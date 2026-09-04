import { parse as parseCssColor, formatCss as formatCssColor } from "culori";
import { toCssUrl, toDataUri, toJsx as toJsxMarkup } from "./export";
import { idPrefix } from "./settings";
import { artworkBox, ensureSvgXmlns } from "./svg";
import type { FormatSettings } from "./format-settings";

/**
 * The Format layer: pure projections applied AFTER the optimizer. Everything
 * here is a lexical string transform in the style of lib/export.ts — no DOM —
 * so it runs identically in the browser, tests, and (if ever needed) workers.
 *
 * Optimized SVGO output is regular enough (`attr="value"` pairs, one root
 * <svg> tag) that lexical passes are safe; hand-authored edge cases fall back
 * to leaving the markup untouched rather than corrupting it.
 */

export type FormatContext = {
  /** The file's name, extension included ("icon-home.svg"). */
  name: string;
  /** Per-part color overrides, keyed by original paint value (lowercased). */
  partColors?: Record<string, string>;
};

export type CodeLanguage = "xml" | "typescript" | "css";

export type FormattedFile = {
  content: string;
  filename: string;
  mime: string;
  /** The grammar the Code view highlights the content with. */
  language: CodeLanguage;
};

const ROOT_TAG = /<svg\b[^>]*>/;

/* ---------------------------------------------------------------- attrs */

function setAttr(tag: string, name: string, value: string): string {
  const pattern = new RegExp(`(\\s${name}=")[^"]*(")`);
  if (pattern.test(tag)) return tag.replace(pattern, `$1${value}$2`);
  return tag.replace(/\s*(\/?)>$/, ` ${name}="${value}"$1>`);
}

function removeAttr(tag: string, name: string): string {
  return tag.replace(new RegExp(`\\s${name}="[^"]*"`), "");
}

/** Apply a transform to the root <svg> open tag; no root tag → untouched. */
function mapRootTag(svg: string, fn: (tag: string) => string): string {
  const match = svg.match(ROOT_TAG);
  if (!match) return svg;
  return svg.replace(match[0], fn(match[0]));
}

/* ---------------------------------------------------------------- palette */

/** Paint values that aren't recolorable slots. */
function isPaintSlot(value: string): boolean {
  const paint = value.trim().toLowerCase();
  return paint !== "" && paint !== "none" && !paint.startsWith("url(");
}

const FILL_STROKE_ATTR = /\s(?:fill|stroke)="([^"]*)"/g;
const FILL_STROKE_STYLE = /(?:^|;)\s*(?:fill|stroke)\s*:\s*([^;"']+)/g;

/**
 * Distinct paint values, lowercased: fill/stroke attributes in document
 * order, then style-declared paints. "none" and url(#…) references are
 * excluded. Each entry is one recolorable part slot; the value doubles as
 * the stable key for per-part overrides, so slots survive re-optimization.
 */
export function extractPalette(svg: string): string[] {
  const seen = new Set<string>();
  const palette: string[] = [];
  const add = (value: string) => {
    if (!isPaintSlot(value)) return;
    const key = value.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    palette.push(key);
  };
  for (const match of svg.matchAll(FILL_STROKE_ATTR)) add(match[1]);
  for (const style of svg.matchAll(/\sstyle="([^"]*)"/g)) {
    for (const match of style[1].matchAll(FILL_STROKE_STYLE)) add(match[1]);
  }
  return palette;
}

/** Rewrite every fill/stroke paint equal to `from` (case-insensitive) with `to`. */
function replacePaint(svg: string, from: string, to: string): string {
  const key = from.trim().toLowerCase();
  const swapped = svg.replace(FILL_STROKE_ATTR, (match, value: string) =>
    value.trim().toLowerCase() === key
      ? match.replace(`"${value}"`, `"${to}"`)
      : match,
  );
  return swapped.replace(/\sstyle="([^"]*)"/g, (match, style: string) => {
    const next = style.replace(
      FILL_STROKE_STYLE,
      (decl: string, value: string) =>
        value.trim().toLowerCase() === key ? decl.replace(value, to) : decl,
    );
    return next === style ? match : match.replace(style, next);
  });
}

/**
 * The color pass. Per-part overrides always win for their slot. A non-empty
 * base color additionally recolors monochrome files: exactly one slot → that
 * slot follows the base; no explicit paints at all → the base becomes a root
 * fill. Multi-color files keep their palette unless individually overridden.
 */
function applyColors(
  svg: string,
  format: FormatSettings,
  partColors: Record<string, string> | undefined,
): string {
  const palette = extractPalette(svg);
  const base = format.color.trim();

  if (palette.length === 0) {
    return base ? mapRootTag(svg, (tag) => setAttr(tag, "fill", base)) : svg;
  }

  let out = svg;
  for (const slot of palette) {
    const target =
      partColors?.[slot] ?? (palette.length === 1 && base ? base : undefined);
    if (target && target.trim().toLowerCase() !== slot) {
      out = replacePaint(out, slot, target);
    }
  }
  return out;
}

/* ------------------------------------------------------------- highlight */

/** A ~15%-alpha version of a paint; unparseable paints dim to translucent black. */
function dimPaint(value: string): string {
  const parsed = parseCssColor(value);
  if (!parsed) return "rgba(0,0,0,0.15)";
  return formatCssColor({ ...parsed, alpha: (parsed.alpha ?? 1) * 0.15 });
}

/**
 * Preview-only highlight variant: the target slot keeps its paint, every
 * other slot fades to 15% alpha so the hovered part pops.
 */
export function highlightPartSvg(svg: string, partKey: string): string {
  const key = partKey.trim().toLowerCase();
  let out = svg;
  for (const slot of extractPalette(svg)) {
    if (slot !== key) out = replacePaint(out, slot, dimPaint(slot));
  }
  return out;
}

/* ------------------------------------------------------------ size + rect */

function applySize(svg: string, format: FormatSettings): string {
  if (format.sizeMode === "auto") return svg;
  return mapRootTag(svg, (tag) => {
    if (format.sizeMode === "none") {
      return removeAttr(removeAttr(tag, "width"), "height");
    }
    const unit = format.sizeMode === "px" ? "px" : format.sizeMode;
    const size = `${format.sizeValue}${unit}`;
    return setAttr(setAttr(tag, "width", size), "height", size);
  });
}

function applyEmptyRect(svg: string): string {
  const box = artworkBox(svg);
  if (!box) return svg;
  const offset =
    (box.x !== 0 ? ` x="${box.x}"` : "") + (box.y !== 0 ? ` y="${box.y}"` : "");
  const rect = `<rect${offset} width="${box.w}" height="${box.h}" fill="none"/>`;
  return mapRootTag(svg, (tag) => `${tag}${rect}`);
}

/* ------------------------------------------------------------- wrapping */

function stemOf(name: string): string {
  return name.replace(/\.svg$/i, "").trim() || "svg";
}

function pascalCase(stem: string): string {
  const joined = stem
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
  if (!joined) return "SvgIcon";
  return /^[0-9]/.test(joined) ? `Svg${joined}` : joined;
}

function toJsxComponent(svg: string, name: string): string {
  const componentName = pascalCase(stemOf(name));
  const markup = mapRootTag(toJsxMarkup(svg), (tag) =>
    tag.replace(/\s*(\/?)>$/, " {...props}$1>"),
  );
  return (
    `import type { SVGProps } from "react";\n\n` +
    `export function ${componentName}(props: SVGProps<SVGSVGElement>) {\n` +
    `  return (\n    ${markup}\n  );\n}\n`
  );
}

function toSymbol(svg: string, symbolId: string): string {
  const box = artworkBox(svg);
  const viewBox = box ? ` viewBox="${box.x} ${box.y} ${box.w} ${box.h}"` : "";
  const inner = svg
    .replace(/^[\s\S]*?<svg\b[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");
  return `<symbol id="${symbolId}"${viewBox}>${inner}</symbol>`;
}

const SPRITE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">`;

/** One sprite <svg> holding a <symbol> per file, ready to inline or serve. */
export function buildSprite(
  files: { symbolId: string; svg: string }[],
): string {
  const symbols = files.map((f) => toSymbol(f.svg, f.symbolId)).join("");
  return `${SPRITE_OPEN}${symbols}</svg>`;
}

/* ------------------------------------------------------------------ css */

/** `inline-size`/`block-size` lines when the Size setting names a unit. */
function cssSizeDeclarations(format: FormatSettings): string {
  if (format.sizeMode === "auto" || format.sizeMode === "none") return "";
  const size = `${format.sizeValue}${format.sizeMode}`;
  return `inline-size: ${size};\nblock-size: ${size};\n`;
}

/**
 * The CSS file type: the (visually formatted) SVG as a data URI, wrapped in
 * the snippet the user will paste. A data URI renders as a standalone
 * document, so xmlns is restored if the optimizer stripped it — without it
 * the browser shows nothing.
 */
export function formatCss(
  svg: string,
  format: FormatSettings,
  ctx: FormatContext,
): string {
  const options = { encoding: format.cssEncoding, quotes: format.cssQuotes };
  const markup = ensureSvgXmlns(svg);
  const url = toCssUrl(markup, options);
  const position = `${url} center / contain no-repeat`;
  switch (format.cssSnippet) {
    case "uri":
      return toDataUri(markup, options);
    case "url":
      return url;
    case "property":
      return `--${idPrefix(ctx.name)}: ${url};`;
    case "background":
      return `${cssSizeDeclarations(format)}background: ${position};`;
    case "mask":
      return (
        `${cssSizeDeclarations(format)}background-color: currentColor;\n` +
        `mask: ${position};`
      );
  }
}

/* ---------------------------------------------------------------- public */

/**
 * Visual-only transforms (size, color, empty rect) with no file-type
 * wrapping — this feeds the preview <img> for every file type, so what the
 * user sees always matches the paints and box of what they'll export.
 */
export function formatPreviewSvg(
  svg: string,
  format: FormatSettings,
  ctx: FormatContext,
): string {
  let out = applySize(svg, format);
  out = applyColors(out, format, ctx.partColors);
  if (format.includeEmptyRect) out = applyEmptyRect(out);
  return out;
}

/**
 * The full export projection: visual transforms plus file-type wrapping.
 * Copy, Download, and the Code view must all consume this same result.
 */
export function formatOutput(
  svg: string,
  format: FormatSettings,
  ctx: FormatContext,
): FormattedFile {
  const markup = formatPreviewSvg(svg, format, ctx);
  const stem = stemOf(ctx.name);

  if (format.fileType === "jsx") {
    return {
      content: toJsxComponent(markup, ctx.name),
      filename: `${stem}.tsx`,
      mime: "text/plain",
      language: "typescript",
    };
  }

  if (format.fileType === "css") {
    return {
      content: formatCss(markup, format, ctx),
      filename: `${stem}.css`,
      mime: "text/css",
      language: "css",
    };
  }

  if (format.fileType === "symbol") {
    const slug = idPrefix(ctx.name);
    const usage = `\n<!-- <svg width="24" height="24"><use href="#${slug}"/></svg> -->`;
    return {
      content: `${SPRITE_OPEN}${toSymbol(markup, slug)}</svg>${usage}`,
      filename: `${stem}.svg`,
      mime: "image/svg+xml",
      language: "xml",
    };
  }

  return {
    content: markup,
    filename: `${stem}.svg`,
    mime: "image/svg+xml",
    language: "xml",
  };
}
