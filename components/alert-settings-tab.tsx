"use client"

import { useState, useMemo } from "react"
import { Search, Bell, Save, Settings2, AlertTriangle, Clock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type { TickData } from "@/hooks/use-tick-data"
import type { InactivityAlertConfig } from "@/hooks/use-inactivity-alerts"
import { getInstrumentName, getExchange } from "./market-data-grid"
import { getDetailedMarketStatus } from "@/utils/market-timings"

interface AlertSettingsTabProps {
  ticks: TickData[]
  alertConfigurations: Map<number, InactivityAlertConfig>
  onConfigurationChange: (token: number, config: InactivityAlertConfig) => void
  inactiveSymbols: Set<number>
}

interface SymbolInfo {
  token: number
  name: string
  exchange: string
  lastPrice: number
  isActive: boolean
  config?: InactivityAlertConfig
  marketStatus: ReturnType<typeof getDetailedMarketStatus>
}

const PRESET_DURATIONS = [
  { label: "5 seconds", value: 5 },
  { label: "15 seconds", value: 15 },
  { label: "30 seconds", value: 30 },
  { label: "1 minute", value: 60 },
  { label: "2 minutes", value: 120 },
  { label: "5 minutes", value: 300 },
]

const PRESET_DEVIATIONS = [
  { label: "±0.01", value: 0.01 },
  { label: "±0.05", value: 0.05 },
  { label: "±0.1", value: 0.1 },
  { label: "±0.5", value: 0.5 },
  { label: "±1.0", value: 1.0 },
  { label: "±2.0", value: 2.0 },
]

export function AlertSettingsTab({
  ticks,
  alertConfigurations,
  onConfigurationChange,
  inactiveSymbols,
}: AlertSettingsTabProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "enabled" | "disabled">("all")
  const [selectedSymbols, setSelectedSymbols] = useState<Set<number>>(new Set())
  const [bulkConfig, setBulkConfig] = useState<InactivityAlertConfig>({
    enabled: true,
    deviation: 0.1,
    duration: 30,
    respectMarketHours: true,
  })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [pendingConfigs, setPendingConfigs] = useState<Map<number, InactivityAlertConfig>>(new Map())

  // Get unique symbols from ticks
  const availableSymbols = useMemo(() => {
    const symbolMap = new Map<number, SymbolInfo>()

    ticks.forEach((tick) => {
      if (!symbolMap.has(tick.instrument_token) || tick.receivedAt > symbolMap.get(tick.instrument_token)!.lastPrice) {
        const config = alertConfigurations.get(tick.instrument_token)
        const instrumentName = getInstrumentName(tick)
        const marketStatus = getDetailedMarketStatus(instrumentName)

        symbolMap.set(tick.instrument_token, {
          token: tick.instrument_token,
          name: instrumentName,
          exchange: getExchange(tick),
          lastPrice: tick.last_price,
          isActive: !inactiveSymbols.has(tick.instrument_token),
          config,
          marketStatus,
        })
      }
    })

    return Array.from(symbolMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [ticks, alertConfigurations, inactiveSymbols])

  // Filter symbols based on search and status
  const filteredSymbols = useMemo(() => {
    return availableSymbols.filter((symbol) => {
      const matchesSearch =
        symbol.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        symbol.exchange.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesFilter =
        filterStatus === "all" ||
        (filterStatus === "enabled" && symbol.config?.enabled) ||
        (filterStatus === "disabled" && !symbol.config?.enabled)

      return matchesSearch && matchesFilter
    })
  }, [availableSymbols, searchTerm, filterStatus])

  // Statistics
  const stats = useMemo(() => {
    const total = availableSymbols.length
    const enabled = availableSymbols.filter((s) => s.config?.enabled).length
    const alerting = availableSymbols.filter((s) => !s.isActive).length
    const marketOpen = availableSymbols.filter((s) => s.marketStatus.isOpen).length

    return { total, enabled, alerting, marketOpen }
  }, [availableSymbols])

  const handleSymbolConfigChange = (token: number, config: InactivityAlertConfig) => {
    setPendingConfigs((prev) => new Map(prev).set(token, config))
    setHasUnsavedChanges(true)
  }

  const handleBulkApply = () => {
    selectedSymbols.forEach((token) => {
      setPendingConfigs((prev) => new Map(prev).set(token, bulkConfig))
    })
    setHasUnsavedChanges(true)
  }

  const handleSaveAll = () => {
    pendingConfigs.forEach((config, token) => {
      onConfigurationChange(token, config)
    })
    setPendingConfigs(new Map())
    setHasUnsavedChanges(false)
  }

  const handleSelectAll = () => {
    if (selectedSymbols.size === filteredSymbols.length) {
      setSelectedSymbols(new Set())
    } else {
      setSelectedSymbols(new Set(filteredSymbols.map((s) => s.token)))
    }
  }

  const getEffectiveConfig = (symbol: SymbolInfo): InactivityAlertConfig => {
    return (
      pendingConfigs.get(symbol.token) ||
      symbol.config || {
        enabled: false,
        deviation: 0.1,
        duration: 30,
        respectMarketHours: true,
      }
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Alert Settings</h2>
          <p className="text-sm text-gray-500">Configure price inactivity alerts for trading symbols</p>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-orange-600 border-orange-200">
              Unsaved Changes
            </Badge>
          )}
          <Button onClick={handleSaveAll} disabled={!hasUnsavedChanges} className="gap-2">
            <Save className="w-4 h-4" />
            Save All Changes
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded">
                <Settings2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Symbols</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded">
                <Bell className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Alerts Enabled</p>
                <p className="text-2xl font-bold text-gray-900">{stats.enabled}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Currently Alerting</p>
                <p className="text-2xl font-bold text-gray-900">{stats.alerting}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Markets Open</p>
                <p className="text-2xl font-bold text-gray-900">{stats.marketOpen}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="individual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="individual">Individual Settings</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="space-y-4">
          {/* Search and Filter */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search symbols..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Symbols</SelectItem>
                    <SelectItem value="enabled">Alerts Enabled</SelectItem>
                    <SelectItem value="disabled">Alerts Disabled</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleSelectAll}>
                  {selectedSymbols.size === filteredSymbols.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Symbols Table */}
          <Card>
            <CardHeader>
              <CardTitle>Symbol Alert Configuration</CardTitle>
              <CardDescription>Configure individual alert settings for each trading symbol</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Market</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead>Market Hours</TableHead>
                      <TableHead>Threshold</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSymbols.map((symbol) => {
                      const config = getEffectiveConfig(symbol)
                      const isSelected = selectedSymbols.has(symbol.token)
                      const isPending = pendingConfigs.has(symbol.token)

                      return (
                        <TableRow key={symbol.token} className={isPending ? "bg-blue-50" : ""}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const newSelected = new Set(selectedSymbols)
                                if (e.target.checked) {
                                  newSelected.add(symbol.token)
                                } else {
                                  newSelected.delete(symbol.token)
                                }
                                setSelectedSymbols(newSelected)
                              }}
                              className="rounded"
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{symbol.name}</div>
                              <div className="text-xs text-gray-500">{symbol.exchange}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Badge variant={symbol.marketStatus.isOpen ? "default" : "secondary"} className="text-xs">
                                {symbol.marketStatus.session}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                ({symbol.marketStatus.marketType.toUpperCase()})
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {symbol.isActive ? (
                              <Badge variant="outline" className="text-green-600">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Alerting</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={config.enabled}
                              onCheckedChange={(checked) =>
                                handleSymbolConfigChange(symbol.token, { ...config, enabled: checked })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={config.respectMarketHours}
                              onCheckedChange={(checked) =>
                                handleSymbolConfigChange(symbol.token, { ...config, respectMarketHours: checked })
                              }
                              disabled={!config.enabled}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={config.deviation}
                              onChange={(e) =>
                                handleSymbolConfigChange(symbol.token, {
                                  ...config,
                                  deviation: Math.max(0.01, Number.parseFloat(e.target.value) || 0.1),
                                })
                              }
                              step="0.01"
                              min="0.01"
                              className="w-20"
                              disabled={!config.enabled}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={config.duration.toString()}
                              onValueChange={(value) =>
                                handleSymbolConfigChange(symbol.token, { ...config, duration: Number.parseInt(value) })
                              }
                              disabled={!config.enabled}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PRESET_DURATIONS.map((preset) => (
                                  <SelectItem key={preset.value} value={preset.value.toString()}>
                                    {preset.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {config.enabled ? (
                              <div className="text-xs text-gray-600">
                                Alert if price doesn't move ±{config.deviation} for {config.duration}s
                                {config.respectMarketHours ? " (trading hours only)" : " (24/7)"}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400">Disabled</div>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bulk Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Bulk Alert Configuration</CardTitle>
                <CardDescription>Apply the same alert settings to multiple symbols at once</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bulk-enabled" className="text-base font-medium">
                    Enable Alerts
                  </Label>
                  <Switch
                    id="bulk-enabled"
                    checked={bulkConfig.enabled}
                    onCheckedChange={(checked) => setBulkConfig((prev) => ({ ...prev, enabled: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="bulk-market-hours" className="text-base font-medium">
                    Respect Market Hours
                  </Label>
                  <Switch
                    id="bulk-market-hours"
                    checked={bulkConfig.respectMarketHours}
                    onCheckedChange={(checked) => setBulkConfig((prev) => ({ ...prev, respectMarketHours: checked }))}
                    disabled={!bulkConfig.enabled}
                  />
                </div>

                {!bulkConfig.respectMarketHours && bulkConfig.enabled && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                    <div className="text-sm text-orange-800">
                      <p className="font-medium">24/7 Monitoring Enabled</p>
                      <p>Alerts will trigger even when markets are closed.</p>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="space-y-3">
                  <Label className="text-base font-medium">Price Deviation Threshold</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_DEVIATIONS.map((preset) => (
                      <Button
                        key={preset.value}
                        variant={bulkConfig.deviation === preset.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setBulkConfig((prev) => ({ ...prev, deviation: preset.value }))}
                        disabled={!bulkConfig.enabled}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Custom:</span>
                    <Input
                      type="number"
                      value={bulkConfig.deviation}
                      onChange={(e) =>
                        setBulkConfig((prev) => ({
                          ...prev,
                          deviation: Math.max(0.01, Number.parseFloat(e.target.value) || 0.1),
                        }))
                      }
                      step="0.01"
                      min="0.01"
                      className="w-24"
                      disabled={!bulkConfig.enabled}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-medium">Duration: {bulkConfig.duration} seconds</Label>
                  <Slider
                    value={[bulkConfig.duration]}
                    onValueChange={([value]) => setBulkConfig((prev) => ({ ...prev, duration: value }))}
                    min={5}
                    max={300}
                    step={5}
                    disabled={!bulkConfig.enabled}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>5s</span>
                    <span>60s</span>
                    <span>300s</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Selected Symbols</Label>
                    <Badge variant="outline">{selectedSymbols.size} selected</Badge>
                  </div>
                  <Button onClick={handleBulkApply} disabled={selectedSymbols.size === 0} className="w-full">
                    Apply to Selected Symbols
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Configuration Preview</CardTitle>
                <CardDescription>Preview of bulk settings that will be applied</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Bulk Configuration</h4>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div>Status: {bulkConfig.enabled ? "Enabled" : "Disabled"}</div>
                    <div>Market Hours: {bulkConfig.respectMarketHours ? "Respected" : "Ignored (24/7)"}</div>
                    <div>Threshold: ±{bulkConfig.deviation}</div>
                    <div>Duration: {bulkConfig.duration} seconds</div>
                    <div>Will apply to: {selectedSymbols.size} symbols</div>
                  </div>
                </div>

                {selectedSymbols.size > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Selected Symbols:</Label>
                    <ScrollArea className="h-32 mt-2">
                      <div className="space-y-1">
                        {filteredSymbols
                          .filter((s) => selectedSymbols.has(s.token))
                          .map((symbol) => (
                            <div
                              key={symbol.token}
                              className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
                            >
                              <span>{symbol.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500">{symbol.exchange}</span>
                                <Badge
                                  variant={symbol.marketStatus.isOpen ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {symbol.marketStatus.session}
                                </Badge>
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {bulkConfig.enabled && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800">Alert Preview:</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      You'll be alerted if selected symbols' prices don't move by ±{bulkConfig.deviation} for{" "}
                      {bulkConfig.duration} seconds{bulkConfig.respectMarketHours ? " during trading hours" : " (24/7)"}
                      .
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
