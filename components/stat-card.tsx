"use client";

import { formatBytes, formatPercent } from "@/lib/format";
import type { SvgDocType } from "@/lib/db";
import {
  isFailed,
  isStale,
  optimizedSizeOf,
  savingsOf,
  type OptimizeResult,
} from "@/lib/optimize";
import { cn } from "@/lib/utils";

type StatCardProps = {
  svg: SvgDocType | null;
  result: OptimizeResult | undefined;
  /** Batch progress across all files, shown only for multi-file sessions. */
  batch: { total: number; done: number };
  /** A folder or multi-selection: aggregate totals replace the single file. */
  group?: {
    label: string;
    count: number;
    totals: { original: number; optimized: number; done: number; pct: number };
  } | null;
};

/**
 * The savings readout for the current selection, at the top of the inspector.
 * Stale numbers dim while a re-optimize runs instead of disappearing.
 */
export function StatCard({ svg, result, batch, group }: StatCardProps) {
  if (group) return <GroupStatCard group={group} />;
  if (!svg) return null;

  const running = isStale(result);
  const failed = isFailed(result);
  const optimizedSize = optimizedSizeOf(result);
  const pct = savingsOf(svg, result);
  const barPct = pct != null ? Math.max(0, Math.min(100, pct)) : 0;

  return (
    <section
      aria-live="polite"
      aria-label="Optimization results"
      className={cn(
        "border-border bg-card rounded-2xl border p-4 transition-opacity duration-150",
        running && "opacity-60",
      )}
    >
      <p className="truncate text-sm font-medium">{svg.name}</p>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        {failed ? (
          <span className="text-destructive text-sm font-medium">
            optimization failed
          </span>
        ) : pct != null ? (
          <span
            key={formatPercent(pct)}
            className={cn(
              "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 text-2xl font-semibold tabular-nums motion-safe:duration-200",
              pct > 0
                ? "text-success"
                : pct < 0
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {formatPercent(pct)}
          </span>
        ) : (
          <span className="text-muted-foreground text-2xl font-semibold">
            …
          </span>
        )}
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {formatBytes(svg.size)}
          {optimizedSize != null && (
            <>
              {" → "}
              <span className="text-foreground">
                {formatBytes(optimizedSize)}
              </span>
            </>
          )}
        </span>
      </div>

      <div
        className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full"
        aria-hidden
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            pct != null && pct < 0 ? "bg-destructive" : "bg-success",
          )}
          style={{ width: `${barPct}%` }}
        />
      </div>

      <p className="text-muted-foreground mt-2 font-mono text-xs tabular-nums">
        {result?.gzip != null ? `${formatBytes(result.gzip)} gzipped` : " "}
        {batch.total > 1 && ` · ${batch.done} of ${batch.total} optimized`}
      </p>
    </section>
  );
}

function GroupStatCard({
  group,
}: {
  group: NonNullable<StatCardProps["group"]>;
}) {
  const { totals } = group;
  const running = totals.done < group.count;
  const pct = totals.pct;
  const barPct = Math.max(0, Math.min(100, pct));
  return (
    <section
      aria-live="polite"
      aria-label="Optimization results"
      className={cn(
        "border-border bg-card rounded-2xl border p-4 transition-opacity duration-150",
        running && "opacity-60",
      )}
    >
      <p className="truncate text-sm font-medium">{group.label}</p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span
          key={formatPercent(pct)}
          className={cn(
            "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 text-2xl font-semibold tabular-nums motion-safe:duration-200",
            pct > 0
              ? "text-success"
              : pct < 0
                ? "text-destructive"
                : "text-muted-foreground",
          )}
        >
          {formatPercent(pct)}
        </span>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {formatBytes(totals.original)}
          {" → "}
          <span className="text-foreground">
            {formatBytes(totals.optimized)}
          </span>
        </span>
      </div>
      <div
        className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full"
        aria-hidden
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            pct < 0 ? "bg-destructive" : "bg-success",
          )}
          style={{ width: `${barPct}%` }}
        />
      </div>
      <p className="text-muted-foreground mt-2 font-mono text-xs tabular-nums">
        {totals.done} of {group.count} optimized
      </p>
    </section>
  );
}
