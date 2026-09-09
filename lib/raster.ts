/**
 * Raster export: SVG markup → PNG / WebP / AVIF bytes, in the browser.
 *
 * The markup is loaded into an <img> (namespace restored, box pinned to the
 * target pixel size) and drawn onto a canvas. PNG always comes from the
 * canvas. WebP and AVIF are asked of the canvas first; browsers that can't
 * encode them silently hand back PNG, which is detected by MIME and routed to
 * the WASM encoders from jSquash instead. The encoders are dynamically
 * imported so their multi-megabyte codecs never ride in the main bundle.
 */

import { artworkBox, ensureSvgXmlns, withPixelSize } from "./svg";

export type RasterFormat = "png" | "webp" | "avif";

export const RASTER_FORMATS: {
  value: RasterFormat;
  label: string;
  mime: string;
  ext: string;
  /** Lossy formats take a quality; PNG ignores it. */
  lossy: boolean;
  hint: string;
}[] = [
  {
    value: "png",
    label: "PNG",
    mime: "image/png",
    ext: "png",
    lossy: false,
    hint: "Lossless with alpha. The universal choice.",
  },
  {
    value: "webp",
    label: "WebP",
    mime: "image/webp",
    ext: "webp",
    lossy: true,
    hint: "Much smaller than PNG, keeps alpha, supported everywhere modern.",
  },
  {
    value: "avif",
    label: "AVIF",
    mime: "image/avif",
    ext: "avif",
    lossy: true,
    hint: "Smallest of all; slower to encode, needs a recent browser to view.",
  },
];

export type RasterOptions = {
  format: RasterFormat;
  width: number;
  height: number;
  /** 1 to 100 for lossy formats; ignored for PNG. */
  quality?: number;
  /** A CSS color painted under the artwork; omit for transparency. */
  background?: string;
  /**
   * Fraction of the shorter side left empty around the artwork (0 to 0.45).
   * Favicons use it to keep glyphs inside the maskable safe zone.
   */
  padding?: number;
};

export const DEFAULT_QUALITY = 85;

/** Size the export defaults to: the artwork's own box, or 300×150 like an <img>. */
export function naturalSize(svg: string): { width: number; height: number } {
  const box = artworkBox(svg);
  if (!box || box.w <= 0 || box.h <= 0) return { width: 300, height: 150 };
  return { width: box.w, height: box.h };
}

/** Load markup as an image, sized to exactly the pixel box requested. */
function loadSvgImage(
  svg: string,
  width: number,
  height: number,
): Promise<HTMLImageElement> {
  const markup = ensureSvgXmlns(withPixelSize(svg, width, height));
  const url = URL.createObjectURL(
    new Blob([markup], { type: "image/svg+xml" }),
  );
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The SVG couldn't be rendered as an image"));
    };
    img.src = url;
  });
}

/**
 * Draw the markup onto a fresh canvas. The artwork keeps its aspect ratio
 * and is centered inside the box (letterboxed on transparent or the
 * background color), so a square favicon of a wide logo is never squashed.
 */
export async function rasterize(
  svg: string,
  { width, height, background, padding = 0 }: Omit<RasterOptions, "format">,
): Promise<HTMLCanvasElement> {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const inset = Math.round(
    Math.min(w, h) * Math.min(Math.max(padding, 0), 0.45),
  );
  const innerW = Math.max(1, w - inset * 2);
  const innerH = Math.max(1, h - inset * 2);

  const natural = naturalSize(svg);
  const scale = Math.min(innerW / natural.width, innerH / natural.height);
  const drawW = Math.max(1, Math.round(natural.width * scale));
  const drawH = Math.max(1, Math.round(natural.height * scale));

  const img = await loadSvgImage(svg, drawW, drawH);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(
    img,
    Math.round((w - drawW) / 2),
    Math.round((h - drawH) / 2),
    drawW,
    drawH,
  );
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

/**
 * Whether the browser's own encoder can produce `mime`. Memoized per format:
 * the probe encodes a 1×1 canvas and checks what MIME came back.
 */
const nativeSupport = new Map<string, Promise<boolean>>();
function supportsNativeEncode(mime: string): Promise<boolean> {
  let probe = nativeSupport.get(mime);
  if (!probe) {
    probe = (async () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const blob = await canvasToBlob(canvas, mime);
      return blob?.type === mime;
    })();
    nativeSupport.set(mime, probe);
  }
  return probe;
}

async function encodeWithWasm(
  canvas: HTMLCanvasElement,
  format: "webp" | "avif",
  quality: number,
): Promise<Blob> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (format === "webp") {
    const { encode } = await import("@jsquash/webp");
    const bytes = await encode(image, { quality });
    return new Blob([bytes], { type: "image/webp" });
  }
  const avif = await loadAvifEncoder();
  const { defaultOptions } = await import("@jsquash/avif/meta.js");
  // AVIF speed 6 is libavif's default; faster settings visibly cost quality
  // on flat-color artwork, which is exactly what icons are.
  const bytes = avif.encode(image.data, image.width, image.height, {
    ...defaultOptions,
    quality,
    speed: 6,
  });
  if (!bytes) throw new Error("AVIF encoding failed");
  // Copy out of the WASM heap so the Blob owns its bytes.
  return new Blob([new Uint8Array(bytes)], { type: "image/avif" });
}

/**
 * The AVIF codec is loaded straight from its single-threaded emscripten
 * build rather than through the package's encode() wrapper. The wrapper
 * also references the pthreads build, whose Worker + SharedArrayBuffer
 * graph makes Turbopack's production build hang indefinitely (ADR-0001).
 * The app never sends the cross-origin isolation headers threads need, so
 * nothing is lost.
 */
let avifModule: Promise<
  import("@jsquash/avif/codec/enc/avif_enc.js").AVIFModule
> | null = null;
function loadAvifEncoder() {
  avifModule ??= import("@jsquash/avif/codec/enc/avif_enc.js").then(
    ({ default: factory }) => factory({ noInitialRun: true }),
  );
  return avifModule;
}

/** Encode a rendered canvas in the requested format. */
export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: RasterFormat,
  quality = DEFAULT_QUALITY,
): Promise<Blob> {
  const meta = RASTER_FORMATS.find((f) => f.value === format)!;
  if (format === "png") {
    const blob = await canvasToBlob(canvas, meta.mime);
    if (!blob) throw new Error("PNG encoding failed");
    return blob;
  }
  const q = Math.min(Math.max(quality, 1), 100);
  if (await supportsNativeEncode(meta.mime)) {
    const blob = await canvasToBlob(canvas, meta.mime, q / 100);
    if (blob?.type === meta.mime) return blob;
  }
  return encodeWithWasm(canvas, format, q);
}

/** SVG markup → encoded image, in one step. */
export async function renderRaster(
  svg: string,
  options: RasterOptions,
): Promise<Blob> {
  const canvas = await rasterize(svg, options);
  return encodeCanvas(canvas, options.format, options.quality);
}

/** "icon-home.svg" → "icon-home.png". */
export function rasterFilename(name: string, format: RasterFormat): string {
  const ext = RASTER_FORMATS.find((f) => f.value === format)!.ext;
  const stem = name.replace(/\.svg$/i, "").trim() || "image";
  return `${stem}.${ext}`;
}
