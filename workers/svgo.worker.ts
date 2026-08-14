/// <reference lib="webworker" />
// SVGO runs here, off the main thread, so batches of files never freeze the UI.
import { optimize } from "svgo/browser";

type Request = {
  id: number;
  svg: string;
  config: Parameters<typeof optimize>[1];
};

type Response =
  | { id: number; ok: true; data: string }
  | { id: number; ok: false; error: string };

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, svg, config } = event.data;
  let response: Response;
  try {
    const result = optimize(svg, config);
    response = { id, ok: true, data: result.data };
  } catch (err) {
    response = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : "Optimization failed",
    };
  }
  (self as unknown as Worker).postMessage(response);
};
