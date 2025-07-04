"use client"

import { useEffect, useRef, useState, useCallback } from "react"

/* ─────────────────────────  Types  ───────────────────────── */

export interface UpstoxTickData {
  id: string
  instrument_token: string
  last_price: number
  last_quantity: number
  average_price: number
  volume: number
  timestamp: number
  receivedAt: number
  delay: number
  tradingsymbol?: string
  exchange?: string
}

export interface UpstoxAlert {
  id: string
  type: "connection" | "data" | "freeze"
  message: string
  timestamp: number
  severity: "low" | "medium" | "high"
}

/* ───────────────────────  Constants  ─────────────────────── */

const FEED_URL = "https://ticks.rvinod.com/upstox"
const FREEZE_TIMEOUT = 30_000 // 30 s with no ticks ⇒ freeze
const MAX_TICKS = 1_000
const MAX_ALERTS = 50
const MAX_RAW_MESSAGES = 20
const MAX_DEBUG_INFO = 50

/* ────────────────────────  Hook  ─────────────────────────── */

export function useUpstoxTickData() {
  /* ---------- UI-state ---------- */
  const [ticks, setTicks] = useState<UpstoxTickData[]>([])
  const [alerts, setAlerts] = useState<UpstoxAlert[]>([])
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">(
    "disconnected",
  )
  const [isFrozen, setIsFrozen] = useState(false)
  const [lastTickTime, setLastTickTime] = useState<number | null>(null)
  const [totalTicks, setTotalTicks] = useState(0)
  const [freezingIncidents, setFreezingIncidents] = useState(0)
  const [rawMessages, setRawMessages] = useState<string[]>([])
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  /* ---------- refs (no re-render) ---------- */
  const esRef = useRef<EventSource | null>(null)
  const freezeTimer = useRef<NodeJS.Timeout | null>(null)
  const lastTickForInstrument = useRef<Map<string, number>>(new Map())
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectionAttempts = useRef(0)

  /* ---------- helpers ---------- */
  const addDebugInfo = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
    })
    setDebugInfo((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, MAX_DEBUG_INFO - 1)])
    console.log(`🔍 UPSTOX DEBUG: ${message}`)
  }, [])

  const addAlert = (type: UpstoxAlert["type"], message: string, severity: UpstoxAlert["severity"] = "medium") => {
    setAlerts((prev) => [
      { id: crypto.randomUUID(), type, message, severity, timestamp: Date.now() },
      ...prev.slice(0, MAX_ALERTS - 1),
    ])
    addDebugInfo(`Alert [${severity}]: ${message}`)
  }

  const scheduleFreeze = () => {
    if (freezeTimer.current) clearTimeout(freezeTimer.current)
    freezeTimer.current = setTimeout(() => {
      setIsFrozen(true)
      setFreezingIncidents(prev => prev + 1)
      addAlert("freeze", "No Upstox data for 30 s", "high")
    }, FREEZE_TIMEOUT)
  }

  // Add test tick function for debugging
  const addTestTick = useCallback((testData: string) => {
    addDebugInfo(`Adding Upstox test tick: ${testData}`)
    try {
      const payload = JSON.parse(testData)
      const now = Date.now()
      const newTicks: UpstoxTickData[] = []

      // Process test data similar to real data
      if (payload?.type === "live_feed" && payload.feeds) {
        for (const [key, item] of Object.entries<any>(payload.feeds)) {
          const ltpc = item?.ff?.marketFF?.ltpc
          if (!ltpc?.ltp) continue

          const ts = Number(ltpc.ltt ?? now)
          const prev = lastTickForInstrument.current.get(key)
          const delay = prev ? ts - prev : 0
          lastTickForInstrument.current.set(key, ts)

          newTicks.push({
            id: `test-${key}-${ts}`,
            instrument_token: key,
            last_price: Number(ltpc.ltp),
            last_quantity: Number(ltpc.ltq ?? 0),
            average_price: Number(ltpc.cp ?? ltpc.ltp),
            volume: item?.ff?.marketFF?.marketOHLC?.ohlc?.at(-1)?.volume ?? Number(item.volume ?? 0),
            timestamp: ts,
            receivedAt: now,
            delay,
            tradingsymbol: `TEST_${key}`,
            exchange: "TEST"
          })
        }
      }

      if (newTicks.length > 0) {
        setTicks((prev) => [...newTicks, ...prev].slice(0, MAX_TICKS))
        setTotalTicks((prev) => prev + newTicks.length)
        setLastTickTime(Date.now())
        addDebugInfo(`Successfully added ${newTicks.length} Upstox test tick(s)`)
      }
    } catch (error) {
      addDebugInfo(`Error processing Upstox test data: ${error}`)
    }
  }, [addDebugInfo])

  const connectToUpstox = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
    }

    connectionAttempts.current++
    setConnectionStatus("connecting")
    addDebugInfo(`Upstox attempt ${connectionAttempts.current}: Connecting to ${FEED_URL}`)

    try {
      const es = new EventSource(FEED_URL)
      esRef.current = es

      const connectionTimeout = setTimeout(() => {
        if (es.readyState === EventSource.CONNECTING) {
          addDebugInfo("Upstox connection timeout - closing connection")
          es.close()
          addAlert("connection", "Upstox connection timeout", "high")
        }
      }, 15000)

      /* ----- open ----- */
      es.onopen = () => {
        clearTimeout(connectionTimeout)
        setConnectionStatus("connected")
        connectionAttempts.current = 0
        addAlert("connection", "Upstox connected", "low")
        addDebugInfo("Upstox SSE connection opened successfully")
        scheduleFreeze()
      }

      /* ----- message ----- */
      es.onmessage = (e) => {
        scheduleFreeze()
        
        // Store raw message for debugging
        setRawMessages((prev) => [
          `[upstox] ${e.data.substring(0, 100)}...`,
          ...prev.slice(0, MAX_RAW_MESSAGES - 1),
        ])

        try {
          const payload = JSON.parse(e.data)
          addDebugInfo(`Upstox received message type: ${payload?.type}`)

          /* Upstox live_feed */
          if (payload?.type === "live_feed" && payload.feeds) {
            const now = Date.now()
            const newTicks: UpstoxTickData[] = []

            for (const [key, item] of Object.entries<any>(payload.feeds)) {
              const ltpc = item?.ff?.marketFF?.ltpc
              if (!ltpc?.ltp) continue

              const ts = Number(ltpc.ltt ?? now)
              const prev = lastTickForInstrument.current.get(key)
              const delay = prev ? ts - prev : 0
              lastTickForInstrument.current.set(key, ts)

              // Extract exchange and symbol from key
              const [exchange, symbol] = key.split('|')

              newTicks.push({
                id: `${key}-${ts}-${Math.random().toString(36).substr(2, 5)}`,
                instrument_token: key,
                last_price: Number(ltpc.ltp),
                last_quantity: Number(ltpc.ltq ?? 0),
                average_price: Number(ltpc.cp ?? ltpc.ltp),
                volume: item?.ff?.marketFF?.marketOHLC?.ohlc?.at(-1)?.volume ?? Number(item.volume ?? 0),
                timestamp: ts,
                receivedAt: now,
                delay,
                tradingsymbol: symbol || key,
                exchange: exchange || "UNK"
              })
            }

            if (newTicks.length) {
              setTicks((prev) => [...newTicks, ...prev].slice(0, MAX_TICKS))
              setTotalTicks((prev) => prev + newTicks.length)
              setLastTickTime(now)
              setIsFrozen(false)
              addDebugInfo(`Processed ${newTicks.length} Upstox ticks`)
            }
          }
        } catch (err) {
          addAlert("data", `Upstox parse error: ${err}`, "medium")
          addDebugInfo(`Upstox parse error: ${err}`)
        }
      }

      /* ----- error ----- */
      es.onerror = () => {
        clearTimeout(connectionTimeout)
        addDebugInfo(`Upstox SSE error occurred, readyState: ${es.readyState}`)
        
        if (es.readyState === EventSource.CLOSED) {
          setConnectionStatus("error")
          addAlert("connection", "Upstox error – reconnecting", "medium")
          es.close()

          const delay = Math.min(5000 * Math.pow(2, connectionAttempts.current - 1), 30000)
          addDebugInfo(`Upstox reconnecting in ${delay / 1000}s...`)

          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = setTimeout(connectToUpstox, delay)
        }
      }
    } catch (error) {
      addDebugInfo(`Failed to create Upstox SSE connection: ${error}`)
      setConnectionStatus("error")
      addAlert("connection", `Upstox connection failed: ${error}`, "high")
    }
  }, [addAlert, addDebugInfo])

  /* ---------- INIT (runs once) ---------- */
  useEffect(() => {
    connectToUpstox()

    /* cleanup on unmount */
    return () => {
      if (esRef.current) esRef.current.close()
      if (freezeTimer.current) clearTimeout(freezeTimer.current)
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    }
  }, [connectToUpstox])

  /* ---------- derived ---------- */
  const averageDelay = ticks.length === 0 ? 0 : ticks.reduce((s, t) => s + t.delay, 0) / ticks.length

  return {
    ticks,
    averageDelay,
    isConnected: connectionStatus === "connected",
    isFrozen,
    lastTickTime,
    totalTicks,
    freezingIncidents,
    alerts,
    connectionStatus,
    clearAlerts: () => setAlerts([]),
    rawMessages,
    debugInfo,
    addTestTick,
  }
}