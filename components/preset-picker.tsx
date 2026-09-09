"use client";

import { useMemo, useState } from "react";
import { BookmarkPlusIcon, Share2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BUILT_IN_PRESETS, SETTING_KEYS, type Settings } from "@/lib/settings";
import {
  DEFAULT_FORMAT,
  FORMAT_KEYS,
  parseFormatSettings,
  type FormatSettings,
} from "@/lib/format-settings";
import { Label } from "@/components/ui/label";
import type { PresetDocType } from "@/lib/db";

/**
 * A preset snapshot covers both halves of the model: optimize settings plus
 * format settings, stored flat. Built-ins predate format settings, so they
 * compare against the format defaults; old saved presets parse the same way.
 */
function presetMatches(
  preset: { settings: unknown },
  settings: Settings,
  format: FormatSettings,
): boolean {
  const stored = preset.settings as Record<string, unknown>;
  const storedFormat = parseFormatSettings(stored);
  return (
    SETTING_KEYS.every((k) => stored[k] === settings[k]) &&
    FORMAT_KEYS.every((k) => storedFormat[k] === format[k])
  );
}

type PresetPickerProps = {
  settings: Settings;
  format: FormatSettings;
  /** Receives unvalidated data; the settings models validate on apply. */
  onApply: (settings: unknown) => void;
  savedPresets: PresetDocType[];
  onSave: (
    name: string,
    settings: Settings & FormatSettings,
  ) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
};

/**
 * One compact row: a Select showing the active preset ("Custom" when the
 * settings match none), plus save/share actions. Saved-preset ids are
 * namespaced "saved:" so they can never collide with built-in ids.
 */
export function PresetPicker({
  settings,
  format,
  onApply,
  savedPresets,
  onSave,
  onRemove,
}: PresetPickerProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  const activeBuiltIn = useMemo(
    () =>
      BUILT_IN_PRESETS.find((p) => presetMatches(p, settings, format))?.id ??
      null,
    [settings, format],
  );
  const activeSaved = useMemo(
    () => savedPresets.find((p) => presetMatches(p, settings, format)) ?? null,
    [savedPresets, settings, format],
  );
  const activeId =
    activeBuiltIn ?? (activeSaved ? `saved:${activeSaved.id}` : null);

  // Base UI renders the trigger label from this map (value → label).
  const items = useMemo(
    () =>
      Object.fromEntries([
        ...BUILT_IN_PRESETS.map((p) => [p.id, p.name]),
        ...savedPresets.map((p) => [`saved:${p.id}`, p.name]),
      ]) as Record<string, string>,
    [savedPresets],
  );

  function handleChange(value: unknown) {
    if (typeof value !== "string") return;
    const builtIn = BUILT_IN_PRESETS.find((p) => p.id === value);
    if (builtIn) {
      // Built-ins predate format settings, so applying one resets format too.
      onApply({ ...DEFAULT_FORMAT, ...builtIn.settings });
      return;
    }
    const saved = savedPresets.find((p) => `saved:${p.id}` === value);
    if (saved) onApply(saved.settings);
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Share link copied", {
        description: "These exact settings are baked into the URL.",
      });
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onSave(trimmed, { ...settings, ...format });
    setName("");
    setSaveOpen(false);
    toast.success(`Saved preset "${trimmed}"`);
  }

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <Select value={activeId} onValueChange={handleChange} items={items}>
          <TooltipTrigger
            render={
              <SelectTrigger
                size="sm"
                className="min-w-0 flex-1"
                aria-label="Preset"
              >
                <SelectValue placeholder="Custom" />
              </SelectTrigger>
            }
          />

          <SelectContent>
            <SelectGroup>
              <SelectLabel>Built-in presets</SelectLabel>
              {BUILT_IN_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectGroup>
            {savedPresets.length > 0 && (
              <SelectGroup>
                <SelectLabel>Yours</SelectLabel>
                {savedPresets.map((preset) => (
                  <SelectItem key={preset.id} value={`saved:${preset.id}`}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <TooltipContent>Select a preset</TooltipContent>
      </Tooltip>
      {activeSaved && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete preset ${activeSaved.name}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => void onRemove(activeSaved.id)}
              >
                <Trash2Icon />
              </Button>
            }
          />
          <TooltipContent>Delete this preset</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Save current settings as a preset"
              onClick={() => setSaveOpen(true)}
            >
              <BookmarkPlusIcon />
            </Button>
          }
        />
        <TooltipContent>Save as preset</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy a share link for these settings"
              onClick={copyShareLink}
            >
              <Share2Icon />
            </Button>
          }
        />
        <TooltipContent>Copy share link</TooltipContent>
      </Tooltip>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save preset</DialogTitle>
            <DialogDescription>
              Store the current settings locally so you can reuse them anytime.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="e.g. App icons"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                handleSave();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              Save preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
