"use client"

import { AlertTriangle, Activity, Clock, Bell, Bug, Play, TestTube, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { TickData, Alert as AlertType } from "@/hooks/use-tick-data"
import { findAvailableEndpoints } from "@/utils/endpoint-tester"
import { useState } from "react"

interface DebugDashboardProps {
  ticks: TickData[]
  isConnected: boolean
  isFrozen: boolean
  lastTickTime: number | null
  averageDelay: number
  totalTicks: number
  freezingIncidents: number
  alerts: AlertType[]
  connectionStatus: string
  clearAlerts: () => void
  rawMessages: string[]
  debugInfo: string[]
  addTestTick?: (data: string) => void
  addDebugInfo?: (data: string) => void
}

export function DebugDashboard({
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
  rawMessages,
  debugInfo,
  addTestTick,
  addDebugInfo,
}: DebugDashboardProps) {
  const [endpointResults, setEndpointResults] = useState<any[]>([])

  const handleAddTestTick = () => {
    const testTick = {
      instrument_token: 12345,
      last_price: Math.random() * 1000 + 100,
      volume_traded: Math.floor(Math.random() * 10000),
      average_traded_price: Math.random() * 1000 + 100,
      last_traded_quantity: Math.floor(Math.random() * 100),
      timestamp: new Date().toISOString(),
      tradingsymbol: "TEST",
    }

    if (addTestTick) {
      addTestTick(JSON.stringify([testTick]))
    }
  }

  const testDirectConnection = async () => {
    try {
      console.log("🧪 Testing direct fetch to endpoint...")
      const response = await fetch("https://ticks.rvinod.com/ticks", {
        headers: {
          Accept: "text/event-stream",
        },
      })

      console.log("📡 Response status:", response.status)
      console.log("📡 Response headers:", Object.fromEntries(response.headers.entries()))

      if (response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        for (let i = 0; i < 3; i++) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          console.log(`📦 Chunk ${i + 1}:`, chunk)
        }

        reader.releaseLock()
      }
    } catch (error) {
      console.error("❌ Direct fetch error:", error)
    }
  }

  const testUpstoxDirectConnection = async () => {
    try {
      console.log("🧪 Testing direct fetch to Upstox endpoint...")
      const response = await fetch("https://ticks.rvinod.com/upstox", {
        headers: {
          Accept: "text/event-stream",
        },
      })

      console.log("📡 Upstox Response status:", response.status)
      console.log("📡 Upstox Response headers:", Object.fromEntries(response.headers.entries()))

      if (response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        for (let i = 0; i < 3; i++) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          console.log(`📦 Upstox Chunk ${i + 1}:`, chunk)
        }

        reader.releaseLock()
      }
    } catch (error) {
      console.error("❌ Upstox Direct fetch error:", error)
    }
  }

  const checkPriceTrends = () => {
    console.log("🔍 PRICE TREND ANALYSIS:")

    // Group ticks by instrument
    const instrumentGroups = ticks.reduce(
      (acc, tick) => {
        if (!acc[tick.instrument_token]) {
          acc[tick.instrument_token] = []
        }
        acc[tick.instrument_token].push(tick)
        return acc
      },
      {} as Record<number, TickData[]>,
    )

    Object.entries(instrumentGroups).forEach(([token, instrumentTicks]) => {
      const sortedTicks = instrumentTicks.sort((a, b) => a.timestamp - b.timestamp)
      if (sortedTicks.length >= 2) {
        const firstPrice = sortedTicks[0].last_price
        const lastPrice = sortedTicks[sortedTicks.length - 1].last_price
        const change = lastPrice - firstPrice
        const changePercent = (change / firstPrice) * 100

        console.log(`Token ${token}:`, {
          tickCount: sortedTicks.length,
          firstPrice,
          lastPrice,
          change: change.toFixed(4),
          changePercent: changePercent.toFixed(4) + "%",
          priceHistory: sortedTicks.slice(-5).map((t) => t.last_price),
        })
      }
    })

    if (addDebugInfo) {
      addDebugInfo("✅ Price trend analysis completed - check console for details")
    }
  }

  const checkDataAuthenticity = () => {
    console.log("🔍 REAL DATA VERIFICATION:")
    console.log("📡 Endpoint:", "https://ticks.rvinod.com/ticks")
    console.log("📊 Recent raw messages:", rawMessages.slice(0, 3))

    const recentTicks = ticks.slice(0, 5)
    console.log("🎯 Real vs Processed comparison:")

    recentTicks.forEach((tick, i) => {
      try {
        const rawData = JSON.parse(tick.raw_data || "{}")
        console.log(`Tick ${i + 1}:`, {
          instrument_token: tick.instrument_token,
          raw_last_price: rawData.last_price,
          displayed_last_price: tick.last_price,
          raw_volume: rawData.volume_traded,
          displayed_volume: tick.volume,
          is_authentic: rawData.last_price === tick.last_price,
          tradingsymbol: tick.tradingsymbol || "Not provided",
        })
      } catch (e) {
        console.log(`Tick ${i + 1}: Error parsing raw data`)
      }
    })

    if (addDebugInfo) {
      addDebugInfo("✅ Real data verification completed - check console for details")
    }
  }

  const testAllEndpoints = async () => {
    addDebugInfo?.("Testing all available endpoints...")
    try {
      const results = await findAvailableEndpoints()
      setEndpointResults(results)
      addDebugInfo?.(
        `Endpoint test completed. Found ${results.filter((r) => r.result.available).length} available endpoints`,
      )

      results.forEach((result) => {
        const status = result.result.available ? "✅ Available" : "❌ Unavailable"
        addDebugInfo?.(`${result.name}: ${status} (${result.result.status || result.result.error})`)
      })
    } catch (error) {
      addDebugInfo?.(`Endpoint testing failed: ${error}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Connection Status Alert */}
      {!isConnected && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Connection Status: {connectionStatus}</AlertDescription>
        </Alert>
      )}

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="w-5 h-5" />
            Connection Tests
          </CardTitle>
          <CardDescription>Test the connection and add sample data</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <Button onClick={handleAddTestTick} variant="outline">
            <Play className="w-4 h-4 mr-2" />
            Add Test Tick
          </Button>
          <Button onClick={testDirectConnection} variant="outline">
            <Bug className="w-4 h-4 mr-2" />
            Test Direct Fetch
          </Button>
          <Button onClick={testUpstoxDirectConnection} variant="outline">
            <Bug className="w-4 h-4 mr-2" />
            Test Upstox Direct
          </Button>
          <Button onClick={() => window.open("https://ticks.rvinod.com/ticks", "_blank")} variant="outline">
            <Activity className="w-4 h-4 mr-2" />
            Open SSE in New Tab
          </Button>
          <Button onClick={() => window.open("https://ticks.rvinod.com/upstox", "_blank")} variant="outline">
            <Activity className="w-4 h-4 mr-2" />
            Open Upstox SSE
          </Button>
          <Button onClick={checkDataAuthenticity} variant="outline">
            <Bug className="w-4 h-4 mr-2" />
            Check Data Authenticity
          </Button>
          <Button onClick={checkPriceTrends} variant="outline">
            <TrendingUp className="w-4 h-4 mr-2" />
            Analyze Price Trends
          </Button>
          <Button onClick={testAllEndpoints} variant="outline">
            <Bug className="w-4 h-4 mr-2" />
            Test All Endpoints
          </Button>
        </CardContent>
      </Card>

      {endpointResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Endpoint Availability Test</CardTitle>
            <CardDescription>Results of testing various endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {endpointResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{result.name}</span>
                    <span className="text-sm text-gray-500 ml-2">{result.url}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${result.result.available ? "text-green-600" : "text-red-600"}`}>
                      {result.result.available ? "✅ Available" : "❌ Unavailable"}
                    </span>
                    {result.result.status && <span className="text-xs text-gray-500">({result.result.status})</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ticks</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Last tick:{" "}
              {lastTickTime
                ? new Date(lastTickTime).toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour12: false,
                  })
                : "Never"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Delay</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageDelay.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">{averageDelay > 1000 ? "High delay detected" : "Normal"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Freezing Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{freezingIncidents}</div>
            <p className="text-xs text-muted-foreground">{isFrozen ? "Currently frozen" : "Active"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
            <p className="text-xs text-muted-foreground">{alerts.length > 0 ? "Requires attention" : "All clear"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Debug Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5" />
              Debug Log
            </CardTitle>
            <CardDescription>Real-time connection and processing information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-3 rounded text-sm font-mono max-h-96 overflow-y-auto space-y-1">
              {debugInfo.length > 0 ? (
                debugInfo.map((info, i) => (
                  <div key={i} className="text-xs">
                    {info}
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground">No debug information yet...</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Raw Messages</CardTitle>
            <CardDescription>Raw SSE data received from the stream</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-3 rounded text-sm font-mono max-h-96 overflow-y-auto space-y-1">
              {rawMessages.length > 0 ? (
                rawMessages.map((msg, i) => (
                  <div key={i} className="text-xs break-all">
                    {msg}
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground">No messages received yet...</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Tick Data */}
      <Card>
        <CardHeader>
          <CardTitle>Current Tick Data</CardTitle>
          <CardDescription>Most recent ticks processed ({ticks.length} total)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-3 rounded text-sm font-mono max-h-64 overflow-y-auto">
            {ticks.length > 0 ? (
              ticks.slice(0, 10).map((tick, i) => (
                <div key={tick.id} className="mb-2 pb-2 border-b border-border last:border-b-0">
                  <div className="text-xs">
                    #{i + 1} - {tick.tradingsymbol || `TOKEN_${tick.instrument_token}`}: ₹{tick.last_price}, Vol:{" "}
                    {tick.volume}
                  </div>
                  <div className="text-xs text-muted-foreground">Raw: {tick.raw_data}</div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">No tick data processed yet</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
