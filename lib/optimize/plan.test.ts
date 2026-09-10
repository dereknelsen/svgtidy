import { describe, expect, it } from "vitest";
import { jobKey, planRun, type OptimizeJob } from "./plan";
import { DEFAULT_SETTINGS } from "../settings";

const job = (id: string, over: Partial<OptimizeJob> = {}): OptimizeJob => ({
  id,
  name: `${id}.svg`,
  svg: "<svg/>",
  settings: DEFAULT_SETTINGS,
  ...over,
});

const dispatched = (jobs: OptimizeJob[]) =>
  new Map(jobs.map((j) => [j.id, jobKey(j)]));

describe("planRun", () => {
  it("runs everything on a first run", () => {
    const jobs = [job("a"), job("b")];
    const { changed, removed } = planRun(jobs, new Map());
    expect(changed.map((j) => j.id)).toEqual(["a", "b"]);
    expect(removed).toEqual([]);
  });

  it("runs nothing when nothing changed", () => {
    const jobs = [job("a"), job("b")];
    expect(planRun(jobs, dispatched(jobs)).changed).toEqual([]);
  });

  it("re-runs only the file whose settings changed", () => {
    const jobs = [job("a"), job("b")];
    const next = [
      job("a"),
      job("b", { settings: { ...DEFAULT_SETTINGS, floatPrecision: 1 } }),
    ];
    expect(planRun(next, dispatched(jobs)).changed.map((j) => j.id)).toEqual([
      "b",
    ]);
  });

  it("re-runs a renamed file (prefixIds depends on the name)", () => {
    const jobs = [job("a"), job("b")];
    const next = [job("a", { name: "renamed.svg" }), job("b")];
    expect(planRun(next, dispatched(jobs)).changed.map((j) => j.id)).toEqual([
      "a",
    ]);
  });

  it("reports removed ids", () => {
    const jobs = [job("a"), job("b")];
    const { changed, removed } = planRun([job("b")], dispatched(jobs));
    expect(changed).toEqual([]);
    expect(removed).toEqual(["a"]);
  });

  it("ignores format-only changes", () => {
    const jobs = [job("a")];
    const next = [
      job("a", {
        settings: { ...DEFAULT_SETTINGS, fileType: "jsx" } as never,
      }),
    ];
    expect(planRun(next, dispatched(jobs)).changed).toEqual([]);
  });
});
