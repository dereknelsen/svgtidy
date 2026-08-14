/** Trigger a browser download for a single optimized SVG string. */
export function downloadSvg(name: string, svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ensureSvgExt(name);
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
