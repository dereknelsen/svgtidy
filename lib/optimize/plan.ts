import { optimizeKey } from "../effective-settings";
import type { Settings } from "../settings";

/**
 * Planning a re-optimize run. Each file is a job carrying its own effective
 * settings; a job's key captures everything the optimizer's output depends
 * on (content is immutable per id, the name feeds prefixIds, and the
 * optimization half of the settings). Only jobs whose key changed since they
 * were last dispatched need to run again, so a folder edit re-runs that
 * folder's files and nothing else.
 */

export type OptimizeJob = {
  id: string;
  name: string;
  svg: string;
  settings: Settings;
};

export type JobKey = string;

export function jobKey(job: OptimizeJob): JobKey {
  return `${job.id}:${job.name}:${optimizeKey(job.settings)}`;
}

export function planRun(
  jobs: readonly OptimizeJob[],
  last: ReadonlyMap<string, JobKey>,
): { changed: OptimizeJob[]; removed: string[] } {
  const changed: OptimizeJob[] = [];
  const present = new Set<string>();
  for (const job of jobs) {
    present.add(job.id);
    if (last.get(job.id) !== jobKey(job)) changed.push(job);
  }
  const removed: string[] = [];
  for (const id of last.keys()) {
    if (!present.has(id)) removed.push(id);
  }
  return { changed, removed };
}
