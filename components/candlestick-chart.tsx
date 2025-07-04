"use client"

import { useMemo } from "react"
import type { TickData } from "@/hooks/use-tick-data"

interface CandlestickChartProps {
  ticks: TickData[]
  instrumentToken: number
  height?: number
  width?: number
}

interface Candle {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
  isBullish: boolean
}

// Create candles from exactly 3 ticks each
function createCandlesFromTicks(ticks: TickData[], instrumentToken: number): Candle[] {
  const instrumentTicks = ticks
    .filter((tick) => tick.instrument_token === instrumentToken && tick.last_price > 0)
    .sort((a, b) => a.timestamp - b.timestamp)

  const candles: Candle[] = []

  // Group every 3 ticks into one candle
  for (let i = 0; i < instrumentTicks.length; i += 3) {
    const tickGroup = instrumentTicks.slice(i, i + 3)

    if (tickGroup.length === 3) {
      // Only create candle if we have exactly 3 ticks
      const prices = tickGroup.map((t) => t.last_price).filter((p) => !isNaN(p) && p > 0)

      if (prices.length === 3) {
        const open = prices[0]
        const close = prices[2]
        const high = Math.max(...prices)
        const low = Math.min(...prices)
        const volume = tickGroup.reduce((sum, t) => sum + (t.volume || 0), 0)

        candles.push({
          open,
          high,
          low,
          close,
          volume,
          timestamp: tickGroup[2].timestamp, // Use last tick's timestamp
          isBullish: close >= open,
        })
      }
    }
  }

  return candles.slice(-15) // Show last 15 candles
}

export function CandlestickChart({ ticks, instrumentToken, height = 96, width = 252 }: CandlestickChartProps) {
  const candles = useMemo(() => {
    return createCandlesFromTicks(ticks, instrumentToken)
  }, [ticks, instrumentToken])

  // Get the most recent tick for this instrument even if we can't form candles
  const recentTicks = useMemo(() => {
    return ticks
      .filter((tick) => tick.instrument_token === instrumentToken && tick.last_price > 0)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10) // Get last 10 ticks
  }, [ticks, instrumentToken])

  if (candles.length === 0 && recentTicks.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 border rounded text-gray-500">
        <div className="text-center">
          <div className="text-sm font-medium">NO DATA</div>
          <div className="text-xs mt-1">No ticks received</div>
        </div>
      </div>
    )
  }

  // If we don't have enough candles but have recent ticks, show a simple line chart
  if (candles.length === 0 && recentTicks.length > 0) {
    const prices = recentTicks.map((t) => t.last_price).reverse() // Oldest first for line chart
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice
    const padding = priceRange > 0 ? priceRange * 0.1 : maxPrice * 0.05
    const chartMin = minPrice - padding
    const chartMax = maxPrice + padding
    const chartRange = chartMax - chartMin

    const margin = { top: 8, right: 2, bottom: 20, left: 8 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const getYPosition = (price: number): number => {
      if (!isFinite(price) || !isFinite(chartRange) || chartRange <= 0) return margin.top + chartHeight / 2
      return margin.top + ((chartMax - price) / chartRange) * chartHeight
    }

    const getXPosition = (index: number): number => {
      return margin.left + (index / Math.max(prices.length - 1, 1)) * chartWidth
    }

    // Create path for line chart
    const pathData = prices
      .map((price, index) => {
        const x = getXPosition(index)
        const y = getYPosition(price)
        return `${index === 0 ? "M" : "L"} ${x} ${y}`
      })
      .join(" ")

    const currentPrice = recentTicks[0].last_price
    const previousPrice = recentTicks[1]?.last_price || currentPrice
    const isUp = currentPrice >= previousPrice

    return (
      <div className="w-full h-full bg-white border rounded overflow-hidden">
        <svg width={width} height={height} className="bg-white">
          {/* Background */}
          <rect width="100%" height="100%" fill="#ffffff" />

          {/* Grid lines */}
          <g stroke="#f5f5f5" strokeWidth="1">
            {[0.25, 0.5, 0.75].map((ratio) => {
              const y = margin.top + chartHeight * ratio
              return <line key={ratio} x1={margin.left} y1={y} x2={width - margin.right} y2={y} />
            })}
          </g>

          {/* Price line */}
          <path
            d={pathData}
            fill="none"
            stroke={isUp ? "#00C853" : "#FF1744"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {prices.map((price, index) => {
            const x = getXPosition(index)
            const y = getYPosition(price)
            const isLast = index === prices.length - 1

            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r={isLast ? 4 : 2}
                fill={isUp ? "#00C853" : "#FF1744"}
                stroke="white"
                strokeWidth={isLast ? 2 : 1}
              >
                <title>
                  {`Price: ₹${price.toFixed(2)}
Time: ${new Date(recentTicks[recentTicks.length - 1 - index].timestamp).toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour12: false,
                  })}`}
                </title>
              </circle>
            )
          })}

          {/* Current price label */}
          <g fill="#666" fontSize="9" fontFamily="monospace">
            <rect
              x={width - 50}
              y={getYPosition(currentPrice) - 8}
              width={48}
              height={16}
              fill="rgba(255,255,255,0.95)"
              stroke={isUp ? "#00C853" : "#FF1744"}
              strokeWidth="1"
              rx="2"
            />
            <text
              x={width - 26}
              y={getYPosition(currentPrice) + 3}
              textAnchor="middle"
              fill={isUp ? "#00C853" : "#FF1744"}
              fontWeight="bold"
            >
              ₹{currentPrice.toFixed(2)}
            </text>
          </g>

          {/* Chart info */}
          <g fill="#888" fontSize="8">
            <text x={margin.left + 2} y={margin.top + 10}>
              {recentTicks.length} ticks (building candles...)
            </text>
            {/* Staleness indicator for line chart */}
            {recentTicks.length > 0 &&
              (() => {
                const oldestTick = recentTicks[recentTicks.length - 1]
                const dataAge = Date.now() - oldestTick.receivedAt
                const isStale = dataAge > 300000 // 5 minutes

                return isStale ? (
                  <text x={margin.left + 2} y={margin.top + 22} fill="#f59e0b" fontSize="7">
                    Data {Math.floor(dataAge / 60000)}m old (market closed)
                  </text>
                ) : null
              })()}
          </g>

          {/* Time labels */}
          <g fill="#666" fontSize="8" fontFamily="monospace">
            <text x={margin.left + 2} y={height - 4} textAnchor="start">
              {new Date(recentTicks[recentTicks.length - 1].timestamp).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
              })}
            </text>
            <text x={width - 5} y={height - 4} textAnchor="end">
              {new Date(recentTicks[0].timestamp).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
              })}
            </text>
          </g>
        </svg>
      </div>
    )
  }

  // Calculate price range with validation
  const allPrices = candles.flatMap((c) => [c.high, c.low]).filter((p) => !isNaN(p) && isFinite(p))

  if (allPrices.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 border rounded text-gray-500">
        <div className="text-center">
          <div className="text-sm font-medium">INVALID DATA</div>
          <div className="text-xs mt-1">No valid price data</div>
        </div>
      </div>
    )
  }

  const minPrice = Math.min(...allPrices)
  const maxPrice = Math.max(...allPrices)
  const priceRange = maxPrice - minPrice

  // Handle case where all prices are the same
  const padding = priceRange > 0 ? priceRange * 0.05 : maxPrice * 0.01
  const chartMin = minPrice - padding
  const chartMax = maxPrice + padding
  const chartRange = chartMax - chartMin

  // Validate chart range
  if (!isFinite(chartRange) || chartRange <= 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 border rounded text-gray-500">
        <div className="text-center">
          <div className="text-sm font-medium">CHART ERROR</div>
          <div className="text-xs mt-1">Invalid price range</div>
        </div>
      </div>
    )
  }

  // Chart layout - minimize margins
  const margin = { top: 8, right: 2, bottom: 20, left: 8 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  // Candle dimensions
  const candleWidth = Math.max(Math.floor(chartWidth / candles.length) - 1, 3)
  const candleSpacing = 1

  // Helper function to calculate Y position safely
  const getYPosition = (price: number): number => {
    if (!isFinite(price) || !isFinite(chartRange) || chartRange <= 0) return margin.top
    return margin.top + ((chartMax - price) / chartRange) * chartHeight
  }

  return (
    <div className="w-full h-full bg-white border rounded overflow-hidden">
      <svg width={width} height={height} className="bg-white">
        {/* Background */}
        <rect width="100%" height="100%" fill="#ffffff" />

        {/* Grid lines */}
        <g stroke="#f5f5f5" strokeWidth="1">
          {[0.25, 0.5, 0.75].map((ratio) => {
            const y = margin.top + chartHeight * ratio
            if (!isFinite(y)) return null
            return <line key={ratio} x1={margin.left} y1={y} x2={width - margin.right} y2={y} />
          })}
        </g>

        {/* Candlesticks */}
        <g>
          {candles.map((candle, index) => {
            const x = margin.left + index * (candleWidth + candleSpacing)
            const centerX = x + candleWidth / 2

            // Calculate Y positions with validation
            const highY = getYPosition(candle.high)
            const lowY = getYPosition(candle.low)
            const openY = getYPosition(candle.open)
            const closeY = getYPosition(candle.close)

            // Validate all Y positions
            if (!isFinite(highY) || !isFinite(lowY) || !isFinite(openY) || !isFinite(closeY)) {
              return null
            }

            const bodyTop = Math.min(openY, closeY)
            const bodyBottom = Math.max(openY, closeY)
            const bodyHeight = Math.max(Math.abs(closeY - openY), 1)

            const color = candle.isBullish ? "#00C853" : "#FF1744"

            return (
              <g key={index}>
                {/* Wick */}
                <line x1={centerX} y1={highY} x2={centerX} y2={lowY} stroke={color} strokeWidth="1" />

                {/* Body */}
                <rect
                  x={x}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={color}
                  stroke={color}
                  strokeWidth="1"
                  opacity={candle.isBullish ? 0.8 : 1}
                />

                {/* Tooltip area */}
                <rect
                  x={x}
                  y={margin.top}
                  width={candleWidth}
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-pointer"
                >
                  <title>
                    {`O: ₹${candle.open.toFixed(2)}
H: ₹${candle.high.toFixed(2)}
L: ₹${candle.low.toFixed(2)}
C: ₹${candle.close.toFixed(2)}
Vol: ${candle.volume.toLocaleString()}`}
                  </title>
                </rect>
              </g>
            )
          })}
        </g>

        {/* Volume bars */}
        <g>
          {candles.map((candle, index) => {
            const volumes = candles.map((c) => c.volume).filter((v) => isFinite(v) && v > 0)
            const maxVolume = volumes.length > 0 ? Math.max(...volumes) : 1
            const volumeHeight = maxVolume > 0 ? (candle.volume / maxVolume) * 10 : 0
            const x = margin.left + index * (candleWidth + candleSpacing)
            const y = height - margin.bottom - volumeHeight
            const color = candle.isBullish ? "#00C853" : "#FF1744"

            if (!isFinite(volumeHeight) || !isFinite(y)) return null

            return (
              <rect
                key={`vol-${index}`}
                x={x}
                y={y}
                width={candleWidth}
                height={volumeHeight}
                fill={color}
                opacity="0.3"
              />
            )
          })}
        </g>

        {/* Price labels - positioned over the chart */}
        <g fill="#666" fontSize="9" fontFamily="monospace">
          {[0, 0.5, 1].map((ratio) => {
            const price = chartMax - chartRange * ratio
            const y = margin.top + chartHeight * ratio

            if (!isFinite(price) || !isFinite(y)) return null

            return (
              <g key={ratio}>
                <rect
                  x={width - 45}
                  y={y - 6}
                  width={43}
                  height={12}
                  fill="rgba(255,255,255,0.9)"
                  stroke="#ddd"
                  strokeWidth="0.5"
                />
                <text x={width - 23} y={y + 3} textAnchor="middle">
                  ₹{price.toFixed(1)}
                </text>
              </g>
            )
          })}
        </g>

        {/* Time labels */}
        <g fill="#666" fontSize="8" fontFamily="monospace">
          {candles.length > 0 && (
            <>
              <text x={margin.left + 2} y={height - 4} textAnchor="start">
                {new Date(candles[0].timestamp).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </text>
              <text x={width - 5} y={height - 4} textAnchor="end">
                {new Date(candles[candles.length - 1].timestamp).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </text>
            </>
          )}
        </g>

        {/* Chart info */}
        <g fill="#888" fontSize="8">
          <text x={margin.left + 2} y={margin.top + 10}>
            {candles.length} candles (3 ticks each)
          </text>
          {/* Staleness indicator for candlestick chart */}
          {candles.length > 0 &&
            (() => {
              const latestCandle = candles[candles.length - 1]
              const dataAge = Date.now() - latestCandle.timestamp
              const isStale = dataAge > 300000 // 5 minutes

              return isStale ? (
                <text x={margin.left + 2} y={margin.top + 22} fill="#f59e0b" fontSize="7">
                  Data {Math.floor(dataAge / 60000)}m old
                </text>
              ) : null
            })()}
        </g>
      </svg>
    </div>
  )
}
