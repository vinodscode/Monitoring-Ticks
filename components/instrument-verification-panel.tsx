"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertTriangle, XCircle, Download } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  VERIFIED_INSTRUMENT_MAPPINGS, 
  analyzePriceDiscrepancies, 
  generateVerificationReport,
  CURRENT_PRICE_ANALYSIS,
  type PriceDiscrepancy 
} from "@/utils/instrument-verification"

interface InstrumentVerificationPanelProps {
  kiteTicks: any[]
  upstoxTicks: any[]
}

export function InstrumentVerificationPanel({ kiteTicks, upstoxTicks }: InstrumentVerificationPanelProps) {
  const discrepancies = useMemo(() => {
    return analyzePriceDiscrepancies(kiteTicks, upstoxTicks)
  }, [kiteTicks, upstoxTicks])

  const stats = useMemo(() => {
    const matched = discrepancies.filter(d => d.status === 'matched').length
    const withDiscrepancies = discrepancies.filter(d => d.status === 'discrepancy').length
    const missingData = discrepancies.filter(d => 
      d.status === 'missing_kite' || d.status === 'missing_upstox' || d.status === 'both_missing'
    ).length
    const highSeverity = discrepancies.filter(d => d.severity === 'high').length

    return { matched, withDiscrepancies, missingData, highSeverity }
  }, [discrepancies])

  const getStatusIcon = (status: PriceDiscrepancy['status']) => {
    switch (status) {
      case 'matched':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'discrepancy':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
      default:
        return <XCircle className="w-4 h-4 text-red-600" />
    }
  }

  const getStatusBadge = (status: PriceDiscrepancy['status']) => {
    const variants = {
      matched: "default",
      discrepancy: "outline", 
      missing_kite: "destructive",
      missing_upstox: "destructive",
      both_missing: "destructive"
    } as const

    const labels = {
      matched: "Matched",
      discrepancy: "Discrepancy", 
      missing_kite: "Missing Kite",
      missing_upstox: "Missing Upstox",
      both_missing: "Both Missing"
    }

    return (
      <Badge variant={variants[status]} className="text-xs">
        {labels[status]}
      </Badge>
    )
  }

  const getSeverityBadge = (severity: PriceDiscrepancy['severity']) => {
    const colors = {
      low: "text-green-600 bg-green-50 border-green-200",
      medium: "text-yellow-600 bg-yellow-50 border-yellow-200", 
      high: "text-red-600 bg-red-50 border-red-200"
    }

    return (
      <Badge variant="outline" className={`text-xs ${colors[severity]}`}>
        {severity.toUpperCase()}
      </Badge>
    )
  }

  const handleDownloadReport = () => {
    const report = generateVerificationReport(discrepancies)
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `instrument-verification-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Instrument Verification</h2>
          <p className="text-sm text-gray-500">
            Kite vs Upstox instrument code mapping and price comparison
          </p>
        </div>
        <Button onClick={handleDownloadReport} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Download Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Matched Prices</p>
                <p className="text-2xl font-bold text-gray-900">{stats.matched}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Price Discrepancies</p>
                <p className="text-2xl font-bold text-gray-900">{stats.withDiscrepancies}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Missing Data</p>
                <p className="text-2xl font-bold text-gray-900">{stats.missingData}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded">
                <AlertTriangle className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">High Severity</p>
                <p className="text-2xl font-bold text-gray-900">{stats.highSeverity}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instrument Mapping Table */}
      <Card>
        <CardHeader>
          <CardTitle>Verified Instrument Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kite Symbol</TableHead>
                  <TableHead>Upstox Reference</TableHead>
                  <TableHead>ISIN/Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {VERIFIED_INSTRUMENT_MAPPINGS.map((mapping, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{mapping.kiteSymbol}</TableCell>
                    <TableCell className="font-mono text-sm">{mapping.upstoxSymbol}</TableCell>
                    <TableCell className="font-mono text-sm">{mapping.isin || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {mapping.instrumentType.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-600">Verified</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Price Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Real-time Price Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instrument</TableHead>
                  <TableHead>Kite Price</TableHead>
                  <TableHead>Upstox Price</TableHead>
                  <TableHead>Difference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discrepancies.map((disc, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{disc.instrumentName}</TableCell>
                    <TableCell>
                      {disc.kitePrice !== null ? `₹${disc.kitePrice.toFixed(2)}` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {disc.upstoxPrice !== null ? `₹${disc.upstoxPrice.toFixed(2)}` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {disc.difference !== null ? (
                        <div>
                          <div>₹{disc.difference.toFixed(2)}</div>
                          <div className="text-xs text-gray-500">
                            {disc.percentageDiff?.toFixed(4)}%
                          </div>
                        </div>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(disc.status)}
                        {getStatusBadge(disc.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getSeverityBadge(disc.severity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Current Analysis from Image */}
      <Card>
        <CardHeader>
          <CardTitle>Current Price Analysis (From Screenshot)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Key Findings:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>RELIANCE:</strong> Perfect price match at ₹1,521.50 on both platforms</li>
                <li>• <strong>Missing Kite Data:</strong> 5 out of 6 instruments show N/A for Kite prices</li>
                <li>• <strong>Upstox Data Available:</strong> All instruments have live prices on Upstox</li>
                <li>• <strong>Connection Issue:</strong> Kite feed appears to be disconnected or filtered</li>
              </ul>
            </div>
            
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-2">Recommendations:</h4>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Check Kite WebSocket connection status</li>
                <li>• Verify instrument token mappings for missing symbols</li>
                <li>• Ensure both feeds are subscribed to the same instruments</li>
                <li>• Monitor connection stability for consistent data flow</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}