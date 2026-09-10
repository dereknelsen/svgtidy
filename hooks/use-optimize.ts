"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getOptimizer,
  type OptimizeResult,
  type ResultMap,
} from "@/lib/optimize";
import { jobKey, planRun, type OptimizeJob } from "@/lib/optimize/plan";
import { byteLength, gzipSize } from "@/lib/format";

export type { OptimizeJob };

/**
 * Re-optimizes files whenever their content, name, or effective settings
 * change. Work is spread across a worker pool and debounced so dragging a
 * slider stays smooth.
 *
 * Each job carries its own settings, and only jobs whose key changed since
 * they were last dispatched re-run: a folder override edit re-runs that
 * folder's files, a file override edit re-runs one file, and a format edit
 * re-runs nothing.
 *
 * Two things keep the UI calm while that happens:
 * - Prior results are carried into the "running" state, so consumers can keep
 *   rendering stale output (stale-while-revalidate) instead of flashing
 *   spinners. The running flag is only set once the debounce fires.
 * - Completions are merged into one state commit per flush window rather than
 *   one setState per file, so a large batch doesn't re-render the tree N times.
 */
export function useOptimize(jobs: OptimizeJob[]) {
  const [results, setResults] = useState<ResultMap>({});
  // Per-file dispatch tokens: a completion lands only if its file hasn't been
  // re-dispatched since, so one file's edit never discards the others' work.
  const tokenRef = useRef(new Map<string, number>());
  // What each file was last dispatched with. Updated only on dispatch, so
  // edits that arrive during the debounce coalesce into one run.
  const dispatchedRef = useRef(new Map<string, string>());
  const pendingRef = useRef(new Map<string, OptimizeResult>());
  const flushTimerRef = useRef<number | null>(null);

  const jobsKey = useMemo(() => jobs.map(jobKey).join("\n"), [jobs]);

  // In-flight work survives job changes (per-file tokens decide what lands),
  // so the flush timer is only torn down on unmount.
  useEffect(
    () => () => {
      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (jobs.length === 0) {
      tokenRef.current.clear();
      dispatchedRef.current.clear();
      // Clearing stale results when the last file is removed is a state sync
      // with an external event, not a render-derived value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }

    const pool = getOptimizer();

    const queueResult = (id: string, token: number, result: OptimizeResult) => {
      if (tokenRef.current.get(id) !== token) return;
      pendingRef.current.set(id, result);
      if (flushTimerRef.current != null) return;
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        const batch = pendingRef.current;
        pendingRef.current = new Map();
        setResults((prev) => {
          const next = { ...prev };
          for (const [key, value] of batch) {
            // Re-check: the file may have been re-dispatched since queueing.
            if (tokenRef.current.has(key)) next[key] = value;
          }
          return next;
        });
      }, 50);
    };

    const timer = setTimeout(() => {
      const { changed, removed } = planRun(jobs, dispatchedRef.current);
      for (const id of removed) {
        dispatchedRef.current.delete(id);
        tokenRef.current.delete(id);
        pendingRef.current.delete(id);
      }
      if (changed.length === 0 && removed.length === 0) return;

      // Mark only the changed files as running, now, inside the debounce, so
      // rapid setting changes (slider drags) cause zero intermediate state
      // churn. Previous data/size/gzip are kept so the UI can show stale
      // values while it runs.
      setResults((prev) => {
        const next: ResultMap = {};
        for (const [id, value] of Object.entries(prev)) {
          if (!removed.includes(id)) next[id] = value;
        }
        for (const job of changed) {
          next[job.id] = { ...(prev[job.id] ?? {}), status: "running" };
        }
        return next;
      });

      for (const job of changed) {
        const token = (tokenRef.current.get(job.id) ?? 0) + 1;
        tokenRef.current.set(job.id, token);
        dispatchedRef.current.set(job.id, jobKey(job));
        // The filename travels with the request so prefixIds can derive its
        // per-file prefix behind the optimizer seam.
        pool
          .optimize(job.svg, job.settings, { filename: job.name })
          .then(async (data) => {
            if (tokenRef.current.get(job.id) !== token) return;
            const [size, gzip] = await Promise.all([
              Promise.resolve(byteLength(data)),
              gzipSize(data),
            ]);
            queueResult(job.id, token, { status: "done", data, size, gzip });
          })
          .catch((error: unknown) => {
            queueResult(job.id, token, {
              status: "error",
              error: error instanceof Error ? error.message : String(error),
            });
          });
      }
    }, 150);

    return () => {
      clearTimeout(timer);
    };
    // Keyed on the derived jobsKey, not the jobs array identity, so per-file
    // metadata edits (part colors, format overrides) never re-run the pool.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsKey]);

  return results;
}
