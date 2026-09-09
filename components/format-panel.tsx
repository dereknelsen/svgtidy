"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { TextCursorInputIcon, Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ColorPicker,
  parseColor,
  type OklchColor,
} from "@/components/ui/fill-picker-base/color-picker";
import {
  CSS_ENCODING_OPTIONS,
  CSS_SNIPPET_OPTIONS,
  FILE_TYPE_OPTIONS,
  FORMAT_DESCRIPTORS,
  SIZE_MODES,
  SIZE_SUGGESTIONS,
  type CssQuotes,
  type CssSnippet,
  type DataUriEncoding,
  type FormatSettings,
  type SizeMode,
} from "@/lib/format-settings";
import { extractPalette } from "@/lib/format-output";
import { readLocal, writeLocal } from "@/lib/local-storage";
import type { SvgDocType } from "@/lib/db";
import { cn } from "@/lib/utils";

const SWATCHES_KEY = "svgtidy:swatches";

type FormatPanelProps = {
  svg: SvgDocType | null;
  /** The selected file's optimized output, the palette source. */
  optimizedSvg: string | null;
  format: FormatSettings;
  onFormatChange: <K extends keyof FormatSettings>(
    key: K,
    value: FormatSettings[K],
  ) => void;
  onRename: (id: string, name: string) => void;
  /** Opens the series rename dialog for the file's folder; null when loose. */
  onSeriesRename: (() => void) | null;
  onPartColorsChange: (id: string, partColors: Record<string, string>) => void;
  /** A part slot is being hovered/edited, so the preview dims the others. */
  onPartHover: (partKey: string | null) => void;
};

function loadSwatches(): string[] {
  const stored = readLocal(SWATCHES_KEY);
  return Array.isArray(stored)
    ? stored.filter((s) => typeof s === "string")
    : [];
}

/**
 * The user's saved playground composition: the full picker surface, opened
 * per color slot. `value` is the slot's current css color; commits stream out
 * as hex (or hex8 with alpha) while dragging.
 */
function PartColorPopover({
  label,
  value,
  onCommit,
  onOpenChange,
  trigger,
}: {
  label: string;
  value: string;
  onCommit: (css: string) => void;
  onOpenChange?: (open: boolean) => void;
  /** Must render a native <button>, per Base UI's trigger contract. */
  trigger: React.ReactElement;
}) {
  const { resolvedTheme } = useTheme();
  const [swatches, setSwatches] = useState<string[]>(loadSwatches);
  const parsed = useMemo(() => parseColor(value), [value]);
  const [color, setColor] = useState<OklchColor | undefined>(
    parsed ?? undefined,
  );
  // Throttle streamed commits so drags don't hammer the DB / preview.
  const lastCommit = useRef(0);
  const trailing = useRef<number | null>(null);

  const commit = useCallback(
    (css: string) => {
      const now = performance.now();
      if (trailing.current != null) window.clearTimeout(trailing.current);
      if (now - lastCommit.current > 150) {
        lastCommit.current = now;
        onCommit(css);
      } else {
        trailing.current = window.setTimeout(() => {
          lastCommit.current = performance.now();
          onCommit(css);
        }, 150);
      }
    },
    [onCommit],
  );

  useEffect(
    () => () => {
      if (trailing.current != null) window.clearTimeout(trailing.current);
    },
    [],
  );

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setColor(parseColor(value) ?? undefined);
        onOpenChange?.(open);
      }}
    >
      <PopoverTrigger aria-label={`Edit color ${label}`} render={trigger} />
      <PopoverContent
        align="end"
        className="w-auto border-0 bg-transparent p-0 shadow-none"
      >
        <ColorPicker.Root
          value={color}
          onValueChange={(next, _formatted, formats) => {
            setColor(next);
            commit(next.alpha < 1 ? formats.oklch : formats.hex);
          }}
          backgroundColor={resolvedTheme === "dark" ? "#201d1b" : "#fafaf9"}
        >
          <div className="flex items-stretch gap-2">
            <ColorPicker.GamutBadge
              showLabel={false}
              className="w-auto flex-1 justify-center"
            />
            <ColorPicker.ContrastReadout
              metrics={["wcag", "apca"]}
              showLabel={false}
              showValue={false}
              className="w-auto flex-1 justify-center"
            />
          </div>
          <ColorPicker.Area mode="oklch-cl" softProof />
          <ColorPicker.Preview />
          <div className="flex flex-col gap-1.5">
            <ColorPicker.Hue />
            <ColorPicker.Chroma />
            <ColorPicker.Lightness />
            <ColorPicker.Alpha />
          </div>
          <div className="flex items-center gap-2">
            <ColorPicker.FormatSwitcher className="flex-1" />
            <ColorPicker.EyeDropper className="h-8 w-full flex-1" />
          </div>
          <ColorPicker.ChannelInput showFormat={false} />
          <ColorPicker.CssInput />
          <ColorPicker.Swatches
            presets={swatches.length > 0 ? swatches : undefined}
            onAdd={(_c, hex) => {
              setSwatches((prev) => {
                const next = prev.includes(hex) ? prev : [...prev, hex];
                writeLocal(SWATCHES_KEY, next);
                return next;
              });
            }}
          />
        </ColorPicker.Root>
      </PopoverContent>
    </Popover>
  );
}

function Swatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn(
        "border-border bg-checkerboard inline-block size-5 shrink-0 overflow-hidden rounded-full border",
        className,
      )}
    >
      <span
        className="block h-full w-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <label htmlFor={id} className="text-sm leading-none font-medium">
          {label}
        </label>
        <span className="text-muted-foreground mt-1 text-xs leading-snug">
          {description}
        </span>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * The Format section of the inspector: how the optimized file is named,
 * packaged, sized, and colored on its way out. Everything here is a pure
 * projection. It never changes the optimizer's output.
 */
export function FormatPanel({
  svg,
  optimizedSvg,
  format,
  onFormatChange,
  onRename,
  onSeriesRename,
  onPartColorsChange,
  onPartHover,
}: FormatPanelProps) {
  const palette = useMemo(
    () => (optimizedSvg ? extractPalette(optimizedSvg) : []),
    [optimizedSvg],
  );
  const partColors = useMemo(() => svg?.partColors ?? {}, [svg]);
  const typeHint =
    FILE_TYPE_OPTIONS.find((o) => o.value === format.fileType)?.hint ?? "";
  const snippetHint =
    CSS_SNIPPET_OPTIONS.find((o) => o.value === format.cssSnippet)?.hint ?? "";
  const sizeDisabled = format.sizeMode === "auto" || format.sizeMode === "none";

  const [name, setName] = useState(svg?.name ?? "");
  useEffect(() => {
    // Reseed when the selection (or a sidebar rename) changes the source name.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(svg?.name ?? "");
  }, [svg?.id, svg?.name]);

  const commitName = () => {
    if (!svg) return;
    const next = name.trim();
    if (next && next !== svg.name) onRename(svg.id, next);
    else setName(svg.name);
  };

  const setPartColor = (slot: string, css: string | null) => {
    if (!svg) return;
    const next = { ...partColors };
    if (css === null) delete next[slot];
    else next[slot] = css;
    onPartColorsChange(svg.id, next);
  };

  if (!svg) return null;

  const mono = palette.length === 1;

  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-4">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="format-name"
          className="text-sm leading-none font-medium"
        >
          Name
        </label>
        <div className="flex items-center gap-1.5">
          <Input
            id="format-name"
            className="h-8"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.currentTarget.blur();
              }
              if (e.key === "Escape") setName(svg.name);
            }}
          />
          {onSeriesRename && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Rename files in this folder"
                    onClick={onSeriesRename}
                  >
                    <TextCursorInputIcon />
                  </Button>
                }
              />
              <TooltipContent>Rename files… ⌘R</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* File type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm leading-none font-medium">
          {FORMAT_DESCRIPTORS.fileType.label}
        </label>
        <Select
          items={FILE_TYPE_OPTIONS}
          value={format.fileType}
          onValueChange={(value) => {
            if (value)
              onFormatChange("fileType", value as FormatSettings["fileType"]);
          }}
        >
          <SelectTrigger className="h-8 w-full" aria-label="File type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs leading-snug">{typeHint}</p>
      </div>

      {/* CSS: what wraps the data URI, and how it's encoded */}
      {format.fileType === "css" && (
        <div className="border-border flex flex-col gap-4 border-l-2 pl-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm leading-none font-medium">
              {FORMAT_DESCRIPTORS.cssSnippet.label}
            </label>
            <Select
              items={CSS_SNIPPET_OPTIONS}
              value={format.cssSnippet}
              onValueChange={(value) => {
                if (value) onFormatChange("cssSnippet", value as CssSnippet);
              }}
            >
              <SelectTrigger className="h-8 w-full" aria-label="CSS snippet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CSS_SNIPPET_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs leading-snug">
              {snippetHint}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm leading-none font-medium">
              {FORMAT_DESCRIPTORS.cssEncoding.label}
            </label>
            <div className="flex items-center gap-1.5">
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={0}
                className="flex-1"
                aria-label="Encoding"
                value={[format.cssEncoding]}
                onValueChange={(value) => {
                  const next = value[0] as DataUriEncoding | undefined;
                  if (next) onFormatChange("cssEncoding", next);
                }}
              >
                {CSS_ENCODING_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className="flex-1"
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={0}
                aria-label={FORMAT_DESCRIPTORS.cssQuotes.label}
                value={[format.cssQuotes]}
                onValueChange={(value) => {
                  const next = value[0] as CssQuotes | undefined;
                  if (next) onFormatChange("cssQuotes", next);
                }}
              >
                <ToggleGroupItem
                  value="double"
                  aria-label="Double quotes"
                  className="font-mono"
                >
                  &quot;
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="single"
                  aria-label="Single quotes"
                  className="font-mono"
                >
                  &apos;
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <p className="text-muted-foreground text-xs leading-snug">
              {FORMAT_DESCRIPTORS.cssEncoding.description}{" "}
              {FORMAT_DESCRIPTORS.cssQuotes.description}
            </p>
          </div>
        </div>
      )}

      {/* Size */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm leading-none font-medium">
          {FORMAT_DESCRIPTORS.sizeMode.label}
        </label>
        <div className="flex items-center gap-1.5">
          <Combobox
            items={SIZE_SUGGESTIONS.map(String)}
            inputValue={sizeDisabled ? "" : String(format.sizeValue)}
            onInputValueChange={(value) => {
              const n = Number.parseFloat(value);
              if (Number.isFinite(n) && n >= 0) onFormatChange("sizeValue", n);
            }}
            disabled={sizeDisabled}
          >
            <ComboboxInput
              className="h-8 flex-1"
              placeholder={sizeDisabled ? "—" : "24"}
              aria-label="Size value"
              disabled={sizeDisabled}
            />
            <ComboboxContent>
              <ComboboxList>
                {(item: string) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <Select
            value={format.sizeMode}
            onValueChange={(value) => {
              if (value) onFormatChange("sizeMode", value as SizeMode);
            }}
          >
            <SelectTrigger className="h-8 w-24" aria-label="Size unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZE_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {mode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground text-xs leading-snug">
          {FORMAT_DESCRIPTORS.sizeMode.description}
        </p>
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="format-color"
          className="text-sm leading-none font-medium"
        >
          {FORMAT_DESCRIPTORS.color.label}
        </label>
        <div className="flex items-center gap-1.5">
          <Input
            id="format-color"
            className="h-8 font-mono text-xs"
            value={format.color}
            placeholder="original"
            onChange={(e) => onFormatChange("color", e.target.value)}
          />
          <PartColorPopover
            label="base"
            value={format.color || "#000000"}
            onCommit={(css) => onFormatChange("color", css)}
            trigger={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Pick base color"
              >
                <Swatch
                  color={format.color || "transparent"}
                  className="size-4"
                />
              </Button>
            }
          />
        </div>
        <p className="text-muted-foreground text-xs leading-snug">
          {FORMAT_DESCRIPTORS.color.description}{" "}
          {format.color === "currentColor" && "currentColor previews as black."}
        </p>

        {palette.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1" aria-label="Parts">
            {palette.map((slot) => {
              const override = partColors[slot];
              const effective =
                override ?? (mono && format.color ? format.color : slot);
              return (
                <li
                  key={slot}
                  className="group/part hover:bg-accent/50 -mx-1 flex items-center gap-2 rounded-md px-1 py-1"
                  onPointerEnter={() => onPartHover(slot)}
                  onPointerLeave={() => onPartHover(null)}
                >
                  <PartColorPopover
                    label={slot}
                    value={effective}
                    onCommit={(css) => setPartColor(slot, css)}
                    onOpenChange={(open) => onPartHover(open ? slot : null)}
                    trigger={
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center"
                        aria-label={`Edit color for ${slot}`}
                      >
                        <Swatch color={effective} />
                      </button>
                    }
                  />
                  <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">
                    {slot}
                  </span>
                  {override && (
                    <>
                      <span className="text-foreground font-mono text-xs">
                        {override}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-6 opacity-0 group-hover/part:opacity-100"
                        aria-label={`Reset color for ${slot}`}
                        onClick={() => setPartColor(slot, null)}
                      >
                        <Undo2Icon className="size-3.5" />
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Switches */}
      <SwitchRow
        id="format-empty-rect"
        label={FORMAT_DESCRIPTORS.includeEmptyRect.label}
        description={FORMAT_DESCRIPTORS.includeEmptyRect.description}
        checked={format.includeEmptyRect}
        onChange={(checked) => onFormatChange("includeEmptyRect", checked)}
      />
    </div>
  );
}
