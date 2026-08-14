import type { Settings } from "./settings";

export type ToggleKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

export type ToggleMeta = {
  key: ToggleKey;
  label: string;
  description: string;
  /** Warn the user that this can change how the SVG looks/behaves. */
  risky?: boolean;
};

export type SettingsGroup = {
  id: string;
  title: string;
  description: string;
  toggles: ToggleMeta[];
};

/**
 * The panel is grouped by intent, not by SVGO plugin. Each toggle is described
 * in terms of what happens to the file, and risky options are flagged so the
 * user knows when output might visually differ.
 */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "cleanup",
    title: "Cleanup",
    description: "Strip editor cruft and metadata that browsers ignore.",
    toggles: [
      {
        key: "removeComments",
        label: "Remove comments",
        description: "Delete <!-- --> comments.",
      },
      {
        key: "removeMetadata",
        label: "Remove metadata",
        description: "Drop <metadata> blocks.",
      },
      {
        key: "removeEditorNS",
        label: "Remove editor data",
        description: "Strip Illustrator / Inkscape / Sketch namespaces.",
      },
      {
        key: "removeDoctype",
        label: "Remove doctype",
        description: "Delete the <!DOCTYPE> declaration.",
      },
      {
        key: "removeXMLProcInst",
        label: "Remove XML instructions",
        description: "Delete the <?xml ?> processing instruction.",
      },
      {
        key: "removeTitle",
        label: "Remove <title>",
        description: "Removes accessible titles.",
        risky: true,
      },
      {
        key: "removeDesc",
        label: "Remove <desc>",
        description: "Removes long descriptions.",
        risky: true,
      },
    ],
  },
  {
    id: "structure",
    title: "Structure & styles",
    description: "Simplify the document tree and inline styling.",
    toggles: [
      {
        key: "cleanupIds",
        label: "Minify IDs",
        description: "Shorten and remove unused id attributes.",
      },
      {
        key: "inlineStyles",
        label: "Inline styles",
        description: "Move matching CSS rules onto elements.",
      },
      {
        key: "minifyStyles",
        label: "Minify CSS",
        description: "Compress remaining <style> blocks.",
      },
      {
        key: "convertStyleToAttrs",
        label: "Styles to attributes",
        description: 'Rewrite style="" as presentation attributes.',
        risky: true,
      },
      {
        key: "collapseGroups",
        label: "Collapse groups",
        description: "Flatten redundant <g> wrappers.",
        risky: true,
      },
      {
        key: "mergePaths",
        label: "Merge paths",
        description: "Combine adjacent paths with the same style.",
        risky: true,
      },
      {
        key: "removeHiddenElems",
        label: "Remove hidden elements",
        description: "Drop display:none and zero-size shapes.",
      },
      {
        key: "removeEmptyContainers",
        label: "Remove empty containers",
        description: "Delete containers with no children.",
      },
      {
        key: "removeUselessStrokeFill",
        label: "Clean stroke & fill",
        description: "Remove strokes/fills that have no effect.",
      },
      {
        key: "removeUnknownsAndDefaults",
        label: "Remove defaults",
        description: "Drop unknown and redundant default attributes.",
      },
      {
        key: "sortAttrs",
        label: "Sort attributes",
        description: "Order attributes for better gzip.",
      },
    ],
  },
  {
    id: "geometry",
    title: "Geometry & color",
    description: "Rewrite path data, transforms, and colors more compactly.",
    toggles: [
      {
        key: "convertPathData",
        label: "Optimize path data",
        description: 'Rewrite d="" to shorter commands.',
        risky: true,
      },
      {
        key: "convertTransform",
        label: "Optimize transforms",
        description: "Collapse and shorten transform lists.",
        risky: true,
      },
      {
        key: "convertColors",
        label: "Shorten colors",
        description: "rgb() to #hex, and #aabbcc to #abc.",
      },
    ],
  },
  {
    id: "dimensions",
    title: "Dimensions & scaling",
    description: "Control viewBox, width/height and the root namespace.",
    toggles: [
      {
        key: "removeViewBox",
        label: "Remove viewBox",
        description: "Not recommended \u2014 breaks responsive scaling.",
        risky: true,
      },
      {
        key: "removeDimensions",
        label: "Remove width/height",
        description: "Keep viewBox, drop fixed size so it scales.",
      },
      {
        key: "removeXMLNS",
        label: "Remove xmlns",
        description: "For inlining directly into HTML/JSX.",
        risky: true,
      },
    ],
  },
  {
    id: "output",
    title: "Output",
    description: "How the final markup is formatted.",
    toggles: [
      {
        key: "multipass",
        label: "Multipass",
        description: "Run repeatedly until no further savings.",
      },
      {
        key: "prettify",
        label: "Pretty print",
        description: "Readable, indented output (larger).",
      },
    ],
  },
];
