import type { TickData } from "@/hooks/use-tick-data"

export interface CandlestickData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  tickCount: number
}

export function generateCandlestickData(
  ticks: TickData[],
  instrumentToken: number,
  ticksPerCandle = 3,
): CandlestickData[] {
  // Filter ticks for the specific instrument and sort by timestamp
  const instrumentTicks = ticks
    .filter((tick) => tick.instrument_token === instrumentToken)
    .sort((a, b) => a.timestamp - b.timestamp)

  if (instrumentTicks.length === 0) return []

  const candles: CandlestickData[] = []

  // Group ticks into candles (every 3 ticks = 1 candle)
  for (let i = 0; i < instrumentTicks.length; i += ticksPerCandle) {
    const candleTicks = instrumentTicks.slice(i, i + ticksPerCandle)

    if (candleTicks.length === 0) continue

    // Calculate OHLC from the tick group
    const prices = candleTicks.map((t) => t.last_price)
    const open = prices[0]
    const close = prices[prices.length - 1]
    const high = Math.max(...prices)
    const low = Math.min(...prices)
    const volume = candleTicks.reduce((sum, t) => sum + t.volume, 0)
    const timestamp = candleTicks[candleTicks.length - 1].timestamp

    candles.push({
      timestamp,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
      tickCount: candleTicks.length,
    })
  }

  // Return last 15 candles for better visibility
  return candles.slice(-15)
}

export function formatCandlestickTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}
