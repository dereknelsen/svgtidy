/// <reference lib="webworker" />
// SVGO runs here, off the main thread, so batches of files never freeze the UI.
// All actual optimization logic lives in lib/optimize/core.ts — this file only
// speaks the wire protocol.
import { optimizeSvg, prettifySvg } from "../lib/optimize/core";
import type {
  OptimizeRequest,
  OptimizeResponse,
} from "../lib/optimize/protocol";

self.onmessage = (event: MessageEvent<OptimizeRequest>) => {
  const request = event.data;
  let response: OptimizeResponse;
  try {
    const data =
      request.op === "optimize"
        ? optimizeSvg(request.svg, request.settings, {
            filename: request.filename,
          })
        : prettifySvg(request.svg);
    response = { id: request.id, ok: true, data };
  } catch (err) {
    response = {
      id: request.id,
      ok: false,
      error: err instanceof Error ? err.message : "Optimization failed",
    };
  }
  (self as unknown as Worker).postMessage(response);
};
