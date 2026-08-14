"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  formatBytes,
  formatPercent,
  savingsPercent,
} from "@/lib/format";
import type { SvgDocType } from "@/lib/db";
import type { OptimizeResult } from "@/lib/types";
import { EyeIcon, CodeIcon, GitCompareIcon } from "lucide-react";

type ViewMode = "preview" | "code" | "diff";

function svgToDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

type SvgViewerProps = {
  svg: SvgDocType | null;
  result: OptimizeResult | undefined;
};

export function SvgViewer({ svg, result }: SvgViewerProps) {
  const [mode, setMode] = useState<ViewMode>("preview");

  const optimized = result?.data ?? "";
  const hasResult = result?.status === "done" && optimized.length > 0;

  const pct = useMemo(() => {
    if (!svg || result?.size == null) return null;
    return savingsPercent(svg.size, result.size);
  }, [svg, result?.size]);

  if (!svg) {
    return (
      <div className="grid h-full place-items-center text-muted-foreground">
        <p className="text-sm">Select a file to preview.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{svg.name}</p>
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {formatBytes(svg.size)}
            {hasResult && result?.size != null && (
              <>
                {" → "}
                <span className="text-foreground">{formatBytes(result.size)}</span>{" "}
                {pct != null && (
                  <span
                    className={cn(
                      "font-medium",
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
                {result.gzip != null && (
                  <span className="ml-2 text-muted-foreground">
                    {formatBytes(result.gzip)} gzipped
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <ToggleGroup
          value={mode}
          onValueChange={(value) => value && setMode(value as ViewMode)}
          className="shrink-0"
        >
          <ToggleGroupItem value="preview" aria-label="Preview">
            <EyeIcon className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="code" aria-label="Optimized code">
            <CodeIcon className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="diff" aria-label="Compare original and optimized">
            <GitCompareIcon className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="relative min-h-0 flex-1">
        {mode === "preview" && (
          <div className="bg-checkerboard flex h-full items-center justify-center overflow-auto p-8">
            <img
              src={svgToDataUri(hasResult ? optimized : svg.svg) || "/placeholder.svg"}
              alt={`Preview of ${svg.name}`}
              className="max-h-full max-w-full"
              crossOrigin="anonymous"
            />
          </div>
        )}

        {mode === "code" && (
          <pre className="h-full overflow-auto bg-muted/40 p-4 text-xs leading-relaxed">
            <code>{hasResult ? optimized : svg.svg}</code>
          </pre>
        )}

        {mode === "diff" && (
          <div className="grid h-full grid-cols-2 divide-x divide-border">
            <div className="flex min-h-0 flex-col">
              <div className="border-b border-border px-3 py-1.5 font-mono text-xs text-muted-foreground">
                Original · {formatBytes(svg.size)}
              </div>
              <pre className="min-h-0 flex-1 overflow-auto bg-muted/40 p-3 text-xs leading-relaxed">
                <code>{svg.svg}</code>
              </pre>
            </div>
            <div className="flex min-h-0 flex-col">
              <div className="border-b border-border px-3 py-1.5 font-mono text-xs text-muted-foreground">
                Optimized · {result?.size != null ? formatBytes(result.size) : "—"}
              </div>
              <pre className="min-h-0 flex-1 overflow-auto bg-muted/40 p-3 text-xs leading-relaxed">
                <code>{hasResult ? optimized : "Not optimized yet."}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
