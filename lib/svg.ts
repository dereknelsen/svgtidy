/** Small pure helpers over raw SVG markup and filenames. */

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

/**
 * Make markup renderable as a standalone image. Optimized output can legally
 * drop `xmlns` (the removeXMLNS setting exists for inlining into HTML), but a
 * browser will not render a namespace-less SVG loaded via an object URL or
 * <img>. Used for previews only. Downloads and copies keep the real output.
 */
export function ensureSvgXmlns(svg: string): string {
  const rootMatch = svg.match(/<svg\b[^>]*/);
  if (!rootMatch) return svg;
  const root = rootMatch[0];
  let patched = root;
  if (!/\sxmlns\s*=/.test(root)) {
    patched = patched.replace(/^<svg\b/, `<svg xmlns="${SVG_NS}"`);
  }
  if (/\bxlink:/.test(svg) && !/\sxmlns:xlink\s*=/.test(root)) {
    patched = patched.replace(/^<svg\b/, `<svg xmlns:xlink="${XLINK_NS}"`);
  }
  return patched === root ? svg : svg.replace(root, patched);
}

export type ArtworkBox = { x: number; y: number; w: number; h: number };

const ROOT_TAG = /<svg\b[^>]*>/;

function rootAttr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`[\\s<]${name}="([^"]*)"`))?.[1];
}

/** The artwork's box: viewBox when present, else numeric width/height. */
export function artworkBox(svg: string): ArtworkBox | null {
  const tag = svg.match(ROOT_TAG)?.[0];
  if (!tag) return null;
  const viewBox = rootAttr(tag, "viewBox");
  if (viewBox) {
    const [x, y, w, h] = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if ([x, y, w, h].every(Number.isFinite)) return { x, y, w, h };
  }
  const w = Number.parseFloat(rootAttr(tag, "width") ?? "");
  const h = Number.parseFloat(rootAttr(tag, "height") ?? "");
  if (Number.isFinite(w) && Number.isFinite(h)) return { x: 0, y: 0, w, h };
  return null;
}

/**
 * Markup that renders at exactly `width` × `height` CSS pixels when loaded
 * as an image: the box becomes the viewBox (so the artwork scales rather
 * than crops) and pixel width/height replace whatever units were there.
 * Used by the rasterizer, which draws the result onto a canvas.
 */
export function withPixelSize(svg: string, width: number, height: number) {
  const rootMatch = svg.match(ROOT_TAG);
  if (!rootMatch) return svg;
  const root = rootMatch[0];
  const box = artworkBox(svg);
  let tag = root
    .replace(/\s(?:width|height|viewBox)="[^"]*"/g, "")
    .replace(/\s*(\/?)>$/, ` width="${width}" height="${height}"$1>`);
  if (box) {
    tag = tag.replace(
      /^<svg\b/,
      `<svg viewBox="${box.x} ${box.y} ${box.w} ${box.h}"`,
    );
  }
  return svg.replace(root, tag);
}

/**
 * Name for an auto-created folder when several files arrive in one gesture:
 * the shared filename prefix when it says something ("icon-home, icon-search"
 * → "icon"), otherwise the drop's date and time.
 */
export function autoGroupName(names: string[], now = new Date()): string {
  const stems = names.map((n) => n.replace(/\.svg$/i, ""));
  let prefix = stems[0] ?? "";
  for (const stem of stems.slice(1)) {
    while (prefix && !stem.startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }
  }
  // Trim back to the last separator so "icon-ho" from "icon-home/icon-house"
  // becomes "icon", then drop trailing separators.
  const boundary = prefix.replace(/[^-_ .]*$/, "").replace(/[-_ .]+$/, "");
  const clean = (boundary || prefix).replace(/[-_ .]+$/, "").trim();
  if (clean.length >= 3) return clean;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
}
