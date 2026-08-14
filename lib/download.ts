/** Trigger a browser download for a single optimized SVG string. */
export function downloadSvg(name: string, svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  downloadBlob(blob, ensureSvgExt(name));
}

/**
 * Bundle many SVGs into a single ZIP download. fflate is dynamically imported
 * so the compressor never rides in the main bundle. A single ZIP also avoids
 * the browser blocking N back-to-back anchor downloads on large batches.
 */
export async function downloadZip(
  files: { name: string; svg: string }[],
  zipName = "svgtidy-optimized.zip",
) {
  const { zipSync, strToU8 } = await import("fflate");
  const entries: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (const file of files) {
    let name = ensureSvgExt(file.name);
    if (used.has(name)) {
      const base = name.slice(0, -4);
      let i = 1;
      while (used.has(`${base}-${i}.svg`)) i++;
      name = `${base}-${i}.svg`;
    }
    used.add(name);
    entries[name] = strToU8(file.svg);
  }
  const zipped = zipSync(entries, { level: 6 });
  downloadBlob(
    new Blob([zipped as BlobPart], { type: "application/zip" }),
    zipName,
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ensureSvgExt(name: string) {
  return name.toLowerCase().endsWith(".svg") ? name : `${name}.svg`;
}

/** Copy text to the clipboard, resolving to whether it succeeded. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
