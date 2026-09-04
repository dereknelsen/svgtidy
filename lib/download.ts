/** Trigger a browser download for any text file. */
export function downloadFile(filename: string, content: string, mime: string) {
  downloadBlob(new Blob([content], { type: mime }), filename);
}

/** Trigger a browser download for a single optimized SVG string. */
export function downloadSvg(name: string, svg: string) {
  downloadFile(ensureSvgExt(name), svg, "image/svg+xml");
}

export type ZipEntry = {
  filename: string;
  /** Text or already-encoded bytes (rasters, ICO). */
  content: string | Uint8Array;
};

/**
 * Bundle many files into a single ZIP download. fflate is dynamically imported
 * so the compressor never rides in the main bundle. A single ZIP also avoids
 * the browser blocking N back-to-back anchor downloads on large batches.
 *
 * Entries arrive pre-named (extension included) — colliding names get a
 * numeric suffix before the extension. Binary entries that are already
 * compressed (PNG, WebP, AVIF) are stored rather than deflated again.
 */
export async function downloadZip(
  files: ZipEntry[],
  zipName = "svgtidy-optimized.zip",
) {
  const { zipSync, strToU8 } = await import("fflate");
  const entries: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  const used = new Set<string>();
  for (const file of files) {
    let name = file.filename;
    if (used.has(name)) {
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let i = 1;
      while (used.has(`${base}-${i}${ext}`)) i++;
      name = `${base}-${i}${ext}`;
    }
    used.add(name);
    entries[name] =
      typeof file.content === "string"
        ? strToU8(file.content)
        : isCompressedImage(name)
          ? [file.content, { level: 0 }]
          : file.content;
  }
  const zipped = zipSync(entries, { level: 6 });
  downloadBlob(
    new Blob([zipped as BlobPart], { type: "application/zip" }),
    zipName,
  );
}

function isCompressedImage(name: string) {
  return /\.(png|webp|avif|jpe?g)$/i.test(name);
}

/** Trigger a browser download for a ready-made Blob. */
export function downloadBlob(blob: Blob, filename: string) {
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
