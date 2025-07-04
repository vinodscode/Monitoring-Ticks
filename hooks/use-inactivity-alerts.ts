"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { TickData } from "./use-tick-data"
import { getInstrumentName } from "@/components/market-data-grid"
import { shouldAlertsBeActive, getDetailedMarketStatus } from "@/utils/market-timings"

export interface InactivityAlertConfig {
  enabled: boolean
  deviation: number
  duration: number // in seconds
  respectMarketHours: boolean // New field to control market hours respect
}

export interface InactivityAlert {
  id: string
  instrumentToken: number
  instrumentName: string
  timestamp: number
  duration: number
  deviation: number
  baselinePrice: number // The price that remained static
  currentPrice: number // The price at the time of alert
  priceRange: { min: number; max: number } // Price range during the inactivity period
  marketSession: string // Which market session the alert occurred in
  marketType: string // Type of market (equity, currency, commodity)
}

interface SymbolState {
  baselinePrice: number
  timerId: NodeJS.Timeout | null
  priceHistory: { price: number; timestamp: number }[] // Track price history during monitoring
  lastMarketStatusCheck: number // Timestamp of last market status check
  wasMarketOpen: boolean // Previous market status
  oscillator: OscillatorNode | null // Store the active oscillator for continuous sound
  gainNode: GainNode | null // Store the gain node to control volume
}

const DEFAULT_CONFIG: InactivityAlertConfig = {
  enabled: false,
  deviation: 0.1,
  duration: 30,
  respectMarketHours: true, // Default to respecting market hours
}

export function useInactivityAlerts(ticks: TickData[]) {
  const [configurations, setConfigurations] = useState<Map<number, InactivityAlertConfig>>(new Map())
  const [alerts, setAlerts] = useState<InactivityAlert[]>([])
  const [inactiveSymbols, setInactiveSymbols] = useState<Set<number>>(new Set())
  const symbolStates = useRef<Map<number, SymbolState>>(new Map())
  const audioContextRef = useRef<AudioContext | null>(null)

  // Initialize AudioContext on first user interaction (or attempt to)
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        } catch (e) {
          console.error("Web Audio API is not supported in this browser")
        }
      }
      window.removeEventListener("click", initAudio)
    }
    window.addEventListener("click", initAudio)
    return () => window.removeEventListener("click", initAudio)
  }, [])

  const stopAlertSound = useCallback((instrumentToken: number) => {
    const state = symbolStates.current.get(instrumentToken)
    if (state?.oscillator) {
      try {
        state.oscillator.stop()
        state.oscillator.disconnect()
        state.gainNode?.disconnect()
      } catch (e) {
        console.warn("Error stopping oscillator:", e)
      } finally {
        state.oscillator = null
        state.gainNode = null
      }
    }
  }, [])

  const playAlertSound = useCallback(
    (instrumentToken: number) => {
      if (!audioContextRef.current) return

      const ctx = audioContextRef.current
      if (ctx.state === "suspended") {
        ctx.resume()
      }

      // Stop any existing sound for this instrument first
      stopAlertSound(instrumentToken)

      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(440, ctx.currentTime) // A4 note
      gainNode.gain.setValueAtTime(0.5, ctx.currentTime) // Full volume

      oscillator.start(ctx.currentTime)

      // Store the oscillator and gainNode in the symbol state
      const state = symbolStates.current.get(instrumentToken)
      if (state) {
        state.oscillator = oscillator
        state.gainNode = gainNode
      }
    },
    [stopAlertSound],
  )

  const showBrowserNotification = useCallback((alert: InactivityAlert) => {
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notification")
      return
    }
    if (Notification.permission === "granted") {
      new Notification(`Inactivity Alert: ${alert.instrumentName}`, {
        body: `Price remained around ₹${alert.baselinePrice.toFixed(2)} (±${alert.deviation.toFixed(2)}) for ${alert.duration} seconds during ${alert.marketSession} session.`,
        icon: "/favicon.ico",
        tag: `inactivity-${alert.instrumentToken}`,
      })
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          showBrowserNotification(alert)
        }
      })
    }
  }, [])

  const triggerAlert = useCallback(
    (tick: TickData, config: InactivityAlertConfig, state: SymbolState) => {
      // Get current market status for this instrument
      const instrumentName = getInstrumentName(tick)
      const marketStatus = getDetailedMarketStatus(instrumentName)

      // Calculate price range during the inactivity period
      const prices = state.priceHistory.map((h) => h.price)
      const priceRange = {
        min: Math.min(...prices),
        max: Math.max(...prices),
      }

      const newAlert: InactivityAlert = {
        id: crypto.randomUUID(),
        instrumentToken: tick.instrument_token,
        instrumentName,
        timestamp: Date.now(),
        duration: config.duration,
        deviation: config.deviation,
        baselinePrice: state.baselinePrice,
        currentPrice: tick.last_price,
        priceRange,
        marketSession: marketStatus.session,
        marketType: marketStatus.marketType,
      }

      setAlerts((prev) => [newAlert, ...prev].slice(0, 100))
      setInactiveSymbols((prev) => new Set(prev).add(tick.instrument_token))
      playAlertSound(tick.instrument_token) // Play continuous sound
      showBrowserNotification(newAlert)
    },
    [playAlertSound, showBrowserNotification],
  )

  const resetInactivityTimer = useCallback(
    (tick: TickData, config: InactivityAlertConfig, state: SymbolState) => {
      if (state.timerId) clearTimeout(state.timerId)

      // Reset price history when starting new monitoring period
      state.priceHistory = [{ price: tick.last_price, timestamp: Date.now() }]

      state.timerId = setTimeout(() => {
        // Double-check market status before triggering alert
        const instrumentName = getInstrumentName(tick)
        const shouldAlert = config.respectMarketHours ? shouldAlertsBeActive(instrumentName) : true

        if (shouldAlert) {
          triggerAlert(tick, config, state)
        } else {
          // Market closed during monitoring period, clear the alert state and stop sound
          console.log(`Market closed for ${instrumentName}, clearing alert state`)
          stopAlertSound(tick.instrument_token) // Stop sound if market closes
          clearSymbolState(tick.instrument_token) // This will also clear the inactive symbol
        }
      }, config.duration * 1000)
    },
    [triggerAlert, stopAlertSound],
  )

  const clearSymbolState = useCallback(
    (token: number) => {
      const state = symbolStates.current.get(token)
      if (state?.timerId) clearTimeout(state.timerId)
      stopAlertSound(token) // Stop sound when clearing state
      symbolStates.current.delete(token)
      setInactiveSymbols((prev) => {
        if (prev.has(token)) {
          const newSet = new Set(prev)
          newSet.delete(token)
          return newSet
        }
        return prev
      })
    },
    [stopAlertSound],
  )

  useEffect(() => {
    const latestTicks = new Map<number, TickData>()
    for (const tick of ticks) {
      if (
        !latestTicks.has(tick.instrument_token) ||
        tick.receivedAt > latestTicks.get(tick.instrument_token)!.receivedAt
      ) {
        latestTicks.set(tick.instrument_token, tick)
      }
    }

    latestTicks.forEach((tick) => {
      const config = configurations.get(tick.instrument_token)
      if (!config || !config.enabled) {
        clearSymbolState(tick.instrument_token)
        return
      }

      // Check if alerts should be active for this instrument based on market hours
      const instrumentName = getInstrumentName(tick)
      const shouldAlert = config.respectMarketHours ? shouldAlertsBeActive(instrumentName) : true

      let state = symbolStates.current.get(tick.instrument_token)
      if (!state) {
        state = {
          baselinePrice: tick.last_price,
          timerId: null,
          priceHistory: [{ price: tick.last_price, timestamp: Date.now() }],
          lastMarketStatusCheck: Date.now(),
          wasMarketOpen: shouldAlert,
          oscillator: null, // Initialize oscillator to null
          gainNode: null, // Initialize gainNode to null
        }
        symbolStates.current.set(tick.instrument_token, state)
        if (shouldAlert) {
          resetInactivityTimer(tick, config, state)
        }
        return
      }

      // Check if market status changed (from closed to open or vice versa)
      const now = Date.now()
      if (now - state.lastMarketStatusCheck > 60000) {
        // Check every minute
        state.lastMarketStatusCheck = now
        if (state.wasMarketOpen !== shouldAlert) {
          state.wasMarketOpen = shouldAlert
          if (shouldAlert) {
            // Market just opened, reset monitoring
            state.baselinePrice = tick.last_price
            resetInactivityTimer(tick, config, state)
            // Clear from inactive symbols as we're starting fresh
            if (inactiveSymbols.has(tick.instrument_token)) {
              setInactiveSymbols((prev) => {
                const newSet = new Set(prev)
                newSet.delete(tick.instrument_token)
                return newSet
              })
            }
            stopAlertSound(tick.instrument_token) // Ensure sound is stopped if market just opened
            return
          } else {
            // Market just closed, stop sound and clear timer
            stopAlertSound(tick.instrument_token)
            if (state.timerId) {
              clearTimeout(state.timerId)
              state.timerId = null
            }
            return // Do not process further if market is now closed
          }
        }
      }

      // If market is currently closed and alerts respect market hours, do nothing
      if (!shouldAlert && config.respectMarketHours) {
        stopAlertSound(tick.instrument_token) // Ensure sound is stopped if market is closed
        if (state.timerId) {
          clearTimeout(state.timerId)
          state.timerId = null
        }
        return
      }

      // Add current price to history
      state.priceHistory.push({ price: tick.last_price, timestamp: Date.now() })

      // Keep only recent history (last 100 entries or last 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      state.priceHistory = state.priceHistory.filter((h) => h.timestamp > fiveMinutesAgo).slice(-100)

      const priceMoved = Math.abs(tick.last_price - state.baselinePrice) > config.deviation
      if (priceMoved) {
        state.baselinePrice = tick.last_price
        resetInactivityTimer(tick, config, state)
        if (inactiveSymbols.has(tick.instrument_token)) {
          setInactiveSymbols((prev) => {
            const newSet = new Set(prev)
            newSet.delete(tick.instrument_token)
            return newSet
          })
        }
        stopAlertSound(tick.instrument_token) // Stop sound when price moves
      }
    })
  }, [ticks, configurations, resetInactivityTimer, clearSymbolState, inactiveSymbols, stopAlertSound])

  const updateConfiguration = useCallback(
    (token: number, config: InactivityAlertConfig) => {
      setConfigurations((prev) => new Map(prev).set(token, config))
      // When config changes, reset the state for that symbol to start fresh
      clearSymbolState(token)
    },
    [clearSymbolState],
  )

  const clearAllAlerts = useCallback(() => {
    setAlerts([])
    // Stop all active sounds
    symbolStates.current.forEach((_, token) => {
      stopAlertSound(token)
    })
    setInactiveSymbols(new Set()) // Also clear inactive symbols from UI
  }, [stopAlertSound])

  return { alerts, inactiveSymbols, configurations, updateConfiguration, clearAllAlerts }
}
