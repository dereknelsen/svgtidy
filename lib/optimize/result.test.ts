import { describe, expect, it } from "vitest";
import {
  batchTotals,
  isFailed,
  isStale,
  optimizedOf,
  outputOf,
  savingsOf,
  type OptimizeResult,
} from "./result";

const svg = { id: "a", svg: "<svg>original</svg>", size: 1000 };

const done: OptimizeResult = {
  status: "done",
  data: "<svg>optimized</svg>",
  size: 600,
  gzip: 300,
};

// use-optimize carries prior output into the running state (stale-while-revalidate).
const rerunning: OptimizeResult = { ...done, status: "running" };

const failed: OptimizeResult = { status: "error", error: "bad svg" };

describe("outputOf: the single which-bytes rule", () => {
  it("returns the original before any result exists", () => {
    expect(outputOf(svg, undefined)).toBe(svg.svg);
  });

  it("returns optimized output once done", () => {
    expect(outputOf(svg, done)).toBe(done.data);
  });

  it("returns stale optimized output while a re-run is in flight", () => {
    // This is what the canvas shows, and downloads and copies must match it.
    expect(outputOf(svg, rerunning)).toBe(done.data);
  });

  it("falls back to the original after a failure", () => {
    expect(outputOf(svg, failed)).toBe(svg.svg);
  });

  it("treats empty output as no output", () => {
    expect(outputOf(svg, { status: "done", data: "" })).toBe(svg.svg);
  });
});

describe("optimizedOf", () => {
  it("is null until a run has produced output", () => {
    expect(optimizedOf(undefined)).toBeNull();
    expect(optimizedOf({ status: "running" })).toBeNull();
  });

  it("keeps stale output during a re-run", () => {
    expect(optimizedOf(rerunning)).toBe(done.data);
  });
});

describe("savingsOf", () => {
  it("is null before a first size exists", () => {
    expect(savingsOf(svg, undefined)).toBeNull();
    expect(savingsOf(svg, failed)).toBeNull();
  });

  it("computes percent saved, including stale results", () => {
    expect(savingsOf(svg, done)).toBe(40);
    expect(savingsOf(svg, rerunning)).toBe(40);
  });

  it("goes negative when output grew", () => {
    expect(savingsOf(svg, { ...done, size: 1500 })).toBe(-50);
  });
});

describe("status questions", () => {
  it("isStale only while running", () => {
    expect(isStale(rerunning)).toBe(true);
    expect(isStale(done)).toBe(false);
    expect(isStale(undefined)).toBe(false);
  });

  it("isFailed only on error", () => {
    expect(isFailed(failed)).toBe(true);
    expect(isFailed(done)).toBe(false);
    expect(isFailed(undefined)).toBe(false);
  });
});

describe("batchTotals", () => {
  it("counts unfinished files at their original size", () => {
    const svgs = [
      { id: "a", size: 1000 },
      { id: "b", size: 500 },
      { id: "c", size: 250 },
    ];
    const totals = batchTotals(svgs, {
      a: done, // 600
      b: { ...done, status: "running", size: 300 }, // stale → counts as 500
      c: failed, // counts as 250
    });
    expect(totals).toEqual({
      original: 1750,
      optimized: 1350,
      done: 1,
      pct: savingsOf({ size: 1750 }, { status: "done", size: 1350 }),
    });
  });

  it("handles an empty batch", () => {
    expect(batchTotals([], {}).original).toBe(0);
  });
});
