import * as v from "valibot";

/**
 * The optimization settings model. Every field maps to one or more SVGO
 * behaviors, but is named for what it does to the user's file rather than for
 * the internal plugin. Defaults are chosen to be safe and modern: viewBox is
 * always preserved, IDs are cleaned, and precision is high enough to stay
 * crisp while still shaving bytes.
 */
export const SettingsSchema = v.object({
  // Cleanup
  removeComments: v.boolean(),
  removeMetadata: v.boolean(),
  removeTitle: v.boolean(),
  removeDesc: v.boolean(),
  removeEditorNS: v.boolean(),
  removeDoctype: v.boolean(),
  removeXMLProcInst: v.boolean(),
  removeHiddenElems: v.boolean(),
  removeEmptyContainers: v.boolean(),
  removeUnknownsAndDefaults: v.boolean(),
  removeUselessStrokeFill: v.boolean(),

  // Structure & styles
  cleanupIds: v.boolean(),
  minifyStyles: v.boolean(),
  inlineStyles: v.boolean(),
  convertStyleToAttrs: v.boolean(),
  collapseGroups: v.boolean(),
  mergePaths: v.boolean(),
  sortAttrs: v.boolean(),

  // Geometry & color
  convertColors: v.boolean(),
  convertPathData: v.boolean(),
  convertTransform: v.boolean(),
  floatPrecision: v.pipe(v.number(), v.minValue(0), v.maxValue(8), v.integer()),

  // Dimensions
  removeViewBox: v.boolean(),
  removeDimensions: v.boolean(),
  removeXMLNS: v.boolean(),

  // Output
  prettify: v.boolean(),
  multipass: v.boolean(),
});

export type Settings = v.InferOutput<typeof SettingsSchema>;

/** Balanced, production-safe defaults. */
export const DEFAULT_SETTINGS: Settings = {
  removeComments: true,
  removeMetadata: true,
  removeTitle: false,
  removeDesc: false,
  removeEditorNS: true,
  removeDoctype: true,
  removeXMLProcInst: true,
  removeHiddenElems: true,
  removeEmptyContainers: true,
  removeUnknownsAndDefaults: true,
  removeUselessStrokeFill: true,

  cleanupIds: true,
  minifyStyles: true,
  inlineStyles: true,
  convertStyleToAttrs: false,
  collapseGroups: true,
  mergePaths: true,
  sortAttrs: true,

  convertColors: true,
  convertPathData: true,
  convertTransform: true,
  floatPrecision: 3,

  removeViewBox: false,
  removeDimensions: false,
  removeXMLNS: false,

  prettify: false,
  multipass: true,
};

/**
 * Named presets. These are the "better defaults" that ship with the app so
 * the common cases are one click away.
 */
export const BUILT_IN_PRESETS: { id: string; name: string; hint: string; settings: Settings }[] = [
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
    },
  },
  {
    id: "inline",
    name: "Inline / React",
    hint: "For pasting into JSX. Strips xmlns, keeps viewBox.",
    settings: {
      ...DEFAULT_SETTINGS,
      removeXMLNS: true,
      removeDimensions: true,
      cleanupIds: true,
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
 */
export function buildSvgoConfig(s: Settings): SvgoConfig {
  const overrides: Record<string, unknown> = {};
  const off = (name: string, enabled: boolean) => {
    if (!enabled) overrides[name] = false;
  };

  off("removeComments", s.removeComments);
  off("removeMetadata", s.removeMetadata);
  off("removeTitle", s.removeTitle);
  off("removeDesc", s.removeDesc);
  off("removeEditorsNSData", s.removeEditorNS);
  off("removeDoctype", s.removeDoctype);
  off("removeXMLProcInst", s.removeXMLProcInst);
  off("removeHiddenElems", s.removeHiddenElems);
  off("removeEmptyContainers", s.removeEmptyContainers);
  off("removeUnknownsAndDefaults", s.removeUnknownsAndDefaults);
  off("removeUselessStrokeAndFill", s.removeUselessStrokeFill);
  off("cleanupIds", s.cleanupIds);
  off("minifyStyles", s.minifyStyles);
  off("inlineStyles", s.inlineStyles);
  off("collapseGroups", s.collapseGroups);
  off("mergePaths", s.mergePaths);
  off("convertColors", s.convertColors);
  off("convertPathData", s.convertPathData);
  off("convertTransform", s.convertTransform);

  // viewBox is preserved by default (best practice for responsive SVGs).
  overrides["removeViewBox"] = s.removeViewBox;

  const plugins: unknown[] = [{ name: "preset-default", params: { overrides } }];

  if (s.sortAttrs) plugins.push("sortAttrs");
  if (s.removeDimensions) plugins.push("removeDimensions");
  if (s.removeXMLNS) plugins.push("removeXMLNS");
  if (s.convertStyleToAttrs) plugins.push("convertStyleToAttributes");

  return {
    multipass: s.multipass,
    floatPrecision: s.floatPrecision,
    js2svg: { pretty: s.prettify, indent: 2 },
    plugins,
  };
}

/** Safely coerce unknown data (from a URL or DB) into valid Settings. */
export function parseSettings(input: unknown): Settings {
  const result = v.safeParse(SettingsSchema, { ...DEFAULT_SETTINGS, ...(input as object) });
  return result.success ? result.output : { ...DEFAULT_SETTINGS };
}
