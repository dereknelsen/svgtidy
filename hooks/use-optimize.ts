"use client";

import { useEffect, useRef, useState } from "react";
import { getOptimizer } from "@/lib/optimizer";
import { buildSvgoConfig, type Settings } from "@/lib/settings";
import { byteLength, gzipSize } from "@/lib/format";
import type { SvgDocType } from "@/lib/db";
import type { OptimizeResult, ResultMap } from "@/lib/types";

/**
 * Re-optimizes every SVG whenever the files or settings change. Work is spread
 * across a worker pool and debounced so dragging a slider stays smooth. Results
 * are keyed by SVG id and merged as each job resolves, so the UI fills in
 * progressively rather than waiting for the whole batch.
 */
export function useOptimize(svgs: SvgDocType[], settings: Settings) {
  const [results, setResults] = useState<ResultMap>({});
  const runIdRef = useRef(0);

  const settingsKey = JSON.stringify(settings);

  useEffect(() => {
    if (svgs.length === 0) {
      setResults((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }

    const runId = ++runIdRef.current;
    const config = buildSvgoConfig(settings);
    const pool = getOptimizer();

    // Mark everything as running immediately for instant feedback.
    setResults((prev) => {
      const next: ResultMap = {};
      for (const svg of svgs) {
        next[svg.id] = { ...(prev[svg.id] ?? {}), status: "running" };
      }
      return next;
    });

    const timer = setTimeout(() => {
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
            const result: OptimizeResult = { status: "done", data, size, gzip };
            setResults((prev) => ({ ...prev, [svg.id]: result }));
          })
          .catch((error: unknown) => {
            if (runId !== runIdRef.current) return;
            setResults((prev) => ({
              ...prev,
              [svg.id]: {
                status: "error",
                error: error instanceof Error ? error.message : String(error),
              },
            }));
          });
      }
    }, 150);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgs, settingsKey]);

  return results;
}
