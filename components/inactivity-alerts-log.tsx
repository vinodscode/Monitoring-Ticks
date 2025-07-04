"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { History, X, TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { InactivityAlert } from "@/hooks/use-inactivity-alerts"

interface InactivityAlertsLogProps {
  alerts: InactivityAlert[]
  onClearAlerts: () => void
}

export function InactivityAlertsLog({ alerts, onClearAlerts }: InactivityAlertsLogProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const formatPriceRange = (min: number, max: number) => {
    if (min === max) {
      return `₹${formatPrice(min)}`
    }
    return `₹${formatPrice(min)} - ₹${formatPrice(max)}`
  }

  const getPriceMovementIcon = (baseline: number, current: number) => {
    if (current > baseline) return <TrendingUp className="w-3 h-3 text-green-600" />
    if (current < baseline) return <TrendingDown className="w-3 h-3 text-red-600" />
    return <Minus className="w-3 h-3 text-gray-500" />
  }

  const getAlertSeverity = (alert: InactivityAlert) => {
    const priceRange = alert.priceRange.max - alert.priceRange.min
    if (priceRange < alert.deviation * 0.5) return "high" // Very little movement
    if (priceRange < alert.deviation * 0.8) return "medium" // Some movement but within threshold
    return "low" // Movement close to threshold
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "high":
        return (
          <Badge variant="destructive" className="text-xs">
            High
          </Badge>
        )
      case "medium":
        return (
          <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
            Medium
          </Badge>
        )
      case "low":
        return (
          <Badge variant="outline" className="text-xs">
            Low
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs">
            Unknown
          </Badge>
        )
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Inactivity Alert Log
          </CardTitle>
          <CardDescription>
            Detailed log of all triggered price inactivity alerts with actual price information
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onClearAlerts} disabled={alerts.length === 0}>
          <X className="w-4 h-4 mr-2" />
          Clear Log ({alerts.length})
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Baseline Price</TableHead>
                <TableHead>Price Range</TableHead>
                <TableHead>Current Price</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Severity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.length > 0 ? (
                alerts.map((alert) => {
                  const severity = getAlertSeverity(alert)
                  const priceChange = alert.currentPrice - alert.baselinePrice
                  const changePercent = alert.baselinePrice > 0 ? (priceChange / alert.baselinePrice) * 100 : 0

                  return (
                    <TableRow key={alert.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono text-sm">
                        {new Date(alert.timestamp).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          hour12: false,
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="font-medium">{alert.instrumentName}</TableCell>
                      <TableCell className="font-mono">
                        <div className="flex items-center gap-1">
                          <span>₹{formatPrice(alert.baselinePrice)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <div className="flex flex-col">
                          <span>{formatPriceRange(alert.priceRange.min, alert.priceRange.max)}</span>
                          <span className="text-xs text-gray-500">
                            Range: ₹{formatPrice(alert.priceRange.max - alert.priceRange.min)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        <div className="flex items-center gap-1">
                          {getPriceMovementIcon(alert.baselinePrice, alert.currentPrice)}
                          <span>₹{formatPrice(alert.currentPrice)}</span>
                          {priceChange !== 0 && (
                            <span className={`text-xs ${priceChange > 0 ? "text-green-600" : "text-red-600"}`}>
                              ({priceChange > 0 ? "+" : ""}
                              {priceChange.toFixed(2)})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {alert.duration}s
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">±{alert.deviation.toFixed(2)}</TableCell>
                      <TableCell>{getSeverityBadge(severity)}</TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <History className="w-8 h-8" />
                      <p>No inactivity alerts have been triggered yet.</p>
                      <p className="text-sm">Configure alerts in the Alert Settings tab to start monitoring.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {alerts.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Alert Details Explanation:</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <div>
                <strong>Baseline Price:</strong> The price when monitoring started for this period
              </div>
              <div>
                <strong>Price Range:</strong> The actual price range during the inactivity period
              </div>
              <div>
                <strong>Current Price:</strong> The price at the moment the alert was triggered
              </div>
              <div>
                <strong>Severity:</strong> Based on how little the price actually moved within the threshold
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
