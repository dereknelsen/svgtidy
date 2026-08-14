"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getOptimizer } from "@/lib/optimizer";
import { buildSvgoConfig, type Settings } from "@/lib/settings";
import { byteLength, gzipSize } from "@/lib/format";
import type { SvgDocType } from "@/lib/db";
import type { OptimizeResult, ResultMap } from "@/lib/types";

/**
 * Re-optimizes every SVG whenever the files or settings change. Work is spread
 * across a worker pool and debounced so dragging a slider stays smooth.
 *
 * Two things keep the UI calm while that happens:
 * - Prior results are carried into the "running" state, so consumers can keep
 *   rendering stale output (stale-while-revalidate) instead of flashing
 *   spinners. The running flag is only set once the debounce fires.
 * - Completions are merged into one state commit per flush window rather than
 *   one setState per file, so a large batch doesn't re-render the tree N times.
 */
export function useOptimize(svgs: SvgDocType[], settings: Settings) {
  const [results, setResults] = useState<ResultMap>({});
  const runIdRef = useRef(0);
  const pendingRef = useRef(new Map<string, OptimizeResult>());
  const flushTimerRef = useRef<number | null>(null);

  const settingsKey = useMemo(() => JSON.stringify(settings), [settings]);

  useEffect(() => {
    if (svgs.length === 0) {
      // Clearing stale results when the last file is removed is a state sync
      // with an external event, not a render-derived value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }

    const runId = ++runIdRef.current;
    const config = buildSvgoConfig(settings);
    const pool = getOptimizer();
    pendingRef.current.clear();

    const queueResult = (id: string, result: OptimizeResult) => {
      pendingRef.current.set(id, result);
      if (flushTimerRef.current != null) return;
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        if (runId !== runIdRef.current) return;
        const batch = pendingRef.current;
        pendingRef.current = new Map();
        setResults((prev) => {
          const next = { ...prev };
          for (const [key, value] of batch) next[key] = value;
          return next;
        });
      }, 50);
    };

    const timer = setTimeout(() => {
      // Mark files as running only now, inside the debounce, so rapid setting
      // changes (slider drags) cause zero intermediate state churn. Previous
      // data/size/gzip are kept so the UI can show stale values while it runs.
      setResults((prev) => {
        const next: ResultMap = {};
        for (const svg of svgs) {
          next[svg.id] = { ...(prev[svg.id] ?? {}), status: "running" };
        }
        return next;
      });

      for (const svg of svgs) {
        pool
          .optimize(svg.svg, config)
          .then(async (data) => {
            if (runId !== runIdRef.current) return;
            const [size, gzip] = await Promise.all([
              Promise.resolve(byteLength(data)),
              gzipSize(data),
            ]);
            if (runId !== runIdRef.current) return;
            queueResult(svg.id, { status: "done", data, size, gzip });
          })
          .catch((error: unknown) => {
            if (runId !== runIdRef.current) return;
            queueResult(svg.id, {
              status: "error",
              error: error instanceof Error ? error.message : String(error),
            });
          });
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (flushTimerRef.current != null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgs, settingsKey]);

  return results;
}
