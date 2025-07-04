"use client"

import { useState } from "react"
import { Activity, TrendingUp, Wifi, Clock, Settings, Bell, History, Sliders, GitCompare } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MarketDataGrid } from "@/components/market-data-grid"
import { UpstoxMarketDataGrid } from "@/components/upstox-market-data-grid"
import { ComparisonDashboard } from "@/components/comparison-dashboard"
import { DebugDashboard } from "@/components/debug-dashboard"
import { AlertSettingsTab } from "@/components/alert-settings-tab"
import { useTickData } from "@/hooks/use-tick-data"
import { InactivityAlertsLog } from "@/components/inactivity-alerts-log"
import { useUpstoxTickData } from "@/hooks/use-upstox-tick-data"
import { useInactivityAlerts } from "@/hooks/use-inactivity-alerts"

function MarketDashboard() {
  const {
    ticks,
    isConnected,
    isFrozen,
    lastTickTime,
    averageDelay,
    totalTicks,
    freezingIncidents,
    alerts: systemAlerts, // Renamed to avoid conflict
    connectionStatus,
    clearAlerts,
    rawMessages,
    debugInfo,
    addTestTick,
  } = useTickData()

  const {
    ticks: upstoxTicks,
    isConnected: upstoxIsConnected,
    isFrozen: upstoxIsFrozen,
    lastTickTime: upstoxLastTickTime,
    averageDelay: upstoxAverageDelay,
    totalTicks: upstoxTotalTicks,
    freezingIncidents: upstoxFreezingIncidents,
    alerts: upstoxSystemAlerts,
    connectionStatus: upstoxConnectionStatus,
    clearAlerts: upstoxClearAlerts,
    rawMessages: upstoxRawMessages,
    debugInfo: upstoxDebugInfo,
    addTestTick: upstoxAddTestTick,
  } = useUpstoxTickData()

  // ORIGINAL feed
  const {
    alerts: inactivityAlerts,
    inactiveSymbols,
    configurations,
    updateConfiguration,
    clearAllAlerts,
  } = useInactivityAlerts(ticks)

  // UPSTOX feed - need to create a compatible adapter for the hook
  const upstoxTicksForAlerts = upstoxTicks.map((tick) => ({
    ...tick,
    instrument_token: Number.parseInt(tick.instrument_token.replace(/[^0-9]/g, "")) || 0, // Convert string to number for compatibility
  }))

  const {
    alerts: upstoxInactivityAlerts,
    inactiveSymbols: upstoxInactiveSymbols,
    configurations: upstoxConfigurations,
    updateConfiguration: upstoxUpdateConfiguration,
    clearAllAlerts: upstoxClearAllAlerts,
  } = useInactivityAlerts(upstoxTicksForAlerts)

  const [selectedTab, setSelectedTab] = useState("kite")

  // Get unique instruments from both feeds
  const uniqueInstruments = ticks.reduce(
    (acc, tick) => {
      if (!acc.find((t) => t.instrument_token === tick.instrument_token)) {
        acc.push(tick)
      }
      return acc
    },
    [] as typeof ticks,
  )

  const upstoxUniqueInstruments = upstoxTicks.reduce(
    (acc, tick) => {
      if (!acc.find((t) => t.instrument_token === tick.instrument_token)) {
        acc.push(tick)
      }
      return acc
    },
    [] as typeof upstoxTicks,
  )

  const enabledAlertsCount = Array.from(configurations.values()).filter((c) => c.enabled).length
  const upstoxEnabledAlertsCount = Array.from(upstoxConfigurations.values()).filter((c) => c.enabled).length
  const totalEnabledAlerts = enabledAlertsCount + upstoxEnabledAlertsCount

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-500 rounded flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Market Ticks Health Monitor</h1>
              <p className="text-sm text-gray-500">Real-Time Inactivity Alert System</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2"></div>
      </div>

      {/* Main Dashboard */}
      <div className="space-y-6">
        {/* Dashboard Title and Time */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Market Data Dashboard</h2>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-lg font-mono text-gray-900">
              {new Date().toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour12: false,
              })}
            </span>
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Instruments</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {uniqueInstruments.length + upstoxUniqueInstruments.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded">
                  <Wifi className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Connection</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {isConnected && upstoxIsConnected
                      ? "Both Connected"
                      : isConnected || upstoxIsConnected
                        ? "Partial"
                        : "Disconnected"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded">
                  <Bell className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Alerts Enabled</p>
                  <p className="text-2xl font-bold text-gray-900">{totalEnabledAlerts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded">
                  <Activity className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Currently Alerting</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {inactiveSymbols.size + upstoxInactiveSymbols.size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Connection Status Debug */}
        {(!isConnected || !upstoxIsConnected) && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wifi className="w-5 h-5 text-yellow-600" />
                <h3 className="font-medium text-yellow-800">Connection Status</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Kite Feed:</p>
                  <p className={`${isConnected ? "text-green-600" : "text-red-600"}`}>
                    {isConnected ? "✅ Connected" : "❌ Disconnected"} ({connectionStatus})
                  </p>
                  <p className="text-gray-600">Endpoint: https://ticks.rvinod.com/ticks</p>
                </div>
                <div>
                  <p className="font-medium">Upstox Feed:</p>
                  <p className={`${upstoxIsConnected ? "text-green-600" : "text-red-600"}`}>
                    {upstoxIsConnected ? "✅ Connected" : "❌ Disconnected"} ({upstoxConnectionStatus})
                  </p>
                  <p className="text-gray-600">Endpoint: https://ticks.rvinod.com/upstox</p>
                  {upstoxSystemAlerts.length > 0 && (
                    <p className="text-xs text-red-600 mt-1">Latest: {upstoxSystemAlerts[0]?.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className="bg-white border">
            <TabsTrigger value="kite" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Kite
              {uniqueInstruments.length > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-600">
                  {uniqueInstruments.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="upstox" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Upstox
              {upstoxUniqueInstruments.length > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                  {upstoxUniqueInstruments.length}
                </span>
              )}
              {!upstoxIsConnected && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-medium text-red-600">
                  !
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="comparison" className="flex items-center gap-2">
              <GitCompare className="w-4 h-4" />
              Comparison
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-xs font-medium text-orange-600">
                6
              </span>
            </TabsTrigger>
            <TabsTrigger value="alert-settings" className="flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              Alert Settings
              {enabledAlertsCount > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-600">
                  {enabledAlertsCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="inactivity-log" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Alert Log
              {inactivityAlerts.length > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-medium text-red-600">
                  {inactivityAlerts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="debug" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Debug
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kite">
            <MarketDataGrid
              ticks={ticks}
              inactiveSymbols={inactiveSymbols}
              alertConfigurations={configurations}
              onConfigurationChange={updateConfiguration}
            />
          </TabsContent>

          <TabsContent value="upstox">
            <UpstoxMarketDataGrid
              ticks={upstoxTicks}
              inactiveSymbols={new Set(Array.from(upstoxInactiveSymbols).map(String))} // Convert to string set
              alertConfigurations={new Map(Array.from(upstoxConfigurations.entries()).map(([k, v]) => [String(k), v]))} // Convert to string keys
              onConfigurationChange={(token, config) =>
                upstoxUpdateConfiguration(Number.parseInt(token.replace(/[^0-9]/g, "")) || 0, config)
              } // Convert back to number
            />
          </TabsContent>

          <TabsContent value="comparison">
            <ComparisonDashboard
              kiteTicks={ticks}
              upstoxTicks={upstoxTicks}
              kiteConnected={isConnected}
              upstoxConnected={upstoxIsConnected}
            />
          </TabsContent>

          {/* NSE / MCX alert settings */}
          <TabsContent value="alert-settings">
            <AlertSettingsTab
              ticks={ticks}
              alertConfigurations={configurations}
              onConfigurationChange={updateConfiguration}
              inactiveSymbols={inactiveSymbols}
            />
          </TabsContent>

          {/* Alert Log for BOTH feeds (merge arrays) */}
          <TabsContent value="inactivity-log">
            <InactivityAlertsLog
              alerts={[...inactivityAlerts, ...upstoxInactivityAlerts]}
              onClearAlerts={() => {
                clearAllAlerts()
                upstoxClearAllAlerts()
              }}
            />
          </TabsContent>

          <TabsContent value="debug">
            <DebugDashboard
              ticks={ticks}
              isConnected={isConnected}
              isFrozen={isFrozen}
              lastTickTime={lastTickTime}
              averageDelay={averageDelay}
              totalTicks={totalTicks}
              freezingIncidents={freezingIncidents}
              alerts={systemAlerts}
              connectionStatus={connectionStatus}
              clearAlerts={clearAlerts}
              rawMessages={rawMessages}
              debugInfo={debugInfo}
              addTestTick={addTestTick}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default MarketDashboard