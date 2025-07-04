"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { getCurrentMarketStatus, getMarketTypeForInstrument } from "@/utils/market-timings"

export interface TickData {
  id: string
  instrument_token: number
  last_price: number
  volume: number
  average_price: number
  last_quantity: number
  timestamp: number // Timestamp from the tick data itself
  delay: number // Time difference from previous tick for the same instrument
  receivedAt: number // When the tick was received by the client
  raw_data?: string
  tradingsymbol?: string
}

export interface Alert {
  id: string
  type: "freeze" | "delay" | "connection" | "data" | "market"
  message: string
  timestamp: number
  severity: "low" | "medium" | "high"
  instrumentToken?: number // Add this field for instrument-specific alerts
}

const FREEZE_THRESHOLD = 5000
const DELAY_THRESHOLD = 1000 // This threshold now applies to inter-tick delay
const MAX_TICKS_STORED = 200
const MAX_RAW_MESSAGES = 20
const MAX_DEBUG_INFO = 50
const MAX_ALERTS = 20

// Connect directly to the upstream stream
const TICKS_ENDPOINT = "https://ticks.rvinod.com/ticks"

// Store last tick timestamp for each instrument to calculate inter-tick delay
const lastTickTimestamps = new Map<number, number>()

export function useTickData() {
  const [ticks, setTicks] = useState<TickData[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isFrozen, setIsFrozen] = useState(false)
  const [lastTickTime, setLastTickTime] = useState<number | null>(null)
  const [totalTicks, setTotalTicks] = useState(0)
  const [freezingIncidents, setFreezingIncidents] = useState(0)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected")
  const [rawMessages, setRawMessages] = useState<string[]>([])
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const eventSourceRef = useRef<EventSource | null>(null)
  const freezeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectionAttempts = useRef(0)

  const addDebugInfo = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
    })
    setDebugInfo((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, MAX_DEBUG_INFO - 1)])
    console.log(`🔍 DEBUG: ${message}`)
  }, [])

  const addAlert = useCallback(
    (type: Alert["type"], message: string, severity: Alert["severity"] = "medium", instrumentToken?: number) => {
      const alert: Alert = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        message,
        timestamp: Date.now(),
        severity,
        instrumentToken,
      }
      setAlerts((prev) => [alert, ...prev].slice(0, MAX_ALERTS - 1))
      addDebugInfo(`Alert [${severity}]: ${message}`)
    },
    [addDebugInfo],
  )

  const clearAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  const calculateAverageDelay = useCallback((ticksArray: TickData[]) => {
    if (ticksArray.length === 0) return 0
    const recentTicks = ticksArray.slice(-50)
    const totalDelay = recentTicks.reduce((sum, tick) => sum + tick.delay, 0)
    return totalDelay / recentTicks.length
  }, [])

  // Get instrument name for market timing check
  const getInstrumentName = useCallback((instrumentToken: number, tradingsymbol?: string) => {
    if (tradingsymbol) return tradingsymbol

    const tokenMap: Record<number, string> = {
      256265: "NIFTY",
      265: "SENSEX",
      128083204: "RELIANCE",
      281836549: "BHEL",
      408065: "USDINR",
      134657: "CRUDEOIL",
    }
    return tokenMap[instrumentToken] || `TOKEN_${instrumentToken}`
  }, [])

  // Check if market is open for this instrument
  const isMarketOpen = useCallback(
    (instrumentToken: number, tradingsymbol?: string) => {
      const instrumentName = getInstrumentName(instrumentToken, tradingsymbol)
      const marketType = getMarketTypeForInstrument(instrumentName)
      const marketStatus = getCurrentMarketStatus(marketType)
      return marketStatus.isOpen
    },
    [getInstrumentName],
  )

  // Add test tick function for debugging
  const addTestTick = useCallback((testData: string) => {
    addDebugInfo(`Adding test tick: ${testData}`)
    const processedTicks = processTickData(testData, "test")

    if (processedTicks.length > 0) {
      setTicks((prev) => [...processedTicks, ...prev].slice(0, MAX_TICKS_STORED))
      setTotalTicks((prev) => prev + processedTicks.length)
      setLastTickTime(Date.now())
      addDebugInfo(`Successfully added ${processedTicks.length} test tick(s)`)
    }
  }, [])

  const processTickData = useCallback(
    (rawData: string, eventType = "unknown"): TickData[] => {
      const receivedAt = Date.now()
      const processedTicks: TickData[] = []

      try {
        addDebugInfo(`Processing ${eventType} event with data length: ${rawData.length}`)

        // Store raw message for debugging (truncated and limited)
        setRawMessages((prev) => [
          `[${eventType}] ${rawData.substring(0, 100)}...`,
          ...prev.slice(0, MAX_RAW_MESSAGES - 1),
        ])

        // Parse the JSON array from the SSE stream
        const ticksArray = JSON.parse(rawData)
        addDebugInfo(`Successfully parsed JSON array with ${ticksArray.length} ticks`)

        // Process each tick in the array - USE ONLY REAL DATA
        for (const tickData of ticksArray) {
          if (tickData && typeof tickData === "object" && tickData.instrument_token) {
            // Always process ticks regardless of market timing for real-time monitoring
            const marketOpen = isMarketOpen(tickData.instrument_token, tickData.tradingsymbol)

            let tickTimestamp = receivedAt
            if (tickData.timestamp) {
              tickTimestamp = new Date(tickData.timestamp).getTime()
            }

            // Calculate inter-tick delay (difference from previous tick for this instrument)
            const lastTickTimeForInstrument = lastTickTimestamps.get(tickData.instrument_token)
            const interTickDelay = lastTickTimeForInstrument ? tickTimestamp - lastTickTimeForInstrument : 0
            lastTickTimestamps.set(tickData.instrument_token, tickTimestamp)

            const newTick: TickData = {
              id: `${tickData.instrument_token}_${receivedAt}_${Math.random().toString(36).substr(2, 5)}`,
              instrument_token: tickData.instrument_token,
              last_price: tickData.last_price || 0,
              volume: tickData.volume_traded || 0,
              average_price: tickData.average_traded_price || tickData.last_price || 0,
              last_quantity: tickData.last_traded_quantity || 0,
              timestamp: tickTimestamp,
              delay: Math.max(0, interTickDelay), // This is now the inter-tick delay
              receivedAt,
              tradingsymbol: tickData.tradingsymbol || undefined,
            }

            if (newTick.instrument_token) {
              processedTicks.push(newTick)
              if (newTick.instrument_token === 265 || newTick.instrument_token === 408065) {
                addDebugInfo(
                  `Specific Tick: ${newTick.tradingsymbol || newTick.instrument_token} Price: ${newTick.last_price}, Delay: ${newTick.delay}ms`,
                )
              }
            } else {
              addDebugInfo(`❌ Skipped invalid tick: ${JSON.stringify(tickData)}`)
            }
          }
        }

        if (processedTicks.length > 0) {
          addDebugInfo(
            `✅ Successfully processed ${processedTicks.length} ticks (${processedTicks.filter((t) => t.last_price > 0).length} with prices)`,
          )
        }
      } catch (error) {
        addDebugInfo(`Error processing data: ${error}`)
        addAlert("data", `Error processing data: ${error}`, "medium")
      }

      return processedTicks
    },
    [addAlert, addDebugInfo, isMarketOpen],
  )

  const connectToSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    connectionAttempts.current++
    setConnectionStatus("connecting")

    addDebugInfo(`Attempt ${connectionAttempts.current}: Connecting to ${TICKS_ENDPOINT}`)

    try {
      const eventSource = new EventSource(TICKS_ENDPOINT)
      eventSourceRef.current = eventSource

      addDebugInfo(`EventSource created, readyState: ${eventSource.readyState}`)

      const connectionTimeout = setTimeout(() => {
        if (eventSource.readyState === EventSource.CONNECTING) {
          addDebugInfo("Connection timeout - closing connection")
          eventSource.close()
          addAlert("connection", "Connection timeout", "high")
        }
      }, 15000)

      eventSource.onopen = (event) => {
        clearTimeout(connectionTimeout)
        addDebugInfo("SSE connection opened successfully")
        setIsConnected(true)
        setConnectionStatus("connected")
        connectionAttempts.current = 0
        addAlert("connection", "Successfully connected to tick stream", "low")
      }

      eventSource.addEventListener("tick", (event) => {
        const processedTicks = processTickData(event.data, "tick")

        if (processedTicks.length > 0) {
          setTicks((prev) => [...processedTicks, ...prev].slice(0, MAX_TICKS_STORED))
          setTotalTicks((prev) => prev + processedTicks.length)
          setLastTickTime(Date.now())
          setIsFrozen(false)

          // Check for high inter-tick delays
          const highDelayTicks = processedTicks.filter((tick) => tick.delay > DELAY_THRESHOLD)
          if (highDelayTicks.length > 0) {
            addAlert("delay", `${highDelayTicks.length} ticks with high inter-tick delay detected`, "medium")
          }

          if (freezeTimeoutRef.current) {
            clearTimeout(freezeTimeoutRef.current)
          }

          freezeTimeoutRef.current = setTimeout(() => {
            setIsFrozen(true)
            setFreezingIncidents((prev) => prev + 1)
            addAlert("freeze", `No data received for ${FREEZE_THRESHOLD / 1000} seconds`, "high")
          }, FREEZE_THRESHOLD)
        }
      })

      eventSource.onerror = (error) => {
        clearTimeout(connectionTimeout)
        addDebugInfo(`SSE error occurred, readyState: ${eventSource.readyState}`)

        if (eventSource.readyState === EventSource.CLOSED) {
          addDebugInfo("Connection closed, will attempt reconnect")
          setIsConnected(false)
          setConnectionStatus("disconnected")

          const delay = Math.min(5000 * Math.pow(2, connectionAttempts.current - 1), 30000)
          addAlert("connection", `Connection lost. Reconnecting in ${delay / 1000}s...`, "high")

          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = setTimeout(connectToSSE, delay)
        }
      }
    } catch (error) {
      addDebugInfo(`Failed to create SSE connection: ${error}`)
      setConnectionStatus("disconnected")
      addAlert("connection", `Connection failed: ${error}`, "high")
    }
  }, [addAlert, addDebugInfo, processTickData])

  useEffect(() => {
    connectToSSE()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (freezeTimeoutRef.current) {
        clearTimeout(freezeTimeoutRef.current)
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connectToSSE])

  const averageDelay = calculateAverageDelay(ticks)

  return {
    ticks,
    isConnected,
    isFrozen,
    lastTickTime,
    averageDelay,
    totalTicks,
    freezingIncidents,
    alerts,
    connectionStatus,
    clearAlerts,
    addAlert,
    rawMessages,
    debugInfo,
    addTestTick,
  }
}
