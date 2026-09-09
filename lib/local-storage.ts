/**
 * Tiny localStorage wrapper: SSR-safe (no window on the server), quota-safe,
 * and JSON-typed. Callers validate what comes out, since storage is untrusted
 * exactly like URL params and DB presets.
 */

export function readLocal(key: string): unknown {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

export function writeLocal(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or privacy mode. Losing a convenience snapshot is fine.
  }
}
