"use client"

import { useState, useMemo } from "react"
import { Calendar, Filter, Search } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { TickData } from "@/hooks/use-tick-data"

interface HistoricalDataProps {
  ticks: TickData[]
}

export function HistoricalData({ ticks }: HistoricalDataProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [delayFilter, setDelayFilter] = useState<"all" | "high" | "normal">("all")

  const filteredTicks = useMemo(() => {
    return ticks
      .filter((tick) => {
        // Date filter
        if (dateFilter) {
          const tickDate = new Date(tick.timestamp).toISOString().split("T")[0]
          if (tickDate !== dateFilter) return false
        }

        // Delay filter
        if (delayFilter === "high" && tick.delay <= 1000) return false
        if (delayFilter === "normal" && tick.delay > 1000) return false

        // Search term (search in tick ID or value)
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase()
          if (!tick.id.toLowerCase().includes(searchLower) && !tick.value.toString().includes(searchTerm)) {
            return false
          }
        }

        return true
      })
      .slice(0, 100) // Limit to 100 results for performance
  }, [ticks, searchTerm, dateFilter, delayFilter])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historical Data Analysis</CardTitle>
        <CardDescription>Browse and analyze historical tick data with filtering options</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by ID or value..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="date">Date Filter</Label>
            <div className="relative">
              <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="date"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div>
            <Label>Delay Filter</Label>
            <div className="flex gap-2 mt-1">
              <Button
                variant={delayFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setDelayFilter("all")}
              >
                All
              </Button>
              <Button
                variant={delayFilter === "high" ? "default" : "outline"}
                size="sm"
                onClick={() => setDelayFilter("high")}
              >
                High Delay
              </Button>
              <Button
                variant={delayFilter === "normal" ? "default" : "outline"}
                size="sm"
                onClick={() => setDelayFilter("normal")}
              >
                Normal
              </Button>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredTicks.length} of {ticks.length} ticks
          </p>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Clear Filters
          </Button>
        </div>

        {/* Data Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Instrument Token</TableHead>
                <TableHead>Last Price</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Delay</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTicks.map((tick) => (
                <TableRow key={tick.id}>
                  <TableCell className="font-mono text-sm">
                    {new Date(tick.timestamp).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour12: false,
                    })}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{tick.instrument_token}</TableCell>
                  <TableCell>{tick.last_price.toFixed(2)}</TableCell>
                  <TableCell>{tick.volume.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={tick.delay > 1000 ? "text-red-600 font-semibold" : ""}>{tick.delay}ms</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tick.delay > 1000 ? "destructive" : "default"}>
                      {tick.delay > 1000 ? "High Delay" : "Normal"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredTicks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No ticks found matching the current filters.</div>
        )}
      </CardContent>
    </Card>
  )
}
