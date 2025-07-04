"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Clock, AlertTriangle } from "lucide-react"
import type { InactivityAlertConfig } from "@/hooks/use-inactivity-alerts"
import { getDetailedMarketStatus, getMarketTypeForInstrument } from "@/utils/market-timings"

interface SymbolAlertSettingsDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  config?: InactivityAlertConfig
  onSave: (config: InactivityAlertConfig) => void
  symbolName: string
}

const DEFAULT_CONFIG: InactivityAlertConfig = {
  enabled: false,
  deviation: 0.1,
  duration: 30,
  respectMarketHours: true,
}

export function SymbolAlertSettingsDialog({
  isOpen,
  onOpenChange,
  config,
  onSave,
  symbolName,
}: SymbolAlertSettingsDialogProps) {
  const [localConfig, setLocalConfig] = useState<InactivityAlertConfig>(config || DEFAULT_CONFIG)

  useEffect(() => {
    setLocalConfig(config || DEFAULT_CONFIG)
  }, [config, isOpen])

  const handleSave = () => {
    onSave(localConfig)
    onOpenChange(false)
  }

  // Get market information for this symbol
  const marketStatus = getDetailedMarketStatus(symbolName)
  const marketType = getMarketTypeForInstrument(symbolName)

  const getMarketTimingInfo = () => {
    switch (marketType) {
      case "equity":
        return {
          sessions: "Pre-market (9:00-9:15), Normal (9:15-15:30), Post-market (15:30-16:00)",
          days: "Monday to Friday (excluding holidays)",
        }
      case "currency":
        return {
          sessions: "Normal (9:00-17:00)",
          days: "Monday to Friday (excluding holidays)",
        }
      case "commodity":
        return {
          sessions: "Normal (9:00-23:30)",
          days: "Monday to Friday (excluding holidays)",
        }
      default:
        return {
          sessions: "Normal (9:00-17:00)",
          days: "Monday to Friday (excluding holidays)",
        }
    }
  }

  const timingInfo = getMarketTimingInfo()

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Inactivity Alert Settings</DialogTitle>
          <DialogDescription>
            Configure price inactivity alerts for <strong>{symbolName}</strong> ({marketType.toUpperCase()})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Market Status */}
          <div
            className={`p-3 rounded-lg border ${
              marketStatus.isOpen ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Current Market Status</span>
              <Badge variant={marketStatus.isOpen ? "default" : "secondary"}>{marketStatus.session}</Badge>
            </div>
            <p className="text-sm text-gray-600">{marketStatus.reason}</p>
            <div className="text-xs text-gray-500 mt-1">
              <div>Sessions: {timingInfo.sessions}</div>
              <div>Trading Days: {timingInfo.days}</div>
            </div>
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div>
              <Label htmlFor="enabled" className="text-base font-medium">
                Enable Inactivity Alerts
              </Label>
              <p className="text-sm text-muted-foreground mt-1">Monitor this symbol for price inactivity</p>
            </div>
            <Switch
              id="enabled"
              checked={localConfig.enabled}
              onCheckedChange={(checked) => setLocalConfig((prev) => ({ ...prev, enabled: checked }))}
            />
          </div>

          {/* Configuration Options */}
          <div className={`space-y-6 transition-opacity ${localConfig.enabled ? "opacity-100" : "opacity-50"}`}>
            {/* Market Hours Respect */}
            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div>
                <Label htmlFor="respectMarketHours" className="text-base font-medium">
                  Respect Market Hours
                </Label>
                <p className="text-sm text-muted-foreground mt-1">Only trigger alerts during official trading hours</p>
              </div>
              <Switch
                id="respectMarketHours"
                checked={localConfig.respectMarketHours}
                onCheckedChange={(checked) => setLocalConfig((prev) => ({ ...prev, respectMarketHours: checked }))}
                disabled={!localConfig.enabled}
              />
            </div>

            {!localConfig.respectMarketHours && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium">Warning: 24/7 Monitoring</p>
                  <p>
                    Alerts will trigger even when markets are closed. This may result in alerts during non-trading hours
                    when price data might be stale.
                  </p>
                </div>
              </div>
            )}

            {/* Price Deviation Threshold */}
            <div className="space-y-3">
              <Label htmlFor="deviation" className="text-base font-medium">
                Price Movement Threshold
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">±</span>
                <Input
                  id="deviation"
                  type="number"
                  value={localConfig.deviation}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      deviation: Math.max(0.01, Number.parseFloat(e.target.value) || 0.1),
                    }))
                  }
                  step="0.01"
                  min="0.01"
                  max="100"
                  disabled={!localConfig.enabled}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">units</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Alert if price doesn't move more than ±{localConfig.deviation} from the baseline.
              </p>
            </div>

            {/* Duration Slider */}
            <div className="space-y-3">
              <Label htmlFor="duration" className="text-base font-medium">
                Monitoring Duration: {localConfig.duration} seconds
              </Label>
              <Slider
                id="duration"
                min={5}
                max={300}
                step={5}
                value={[localConfig.duration]}
                onValueChange={([value]) => setLocalConfig((prev) => ({ ...prev, duration: value }))}
                disabled={!localConfig.enabled}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5s (Very Sensitive)</span>
                <span>60s (Balanced)</span>
                <span>300s (Less Sensitive)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                How long to wait before triggering an alert if price stays within the threshold.
              </p>
            </div>

            {/* Preview */}
            {localConfig.enabled && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800">Alert Preview:</p>
                <p className="text-sm text-blue-700 mt-1">
                  You'll be alerted if <strong>{symbolName}</strong> price doesn't move by ±{localConfig.deviation} for{" "}
                  {localConfig.duration} seconds{localConfig.respectMarketHours ? " during trading hours" : " (24/7)"}.
                </p>
                {localConfig.respectMarketHours && (
                  <p className="text-xs text-blue-600 mt-1">Active during: {timingInfo.sessions}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={localConfig.enabled && localConfig.deviation <= 0}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
