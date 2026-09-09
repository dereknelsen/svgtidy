import { savingsPercent } from "../format";

/**
 * The result model: what the app knows about one file's optimization right
 * now. Consumers ask questions through the functions below instead of reading
 * raw fields, so the answers (especially "which bytes represent this file?")
 * are decided in exactly one place.
 *
 * The stale-while-revalidate rule: while a re-optimize runs, prior output is
 * carried into the "running" result, and every consumer (canvas, downloads,
 * copies, stats) keeps using it. A failed run carries nothing, so failures
 * fall back to the original.
 */

export type OptimizeStatus = "running" | "done" | "error";

export type OptimizeResult = {
  status: OptimizeStatus;
  data?: string;
  size?: number;
  gzip?: number;
  error?: string;
};

export type ResultMap = Record<string, OptimizeResult>;

/** The optimized markup, if any run has produced some (stale counts). */
export function optimizedOf(result: OptimizeResult | undefined): string | null {
  return result?.data != null && result.data.length > 0 ? result.data : null;
}

/**
 * The single rule for which bytes represent a file right now: what the
 * canvas shows and what download/copy/export produce.
 */
export function outputOf(
  svg: { svg: string },
  result: OptimizeResult | undefined,
): string {
  return optimizedOf(result) ?? svg.svg;
}

/** The optimized byte size, if known (stale counts). */
export function optimizedSizeOf(
  result: OptimizeResult | undefined,
): number | null {
  return result?.size ?? null;
}

/** Savings vs the original, or null until a first size exists. */
export function savingsOf(
  svg: { size: number },
  result: OptimizeResult | undefined,
): number | null {
  const optimized = optimizedSizeOf(result);
  return optimized != null ? savingsPercent(svg.size, optimized) : null;
}

/** True while a re-optimize is in flight. Displayed values are stale. */
export function isStale(result: OptimizeResult | undefined): boolean {
  return result?.status === "running";
}

export function isFailed(result: OptimizeResult | undefined): boolean {
  return result?.status === "error";
}

/**
 * Aggregate savings across the batch. Files without a finished result count
 * at their original size, so the percentage never overpromises.
 */
export function batchTotals(
  svgs: { id: string; size: number }[],
  results: ResultMap,
): { original: number; optimized: number; done: number; pct: number } {
  let original = 0;
  let optimized = 0;
  let done = 0;
  for (const svg of svgs) {
    original += svg.size;
    const result = results[svg.id];
    const size = result?.status === "done" ? optimizedSizeOf(result) : null;
    if (size != null) {
      optimized += size;
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
}
