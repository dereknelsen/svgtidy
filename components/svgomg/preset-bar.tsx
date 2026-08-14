"use client";

import { useMemo, useState } from "react";
import {
  BookmarkPlusIcon,
  Share2Icon,
  CheckIcon,
  Trash2Icon,
  StarIcon,
} from "lucide-react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BUILT_IN_PRESETS, type Settings } from "@/lib/settings";
import type { PresetDocType } from "@/lib/db";
import { cn } from "@/lib/utils";

function settingsEqual(a: Settings, b: Settings): boolean {
  const keys = Object.keys(a) as (keyof Settings)[];
  return keys.every((k) => a[k] === b[k]);
}

type PresetBarProps = {
  settings: Settings;
  onApply: (settings: Settings) => void;
  savedPresets: PresetDocType[];
  onSave: (name: string, settings: Settings) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
};

export function PresetBar({
  settings,
  onApply,
  savedPresets,
  onSave,
  onRemove,
}: PresetBarProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  const activeBuiltIn = useMemo(
    () =>
      BUILT_IN_PRESETS.find((p) => settingsEqual(p.settings, settings))?.id ??
      null,
    [settings],
  );
  const activeSaved = useMemo(
    () =>
      savedPresets.find((p) => settingsEqual(p.settings, settings))?.id ?? null,
    [savedPresets, settings],
  );

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
    await onSave(trimmed, settings);
    setName("");
    setSaveOpen(false);
    toast.success(`Saved preset "${trimmed}"`);
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Presets</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={copyShareLink}>
            <Share2Icon />
            Share
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setSaveOpen(true)}>
            <BookmarkPlusIcon />
            Save
          </Button>
        </div>
      </div>

      <TooltipProvider delay={300}>
        <div className="flex flex-wrap gap-1.5">
          {BUILT_IN_PRESETS.map((preset) => {
            const active = activeBuiltIn === preset.id;
            return (
              <Tooltip key={preset.id}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => onApply(preset.settings)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        active
                          ? "border-success bg-success/10 text-success"
                          : "border-border bg-card text-muted-foreground hover:border-ring hover:text-foreground",
                      )}
                    >
                      {active && <CheckIcon className="size-3" />}
                      {preset.name}
                    </button>
                  }
                />
                <TooltipContent>{preset.hint}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {savedPresets.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase">
            Yours
          </span>
          {savedPresets.map((preset) => {
            const active = activeSaved === preset.id;
            return (
              <div
                key={preset.id}
                className={cn(
                  "group flex items-center justify-between rounded-xl border px-2.5 py-1.5 transition-colors",
                  active
                    ? "border-success/60 bg-success/5"
                    : "hover:bg-muted border-transparent",
                )}
              >
                <button
                  type="button"
                  onClick={() => onApply(preset.settings as Settings)}
                  className="flex min-w-0 items-center gap-2 text-sm"
                >
                  <StarIcon
                    className={cn(
                      "size-3.5 shrink-0",
                      active
                        ? "fill-success text-success"
                        : "text-muted-foreground",
                    )}
                  />
                  <span className="truncate">{preset.name}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete preset ${preset.name}`}
                  onClick={() => onRemove(preset.id)}
                  className="hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

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
