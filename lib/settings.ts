import * as v from "valibot";

/**
 * The optimization settings model. Every setting maps to one or more SVGO
 * behaviors, but is named for what it does to the user's file rather than for
 * the internal plugin. Defaults are chosen to be safe and modern: viewBox is
 * always preserved, IDs are cleaned, and precision is high enough to stay
 * crisp while still shaving bytes.
 *
 * `SETTING_DESCRIPTORS` is the single source of truth: the `Settings` type,
 * defaults, validation schema, URL parameter names, panel copy, and the SVGO
 * config are all derived from it. Adding a setting means adding one row here
 * and listing its key in a `SETTINGS_GROUP_META` group. Everything else
 * follows.
 *
 * Row order is SVGO execution order: standalone plugins are pushed in the
 * order their rows appear. Panel display order is separate. It lives in the
 * `keys` lists of `SETTINGS_GROUP_META`.
 */

/** How one setting reaches SVGO. */
type SvgoMapping =
  /** Plugin runs inside preset-default; turning the setting off disables it.
   * (When the setting is on, preset-default already runs the plugin.) */
  | { kind: "preset-override"; plugin: string }
  /** Plugin is not in preset-default; turning the setting on pushes it. */
  | { kind: "standalone"; plugin: string }
  /** Top-level SVGO config field rather than a plugin. */
  | { kind: "config"; field: "multipass" | "floatPrecision" | "pretty" };

type SliderControl = { kind: "slider"; min: number; max: number; step: number };

type Descriptor = {
  default: boolean | number;
  /** Compact query param name. Frozen: these are baked into shared links. */
  urlKey: string;
  control: "toggle" | SliderControl;
  label: string;
  description: string;
  /** Warn the user that this can change how the SVG looks/behaves. */
  risky?: boolean;
  svgo: SvgoMapping;
};

export const SETTING_DESCRIPTORS = {
  removeComments: {
    default: true,
    urlKey: "rc",
    control: "toggle",
    label: "Remove comments",
    description: "Delete <!-- --> comments.",
    svgo: { kind: "preset-override", plugin: "removeComments" },
  },
  removeMetadata: {
    default: true,
    urlKey: "rm",
    control: "toggle",
    label: "Remove metadata",
    description: "Drop <metadata> blocks.",
    svgo: { kind: "preset-override", plugin: "removeMetadata" },
  },
  // removeTitle is not part of preset-default, so it must be pushed
  // explicitly, unlike removeDesc just below, which preset-default runs.
  removeTitle: {
    default: false,
    urlKey: "rt",
    control: "toggle",
    label: "Remove <title>",
    description: "Removes accessible titles.",
    risky: true,
    svgo: { kind: "standalone", plugin: "removeTitle" },
  },
  removeDesc: {
    default: false,
    urlKey: "rd",
    control: "toggle",
    label: "Remove <desc>",
    description: "Removes long descriptions.",
    risky: true,
    svgo: { kind: "preset-override", plugin: "removeDesc" },
  },
  removeEditorNS: {
    default: true,
    urlKey: "rns",
    control: "toggle",
    label: "Remove editor data",
    description: "Strip Illustrator / Inkscape / Sketch namespaces.",
    svgo: { kind: "preset-override", plugin: "removeEditorsNSData" },
  },
  removeDoctype: {
    default: true,
    urlKey: "rdt",
    control: "toggle",
    label: "Remove doctype",
    description: "Delete the <!DOCTYPE> declaration.",
    svgo: { kind: "preset-override", plugin: "removeDoctype" },
  },
  removeXMLProcInst: {
    default: true,
    urlKey: "rxp",
    control: "toggle",
    label: "Remove XML instructions",
    description: "Delete the <?xml ?> processing instruction.",
    svgo: { kind: "preset-override", plugin: "removeXMLProcInst" },
  },
  removeScripts: {
    default: false,
    urlKey: "rsc",
    control: "toggle",
    label: "Remove scripts",
    description: "Strip <script> tags and on* event handlers.",
    risky: true,
    svgo: { kind: "standalone", plugin: "removeScripts" },
  },
  removeRasterImages: {
    default: false,
    urlKey: "rri",
    control: "toggle",
    label: "Remove raster images",
    description: "Drop embedded PNG/JPEG <image> data.",
    risky: true,
    svgo: { kind: "standalone", plugin: "removeRasterImages" },
  },
  removeStyleElement: {
    default: false,
    urlKey: "rse",
    control: "toggle",
    label: "Remove <style> blocks",
    description: "Delete all stylesheets outright.",
    risky: true,
    svgo: { kind: "standalone", plugin: "removeStyleElement" },
  },
  removeHiddenElems: {
    default: true,
    urlKey: "rh",
    control: "toggle",
    label: "Remove hidden elements",
    description: "Drop display:none and zero-size shapes.",
    svgo: { kind: "preset-override", plugin: "removeHiddenElems" },
  },
  removeEmptyContainers: {
    default: true,
    urlKey: "rec",
    control: "toggle",
    label: "Remove empty containers",
    description: "Delete containers with no children.",
    svgo: { kind: "preset-override", plugin: "removeEmptyContainers" },
  },
  removeUnknownsAndDefaults: {
    default: true,
    urlKey: "rud",
    control: "toggle",
    label: "Remove defaults",
    description: "Drop unknown and redundant default attributes.",
    svgo: { kind: "preset-override", plugin: "removeUnknownsAndDefaults" },
  },
  removeUselessStrokeFill: {
    default: true,
    urlKey: "rsf",
    control: "toggle",
    label: "Clean stroke & fill",
    description: "Remove strokes/fills that have no effect.",
    svgo: { kind: "preset-override", plugin: "removeUselessStrokeAndFill" },
  },
  cleanupIds: {
    default: true,
    urlKey: "ci",
    control: "toggle",
    label: "Minify IDs",
    description: "Shorten and remove unused id attributes.",
    svgo: { kind: "preset-override", plugin: "cleanupIds" },
  },
  minifyStyles: {
    default: true,
    urlKey: "ms",
    control: "toggle",
    label: "Minify CSS",
    description: "Compress remaining <style> blocks.",
    svgo: { kind: "preset-override", plugin: "minifyStyles" },
  },
  inlineStyles: {
    default: true,
    urlKey: "is",
    control: "toggle",
    label: "Inline styles",
    description: "Move matching CSS rules onto elements.",
    svgo: { kind: "preset-override", plugin: "inlineStyles" },
  },
  collapseGroups: {
    default: true,
    urlKey: "cg",
    control: "toggle",
    label: "Collapse groups",
    description: "Flatten redundant <g> wrappers.",
    risky: true,
    svgo: { kind: "preset-override", plugin: "collapseGroups" },
  },
  mergePaths: {
    default: true,
    urlKey: "mp",
    control: "toggle",
    label: "Merge paths",
    description: "Combine adjacent paths with the same style.",
    risky: true,
    svgo: { kind: "preset-override", plugin: "mergePaths" },
  },
  reusePaths: {
    default: false,
    urlKey: "rp",
    control: "toggle",
    label: "Deduplicate paths",
    description: "Replace repeated paths with <use> references.",
    risky: true,
    svgo: { kind: "standalone", plugin: "reusePaths" },
  },
  cleanupListOfValues: {
    default: false,
    urlKey: "clv",
    control: "toggle",
    label: "Round list values",
    description: "Round numbers in points and viewBox lists.",
    svgo: { kind: "standalone", plugin: "cleanupListOfValues" },
  },
  convertColors: {
    default: true,
    urlKey: "cc",
    control: "toggle",
    label: "Shorten colors",
    description: "rgb() to #hex, and #aabbcc to #abc.",
    svgo: { kind: "preset-override", plugin: "convertColors" },
  },
  convertPathData: {
    default: true,
    urlKey: "cpd",
    control: "toggle",
    label: "Optimize path data",
    description: 'Rewrite d="" to shorter commands.',
    risky: true,
    svgo: { kind: "preset-override", plugin: "convertPathData" },
  },
  convertTransform: {
    default: true,
    urlKey: "ct",
    control: "toggle",
    label: "Optimize transforms",
    description: "Collapse and shorten transform lists.",
    risky: true,
    svgo: { kind: "preset-override", plugin: "convertTransform" },
  },
  convertOneStopGradients: {
    default: false,
    urlKey: "cog",
    control: "toggle",
    label: "Flatten plain gradients",
    description: "Turn one-stop gradients into solid fills.",
    risky: true,
    svgo: { kind: "standalone", plugin: "convertOneStopGradients" },
  },
  removeOffCanvasPaths: {
    default: false,
    urlKey: "rocp",
    control: "toggle",
    label: "Remove off-canvas paths",
    description: "Delete paths entirely outside the viewBox.",
    risky: true,
    svgo: { kind: "standalone", plugin: "removeOffCanvasPaths" },
  },
  // Not in preset-default since SVGO 4, so removing the viewBox requires an
  // explicit standalone push. (Mapping it as a preset-override was a real bug:
  // the toggle silently did nothing.)
  removeViewBox: {
    default: false,
    urlKey: "rvb",
    control: "toggle",
    label: "Remove viewBox",
    description: "Not recommended: breaks responsive scaling.",
    risky: true,
    svgo: { kind: "standalone", plugin: "removeViewBox" },
  },
  sortAttrs: {
    default: true,
    urlKey: "sa",
    control: "toggle",
    label: "Sort attributes",
    description: "Order attributes for better gzip.",
    svgo: { kind: "preset-override", plugin: "sortAttrs" },
  },
  removeDimensions: {
    default: false,
    urlKey: "rdim",
    control: "toggle",
    label: "Remove width/height",
    description: "Keep viewBox, drop fixed size so it scales.",
    svgo: { kind: "standalone", plugin: "removeDimensions" },
  },
  removeXMLNS: {
    default: false,
    urlKey: "rxn",
    control: "toggle",
    label: "Remove xmlns",
    description: "For inlining directly into HTML/JSX.",
    risky: true,
    svgo: { kind: "standalone", plugin: "removeXMLNS" },
  },
  prefixIds: {
    default: false,
    urlKey: "pi",
    control: "toggle",
    label: "Prefix IDs",
    description:
      "Namespace ids/classes by filename so inlined SVGs don't collide.",
    svgo: { kind: "standalone", plugin: "prefixIds" },
  },
  convertStyleToAttrs: {
    default: false,
    urlKey: "csa",
    control: "toggle",
    label: "Styles to attributes",
    description: 'Rewrite style="" as presentation attributes.',
    risky: true,
    svgo: { kind: "standalone", plugin: "convertStyleToAttrs" },
  },
  floatPrecision: {
    default: 3,
    urlKey: "fp",
    control: { kind: "slider", min: 0, max: 8, step: 1 },
    label: "Number precision",
    description:
      "Decimal places for coordinates. Lower is smaller; 2 to 3 is safe for most icons.",
    svgo: { kind: "config", field: "floatPrecision" },
  },
  prettify: {
    default: false,
    urlKey: "pp",
    control: "toggle",
    label: "Pretty print",
    description: "Readable, indented output (larger).",
    svgo: { kind: "config", field: "pretty" },
  },
  multipass: {
    default: true,
    urlKey: "mpass",
    control: "toggle",
    label: "Multipass",
    description: "Run repeatedly until no further savings.",
    svgo: { kind: "config", field: "multipass" },
  },
} as const satisfies Record<string, Descriptor>;

export type SettingKey = keyof typeof SETTING_DESCRIPTORS;

export type Settings = {
  [K in SettingKey]: (typeof SETTING_DESCRIPTORS)[K]["control"] extends "toggle"
    ? boolean
    : number;
};

export type ToggleKey = {
  [K in SettingKey]: Settings[K] extends boolean ? K : never;
}[SettingKey];

export const SETTING_KEYS = Object.keys(SETTING_DESCRIPTORS) as SettingKey[];

export const DEFAULT_SETTINGS = Object.fromEntries(
  SETTING_KEYS.map((key) => [key, SETTING_DESCRIPTORS[key].default]),
) as Settings;

/**
 * The panel is grouped by intent, not by SVGO plugin, and `keys` order is
 * display order. Every toggle must appear in exactly one group (checked below
 * at compile time).
 */
export const SETTINGS_GROUP_META = [
  {
    id: "cleanup",
    title: "Cleanup",
    description: "Strip bloated editor artifacts and metadata.",
    keys: [
      "removeComments",
      "removeMetadata",
      "removeEditorNS",
      "removeDoctype",
      "removeXMLProcInst",
      "removeTitle",
      "removeDesc",
    ],
  },
  {
    id: "sanitize",
    title: "Sanitize",
    description: "Make the file safe to embed anywhere.",
    keys: ["removeScripts", "removeRasterImages", "removeStyleElement"],
  },
  {
    id: "structure",
    title: "Structure & styles",
    description: "Simplify the document tree and inline styling.",
    keys: [
      "cleanupIds",
      "inlineStyles",
      "minifyStyles",
      "convertStyleToAttrs",
      "collapseGroups",
      "mergePaths",
      "removeHiddenElems",
      "removeEmptyContainers",
      "removeUselessStrokeFill",
      "removeUnknownsAndDefaults",
      "sortAttrs",
      "reusePaths",
      "cleanupListOfValues",
    ],
  },
  {
    id: "geometry",
    title: "Geometry & color",
    description: "Rewrite path data, transforms, and colors more compactly.",
    keys: [
      "convertPathData",
      "convertTransform",
      "convertColors",
      "convertOneStopGradients",
      "removeOffCanvasPaths",
    ],
  },
  {
    id: "dimensions",
    title: "Dimensions & scaling",
    description: "Control viewBox, width/height and the root namespace.",
    keys: ["removeViewBox", "removeDimensions", "removeXMLNS", "prefixIds"],
  },
  {
    id: "output",
    title: "Output",
    description: "How the final markup is formatted.",
    keys: ["multipass", "prettify"],
  },
] as const satisfies readonly {
  id: string;
  title: string;
  description: string;
  keys: readonly ToggleKey[];
}[];

// Compile-time completeness: a toggle missing from every group turns this
// assignment into a type error.
type GroupedKey = (typeof SETTINGS_GROUP_META)[number]["keys"][number];
const _everyToggleGrouped: Exclude<ToggleKey, GroupedKey> extends never
  ? true
  : never = true;
void _everyToggleGrouped;

export type ToggleMeta = {
  key: ToggleKey;
  label: string;
  description: string;
  risky?: boolean;
};

export type SettingsGroup = {
  id: string;
  title: string;
  description: string;
  toggles: ToggleMeta[];
};

export const SETTINGS_GROUPS: SettingsGroup[] = SETTINGS_GROUP_META.map(
  (group) => ({
    id: group.id,
    title: group.title,
    description: group.description,
    toggles: group.keys.map((key) => {
      const d = SETTING_DESCRIPTORS[key];
      return {
        key,
        label: d.label,
        description: d.description,
        risky: (d as Descriptor).risky,
      };
    }),
  }),
);

const SettingsSchema = v.object(
  Object.fromEntries(
    SETTING_KEYS.map((key) => {
      const control = SETTING_DESCRIPTORS[key].control;
      return [
        key,
        control === "toggle"
          ? v.boolean()
          : v.pipe(
              v.number(),
              v.minValue(control.min),
              v.maxValue(control.max),
              v.integer(),
            ),
      ];
    }),
  ),
) as unknown as v.GenericSchema<Settings>;

/**
 * Named presets. These are the "better defaults" that ship with the app so
 * the common cases are one click away.
 */
export const BUILT_IN_PRESETS: {
  id: string;
  name: string;
  hint: string;
  settings: Settings;
}[] = [
  {
    id: "balanced",
    name: "Balanced",
    hint: "Safe wins for most SVGs. Keeps viewBox and structure sane.",
    settings: { ...DEFAULT_SETTINGS },
  },
  {
    id: "aggressive",
    name: "Aggressive",
    hint: "Squeeze every byte. Lower precision, drops width/height.",
    settings: {
      ...DEFAULT_SETTINGS,
      floatPrecision: 1,
      removeDimensions: true,
      removeTitle: true,
      removeDesc: true,
      convertStyleToAttrs: true,
      convertOneStopGradients: true,
      removeOffCanvasPaths: true,
    },
  },
  {
    id: "lossless",
    name: "Lossless",
    hint: "Only cleanup. No path/transform rewriting, full precision.",
    settings: {
      ...DEFAULT_SETTINGS,
      floatPrecision: 8,
      convertPathData: false,
      convertTransform: false,
      mergePaths: false,
      collapseGroups: false,
      multipass: false,
    },
  },
];

/** SVGO config type is loose here to avoid pulling svgo types into the bundle. */
export type SvgoConfig = {
  multipass: boolean;
  floatPrecision: number;
  js2svg: { pretty: boolean; indent: number };
  plugins: unknown[];
};

/**
 * Translate the friendly settings model into an explicit SVGO config built on
 * top of preset-default, disabling plugins that the user turned off and adding
 * the standalone plugins they turned on.
 *
 * `filename` feeds prefixIds: SVGO can't derive a prefix in the browser, so
 * the caller passes the file's name and each file gets its own config.
 */
export function buildSvgoConfig(
  s: Settings,
  opts?: { filename?: string },
): SvgoConfig {
  const overrides: Record<string, unknown> = {};
  const standalone: unknown[] = [];
  let multipass = false;
  let floatPrecision = 0;
  let pretty = false;

  for (const key of SETTING_KEYS) {
    const { svgo } = SETTING_DESCRIPTORS[key];
    const value = s[key];
    if (svgo.kind === "preset-override") {
      if (value === false) overrides[svgo.plugin] = false;
    } else if (svgo.kind === "standalone") {
      if (value === true) {
        standalone.push(
          svgo.plugin === "prefixIds"
            ? {
                name: "prefixIds",
                params: { prefix: idPrefix(opts?.filename) },
              }
            : svgo.plugin,
        );
      }
    } else if (svgo.field === "multipass") {
      multipass = value as boolean;
    } else if (svgo.field === "floatPrecision") {
      floatPrecision = value as number;
    } else {
      pretty = value as boolean;
    }
  }

  return {
    multipass,
    floatPrecision,
    js2svg: { pretty, indent: 2 },
    plugins: [{ name: "preset-default", params: { overrides } }, ...standalone],
  };
}

/** A stable id/class prefix derived from a filename ("app icon.svg" → "app-icon"). */
export function idPrefix(filename?: string): string {
  const stem = (filename ?? "").replace(/\.svg$/i, "").trim();
  const slug = stem.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "svg";
}

/** Safely coerce unknown data (from a URL or DB) into valid Settings. */
export function parseSettings(input: unknown): Settings {
  const result = v.safeParse(SettingsSchema, {
    ...DEFAULT_SETTINGS,
    ...(typeof input === "object" && input !== null ? input : {}),
  });
  return result.success ? result.output : { ...DEFAULT_SETTINGS };
}
