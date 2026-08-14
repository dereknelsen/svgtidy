"use client";

import { memo } from "react";
import { XIcon, Trash2Icon, DownloadIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dropzone, type IncomingSvg } from "./dropzone";
import { formatBytes, savingsPercent, formatPercent } from "@/lib/format";
import { useSvgObjectUrl } from "@/hooks/use-object-url";
import type { SvgDocType } from "@/lib/db";
import type { OptimizeResult, ResultMap } from "@/lib/types";
import { cn } from "@/lib/utils";

type FileListProps = {
  svgs: SvgDocType[];
  results: ResultMap;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onAddFiles: (files: IncomingSvg[]) => void;
  onDownloadAll: () => void;
};

function SvgThumb({ svg, className }: { svg: string; className?: string }) {
  const url = useSvgObjectUrl(svg);
  return (
    <div
      className={cn(
        "bg-checkerboard grid shrink-0 place-items-center overflow-hidden rounded-lg",
        className,
      )}
      aria-hidden
    >
      {url && <img src={url} alt="" className="size-[70%] object-contain" />}
    </div>
  );
}

/** The per-file size/savings readout, shared by both list layouts.
 * While a re-optimize runs, stale numbers stay visible and just dim — the
 * spinner only appears for files that have never produced a result. */
function FileMeta({
  size,
  result,
}: {
  size: number;
  result: OptimizeResult | undefined;
}) {
  const running = result?.status === "running";
  const optimizedSize = result?.size;
  const pct =
    optimizedSize != null ? savingsPercent(size, optimizedSize) : null;

  if (result?.status === "error") {
    return <span className="text-destructive">failed</span>;
  }
  if (optimizedSize == null) {
    return running ? (
      <>
        <Loader2Icon className="size-3 animate-spin" />
        optimizing
      </>
    ) : (
      <>{formatBytes(size)}</>
    );
  }
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 transition-opacity duration-150",
        running && "opacity-60",
      )}
    >
      {formatBytes(optimizedSize)}
      {pct != null && (
        <span
          key={formatPercent(pct)}
          className={cn(
            "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200",
            pct > 0
              ? "text-success"
              : pct < 0
                ? "text-destructive"
                : "text-muted-foreground",
          )}
        >
          {formatPercent(pct)}
        </span>
      )}
    </span>
  );
}

type FileRowProps = {
  svg: SvgDocType;
  result: OptimizeResult | undefined;
  selected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
};

const FileRow = memo(function FileRow({
  svg,
  result,
  selected,
  onSelect,
  onRemove,
}: FileRowProps) {
  return (
    <li className="group motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-1 relative motion-safe:duration-200">
      <button
        type="button"
        onClick={() => onSelect(svg.id)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border py-2 pr-10 pl-3 text-left transition-colors",
          selected
            ? "border-border bg-muted"
            : "hover:bg-muted/60 border-transparent",
        )}
      >
        <SvgThumb svg={svg.svg} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{svg.name}</p>
          <p className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs tabular-nums">
            <FileMeta size={svg.size} result={result} />
          </p>
        </div>
      </button>
      <button
        type="button"
        aria-label={`Remove ${svg.name}`}
        onClick={() => onRemove(svg.id)}
        className="text-muted-foreground hover:bg-background hover:text-destructive absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <XIcon className="size-3.5" />
      </button>
    </li>
  );
});

export function FileList({
  svgs,
  results,
  selectedId,
  onSelect,
  onRemove,
  onClear,
  onAddFiles,
  onDownloadAll,
}: FileListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Files</h2>
          <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-mono text-xs tabular-nums">
            {svgs.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={onDownloadAll}
            disabled={svgs.length === 0}
          >
            <DownloadIcon />
            All
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Remove all files"
            onClick={onClear}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-1">
          {svgs.map((svg) => (
            <FileRow
              key={svg.id}
              svg={svg}
              result={results[svg.id]}
              selected={svg.id === selectedId}
              onSelect={onSelect}
              onRemove={onRemove}
            />
          ))}
        </ul>
      </div>

      <Separator />
      <div className="p-3">
        <Dropzone variant="compact" onFiles={onAddFiles} />
      </div>
    </div>
  );
}

type FileStripItemProps = {
  svg: SvgDocType;
  result: OptimizeResult | undefined;
  selected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
};

const FileStripItem = memo(function FileStripItem({
  svg,
  result,
  selected,
  onSelect,
  onRemove,
}: FileStripItemProps) {
  const pct =
    result?.size != null ? savingsPercent(svg.size, result.size) : null;
  return (
    <li className="group motion-safe:animate-in motion-safe:fade-in-0 relative shrink-0 snap-start motion-safe:duration-200">
      <button
        type="button"
        onClick={() => onSelect(svg.id)}
        aria-label={`Select ${svg.name}`}
        aria-current={selected || undefined}
        className={cn(
          "flex w-16 flex-col items-center gap-1 rounded-xl border p-1.5 transition-colors",
          selected
            ? "border-border bg-muted"
            : "hover:bg-muted/60 border-transparent",
        )}
      >
        <SvgThumb svg={svg.svg} className="size-10" />
        <span
          className={cn(
            "max-w-full truncate font-mono text-[10px] tabular-nums",
            pct != null && pct > 0 ? "text-success" : "text-muted-foreground",
          )}
        >
          {pct != null ? formatPercent(pct) : "…"}
        </span>
      </button>
      <button
        type="button"
        aria-label={`Remove ${svg.name}`}
        onClick={() => onRemove(svg.id)}
        className="border-border bg-background text-muted-foreground hover:text-destructive absolute -top-1 -right-1 grid size-5 place-items-center rounded-full border opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <XIcon className="size-3" />
      </button>
    </li>
  );
});

/** Compact horizontal file rail for narrow viewports. */
export function FileStrip({
  svgs,
  results,
  selectedId,
  onSelect,
  onRemove,
}: Omit<FileListProps, "onClear" | "onAddFiles" | "onDownloadAll">) {
  return (
    <ul className="flex snap-x gap-2 overflow-x-auto px-3 py-2">
      {svgs.map((svg) => (
        <FileStripItem
          key={svg.id}
          svg={svg}
          result={results[svg.id]}
          selected={svg.id === selectedId}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      ))}
    </ul>
  );
}
