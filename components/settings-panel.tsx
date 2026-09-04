"use client";

import { useMemo, useState } from "react";
import { SearchIcon, TriangleAlertIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DEFAULT_SETTINGS,
  SETTING_DESCRIPTORS,
  SETTINGS_GROUPS,
  type Settings,
  type ToggleMeta,
} from "@/lib/settings";

const precision = SETTING_DESCRIPTORS.floatPrecision;

type SettingsPanelProps = {
  settings: Settings;
  onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

function ToggleRow({
  toggle,
  checked,
  onChange,
}: {
  toggle: ToggleMeta;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = `set-${toggle.key}`;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <label
          htmlFor={id}
          className="inline items-center gap-1.5 text-sm leading-none font-medium"
        >
          {toggle.label}
          {toggle.risky && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <TriangleAlertIcon
                    className="text-warning ml-1 inline-flex size-3 shrink-0"
                    aria-label="May change appearance or behavior"
                  />
                }
              />
              <TooltipContent>
                Can change how the SVG renders or behaves
              </TooltipContent>
            </Tooltip>
          )}
        </label>
        <span className="text-muted-foreground mt-1 text-xs leading-snug">
          {toggle.description}
        </span>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matchesQuery = (label: string, description: string) =>
    label.toLowerCase().includes(q) || description.toLowerCase().includes(q);

  // Flat match list while filtering; group changed-counts for the badges.
  const filteredToggles = useMemo(
    () =>
      q
        ? SETTINGS_GROUPS.flatMap((group) =>
            group.toggles.filter((t) => matchesQuery(t.label, t.description)),
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q],
  );
  const changedByGroup = useMemo(
    () =>
      Object.fromEntries(
        SETTINGS_GROUPS.map((group) => [
          group.id,
          group.toggles.filter(
            (t) => settings[t.key] !== DEFAULT_SETTINGS[t.key],
          ).length,
        ]),
      ),
    [settings],
  );

  const precisionVisible =
    !q || matchesQuery(precision.label, precision.description);

  // The panel takes its natural height — the inspector itself scrolls, so
  // groups always expand fully instead of scrolling inside a nested area.
  return (
    <div className="flex flex-col">
      <div className="relative px-4 pt-3 pb-3">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-5 left-7 size-4" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter settings…"
          aria-label="Filter settings"
          className="h-8 rounded-full pl-9"
        />
      </div>

      <Separator />

      <div className="px-4 py-4">
        {precisionVisible && (
          <section className="mb-6">
            <div className="mb-2 flex items-baseline justify-between">
              {/* Not a <label for=…>: the slider's focusable input lives deep
                  inside the primitive, which wires aria-labelledby to it. */}
              <span id="precision-label" className="text-sm font-medium">
                {precision.label}
              </span>
              <span className="text-success font-mono text-sm tabular-nums">
                {settings.floatPrecision}
              </span>
            </div>
            <Slider
              aria-labelledby="precision-label"
              min={precision.control.min}
              max={precision.control.max}
              step={precision.control.step}
              value={[settings.floatPrecision]}
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                onChange("floatPrecision", next);
              }}
            />
            <p className="text-muted-foreground mt-2 text-xs">
              {precision.description}
            </p>
          </section>
        )}

        {q ? (
          filteredToggles.length > 0 ? (
            <div className="flex flex-col gap-3">
              {filteredToggles.map((toggle) => (
                <ToggleRow
                  key={toggle.key}
                  toggle={toggle}
                  checked={settings[toggle.key]}
                  onChange={(checked) => onChange(toggle.key, checked)}
                />
              ))}
            </div>
          ) : (
            !precisionVisible && (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No settings match &ldquo;{query.trim()}&rdquo;
              </p>
            )
          )
        ) : (
          <Accordion multiple defaultValue={["cleanup", "sanitize"]}>
            {SETTINGS_GROUPS.map((group) => {
              const changed = changedByGroup[group.id];
              return (
                <AccordionItem key={group.id} value={group.id}>
                  <AccordionTrigger className="py-3">
                    <span className="flex items-center gap-2">
                      {group.title}
                      {changed > 0 && (
                        <Badge
                          variant="secondary"
                          className="bg-success/10 text-success h-5 min-w-5 rounded-full px-1.5 font-mono text-xs tabular-nums"
                        >
                          {changed}
                        </Badge>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-3 text-xs">
                      {group.description}
                    </p>
                    <div className="flex flex-col gap-3">
                      {group.toggles.map((toggle) => (
                        <ToggleRow
                          key={toggle.key}
                          toggle={toggle}
                          checked={settings[toggle.key]}
                          onChange={(checked) => onChange(toggle.key, checked)}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </div>
  );
}
