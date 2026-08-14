import type { SvgoConfig } from "./settings";

type Pending = {
  resolve: (data: string) => void;
  reject: (error: Error) => void;
};

type WorkerResponse =
  | { id: number; ok: true; data: string }
  | { id: number; ok: false; error: string };

/**
 * A small round-robin pool of SVGO workers. Spreading files across several
 * threads is what makes multi-file batches feel instant instead of blocking.
 */
export class OptimizerPool {
  private workers: Worker[] = [];
  private pending = new Map<number, Pending>();
  private counter = 0;
  private cursor = 0;

  constructor(size?: number) {
    const cores =
      typeof navigator !== "undefined" && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 4;
    const count = Math.max(1, Math.min(size ?? cores, 8));

    for (let i = 0; i < count; i++) {
      const worker = new Worker(
        new URL("../workers/svgo.worker.ts", import.meta.url),
        {
          type: "module",
        },
      );
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        const job = this.pending.get(msg.id);
        if (!job) return;
        this.pending.delete(msg.id);
        if (msg.ok) job.resolve(msg.data);
        else job.reject(new Error(msg.error));
      };
      this.workers.push(worker);
    }
  }

  optimize(svg: string, config: SvgoConfig): Promise<string> {
    const id = ++this.counter;
    const worker = this.workers[this.cursor % this.workers.length];
    this.cursor++;
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, svg, config });
    });
  }

  destroy() {
    for (const worker of this.workers) worker.terminate();
    this.workers = [];
    this.pending.clear();
  }
}

let singleton: OptimizerPool | null = null;

/** Lazily create one shared pool for the whole app (browser only). */
export function getOptimizer(): OptimizerPool {
  if (!singleton) singleton = new OptimizerPool();
  return singleton;
}
