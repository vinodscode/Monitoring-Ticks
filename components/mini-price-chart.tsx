"use client"

import { useMemo } from "react"
import type { TickData } from "@/hooks/use-tick-data"

interface MiniPriceChartProps {
  ticks: TickData[]
  instrumentToken: number
  height?: number
  className?: string
}

export function MiniPriceChart({ ticks, instrumentToken, height = 60, className = "" }: MiniPriceChartProps) {
  const chartData = useMemo(() => {
    const instrumentTicks = ticks
      .filter((tick) => tick.instrument_token === instrumentToken && tick.last_price > 0)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-50) // Use last 50 ticks for smoother chart

    if (instrumentTicks.length < 2) {
      return {
        path: "",
        gradientPath: "",
        color: "#9ca3af",
        hasData: false,
        currentPrice: 0,
        priceChange: 0,
        changePercent: 0,
        chartMin: 0, // Initialize to prevent NaN in later calculations
        chartMax: 0, // Initialize to prevent NaN in later calculations
        effectiveChartRange: 0, // Initialize to prevent NaN in later calculations
      }
    }

    const prices = instrumentTicks.map((t) => t.last_price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    const priceRange = maxPrice - minPrice
    const padding = priceRange * 0.1 || maxPrice * 0.05 // Dynamic padding
    const chartMin = minPrice - padding
    const chartMax = maxPrice + padding
    const effectiveChartRange = chartMax - chartMin

    // Calculate dimensions - we'll use 100% width via viewBox
    const chartWidth = 100 // Use percentage-based width
    const chartHeight = height

    const getX = (index: number) => (index / (instrumentTicks.length - 1)) * chartWidth
    const getY = (price: number): number => {
      if (!isFinite(price) || !isFinite(effectiveChartRange) || effectiveChartRange <= 0) {
        return chartHeight / 2 // Return a safe default if inputs are invalid or range is zero
      }
      return chartHeight - ((price - chartMin) / effectiveChartRange) * chartHeight
    }

    // Create the main line path
    const path = instrumentTicks
      .map((tick, i) => {
        const x = getX(i)
        const y = getY(tick.last_price)
        return `${i === 0 ? "M" : "L"} ${x} ${y}`
      })
      .join(" ")

    // Create gradient fill path (area under the curve)
    const gradientPath = instrumentTicks
      .map((tick, i) => {
        const x = getX(i)
        const y = getY(tick.last_price)
        if (i === 0) return `M ${x} ${chartHeight} L ${x} ${y}`
        if (i === instrumentTicks.length - 1) return `L ${x} ${y} L ${x} ${chartHeight} Z`
        return `L ${x} ${y}`
      })
      .join(" ")

    const currentPrice = instrumentTicks[instrumentTicks.length - 1].last_price
    const firstPrice = instrumentTicks[0].last_price
    const priceChange = currentPrice - firstPrice
    const changePercent = firstPrice !== 0 ? (priceChange / firstPrice) * 100 : 0 // Avoid division by zero

    // Determine colors based on overall trend
    const isPositive = priceChange > 0
    const isNegative = priceChange < 0

    let color = "#9ca3af" // neutral gray
    let gradientColor = "rgba(156, 163, 175, 0.1)"

    if (isPositive) {
      color = "#22c55e" // green
      gradientColor = "rgba(34, 197, 94, 0.1)"
    } else if (isNegative) {
      color = "#ef4444" // red
      gradientColor = "rgba(239, 68, 68, 0.1)"
    }

    return {
      path,
      gradientPath,
      color,
      gradientColor,
      hasData: true,
      currentPrice,
      priceChange,
      changePercent,
      isPositive,
      isNegative,
      chartMin,
      chartMax,
      effectiveChartRange,
      getY, // Pass getY function to be used directly in JSX
    }
  }, [ticks, instrumentToken, height])

  if (!chartData.hasData) {
    return (
      <div
        className={`w-full flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 ${className}`}
        style={{ height }}
      >
        <div className="text-center">
          <div className="text-sm text-gray-400 font-medium">No Chart Data</div>
          <div className="text-xs text-gray-300 mt-1">Waiting for ticks...</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`w-full relative bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-100 overflow-hidden ${className}`}
    >
      {/* Chart Container */}
      <div className="relative w-full" style={{ height }}>
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
          {/* Gradient Definition */}
          <defs>
            <linearGradient id={`gradient-${instrumentToken}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={chartData.color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={chartData.color} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={chartData.gradientPath} fill={`url(#gradient-${instrumentToken})`} stroke="none" />

          {/* Main line */}
          <path
            d={chartData.path}
            fill="none"
            stroke={chartData.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-sm"
          />

          {/* Current price dot */}
          <circle
            cx="100"
            cy={chartData.getY(chartData.currentPrice)} // Simplified calculation
            r="2"
            fill={chartData.color}
            stroke="white"
            strokeWidth="1"
            className="drop-shadow-sm"
          />
        </svg>

        {/* Overlay with trend info */}
        <div className="absolute top-2 left-3 flex items-center gap-2">
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm opacity-80 ${
              chartData.isPositive
                ? "bg-green-100 text-green-700"
                : chartData.isNegative
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {chartData.isPositive && <span>↗</span>}
            {chartData.isNegative && <span>↘</span>}
            {!chartData.isPositive && !chartData.isNegative && <span>→</span>}
            <span>
              {chartData.changePercent > 0 ? "+" : ""}
              {chartData.changePercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Chart info overlay */}
        <div className="absolute bottom-2 right-3">
          <div className="text-xs text-gray-500 font-mono bg-white/80 backdrop-blur-sm px-2 py-1 rounded">50 ticks</div>
        </div>
      </div>
    </div>
  )
}
