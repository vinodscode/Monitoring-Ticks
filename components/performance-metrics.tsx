"use client"

import { useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { TickData } from "@/hooks/use-tick-data"

interface PerformanceMetricsProps {
  ticks: TickData[]
  averageDelay: number
  totalTicks: number
  freezingIncidents: number
}

export function PerformanceMetrics({ ticks, averageDelay, totalTicks, freezingIncidents }: PerformanceMetricsProps) {
  const performanceData = useMemo(() => {
    const now = Date.now()
    const intervals = []

    // Create 10-minute intervals for the last hour
    for (let i = 5; i >= 0; i--) {
      const intervalStart = now - (i + 1) * 10 * 60 * 1000
      const intervalEnd = now - i * 10 * 60 * 1000

      const intervalTicks = ticks.filter((tick) => tick.timestamp >= intervalStart && tick.timestamp < intervalEnd)

      const avgDelay =
        intervalTicks.length > 0 ? intervalTicks.reduce((sum, tick) => sum + tick.delay, 0) / intervalTicks.length : 0

      intervals.push({
        time: new Date(intervalEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        tickCount: intervalTicks.length,
        avgDelay: Math.round(avgDelay),
      })
    }

    return intervals
  }, [ticks])

  const chartConfig = {
    tickCount: {
      label: "Tick Count",
      color: "hsl(var(--chart-1))",
    },
    avgDelay: {
      label: "Avg Delay (ms)",
      color: "hsl(var(--chart-2))",
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Metrics</CardTitle>
        <CardDescription>Tick frequency and delay analysis over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{totalTicks}</div>
              <div className="text-sm text-muted-foreground">Total Ticks</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{averageDelay.toFixed(0)}ms</div>
              <div className="text-sm text-muted-foreground">Avg Delay</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{freezingIncidents}</div>
              <div className="text-sm text-muted-foreground">Freeze Events</div>
            </div>
          </div>

          <ChartContainer config={chartConfig} className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar yAxisId="left" dataKey="tickCount" fill="var(--color-tickCount)" name="Tick Count" />
                <Bar yAxisId="right" dataKey="avgDelay" fill="var(--color-avgDelay)" name="Avg Delay (ms)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}
