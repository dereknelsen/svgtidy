"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DownloadIcon, SlidersHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "./theme-toggle";
import { Dropzone, type IncomingSvg } from "./dropzone";
import { FileList, FileStrip } from "./file-list";
import { SvgViewer } from "./svg-viewer";
import { SettingsPanel } from "./settings-panel";
import { PresetBar } from "./preset-bar";
import { Wordmark } from "./wordmark";
import {
  useDatabase,
  useSvgs,
  usePresets,
  useSvgActions,
} from "@/hooks/use-svg-db";
import { useSettingsUrl } from "@/hooks/use-settings-url";
import { useOptimize } from "@/hooks/use-optimize";
import { usePasteImport } from "@/hooks/use-paste-import";
import { downloadSvg, downloadZip } from "@/lib/download";
import { formatBytes, formatPercent, savingsPercent } from "@/lib/format";
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
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  // Paste an SVG (file or markup) anywhere on the page to add it.
  usePasteImport(handleAddFiles);

  // Stable identities so the memoized file rows don't re-render on every pass.
  const handleRemoveSvg = useCallback(
    (id: string) => void removeSvg(id),
    [removeSvg],
  );
  const handleClearSvgs = useCallback(() => void clearSvgs(), [clearSvgs]);
  const handleRemovePreset = useCallback(
    (id: string) => void removePreset(id),
    [removePreset],
  );

  // Selection is derived rather than reconciled in an effect: if the chosen
  // file was removed (or nothing is chosen yet), fall back to the newest file.
  const selected = useMemo(
    () => svgs.find((s) => s.id === selectedId) ?? svgs[0] ?? null,
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

  const handleDownloadAll = useCallback(async () => {
    const files = svgs.map((svg) => {
      const r = results[svg.id];
      return {
        name: svg.name,
        svg: r?.status === "done" && r.data ? r.data : svg.svg,
      };
    });
    if (files.length === 0) return;
    if (files.length === 1) {
      downloadSvg(files[0].name, files[0].svg);
      toast.success(`Downloading ${files[0].name}`);
      return;
    }
    try {
      await downloadZip(files);
      toast.success(`Downloading ${files.length} SVGs as a ZIP`);
    } catch {
      toast.error("Couldn't build the ZIP");
    }
  }, [svgs, results]);

  const handleDownloadCurrent = useCallback(() => {
    if (!selected) return;
    const r = results[selected.id];
    const out = r?.status === "done" && r.data ? r.data : selected.svg;
    downloadSvg(selected.name, out);
  }, [selected, results]);

  const hasFiles = svgs.length > 0;

  const settingsRail = (
    <>
      <PresetBar
        settings={settings}
        onApply={applyPreset}
        savedPresets={presets}
        onSave={savePreset}
        onRemove={handleRemovePreset}
      />
      <div className="border-border min-h-0 flex-1 overflow-hidden border-t">
        <SettingsPanel
          settings={settings}
          onChange={setSetting}
          onReset={reset}
          changedCount={changedCount}
        />
      </div>
    </>
  );

  return (
    <div className="bg-background text-foreground flex h-dvh flex-col overflow-hidden">
      <header className="border-border flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-baseline gap-2">
          <Wordmark className="text-base" />
          <span className="text-muted-foreground hidden text-xs sm:inline">
            local-first SVG optimizer
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {!ready ? (
        <div className="grid flex-1 place-items-center">
          {/* Delayed fade-in so fast loads never flash the loader. */}
          <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:fill-mode-forwards flex flex-col items-center gap-3 opacity-0 motion-safe:delay-150 motion-safe:duration-300">
            <Wordmark className="animate-pulse text-lg" />
            <p className="text-muted-foreground text-sm">Loading your files…</p>
          </div>
        </div>
      ) : !hasFiles ? (
        <div className="motion-safe:animate-in motion-safe:fade-in-0 flex flex-1 items-center justify-center overflow-auto p-6 motion-safe:duration-200">
          <div className="w-full max-w-lg">
            <Dropzone onFiles={handleAddFiles} />
            <p className="text-muted-foreground mt-4 text-center text-xs text-balance">
              Files and presets stay on this device. Close the tab and your work
              is still here when you come back.
            </p>
          </div>
        </div>
      ) : (
        <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-[0.99] grid min-h-0 flex-1 grid-cols-1 ease-out motion-safe:duration-300 md:grid-cols-[minmax(220px,260px)_1fr] lg:grid-cols-[minmax(240px,280px)_1fr_minmax(280px,340px)]">
          {/* Left: files + presets (hidden on phones, replaced by the strip) */}
          <aside className="border-border hidden min-h-0 flex-col border-r md:flex">
            <div className="min-h-0 flex-1 overflow-hidden">
              <FileList
                svgs={svgs}
                results={results}
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
                onRemove={handleRemoveSvg}
                onClear={handleClearSvgs}
                onAddFiles={handleAddFiles}
                onDownloadAll={handleDownloadAll}
              />
            </div>
          </aside>

          {/* Center: preview. min-w-0 keeps long unwrapped code from
              stretching the 1fr column and pushing the right rail offscreen. */}
          <main className="flex min-h-0 min-w-0 flex-col">
            <div className="border-border flex shrink-0 items-center border-b md:hidden">
              <div className="min-w-0 flex-1">
                <FileStrip
                  svgs={svgs}
                  results={results}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelectedId}
                  onRemove={handleRemoveSvg}
                />
              </div>
              <div className="shrink-0 pr-3">
                <Dropzone variant="icon" onFiles={handleAddFiles} />
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <SvgViewer
                svg={selected}
                result={selected ? results[selected.id] : undefined}
              />
            </div>
            <div className="border-border flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-muted-foreground truncate text-xs">
                {totals.done} of {svgs.length} optimized
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setSettingsOpen(true)}
                >
                  <SlidersHorizontalIcon />
                  Settings
                  {changedCount > 0 && (
                    <span className="bg-success/10 text-success rounded-full px-1.5 font-mono text-xs tabular-nums">
                      {changedCount}
                    </span>
                  )}
                </Button>
                {hasFiles && (
                  <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 hidden items-center gap-3 font-mono text-xs tabular-nums motion-safe:duration-200 md:flex">
                    <span className="text-muted-foreground">
                      {formatBytes(totals.original)} →{" "}
                      {formatBytes(totals.optimized)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-semibold",
                        totals.pct > 0
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {formatPercent(totals.pct)}
                    </span>
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={handleDownloadCurrent}
                  disabled={!selected}
                >
                  <DownloadIcon />
                  Download
                </Button>
              </div>
            </div>
          </main>

          {/* Right: presets + settings */}
          <aside className="border-border hidden min-h-0 flex-col border-l lg:flex">
            {settingsRail}
          </aside>
        </div>
      )}

      {/* Below lg the settings rail lives in a sheet. */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-sm">
          <SheetTitle className="sr-only">Presets and settings</SheetTitle>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-6">
            {settingsRail}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
