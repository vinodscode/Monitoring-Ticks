"use client"

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, TrendingUp, TrendingDown, Minus, Wifi, WifiOff, AlertTriangle } from "lucide-react"
import type { TickData } from "@/hooks/use-tick-data"
import type { UpstoxTickData } from "@/hooks/use-upstox-tick-data"

interface ComparisonDashboardProps {
  kiteTicks: TickData[]
  upstoxTicks: UpstoxTickData[]
  kiteConnected: boolean
  upstoxConnected: boolean
}

interface InstrumentPair {
  id: string
  name: string
  kiteSymbol: string
  upstoxSymbol: string
  kiteToken?: number
  category: string
}

const INSTRUMENT_PAIRS: InstrumentPair[] = [
  {
    id: "bhel",
    name: "BHEL (NSE)",
    kiteSymbol: "BHEL",
    upstoxSymbol: "NSE_EQ|INE257A01026",
    kiteToken: 281836549,
    category: "Equity"
  },
  {
    id: "reliance",
    name: "RELIANCE",
    kiteSymbol: "RELIANCE",
    upstoxSymbol: "BSE_EQ|INE002A01018",
    kiteToken: 128083204,
    category: "Equity"
  },
  {
    id: "crude",
    name: "CRUDE OIL Future (July)",
    kiteSymbol: "CRUDEOIL25JULFUT",
    upstoxSymbol: "MCX_FO|447552",
    kiteToken: 134657,
    category: "Commodity"
  },
  {
    id: "usdinr",
    name: "USD/INR Future (July)",
    kiteSymbol: "USDINR25JULFUT",
    upstoxSymbol: "NCD_FO|1229",
    kiteToken: 408065,
    category: "Currency"
  },
  {
    id: "sensex",
    name: "SENSEX Future (July)",
    kiteSymbol: "SENSEX25708FUT",
    upstoxSymbol: "BSE_FO|824914",
    kiteToken: 265,
    category: "Index"
  },
  {
    id: "nifty",
    name: "NIFTY Future (July)",
    kiteSymbol: "NIFTY25JULFUT",
    upstoxSymbol: "NSE_FO|53216",
    kiteToken: 256265,
    category: "Index"
  }
]

interface ComparisonData {
  kitePrice: number | null
  upstoxPrice: number | null
  kitePriceTime: number | null
  upstoxPriceTime: number | null
  priceDifference: number | null
  percentageDifference: number | null
  kiteDelay: number
  upstoxDelay: number
  kiteChange: number
  upstoxChange: number
  lastUpdate: number
}

export function ComparisonDashboard({ kiteTicks, upstoxTicks, kiteConnected, upstoxConnected }: ComparisonDashboardProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [previousPrices, setPreviousPrices] = useState<Record<string, { kite: number | null, upstox: number | null }>>({})

  // Auto-refresh every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1)
      setLastRefresh(Date.now())
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const comparisonData = useMemo(() => {
    const data: Record<string, ComparisonData> = {}

    INSTRUMENT_PAIRS.forEach(pair => {
      // Find latest Kite data
      let kiteData: TickData | null = null
      if (pair.kiteToken) {
        const kiteMatches = kiteTicks.filter(tick => tick.instrument_token === pair.kiteToken)
        kiteData = kiteMatches.length > 0 ? kiteMatches[0] : null
      }

      // Find latest Upstox data
      const upstoxMatches = upstoxTicks.filter(tick => tick.instrument_token === pair.upstoxSymbol)
      const upstoxData = upstoxMatches.length > 0 ? upstoxMatches[0] : null

      const kitePrice = kiteData?.last_price || null
      const upstoxPrice = upstoxData?.last_price || null
      
      let priceDifference: number | null = null
      let percentageDifference: number | null = null

      if (kitePrice !== null && upstoxPrice !== null) {
        priceDifference = kitePrice - upstoxPrice
        percentageDifference = upstoxPrice !== 0 ? (priceDifference / upstoxPrice) * 100 : 0
      }

      // Calculate price changes
      const prevPrices = previousPrices[pair.id] || { kite: null, upstox: null }
      const kiteChange = (kitePrice !== null && prevPrices.kite !== null) ? kitePrice - prevPrices.kite : 0
      const upstoxChange = (upstoxPrice !== null && prevPrices.upstox !== null) ? upstoxPrice - prevPrices.upstox : 0

      data[pair.id] = {
        kitePrice,
        upstoxPrice,
        kitePriceTime: kiteData?.timestamp || null,
        upstoxPriceTime: upstoxData?.timestamp || null,
        priceDifference,
        percentageDifference,
        kiteDelay: kiteData?.delay || 0,
        upstoxDelay: upstoxData?.delay || 0,
        kiteChange,
        upstoxChange,
        lastUpdate: Math.max(kiteData?.receivedAt || 0, upstoxData?.receivedAt || 0)
      }
    })

    return data
  }, [kiteTicks, upstoxTicks, refreshKey, previousPrices])

  // Update previous prices for change calculation
  useEffect(() => {
    const newPreviousPrices: Record<string, { kite: number | null, upstox: number | null }> = {}
    Object.entries(comparisonData).forEach(([pairId, data]) => {
      newPreviousPrices[pairId] = {
        kite: data.kitePrice,
        upstox: data.upstoxPrice
      }
    })
    setPreviousPrices(newPreviousPrices)
  }, [comparisonData])

  const formatPrice = (price: number | null) => {
    if (price === null) return "N/A"
    return new Intl.NumberFormat("en-IN", { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(price)
  }

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return "N/A"
    return new Date(timestamp).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
  }

  const formatDelay = (delay: number) => {
    if (delay === 0) return "N/A"
    if (delay < 1000) return `${delay}ms`
    if (delay < 60000) return `${(delay / 1000).toFixed(1)}s`
    return `${(delay / 60000).toFixed(1)}m`
  }

  const getDifferenceColor = (diff: number | null) => {
    if (diff === null) return "text-gray-500"
    if (Math.abs(diff) < 0.01) return "text-gray-500"
    if (diff > 0) return "text-green-600"
    if (diff < 0) return "text-red-600"
    return "text-gray-500"
  }

  const getDifferenceIcon = (diff: number | null) => {
    if (diff === null || Math.abs(diff) < 0.01) return <Minus className="w-4 h-4" />
    if (diff > 0) return <TrendingUp className="w-4 h-4" />
    if (diff < 0) return <TrendingDown className="w-4 h-4" />
    return <Minus className="w-4 h-4" />
  }

  const getChangeColor = (change: number) => {
    if (Math.abs(change) < 0.01) return "text-gray-500"
    return change > 0 ? "text-green-600" : "text-red-600"
  }

  const getDataAge = (timestamp: number | null) => {
    if (!timestamp) return null
    const ageMs = Date.now() - timestamp
    if (ageMs < 60000) return `${Math.floor(ageMs / 1000)}s ago`
    if (ageMs < 3600000) return `${Math.floor(ageMs / 60000)}m ago`
    return `${Math.floor(ageMs / 3600000)}h ago`
  }

  const handleRefreshCard = (pairId: string) => {
    setRefreshKey(prev => prev + 1)
    setLastRefresh(Date.now())
  }

  const handleRefreshAll = () => {
    setRefreshKey(prev => prev + 1)
    setLastRefresh(Date.now())
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Real-time Price Comparison</h2>
          <p className="text-sm text-gray-500">Kite vs Upstox LTP comparison across different instruments</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {kiteConnected ? <Wifi className="w-4 h-4 text-green-600" /> : <WifiOff className="w-4 h-4 text-red-600" />}
              <span className="text-sm font-medium">Kite</span>
              <Badge variant={kiteConnected ? "default" : "destructive"} className="text-xs">
                {kiteConnected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {upstoxConnected ? <Wifi className="w-4 h-4 text-green-600" /> : <WifiOff className="w-4 h-4 text-red-600" />}
              <span className="text-sm font-medium">Upstox</span>
              <Badge variant={upstoxConnected ? "default" : "destructive"} className="text-xs">
                {upstoxConnected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </div>
          <Button onClick={handleRefreshAll} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh All
          </Button>
        </div>
      </div>

      {/* Connection Status Alert */}
      {(!kiteConnected || !upstoxConnected) && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <div className="text-sm text-yellow-800">
            <span className="font-medium">Connection Issue:</span> 
            {!kiteConnected && !upstoxConnected && " Both Kite and Upstox feeds are disconnected."}
            {!kiteConnected && upstoxConnected && " Kite feed is disconnected."}
            {kiteConnected && !upstoxConnected && " Upstox feed is disconnected."}
            {" "}Price comparisons may be incomplete.
          </div>
        </div>
      )}

      {/* Comparison Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {INSTRUMENT_PAIRS.map(pair => {
          const data = comparisonData[pair.id]
          const hasData = data.kitePrice !== null || data.upstoxPrice !== null
          const hasBothData = data.kitePrice !== null && data.upstoxPrice !== null
          const isStale = data.lastUpdate > 0 && (Date.now() - data.lastUpdate) > 300000 // 5 minutes
          
          return (
            <Card key={pair.id} className={`${!hasData ? 'opacity-60' : ''} ${isStale ? 'border-orange-300' : ''} hover:shadow-lg transition-all duration-300`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{pair.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {pair.category}
                      </Badge>
                      {isStale && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                          Stale Data
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRefreshCard(pair.id)}
                    className="h-8 w-8"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Price Comparison */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-blue-600">Kite</div>
                    <div className="text-2xl font-bold">
                      ₹{formatPrice(data.kitePrice)}
                    </div>
                    {data.kiteChange !== 0 && (
                      <div className={`text-sm font-medium ${getChangeColor(data.kiteChange)}`}>
                        {data.kiteChange > 0 ? "+" : ""}{data.kiteChange.toFixed(2)}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {formatTime(data.kitePriceTime)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Delay: {formatDelay(data.kiteDelay)}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-purple-600">Upstox</div>
                    <div className="text-2xl font-bold">
                      ₹{formatPrice(data.upstoxPrice)}
                    </div>
                    {data.upstoxChange !== 0 && (
                      <div className={`text-sm font-medium ${getChangeColor(data.upstoxChange)}`}>
                        {data.upstoxChange > 0 ? "+" : ""}{data.upstoxChange.toFixed(2)}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {formatTime(data.upstoxPriceTime)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Delay: {formatDelay(data.upstoxDelay)}
                    </div>
                  </div>
                </div>

                {/* Price Difference */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Price Difference</span>
                    <div className={`flex items-center gap-1 ${getDifferenceColor(data.priceDifference)}`}>
                      {getDifferenceIcon(data.priceDifference)}
                      <span className="font-bold">
                        {data.priceDifference !== null ? 
                          `₹${Math.abs(data.priceDifference).toFixed(2)}` : 
                          "N/A"
                        }
                      </span>
                    </div>
                  </div>
                  
                  {data.percentageDifference !== null && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm text-gray-500">Percentage</span>
                      <span className={`text-sm font-medium ${getDifferenceColor(data.priceDifference)}`}>
                        {data.percentageDifference > 0 ? "+" : ""}
                        {data.percentageDifference.toFixed(4)}%
                      </span>
                    </div>
                  )}
                  
                  {hasBothData && Math.abs(data.priceDifference || 0) > 1 && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                      <span className="font-medium">Significant difference detected!</span>
                    </div>
                  )}
                </div>

                {/* Symbol Information */}
                <div className="border-t pt-3 space-y-1">
                  <div className="text-xs text-gray-500">
                    <span className="font-medium">Kite:</span> {pair.kiteSymbol}
                  </div>
                  <div className="text-xs text-gray-500">
                    <span className="font-medium">Upstox:</span> {pair.upstoxSymbol}
                  </div>
                </div>

                {/* Data Status */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${data.kitePrice !== null ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span>Kite Data</span>
                    {data.kitePriceTime && (
                      <span className="text-gray-400">({getDataAge(data.kitePriceTime)})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${data.upstoxPrice !== null ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span>Upstox Data</span>
                    {data.upstoxPriceTime && (
                      <span className="text-gray-400">({getDataAge(data.upstoxPriceTime)})</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Summary Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Object.values(comparisonData).filter(d => d.kitePrice !== null).length}
              </div>
              <div className="text-sm text-gray-500">Kite Instruments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Object.values(comparisonData).filter(d => d.upstoxPrice !== null).length}
              </div>
              <div className="text-sm text-gray-500">Upstox Instruments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(comparisonData).filter(d => d.kitePrice !== null && d.upstoxPrice !== null).length}
              </div>
              <div className="text-sm text-gray-500">Both Available</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {Object.values(comparisonData).filter(d => 
                  d.priceDifference !== null && Math.abs(d.priceDifference) > 0.01
                ).length}
              </div>
              <div className="text-sm text-gray-500">Price Differences</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">Last Update</div>
              <div className="text-sm font-medium">
                {formatTime(lastRefresh)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}