import type { TickData } from "@/hooks/use-tick-data"

interface PriceTrend {
  change: number
  changePercent: number
  direction: "up" | "down" | "neutral"
}

export function calculatePriceTrend(tick: TickData, previousTicks: TickData[]): PriceTrend {
  const instrumentToken = tick.instrument_token
  const currentPrice = tick.last_price

  // Get previous prices for this instrument, sorted by timestamp (oldest first)
  const instrumentTicks = previousTicks
    .filter((t) => t.instrument_token === instrumentToken && t.timestamp < tick.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
    .slice(0, 10) // Last 10 ticks before current

  if (instrumentTicks.length === 0) {
    return { change: 0, changePercent: 0, direction: "neutral" }
  }

  // Use the most recent previous price for comparison
  const previousPrice = instrumentTicks[0].last_price

  if (previousPrice <= 0) {
    return { change: 0, changePercent: 0, direction: "neutral" }
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

// Alternative: Calculate trend from first tick of the day
export function calculateDayTrend(tick: TickData, allTicks: TickData[]): PriceTrend {
  const instrumentToken = tick.instrument_token
  const currentPrice = tick.last_price

  // Get all ticks for this instrument, sorted by timestamp
  const instrumentTicks = allTicks
    .filter((t) => t.instrument_token === instrumentToken)
    .sort((a, b) => a.timestamp - b.timestamp)

  if (instrumentTicks.length < 2) {
    return { change: 0, changePercent: 0, direction: "neutral" }
  }

  // Use the first tick of the session as baseline
  const basePrice = instrumentTicks[0].last_price

  if (basePrice <= 0) {
    return { change: 0, changePercent: 0, direction: "neutral" }
  }

  const change = currentPrice - basePrice
  const changePercent = (change / basePrice) * 100

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

export function getInstrumentBasePrice(instrumentToken: number): number {
  // This should only be used as fallback if no real price is available
  return 0 // Return 0 to indicate no real data available
}
