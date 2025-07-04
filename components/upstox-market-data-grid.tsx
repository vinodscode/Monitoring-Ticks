"use client"

import { useMemo, useEffect, useState, memo, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Minus, ChevronDown, Clock, Settings } from "lucide-react"
import type { UpstoxTickData } from "@/hooks/use-upstox-tick-data"
import { getCurrentMarketStatus, getMarketTypeForInstrument } from "@/utils/market-timings"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SymbolAlertSettingsDialog } from "./symbol-alert-settings-dialog"
import type { InactivityAlertConfig } from "@/hooks/use-inactivity-alerts"

// --- Helper functions ---
export const getUpstoxInstrumentName = (tick: UpstoxTickData) => {
  if (tick.tradingsymbol) return tick.tradingsymbol
  return tick.instrument_key || tick.instrument_token
}

export const getUpstoxExchange = (tick: UpstoxTickData) => {
  return tick.exchange || "UNK"
}

const formatDelay = (delay: number) => {
  if (delay === 0) return "N/A"
  if (delay < 1000) return `${delay}ms`
  if (delay < 60000) return `${(delay / 1000).toFixed(1)}s`
  return `${(delay / 60000).toFixed(1)}m`
}

interface UpstoxMarketDataGridProps {
  ticks: UpstoxTickData[]
  inactiveSymbols: Set<string>
  alertConfigurations: Map<string, InactivityAlertConfig>
  onConfigurationChange: (token: string, config: InactivityAlertConfig) => void
}

interface UpstoxInstrumentData extends UpstoxTickData {
  marketStatus: { isOpen: boolean; session: string; reason: string }
  trend: { change: number; changePercent: number; direction: "up" | "down" | "neutral" }
  dayTrend: { change: number; changePercent: number; direction: "up" | "down" | "neutral" }
}

// Calculate price trend for Upstox data
const calculateUpstoxPriceTrend = (tick: UpstoxTickData, previousTicks: UpstoxTickData[]) => {
  const instrumentToken = tick.instrument_token
  const currentPrice = tick.last_price

  // Get previous prices for this instrument, sorted by timestamp (oldest first)
  const instrumentTicks = previousTicks
    .filter((t) => t.instrument_token === instrumentToken && t.timestamp < tick.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
    .slice(0, 10) // Last 10 ticks before current

  if (instrumentTicks.length === 0) {
    return { change: 0, changePercent: 0, direction: "neutral" as const }
  }

  // Use the most recent previous price for comparison
  const previousPrice = instrumentTicks[0].last_price

  if (previousPrice <= 0) {
    return { change: 0, changePercent: 0, direction: "neutral" as const }
  }

  // Calculate actual change
  const change = currentPrice - previousPrice
  const changePercent = (change / previousPrice) * 100

  // Determine direction - show even small changes
  let direction: "up" | "down" | "neutral" = "neutral"
  if (change > 0) {
    direction = "up"
  } else if (change < 0) {
    direction = "down"
  }

  return {
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(4)),
    direction,
  }
}

// Memoized Price animation component
const AnimatedPrice = memo(function AnimatedPrice({
  price,
  previousPrice,
  direction,
}: {
  price: number
  previousPrice: number | null
  direction: "up" | "down" | "neutral"
}) {
  const [animationClass, setAnimationClass] = useState("")
  const [textColorClass, setTextColorClass] = useState("")

  useEffect(() => {
    if (previousPrice !== null && price !== previousPrice) {
      const changeDirection = price > previousPrice ? "up" : "down"
      setAnimationClass(`price-bg-flash-${changeDirection}`)
      setTextColorClass(`price-text-flash-${changeDirection}`)
      const timer = setTimeout(() => {
        setAnimationClass("")
        setTextColorClass("")
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [price, previousPrice])

  const formatPrice = (p: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p)

  const getBackgroundColor = () => {
    if (animationClass.includes("up")) return "rgba(34, 197, 94, 0.2)"
    if (animationClass.includes("down")) return "rgba(239, 68, 68, 0.2)"
    if (direction === "up") return "rgba(34, 197, 94, 0.1)"
    if (direction === "down") return "rgba(239, 68, 68, 0.1)"
    return "rgba(156, 163, 175, 0.1)"
  }

  return (
    <div
      className={`inline-block px-4 py-2 rounded-lg text-2xl font-bold transition-colors duration-500 ease-out ${textColorClass}`}
      style={{ backgroundColor: getBackgroundColor() }}
    >
      {formatPrice(price)}
      <style jsx>{`
        .price-bg-flash-up {
          background-color: rgba(34, 197, 94, 0.3) !important;
        }
        .price-bg-flash-down {
          background-color: rgba(239, 68, 68, 0.3) !important;
        }
        .price-text-flash-up {
          color: #22c55e !important;
        }
        .price-text-flash-down {
          color: #ef4444 !important;
        }
      `}</style>
    </div>
  )
})

// Memoized instrument card component
const UpstoxInstrumentCard = memo(function UpstoxInstrumentCard({
  instrument,
  instrumentTickCount,
  previousPrice,
  onShowTrades,
  allTicks,
  isInactive,
  alertConfig,
  onAlertConfigChange,
}: {
  instrument: UpstoxInstrumentData
  instrumentTickCount: number
  previousPrice: number | null
  onShowTrades: () => void
  allTicks: UpstoxTickData[]
  isInactive: boolean
  alertConfig?: InactivityAlertConfig
  onAlertConfigChange: (config: InactivityAlertConfig) => void
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const name = getUpstoxInstrumentName(instrument)
  const exchange = getUpstoxExchange(instrument)
  const { trend, dayTrend, marketStatus } = instrument
  const displayTrend = dayTrend.change !== 0 ? dayTrend : trend

  const formatVolume = (volume: number) => {
    if (volume >= 10000000) return `${(volume / 10000000).toFixed(1)}Cr`
    if (volume >= 100000) return `${(volume / 100000).toFixed(1)}L`
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`
    return volume.toString()
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)

  const cardClassName = `bg-white border transition-all duration-500 hover:shadow-lg ${
    isInactive
      ? "border-orange-500 bg-orange-50 shadow-orange-200 shadow-lg ring-2 ring-orange-400 animate-pulse"
      : "border-gray-200"
  }`

  return (
    <>
      <Card className={cardClassName}>
        <CardContent className="p-4 space-y-4">
          {isInactive && (
            <div className="flex items-center gap-2 p-2 bg-orange-100 border border-orange-200 rounded-lg">
              <Clock className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Price Inactivity Alert!</span>
            </div>
          )}

          {/* Header with Settings Icon */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-gray-900">{name}</h3>
              <span className="text-sm text-gray-500 font-medium">{exchange}</span>
              <Badge
                variant={marketStatus.session === "Open" ? "default" : "secondary"}
                className={`text-xs font-medium ${
                  marketStatus.session === "Open"
                    ? "bg-black text-white hover:bg-gray-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {marketStatus.session}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {!marketStatus.isOpen && (
                <Button variant="outline" size="icon" onClick={() => setIsSettingsOpen(true)} className="title">
                  <Settings className="w-4 h-4 text-gray-600 bg-slate-50" />
                </Button>
              )}
            </div>
          </div>

          {/* Price and Change */}
          <div className="flex items-center justify-between">
            <AnimatedPrice
              price={instrument.last_price}
              previousPrice={previousPrice}
              direction={displayTrend.direction}
            />
            <div className="text-right">
              <div
                className={`text-lg font-medium ${
                  displayTrend.direction === "up"
                    ? "text-green-600"
                    : displayTrend.direction === "down"
                      ? "text-red-600"
                      : "text-gray-500"
                }`}
              >
                {displayTrend.change > 0 ? "+" : ""}
                {displayTrend.change.toFixed(2)}
              </div>
              <div
                className={`text-sm ${
                  displayTrend.direction === "up"
                    ? "text-green-600"
                    : displayTrend.direction === "down"
                      ? "text-red-600"
                      : "text-gray-500"
                }`}
              >
                {displayTrend.changePercent > 0 ? "+" : ""}
                {displayTrend.changePercent.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Vol</span>
              <span className="font-medium">{formatVolume(instrument.volume)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Avg</span>
              <span className="font-medium">{formatPrice(instrument.average_price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">LTQ</span>
              <span className="font-medium">{instrument.last_quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Ticks</span>
              <span className="font-medium">{instrumentTickCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Delay</span>
              <span
                className={`font-medium ${
                  instrument.delay > 1000
                    ? "text-red-600"
                    : instrument.delay > 500
                      ? "text-yellow-600"
                      : "text-green-600"
                }`}
              >
                {formatDelay(instrument.delay)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Alerts</span>
              <span className={`font-medium ${alertConfig?.enabled ? "text-green-600" : "text-gray-400"}`}>
                {alertConfig?.enabled ? "ON" : "OFF"}
              </span>
            </div>
          </div>

          {/* Show More Button */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-blue-500 hover:text-blue-600 hover:bg-blue-50"
            onClick={onShowTrades}
          >
            <span>Show last 10 trades</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
      <SymbolAlertSettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        config={alertConfig}
        onSave={onAlertConfigChange}
        symbolName={name}
      />
    </>
  )
})

export function UpstoxMarketDataGrid({
  ticks,
  inactiveSymbols,
  alertConfigurations,
  onConfigurationChange,
}: UpstoxMarketDataGridProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [previousPrices, setPreviousPrices] = useState<Record<string, number>>({})
  const [selectedInstrument, setSelectedInstrument] = useState<UpstoxInstrumentData | null>(null)
  const stableInstrumentOrder = useRef<string[]>([])

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const instrumentData = useMemo(() => {
    const grouped = new Map<string, UpstoxTickData>()
    const recentTicks = ticks.slice(0, 100)
    for (const tick of recentTicks) {
      const key = tick.instrument_token
      if (!grouped.has(key) || tick.receivedAt > grouped.get(key)!.receivedAt) {
        grouped.set(key, tick)
      }
    }
    const validInstruments = Array.from(grouped.values()).filter((tick) => tick.last_price > 0)
    const currentTokens = validInstruments.map((tick) => tick.instrument_token)
    if (stableInstrumentOrder.current.length === 0) {
      stableInstrumentOrder.current = currentTokens.sort().slice(0, 6)
    } else {
      const newTokens = currentTokens.filter((token) => !stableInstrumentOrder.current.includes(token))
      if (stableInstrumentOrder.current.length < 6) {
        const availableSlots = 6 - stableInstrumentOrder.current.length
        stableInstrumentOrder.current.push(...newTokens.slice(0, availableSlots))
      }
    }
    const orderedInstruments: UpstoxInstrumentData[] = []
    for (const token of stableInstrumentOrder.current) {
      const tick = grouped.get(token)
      if (tick && tick.last_price > 0) {
        const instrumentName = getUpstoxInstrumentName(tick)
        const marketType = getMarketTypeForInstrument(instrumentName)
        const marketStatus = getCurrentMarketStatus(marketType)
        const trend = calculateUpstoxPriceTrend(tick, ticks)
        const dayTrend = trend // For now, use same as trend
        orderedInstruments.push({ ...tick, marketStatus, trend, dayTrend })
      }
    }
    return orderedInstruments
  }, [ticks, currentTime])

  useEffect(() => {
    const newPreviousPrices: Record<string, number> = {}
    instrumentData.forEach((instrument) => {
      newPreviousPrices[instrument.instrument_token] = instrument.last_price
    })
    setPreviousPrices(newPreviousPrices)
  }, [instrumentData])

  const getLastTrades = (instrumentToken: string) => {
    const instrumentTicks = ticks
      .filter((tick) => tick.instrument_token === instrumentToken)
      .sort((a, b) => b.timestamp - a.timestamp) // Sort from most recent to oldest

    const uniquePriceTrades: UpstoxTickData[] = []
    if (instrumentTicks.length > 0) {
      uniquePriceTrades.push(instrumentTicks[0]) // Always add the most recent tick

      for (let i = 1; i < instrumentTicks.length; i++) {
        // Compare current tick's price with the previous tick's price
        if (instrumentTicks[i].last_price !== instrumentTicks[i - 1].last_price) {
          uniquePriceTrades.push(instrumentTicks[i])
        }
        // Limit to 10 unique trades
        if (uniquePriceTrades.length >= 10) {
          break
        }
      }
    }
    return uniquePriceTrades
  }

  const formatVolume = (volume: number) => {
    if (volume >= 10000000) return `${(volume / 10000000).toFixed(1)}Cr`
    if (volume >= 100000) return `${(volume / 100000).toFixed(1)}L`
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`
    return volume.toString()
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)

  if (instrumentData.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 animate-pulse">
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {instrumentData.map((instrument) => {
          const instrumentTickCount = ticks.filter((t) => t.instrument_token === instrument.instrument_token).length
          return (
            <UpstoxInstrumentCard
              key={instrument.instrument_token}
              instrument={instrument}
              instrumentTickCount={instrumentTickCount}
              previousPrice={previousPrices[instrument.instrument_token] || null}
              onShowTrades={() => setSelectedInstrument(instrument)}
              allTicks={ticks}
              isInactive={inactiveSymbols.has(instrument.instrument_token)}
              alertConfig={alertConfigurations.get(instrument.instrument_token)}
              onAlertConfigChange={(config) => onConfigurationChange(instrument.instrument_token, config)}
            />
          )
        })}
      </div>

      {/* Trades Dialog */}
      <Dialog open={!!selectedInstrument} onOpenChange={() => setSelectedInstrument(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Last 10 Trades - {selectedInstrument ? getUpstoxInstrumentName(selectedInstrument) : ""}
            </DialogTitle>
            <DialogDescription>
              Recent trading activity for {selectedInstrument ? getUpstoxInstrumentName(selectedInstrument) : ""}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Delay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedInstrument &&
                  getLastTrades(selectedInstrument.instrument_token).map((trade, index) => {
                    const prevTrade = getLastTrades(selectedInstrument.instrument_token)[index + 1]
                    const priceChange = prevTrade ? trade.last_price - prevTrade.last_price : 0
                    return (
                      <TableRow key={trade.id}>
                        <TableCell>
                          {new Date(trade.timestamp).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}
                        </TableCell>
                        <TableCell>₹{formatPrice(trade.last_price)}</TableCell>
                        <TableCell>{trade.last_quantity.toLocaleString()}</TableCell>
                        <TableCell>{formatVolume(trade.volume)}</TableCell>
                        <TableCell>
                          <div
                            className={`flex items-center gap-1 ${priceChange > 0 ? "text-green-600" : priceChange < 0 ? "text-red-600" : "text-gray-500"}`}
                          >
                            {priceChange > 0 && <TrendingUp className="w-3 h-3" />}
                            {priceChange < 0 && <TrendingDown className="w-3 h-3" />}
                            {priceChange === 0 && <Minus className="w-3 h-3" />}
                            <span className="text-xs">
                              {priceChange > 0 ? "+" : ""}
                              {priceChange.toFixed(2)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-xs font-medium ${trade.delay > 1000 ? "text-red-600" : trade.delay > 500 ? "text-yellow-600" : "text-green-600"}`}
                          >
                            {formatDelay(trade.delay)}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
