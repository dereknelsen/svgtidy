"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SETTINGS_GROUPS } from "@/lib/settings-meta";
import type { Settings } from "@/lib/settings";

type SettingsPanelProps = {
  settings: Settings;
  onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onReset: () => void;
  changedCount: number;
};

export function SettingsPanel({
  settings,
  onChange,
  onReset,
  changedCount,
}: SettingsPanelProps) {
  return (
    <TooltipProvider delay={300}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Optimizations
            </h2>
            <p className="text-muted-foreground text-xs">
              {changedCount === 0
                ? "Using defaults"
                : `${changedCount} changed from default`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={onReset}
            disabled={changedCount === 0}
            aria-label="Reset settings to defaults"
          >
            <RotateCcwIcon />
            Reset
          </Button>
        </div>

        <Separator />

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Precision — the single highest-impact control, given top billing. */}
          <section className="mb-6">
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor="precision" className="text-sm font-medium">
                Number precision
              </label>
              <span className="text-success font-mono text-sm tabular-nums">
                {settings.floatPrecision}
              </span>
            </div>
            <Slider
              id="precision"
              min={0}
              max={8}
              step={1}
              value={[settings.floatPrecision]}
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                onChange("floatPrecision", next);
              }}
            />
            <p className="text-muted-foreground mt-2 text-xs">
              Decimal places for coordinates. Lower is smaller; 2–3 is safe for
              most icons.
            </p>
          </section>

          <Separator className="mb-4" />

          <div className="flex flex-col gap-6">
            {SETTINGS_GROUPS.map((group) => (
              <section key={group.id}>
                <div className="mb-3">
                  <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    {group.title}
                  </h3>
                </div>
                <div className="flex flex-col gap-3">
                  {group.toggles.map((toggle) => {
                    const id = `set-${toggle.key}`;
                    return (
                      <div
                        key={toggle.key}
                        className="flex items-start justify-between gap-3"
                      >
                        <div className="flex min-w-0 flex-col">
                          <label
                            htmlFor={id}
                            className="flex items-center gap-1.5 text-sm leading-none font-medium"
                          >
                            {toggle.label}
                            {toggle.risky && (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <TriangleAlertIcon
                                      className="text-warning size-3"
                                      aria-label="May change appearance"
                                    />
                                  }
                                />
                                <TooltipContent>
                                  Can change how the SVG renders
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </label>
                          <span className="text-muted-foreground mt-1 text-xs leading-snug">
                            {toggle.description}
                          </span>
                        </div>
                        <Switch
                          id={id}
                          checked={settings[toggle.key]}
                          onCheckedChange={(checked) =>
                            onChange(toggle.key, checked)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
