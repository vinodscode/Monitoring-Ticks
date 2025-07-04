"use client"

import { useEffect, useRef, useState } from "react"

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
const FREEZE_TIMEOUT = 30_000 // 30 s with no ticks ⇒ freeze
const MAX_TICKS = 1_000
const MAX_ALERTS = 50

/* ────────────────────────  Hook  ─────────────────────────── */

export function useUpstoxTickData() {
  /* ---------- UI-state ---------- */
  const [ticks, setTicks] = useState<UpstoxTickData[]>([])
  const [alerts, setAlerts] = useState<UpstoxAlert[]>([])
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">(
    "disconnected",
  )
  const [isFrozen, setIsFrozen] = useState(false)

  /* ---------- refs (no re-render) ---------- */
  const esRef = useRef<EventSource | null>(null)
  const freezeTimer = useRef<NodeJS.Timeout | null>(null)
  const lastTickForInstrument = useRef<Map<string, number>>(new Map())

  /* ---------- helpers ---------- */
  const addAlert = (type: UpstoxAlert["type"], message: string, severity: UpstoxAlert["severity"] = "medium") =>
    setAlerts((prev) => [
      { id: crypto.randomUUID(), type, message, severity, timestamp: Date.now() },
      ...prev.slice(0, MAX_ALERTS - 1),
    ])

  const scheduleFreeze = () => {
    if (freezeTimer.current) clearTimeout(freezeTimer.current)
    freezeTimer.current = setTimeout(() => {
      setIsFrozen(true)
      addAlert("freeze", "No Upstox data for 30 s", "high")
    }, FREEZE_TIMEOUT)
  }

  /* ---------- INIT (runs once) ---------- */
  useEffect(() => {
    setConnectionStatus("connecting")

    const es = new EventSource(FEED_URL)
    esRef.current = es

    /* ----- open ----- */
    es.onopen = () => {
      setConnectionStatus("connected")
      addAlert("connection", "Upstox connected", "low")
      scheduleFreeze()
    }

    /* ----- message ----- */
    es.onmessage = (e) => {
      scheduleFreeze()
      try {
        const payload = JSON.parse(e.data)

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

            newTicks.push({
              id: `${key}-${ts}`,
              instrument_token: key,
              last_price: Number(ltpc.ltp),
              last_quantity: Number(ltpc.ltq ?? 0),
              average_price: Number(ltpc.cp ?? ltpc.ltp),
              volume: item?.ff?.marketFF?.marketOHLC?.ohlc?.at(-1)?.volume ?? Number(item.volume ?? 0),
              timestamp: ts,
              receivedAt: now,
              delay,
            })
          }

          if (newTicks.length) {
            setTicks((prev) => [...newTicks, ...prev].slice(0, MAX_TICKS))
            setIsFrozen(false)
          }
        }
      } catch (err) {
        addAlert("data", `Parse error: ${err}`, "medium")
      }
    }

    /* ----- error ----- */
    es.onerror = () => {
      setConnectionStatus("error")
      addAlert("connection", "Upstox error – reconnecting", "medium")
      es.close()

      // simple back-off reconnect
      setTimeout(() => {
        setConnectionStatus("connecting")
        esRef.current = new EventSource(FEED_URL)
      }, 5_000)
    }

    /* cleanup on unmount */
    return () => {
      es.close()
      if (freezeTimer.current) clearTimeout(freezeTimer.current)
    }
  }, []) //  ←  empty array ⇒ runs only once

  /* ---------- derived ---------- */
  const averageDelay = ticks.length === 0 ? 0 : ticks.reduce((s, t) => s + t.delay, 0) / ticks.length

  return {
    ticks,
    averageDelay,
    isConnected: connectionStatus === "connected",
    isFrozen,
    alerts,
    connectionStatus,
    clearAlerts: () => setAlerts([]),
  }
}
