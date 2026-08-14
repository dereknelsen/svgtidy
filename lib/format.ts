/** Human-readable byte sizes with tabular-friendly precision. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 2 : 1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

/** Percentage saved between two sizes, clamped and signed for display. */
export function savingsPercent(original: number, optimized: number): number {
  if (original <= 0) return 0;
  return ((original - optimized) / original) * 100;
}

/** Signed percentage for display. Uses a true minus sign (U+2212) so the
 * glyph is consistent everywhere savings are shown. */
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "−" : rounded < 0 ? "+" : ""}${Math.abs(rounded).toFixed(1)}%`;
}

const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

export function byteLength(str: string): number {
  return encoder ? encoder.encode(str).length : new Blob([str]).size;
}

/**
 * Real gzip transfer size using the native CompressionStream, so the numbers
 * reflect what a browser actually downloads. Falls back to raw size.
 */
export async function gzipSize(str: string): Promise<number> {
  if (typeof CompressionStream === "undefined") return byteLength(str);
  try {
    const stream = new Blob([str])
      .stream()
      .pipeThrough(new CompressionStream("gzip"));
    const buffer = await new Response(stream).arrayBuffer();
    return buffer.byteLength;
  } catch {
    return byteLength(str);
  }
}
