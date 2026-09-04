"use client";

import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { getOptimizer } from "@/lib/optimize";
import { MonacoDiff, useIsMobile } from "./code-view";
import { cn } from "@/lib/utils";

// Past this size, prettify + diff stops being cheap.
const MAX_DIFF_BYTES = 300 * 1024;

type DiffViewProps = {
  original: string;
  optimized: string;
};

type PrettyPair = { original: string; optimized: string };

export function DiffView({ original, optimized }: DiffViewProps) {
  const mobile = useIsMobile();
  const [pretty, setPretty] = useState<PrettyPair | null>(null);
  const tooLarge =
    original.length > MAX_DIFF_BYTES || optimized.length > MAX_DIFF_BYTES;

  useEffect(() => {
    if (tooLarge) return;

    let active = true;
    const pool = getOptimizer();
    // Minified SVG is a single line, so both sides are prettified in the
    // worker before diffing — otherwise every diff is "the whole file changed".
    const prettify = (svg: string) => pool.prettify(svg).catch(() => svg);

    // Keep the previous diff on screen while the next one computes.
    void Promise.all([prettify(original), prettify(optimized)]).then(
      ([prettyOriginal, prettyOptimized]) => {
        if (!active) return;
        setPretty({ original: prettyOriginal, optimized: prettyOptimized });
      },
    );
    return () => {
      active = false;
    };
  }, [original, optimized, tooLarge]);

  if (tooLarge) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <p className="text-muted-foreground max-w-sm text-sm text-pretty">
          This file is too large to diff comfortably. Use the code view or the
          visual compare instead.
        </p>
      </div>
    );
  }

  if (!pretty) {
    return (
      <div className="grid h-full place-items-center">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2Icon className="size-4 animate-spin" />
          Computing diff…
        </p>
      </div>
    );
  }

  if (mobile) {
    return (
      <InlineDiff original={pretty.original} optimized={pretty.optimized} />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border text-muted-foreground grid shrink-0 grid-cols-2 border-b font-mono text-xs">
        <span className="border-border border-r px-3 py-1.5">Original</span>
        <span className="px-3 py-1.5">Optimized</span>
      </div>
      <div className="min-h-0 flex-1">
        <MonacoDiff original={pretty.original} modified={pretty.optimized} />
      </div>
    </div>
  );
}

type DiffPart = { value: string; added?: boolean; removed?: boolean };

/**
 * Mobile fallback: a unified line diff rendered into a plain <code> element
 * with add/remove tints (Monaco doesn't support mobile browsers).
 */
function InlineDiff({ original, optimized }: PrettyPair) {
  const [parts, setParts] = useState<DiffPart[] | null>(null);

  useEffect(() => {
    let active = true;
    void import("diff").then((diffModule) => {
      if (!active) return;
      setParts(diffModule.diffLines(original, optimized));
    });
    return () => {
      active = false;
    };
  }, [original, optimized]);

  if (!parts) {
    return (
      <div className="grid h-full place-items-center">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2Icon className="size-4 animate-spin" />
          Computing diff…
        </p>
      </div>
    );
  }

  return (
    <pre className="bg-muted/40 h-full overflow-auto p-4 text-xs leading-relaxed">
      <code>
        {parts.map((part, i) => (
          <span
            key={i}
            className={cn(
              part.added && "bg-success/15 text-success",
              part.removed && "bg-destructive/10 text-destructive",
            )}
          >
            {part.value}
          </span>
        ))}
      </code>
    </pre>
  );
}
