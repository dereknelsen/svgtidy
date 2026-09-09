import type { Settings } from "../settings";

/**
 * The wire protocol between the optimizer pool and the SVGO worker. This file
 * is the protocol's only owner. Both sides import these types, so a shape
 * change is a type error on whichever side falls behind.
 *
 * Requests carry `Settings`, not an SVGO config: the config is built inside
 * the worker, keeping SVGO's vocabulary entirely behind the optimizer seam.
 */
export type OptimizeRequest =
  | {
      id: number;
      op: "optimize";
      svg: string;
      settings: Settings;
      /** Feeds prefixIds: each file derives its id prefix from its name. */
      filename?: string;
    }
  | { id: number; op: "prettify"; svg: string };

export type OptimizeResponse =
  | { id: number; ok: true; data: string }
  | { id: number; ok: false; error: string };
