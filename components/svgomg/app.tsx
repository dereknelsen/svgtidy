"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { Dropzone, type IncomingSvg } from "./dropzone";
import { FileList } from "./file-list";
import { SvgViewer } from "./svg-viewer";
import { SettingsPanel } from "./settings-panel";
import { PresetBar } from "./preset-bar";
import { WordmarkIcon } from "./wordmark";
import {
  useDatabase,
  useSvgs,
  usePresets,
  useSvgActions,
} from "@/hooks/use-svg-db";
import { useSettingsUrl } from "@/hooks/use-settings-url";
import { useOptimize } from "@/hooks/use-optimize";
import { downloadSvg } from "@/lib/download";
import { formatBytes, savingsPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SvgomgApp() {
  const { db, ready } = useDatabase();
  const svgs = useSvgs(db);
  const presets = usePresets(db);
  const { addSvgs, removeSvg, clearSvgs, savePreset, removePreset } =
    useSvgActions(db);

  const { settings, setSetting, applyPreset, reset, changedCount } =
    useSettingsUrl();

  const results = useOptimize(svgs, settings);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Keep a valid selection as files come and go.
  useEffect(() => {
    if (svgs.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !svgs.some((s) => s.id === selectedId)) {
      setSelectedId(svgs[0].id);
    }
  }, [svgs, selectedId]);

  const handleAddFiles = useCallback(
    (files: IncomingSvg[]) => {
      void addSvgs(files);
      toast.success(
        files.length === 1
          ? `Added ${files[0].name}`
          : `Added ${files.length} SVGs`,
      );
    },
    [addSvgs],
  );

  const selected = useMemo(
    () => svgs.find((s) => s.id === selectedId) ?? null,
    [svgs, selectedId],
  );

  // Aggregate stats across the whole batch for the header readout.
  const totals = useMemo(() => {
    let original = 0;
    let optimized = 0;
    let done = 0;
    for (const svg of svgs) {
      original += svg.size;
      const r = results[svg.id];
      if (r?.status === "done" && r.size != null) {
        optimized += r.size;
        done++;
      } else {
        optimized += svg.size;
      }
    }
    return {
      original,
      optimized,
      done,
      pct: savingsPercent(original, optimized),
    };
  }, [svgs, results]);

  const handleDownloadAll = useCallback(() => {
    let count = 0;
    for (const svg of svgs) {
      const r = results[svg.id];
      const out = r?.status === "done" && r.data ? r.data : svg.svg;
      downloadSvg(svg.name, out);
      count++;
    }
    if (count > 0) toast.success(`Downloading ${count} SVGs`);
  }, [svgs, results]);

  const handleDownloadCurrent = useCallback(() => {
    if (!selected) return;
    const r = results[selected.id];
    const out = r?.status === "done" && r.data ? r.data : selected.svg;
    downloadSvg(selected.name, out);
  }, [selected, results]);

  const hasFiles = svgs.length > 0;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2.5">
          <WordmarkIcon className="size-6 text-primary" />
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-tight">Vector</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              local-first SVG optimizer
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasFiles && (
            <div className="hidden items-center gap-3 font-mono text-xs tabular-nums md:flex">
              <span className="text-muted-foreground">
                {formatBytes(totals.original)} → {formatBytes(totals.optimized)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-semibold",
                  totals.pct > 0
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {totals.pct > 0 ? "−" : ""}
                {Math.abs(Math.round(totals.pct * 10) / 10).toFixed(1)}%
              </span>
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      {!ready ? (
        <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
          Loading your workspace…
        </div>
      ) : !hasFiles ? (
        <div className="flex flex-1 items-center justify-center overflow-auto p-6">
          <div className="w-full max-w-lg">
            <Dropzone onFiles={handleAddFiles} />
            <p className="mt-4 text-center text-xs text-muted-foreground text-pretty">
              Files and presets are stored on this device with RxDB. Reopen the
              tab and your work is still here.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(240px,280px)_1fr_minmax(280px,340px)]">
          {/* Left: files + presets */}
          <aside className="flex min-h-0 flex-col border-r border-border">
            <div className="min-h-0 flex-1 overflow-hidden">
              <FileList
                svgs={svgs}
                results={results}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRemove={(id) => void removeSvg(id)}
                onClear={() => void clearSvgs()}
                onAddFiles={handleAddFiles}
                onDownloadAll={handleDownloadAll}
              />
            </div>
          </aside>

          {/* Center: preview */}
          <main className="flex min-h-0 flex-col">
            <div className="min-h-0 flex-1">
              <SvgViewer svg={selected} result={selected ? results[selected.id] : undefined} />
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-3">
              <p className="truncate text-xs text-muted-foreground">
                {totals.done} of {svgs.length} optimized
              </p>
              <Button size="sm" onClick={handleDownloadCurrent} disabled={!selected}>
                <DownloadIcon />
                Download
              </Button>
            </div>
          </main>

          {/* Right: presets + settings */}
          <aside className="flex min-h-0 flex-col border-l border-border">
            <PresetBar
              settings={settings}
              onApply={applyPreset}
              savedPresets={presets}
              onSave={savePreset}
              onRemove={(id) => void removePreset(id)}
            />
            <div className="min-h-0 flex-1 overflow-hidden border-t border-border">
              <SettingsPanel
                settings={settings}
                onChange={setSetting}
                onReset={reset}
                changedCount={changedCount}
              />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
