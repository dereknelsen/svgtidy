import * as v from "valibot";
import type { CssQuotes, DataUriEncoding } from "./export";

/**
 * The format settings model: the export-shaping half of the app's settings,
 * applied AFTER the optimizer as a pure projection (see lib/format-output.ts).
 * It deliberately mirrors lib/settings.ts: one descriptor table drives the
 * type, defaults, validation, and URL parameter names. It stays a separate
 * model because its controls are heterogeneous (selects, text, floats) while
 * `Settings` only knows toggles and sliders.
 *
 * Presets store one flat object holding both halves; each parser picks out its
 * own keys and ignores the rest.
 */

export type FileType = "svg" | "jsx" | "symbol" | "css";
export type SizeMode = "auto" | "px" | "em" | "rem" | "none";
/** The CSS the data URI is wrapped in when the file type is CSS. */
export type CssSnippet = "uri" | "url" | "property" | "background" | "mask";
export type { CssQuotes, DataUriEncoding };

export type FormatSettings = {
  fileType: FileType;
  sizeMode: SizeMode;
  sizeValue: number;
  /** Base paint. "" keeps the original colors untouched. */
  color: string;
  includeEmptyRect: boolean;
  cssSnippet: CssSnippet;
  cssEncoding: DataUriEncoding;
  cssQuotes: CssQuotes;
};

/** Compact query param names. Frozen: these are baked into shared links. */
export const FORMAT_DESCRIPTORS = {
  fileType: {
    default: "svg",
    urlKey: "ft",
    label: "File type",
    description: "How the optimized markup is packaged for copy and download.",
  },
  sizeMode: {
    default: "auto",
    urlKey: "sm",
    label: "Size",
    description: "How width and height are written on the exported SVG.",
  },
  sizeValue: {
    default: 24,
    urlKey: "sv",
    label: "Size value",
    description: "The number used for width and height in px, em, or rem.",
  },
  color: {
    default: "currentColor",
    urlKey: "col",
    label: "Color",
    description:
      "Replaces the paint of single-color files. Multi-color files keep their own palette unless a part is overridden.",
  },
  includeEmptyRect: {
    default: false,
    urlKey: "er",
    label: "Include empty rectangle",
    description:
      "Adds an invisible rectangle covering the viewBox so the artwork keeps its full bounding box when pasted into design tools.",
  },
  cssSnippet: {
    default: "background",
    urlKey: "cs",
    label: "Snippet",
    description: "What CSS is written around the data URI.",
  },
  cssEncoding: {
    default: "uri",
    urlKey: "ce",
    label: "Encoding",
    description:
      "URL-encoding escapes only what CSS needs and stays readable; base64 is opaque but survives tools that mangle percent signs.",
  },
  cssQuotes: {
    default: "double",
    urlKey: "cq",
    label: "Quotes",
    description:
      "The quote around url(). The SVG's own attribute quotes flip to the other kind so nothing inside needs escaping.",
  },
} as const;

export type FormatKey = keyof typeof FORMAT_DESCRIPTORS;

export const FORMAT_KEYS = Object.keys(FORMAT_DESCRIPTORS) as FormatKey[];

export const DEFAULT_FORMAT: FormatSettings = {
  fileType: "svg",
  sizeMode: "auto",
  sizeValue: 24,
  color: "currentColor",
  includeEmptyRect: false,
  cssSnippet: "background",
  cssEncoding: "uri",
  cssQuotes: "double",
};

export const FILE_TYPES = ["svg", "jsx", "symbol", "css"] as const;

/** Panel copy for the file-type select, one sentence per option. */
export const FILE_TYPE_OPTIONS: {
  value: FileType;
  label: string;
  hint: string;
}[] = [
  {
    value: "svg",
    label: "SVG",
    hint: "Plain optimized markup, ready for any tool.",
  },
  {
    value: "jsx",
    label: "JSX",
    hint: "A typed React component you can import directly.",
  },
  {
    value: "symbol",
    label: "Symbol",
    hint: "A <symbol> for SVG sprites, referenced with <use href>.",
  },
  {
    value: "css",
    label: "CSS",
    hint: "The SVG as a data URI, wrapped in the CSS you'll paste it into. xmlns is added if the optimizer stripped it.",
  },
];

export const SIZE_MODES = ["auto", "px", "em", "rem", "none"] as const;

/** Common size suggestions for the combobox; any free value is accepted. */
export const SIZE_SUGGESTIONS = [1, 16, 20, 24, 32, 48, 64];

export const CSS_SNIPPETS = [
  "uri",
  "url",
  "property",
  "background",
  "mask",
] as const;

/** Panel copy for the snippet select: the gotcha each shape avoids. */
export const CSS_SNIPPET_OPTIONS: {
  value: CssSnippet;
  label: string;
  hint: string;
}[] = [
  {
    value: "uri",
    label: "Data URI",
    hint: "Just the encoded data: URI, for an <img src> or your own url().",
  },
  {
    value: "url",
    label: "url()",
    hint: "The URI wrapped in url(), ready for any image-accepting property.",
  },
  {
    value: "property",
    label: "Custom property",
    hint: "A --custom-property named after the file, so background and mask can reference one icon from anywhere.",
  },
  {
    value: "background",
    label: "Background",
    hint: "A centered, contained, non-repeating background. Paints are baked in: currentColor renders black in a data URI, so pick a real color or use Mask.",
  },
  {
    value: "mask",
    label: "Mask",
    hint: "mask plus background-color: currentColor, so the icon takes the text color. Only the shape matters; the SVG's own paints are ignored.",
  },
];

export const CSS_ENCODINGS = ["uri", "base64"] as const;

export const CSS_ENCODING_OPTIONS: { value: DataUriEncoding; label: string }[] =
  [
    { value: "uri", label: "URL-encoded" },
    { value: "base64", label: "Base64" },
  ];

export const CSS_QUOTES = ["double", "single"] as const;

// Kept as a raw object schema so `v.partial` can derive the override parser.
const FormatObjectSchema = v.object({
  fileType: v.picklist(FILE_TYPES),
  sizeMode: v.picklist(SIZE_MODES),
  sizeValue: v.pipe(v.number(), v.minValue(0)),
  color: v.string(),
  includeEmptyRect: v.boolean(),
  cssSnippet: v.picklist(CSS_SNIPPETS),
  cssEncoding: v.picklist(CSS_ENCODINGS),
  cssQuotes: v.picklist(CSS_QUOTES),
});
const FormatSchema = FormatObjectSchema as v.GenericSchema<FormatSettings>;
const FormatOverrideSchema = v.partial(FormatObjectSchema);

/** Safely coerce unknown data (from a URL, DB preset, or storage) into valid FormatSettings. */
export function parseFormatSettings(input: unknown): FormatSettings {
  const result = v.safeParse(FormatSchema, {
    ...DEFAULT_FORMAT,
    ...(typeof input === "object" && input !== null ? input : {}),
  });
  return result.success ? result.output : { ...DEFAULT_FORMAT };
}

/**
 * Coerce unknown data into a partial FormatSettings: the format half of an
 * override. Foreign keys (optimize keys included) are stripped; any invalid
 * value rejects the whole input, mirroring `parseFormatSettings`.
 */
export function parseFormatOverride(input: unknown): Partial<FormatSettings> {
  if (typeof input !== "object" || input === null) return {};
  const result = v.safeParse(FormatOverrideSchema, input);
  return result.success ? (result.output as Partial<FormatSettings>) : {};
}
