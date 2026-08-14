"use client";

import { XIcon, Trash2Icon, DownloadIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dropzone, type IncomingSvg } from "./dropzone";
import { formatBytes, savingsPercent, formatPercent } from "@/lib/format";
import type { SvgDocType } from "@/lib/db";
import type { ResultMap } from "@/lib/types";
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
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Files</h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
            {svgs.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={onDownloadAll} disabled={svgs.length === 0}>
            <DownloadIcon />
            All
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Remove all files" onClick={onClear}>
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-1">
          {svgs.map((svg) => {
            const result = results[svg.id];
            const optimized = result?.size;
            const pct =
              optimized != null ? savingsPercent(svg.size, optimized) : null;
            const selected = svg.id === selectedId;
            return (
              <li key={svg.id}>
                <button
                  type="button"
                  onClick={() => onSelect(svg.id)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                    selected
                      ? "border-border bg-muted"
                      : "border-transparent hover:bg-muted/60",
                  )}
                >
                  <div
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-checkerboard"
                    aria-hidden
                  >
                    <img
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg.svg)}`}
                      alt=""
                      className="size-6 object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{svg.name}</p>
                    <p className="flex items-center gap-1.5 font-mono text-xs tabular-nums text-muted-foreground">
                      {result?.status === "running" ? (
                        <>
                          <Loader2Icon className="size-3 animate-spin" />
                          optimizing
                        </>
                      ) : result?.status === "error" ? (
                        <span className="text-destructive">failed</span>
                      ) : optimized != null ? (
                        <>
                          {formatBytes(optimized)}
                          {pct != null && (
                            <span
                              className={cn(
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
                        </>
                      ) : (
                        formatBytes(svg.size)
                      )}
                    </p>
                  </div>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${svg.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(svg.id);
                    }}
                    className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive group-hover:opacity-100"
                  >
                    <XIcon className="size-3.5" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Separator />
      <div className="p-3">
        <Dropzone variant="compact" onFiles={onAddFiles} />
      </div>
    </div>
  );
}
