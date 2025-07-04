"use client"

import { useState } from "react"
import { Download, FileText, Table } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import type { TickData } from "@/hooks/use-tick-data"

interface ExportPanelProps {
  ticks: TickData[]
}

export function ExportPanel({ ticks }: ExportPanelProps) {
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "pdf">("csv")
  const [dateRange, setDateRange] = useState({ start: "", end: "" })
  const [includeFields, setIncludeFields] = useState({
    timestamp: true,
    id: true,
    last_price: true,
    volume: true,
    delay: true,
  })

  const handleExport = () => {
    let filteredTicks = ticks

    // Apply date range filter
    if (dateRange.start || dateRange.end) {
      filteredTicks = ticks.filter((tick) => {
        const tickDate = new Date(tick.timestamp).toISOString().split("T")[0]
        if (dateRange.start && tickDate < dateRange.start) return false
        if (dateRange.end && tickDate > dateRange.end) return false
        return true
      })
    }

    if (exportFormat === "csv") {
      exportToCSV(filteredTicks)
    } else if (exportFormat === "json") {
      exportToJSON(filteredTicks)
    } else if (exportFormat === "pdf") {
      exportToPDF(filteredTicks)
    }
  }

  const exportToCSV = (data: TickData[]) => {
    const headers = []
    if (includeFields.timestamp) headers.push("Timestamp")
    if (includeFields.id) headers.push("ID")
    if (includeFields.last_price) headers.push("Last Price")
    if (includeFields.volume) headers.push("Volume")
    if (includeFields.delay) headers.push("Delay (ms)")

    const csvContent = [
      headers.join(","),
      ...data.map((tick) => {
        const row = []
        if (includeFields.timestamp)
          row.push(
            new Date(tick.timestamp).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour12: false,
            }),
          )
        if (includeFields.id) row.push(tick.id ?? "")
        if (includeFields.last_price) row.push((tick.last_price ?? "").toString())
        if (includeFields.volume) row.push((tick.volume ?? "").toString())
        if (includeFields.delay) row.push((tick.delay ?? "").toString())
        return row.join(",")
      }),
    ].join("\n")

    downloadFile(csvContent, "tick-data.csv", "text/csv")
  }

  const exportToJSON = (data: TickData[]) => {
    const filteredData = data.map((tick) => {
      const filtered: any = {}
      if (includeFields.timestamp) filtered.timestamp = tick.timestamp
      if (includeFields.id) filtered.id = tick.id
      if (includeFields.last_price) filtered.last_price = tick.last_price
      if (includeFields.volume) filtered.volume = tick.volume
      if (includeFields.delay) filtered.delay = tick.delay
      return filtered
    })

    const jsonContent = JSON.stringify(filteredData, null, 2)
    downloadFile(jsonContent, "tick-data.json", "application/json")
  }

  const exportToPDF = (data: TickData[]) => {
    // For PDF export, we'll create a simple HTML report and trigger print
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tick Data Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Tick Data Report</h1>
            <p>Generated on: ${new Date().toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour12: false,
            })}</p>
            <p>Total Records: ${data.length}</p>
          </div>
          <table>
            <thead>
              <tr>
                ${includeFields.timestamp ? "<th>Timestamp</th>" : ""}
                ${includeFields.id ? "<th>ID</th>" : ""}
                ${includeFields.last_price ? "<th>Last Price</th>" : ""}
                ${includeFields.volume ? "<th>Volume</th>" : ""}
                ${includeFields.delay ? "<th>Delay (ms)</th>" : ""}
              </tr>
            </thead>
            <tbody>
              ${data
                .slice(0, 100)
                .map(
                  (tick) => `
                <tr>
                  ${
                    includeFields.timestamp
                      ? `<td>${new Date(tick.timestamp).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          hour12: false,
                        })}</td>`
                      : ""
                  }
                  ${includeFields.id ? `<td>${tick.id}</td>` : ""}
                  ${includeFields.last_price ? `<td>${(tick.last_price ?? 0).toFixed(2)}</td>` : ""}
                  ${includeFields.volume ? `<td>${tick.volume}</td>` : ""}
                  ${includeFields.delay ? `<td>${tick.delay}</td>` : ""}
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(htmlContent)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Data
          </CardTitle>
          <CardDescription>Export tick data and performance reports in various formats</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Export Format */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4" />
                    CSV (Comma Separated Values)
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    JSON (JavaScript Object Notation)
                  </div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    PDF Report
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label>Date Range (Optional)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-date" className="text-sm">
                  Start Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="end-date" className="text-sm">
                  End Date
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Fields to Include */}
          <div className="space-y-2">
            <Label>Fields to Include</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="timestamp"
                  checked={includeFields.timestamp}
                  onCheckedChange={(checked) => setIncludeFields((prev) => ({ ...prev, timestamp: !!checked }))}
                />
                <Label htmlFor="timestamp">Timestamp</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="id"
                  checked={includeFields.id}
                  onCheckedChange={(checked) => setIncludeFields((prev) => ({ ...prev, id: !!checked }))}
                />
                <Label htmlFor="id">Tick ID</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="last_price"
                  checked={includeFields.last_price}
                  onCheckedChange={(checked) => setIncludeFields((prev) => ({ ...prev, last_price: !!checked }))}
                />
                <Label htmlFor="last_price">Last Price</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="volume"
                  checked={includeFields.volume}
                  onCheckedChange={(checked) => setIncludeFields((prev) => ({ ...prev, volume: !!checked }))}
                />
                <Label htmlFor="volume">Volume</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delay"
                  checked={includeFields.delay}
                  onCheckedChange={(checked) => setIncludeFields((prev) => ({ ...prev, delay: !!checked }))}
                />
                <Label htmlFor="delay">Delay</Label>
              </div>
            </div>
          </div>

          {/* Export Button */}
          <Button onClick={handleExport} className="w-full" size="lg">
            <Download className="w-4 h-4 mr-2" />
            Export {ticks.length} Records as {exportFormat.toUpperCase()}
          </Button>
        </CardContent>
      </Card>

      {/* Quick Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Export</CardTitle>
          <CardDescription>Pre-configured export options for common use cases</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              setExportFormat("csv")
              setIncludeFields({ timestamp: true, last_price: true, delay: true, id: false, volume: true })
              handleExport()
            }}
          >
            <Table className="w-4 h-4 mr-2" />
            Export Performance Data (CSV)
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              setExportFormat("json")
              setIncludeFields({ timestamp: true, last_price: true, delay: true, id: true, volume: true })
              handleExport()
            }}
          >
            <FileText className="w-4 h-4 mr-2" />
            Export Complete Dataset (JSON)
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              setExportFormat("pdf")
              setIncludeFields({ timestamp: true, last_price: true, delay: true, id: false, volume: true })
              handleExport()
            }}
          >
            <FileText className="w-4 h-4 mr-2" />
            Generate Summary Report (PDF)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
