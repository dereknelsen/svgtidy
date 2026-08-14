"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatBytes, formatPercent, savingsPercent } from "@/lib/format";
import { copyText } from "@/lib/download";
import { useSvgObjectUrl } from "@/hooks/use-object-url";
import { CompareSlider } from "./compare-slider";
import { CodeView } from "./code-view";
import { DiffView } from "./diff-view";
import type { SvgDocType } from "@/lib/db";
import type { OptimizeResult } from "@/lib/types";
import {
  EyeIcon,
  CodeIcon,
  ColumnsIcon,
  GitCompareIcon,
  CopyIcon,
  CheckIcon,
} from "lucide-react";
import { toast } from "sonner";

type ViewMode = "preview" | "compare" | "diff" | "code";

type SvgViewerProps = {
  svg: SvgDocType | null;
  result: OptimizeResult | undefined;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant="outline"
      size="sm"
      className="absolute top-3 right-4 z-10"
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) setCopied(true);
        else toast.error("Couldn't copy to clipboard");
      }}
    >
      {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function SvgViewer({ svg, result }: SvgViewerProps) {
  const [mode, setMode] = useState<ViewMode>("preview");

  // Stale-while-revalidate: while a re-optimize runs, keep showing the last
  // optimized output instead of snapping back to the original.
  const hasResult = result?.data != null && result.data.length > 0;
  const optimized = hasResult ? result.data! : null;
  const displayed = optimized ?? svg?.svg ?? null;

  const running = result?.status === "running";
  const pct =
    svg && result?.size != null ? savingsPercent(svg.size, result.size) : null;

  const displayedUrl = useSvgObjectUrl(displayed);
  const originalUrl = useSvgObjectUrl(mode === "compare" ? svg?.svg : null);

  if (!svg) {
    return (
      <div className="text-muted-foreground grid h-full place-items-center">
        <p className="text-sm">Select a file to preview.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex items-center justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{svg.name}</p>
          <p
            aria-live="polite"
            className={cn(
              "text-muted-foreground font-mono text-xs tabular-nums transition-opacity duration-150",
              running && "opacity-60",
            )}
          >
            {formatBytes(svg.size)}
            {result?.size != null && (
              <>
                {" → "}
                <span className="text-foreground">
                  {formatBytes(result.size)}
                </span>{" "}
                {pct != null && (
                  <span
                    key={formatPercent(pct)}
                    className={cn(
                      "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 font-medium motion-safe:duration-200",
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
                  <span className="text-muted-foreground ml-2">
                    {formatBytes(result.gzip)} gzipped
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <ToggleGroup
          value={[mode]}
          onValueChange={(value) => {
            const next = value[0];
            if (next) setMode(next as ViewMode);
          }}
          className="shrink-0"
        >
          <ToggleGroupItem value="preview" aria-label="Preview">
            <EyeIcon className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="compare"
            aria-label="Compare original and optimized visually"
          >
            <ColumnsIcon className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="diff" aria-label="Code diff">
            <GitCompareIcon className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="code" aria-label="Optimized code">
            <CodeIcon className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div
        key={mode}
        className="motion-safe:animate-in motion-safe:fade-in-0 relative min-h-0 flex-1 motion-safe:duration-150"
      >
        {mode === "preview" && (
          <div className="bg-checkerboard flex h-full items-center justify-center overflow-auto p-8">
            {displayedUrl && (
              <img
                src={displayedUrl}
                alt={`Preview of ${svg.name}`}
                className="max-h-full max-w-full"
              />
            )}
          </div>
        )}

        {mode === "compare" &&
          (optimized ? (
            <CompareSlider
              originalUrl={originalUrl}
              optimizedUrl={displayedUrl}
              originalLabel={formatBytes(svg.size)}
              optimizedLabel={
                result?.size != null ? formatBytes(result.size) : "…"
              }
              alt={svg.name}
            />
          ) : (
            <ModePending label="Waiting for the first optimized result…" />
          ))}

        {mode === "diff" &&
          (optimized ? (
            <DiffView original={svg.svg} optimized={optimized} />
          ) : (
            <ModePending label="Waiting for the first optimized result…" />
          ))}

        {mode === "code" && (
          <>
            <CopyButton text={optimized ?? svg.svg} />
            <CodeView value={optimized ?? svg.svg} />
          </>
        )}
      </div>
    </div>
  );
}

function ModePending({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center">
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}
