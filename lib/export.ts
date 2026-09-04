/**
 * "Copy as…" transforms. All pure string → string, so they run anywhere and
 * are unit-tested in lib/export.test.ts.
 */

export type DataUriEncoding = "uri" | "base64";
export type CssQuotes = "double" | "single";

export type DataUriOptions = {
  encoding?: DataUriEncoding;
  /** The quote the caller will wrap the URI in (`url("…")` vs `url('…')`). */
  quotes?: CssQuotes;
};

/**
 * Characters a CSS url() cannot carry raw even inside quotes, plus the ones
 * that break unquoted url() and HTML attributes: `#` (starts a URL fragment —
 * every hex color), `%` (the escape itself), angle brackets, parens, braces,
 * and line breaks. Everything else — spaces, `=`, `:`, `/`, `,`, `;` — stays
 * readable, which is what keeps this encoding smaller than base64.
 */
const UNSAFE = /[\r\n%#()<>?[\\\]^`{|}]/g;

export const QUOTE_CHAR: Record<CssQuotes, string> = {
  double: '"',
  single: "'",
};

/**
 * Minified, percent-encoded SVG for a `data:image/svg+xml,` URI. The SVG's
 * attribute quotes flip to the opposite of the wrapper's quote, so a
 * double-quoted url() carries single-quoted attributes and nothing inside
 * needs escaping. If the markup already uses both quote kinds (a quoted
 * font-family, an apostrophe in <text>), the wrapper's quote is
 * percent-encoded instead so the document stays well-formed.
 */
export function encodeSvgForUri(
  svg: string,
  quotes: CssQuotes = "double",
): string {
  const outer = QUOTE_CHAR[quotes];
  const inner = QUOTE_CHAR[quotes === "double" ? "single" : "double"];
  let out = svg
    .trim()
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ");
  if (!out.includes(inner)) {
    out = out.split(outer).join(inner);
  }
  out = out.replace(UNSAFE, encodeURIComponent);
  return out.split(outer).join(encodeURIComponent(outer));
}

/** UTF-8 safe base64 (btoa alone throws on anything outside Latin-1). */
export function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * A data URI for the markup. URL-encoding (the default) is smaller than
 * base64 for SVG text and stays legible; base64 is opaque but survives tools
 * that mangle percent signs. The result is safe inside url("…") and src="…".
 */
export function toDataUri(svg: string, options: DataUriOptions = {}): string {
  const { encoding = "uri", quotes = "double" } = options;
  if (encoding === "base64") {
    return `data:image/svg+xml;base64,${toBase64(svg.trim())}`;
  }
  return `data:image/svg+xml,${encodeSvgForUri(svg, quotes)}`;
}

/** The URI wrapped in url(), quoted the way the URI was encoded for. */
export function toCssUrl(svg: string, options: DataUriOptions = {}): string {
  const q = QUOTE_CHAR[options.quotes ?? "double"];
  return `url(${q}${toDataUri(svg, options)}${q})`;
}

/** Attribute names React spells differently from SVG source. */
const JSX_ATTR_EXCEPTIONS: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  "xlink:href": "xlinkHref",
  "xlink:title": "xlinkTitle",
  "xml:space": "xmlSpace",
  "xml:lang": "xmlLang",
  "xmlns:xlink": "xmlnsXlink",
};

/**
 * Rewrite optimized SVG markup so it pastes cleanly into JSX: kebab-case and
 * namespaced attributes become camelCase, class becomes className, and
 * style="a:b" becomes style={{ a: "b" }}.
 *
 * This is a lexical pass over `attr="value"` pairs, not a real XML transform —
 * a value that itself contains ` x="` would confuse it. Optimized SVGO output
 * doesn't produce that.
 */
export function toJsx(svg: string): string {
  return svg.replace(
    /(\s)([a-zA-Z_][\w.:-]*)="([^"]*)"/g,
    (_match, ws: string, name: string, value: string) => {
      if (name === "style") return `${ws}${styleToJsx(value)}`;
      return `${ws}${jsxAttrName(name)}="${value}"`;
    },
  );
}

function jsxAttrName(name: string): string {
  const exception = JSX_ATTR_EXCEPTIONS[name];
  if (exception) return exception;
  // React passes data-* and aria-* through unchanged.
  if (/^(data-|aria-)/.test(name)) return name;
  return name.replace(/[-:]([a-z])/g, (_, c: string) => c.toUpperCase());
}

function styleToJsx(value: string): string {
  const entries = value
    .split(";")
    .map((decl) => decl.trim())
    .filter((decl) => decl.includes(":"))
    .map((decl) => {
      const idx = decl.indexOf(":");
      const prop = decl.slice(0, idx).trim();
      const val = decl
        .slice(idx + 1)
        .trim()
        .replace(/"/g, '\\"');
      const key = prop.startsWith("--")
        ? `"${prop}"`
        : prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      return `${key}: "${val}"`;
    });
  return `style={{ ${entries.join(", ")} }}`;
}
