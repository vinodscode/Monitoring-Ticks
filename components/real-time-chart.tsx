"use client"

import { useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { TickData } from "@/hooks/use-tick-data"

interface RealTimeChartProps {
  ticks: TickData[]
}

export function RealTimeChart({ ticks }: RealTimeChartProps) {
  const chartData = useMemo(() => {
    return ticks
      .slice(0, 50) // Show last 50 ticks
      .reverse()
      .map((tick, index) => ({
        index,
        last_price: tick.last_price,
        volume: tick.volume,
        delay: tick.delay,
        timestamp: new Date(tick.timestamp).toLocaleTimeString(),
        instrument: tick.instrument_token,
      }))
  }, [ticks])

  const chartConfig = {
    last_price: {
      label: "Last Price",
      color: "hsl(var(--chart-1))",
    },
    volume: {
      label: "Volume",
      color: "hsl(var(--chart-2))",
    },
    delay: {
      label: "Delay (ms)",
      color: "hsl(var(--chart-3))",
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Real-Time Tick Data</CardTitle>
        <CardDescription>Live visualization of tick prices, volume, and delays</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="index" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <ChartTooltip content={<ChartTooltipContent />} labelFormatter={(value) => `Tick ${value}`} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="last_price"
                stroke="var(--color-last_price)"
                strokeWidth={2}
                dot={false}
                name="Last Price"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="delay"
                stroke="var(--color-delay)"
                strokeWidth={2}
                dot={false}
                name="Delay (ms)"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
