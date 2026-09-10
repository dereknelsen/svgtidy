import { describe, expect, it } from "vitest";
import {
  BUILT_IN_PRESETS,
  buildSvgoConfig,
  DEFAULT_SETTINGS,
  parseSettings,
  SETTING_DESCRIPTORS,
  SETTING_KEYS,
  SETTINGS_GROUP_META,
  type Settings,
  parseSettingsOverride,
} from "./settings";

/**
 * Contract tests: they lock the observable behaviour of the settings module:
 * the shipped defaults, the generated SVGO configs, URL keys, and preset
 * parsing. Defaults and URL keys are baked into shared links (absent params
 * mean the default), so changing either silently changes what old links mean;
 * these tests make that a loud, deliberate decision.
 */

const allToggles = (value: boolean, floatPrecision: number): Settings => {
  const out = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(out) as (keyof Settings)[]) {
    if (typeof out[key] === "boolean") {
      (out as Record<string, boolean | number>)[key] = value;
    }
  }
  out.floatPrecision = floatPrecision;
  return out;
};

describe("DEFAULT_SETTINGS", () => {
  it("locks the shipped defaults (absent URL params mean these values)", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      removeComments: true,
      removeMetadata: true,
      removeTitle: false,
      removeDesc: false,
      removeEditorNS: true,
      removeDoctype: true,
      removeXMLProcInst: true,
      removeScripts: false,
      removeRasterImages: false,
      removeStyleElement: false,
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
      reusePaths: false,
      cleanupListOfValues: false,
      sortAttrs: true,
      convertColors: true,
      convertPathData: true,
      convertTransform: true,
      convertOneStopGradients: false,
      removeOffCanvasPaths: false,
      floatPrecision: 3,
      removeViewBox: false,
      removeDimensions: false,
      removeXMLNS: false,
      prefixIds: false,
      prettify: false,
      multipass: true,
    });
  });
});

describe("buildSvgoConfig", () => {
  it("builds the default config", () => {
    // removeTitle and removeViewBox are standalone plugins (off by default →
    // absent), and sortAttrs runs inside preset-default, so the default
    // config is preset-default with one override and no extra plugins.
    expect(buildSvgoConfig(DEFAULT_SETTINGS)).toEqual({
      multipass: true,
      floatPrecision: 3,
      js2svg: { pretty: false, indent: 2 },
      plugins: [
        {
          name: "preset-default",
          params: {
            overrides: {
              removeDesc: false,
            },
          },
        },
      ],
    });
  });

  it.each(BUILT_IN_PRESETS)("builds the $id preset config", (preset) => {
    expect(buildSvgoConfig(preset.settings)).toMatchSnapshot();
  });

  it("disables every preset-default plugin when all toggles are off", () => {
    expect(buildSvgoConfig(allToggles(false, 0))).toMatchSnapshot();
  });

  it("pushes standalone plugins in a stable order when all toggles are on", () => {
    expect(buildSvgoConfig(allToggles(true, 8))).toEqual({
      multipass: true,
      floatPrecision: 8,
      js2svg: { pretty: true, indent: 2 },
      plugins: [
        {
          name: "preset-default",
          params: { overrides: {} },
        },
        "removeTitle",
        "removeScripts",
        "removeRasterImages",
        "removeStyleElement",
        "reusePaths",
        "cleanupListOfValues",
        "convertOneStopGradients",
        "removeOffCanvasPaths",
        "removeViewBox",
        "removeDimensions",
        "removeXMLNS",
        { name: "prefixIds", params: { prefix: "svg" } },
        "convertStyleToAttrs",
      ],
    });
  });

  it("derives the prefixIds prefix from the filename", () => {
    const settings = { ...DEFAULT_SETTINGS, prefixIds: true };
    const config = buildSvgoConfig(settings, { filename: "App Icon (1).svg" });
    expect(config.plugins.at(-1)).toEqual({
      name: "prefixIds",
      params: { prefix: "App-Icon-1" },
    });
  });
});

describe("parseSettings", () => {
  it("round-trips valid settings", () => {
    const aggressive = BUILT_IN_PRESETS.find((p) => p.id === "aggressive")!;
    expect(parseSettings(aggressive.settings)).toEqual(aggressive.settings);
  });

  it("fills missing keys from defaults", () => {
    expect(parseSettings({ removeComments: false })).toEqual({
      ...DEFAULT_SETTINGS,
      removeComments: false,
    });
  });

  it("returns defaults for garbage input", () => {
    expect(parseSettings("not an object")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects out-of-range floatPrecision", () => {
    expect(parseSettings({ floatPrecision: 99 })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ floatPrecision: 2.5 })).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects wrong value types", () => {
    expect(parseSettings({ removeComments: "yes" })).toEqual(DEFAULT_SETTINGS);
  });
});

describe("SETTING_DESCRIPTORS contracts", () => {
  it("keeps every URL key frozen (they are baked into shared links)", () => {
    const urlKeys = Object.fromEntries(
      SETTING_KEYS.map((key) => [key, SETTING_DESCRIPTORS[key].urlKey]),
    );
    expect(urlKeys).toEqual({
      removeComments: "rc",
      removeMetadata: "rm",
      removeTitle: "rt",
      removeDesc: "rd",
      removeEditorNS: "rns",
      removeDoctype: "rdt",
      removeXMLProcInst: "rxp",
      removeScripts: "rsc",
      removeRasterImages: "rri",
      removeStyleElement: "rse",
      removeHiddenElems: "rh",
      removeEmptyContainers: "rec",
      removeUnknownsAndDefaults: "rud",
      removeUselessStrokeFill: "rsf",
      cleanupIds: "ci",
      minifyStyles: "ms",
      inlineStyles: "is",
      convertStyleToAttrs: "csa",
      collapseGroups: "cg",
      mergePaths: "mp",
      reusePaths: "rp",
      cleanupListOfValues: "clv",
      sortAttrs: "sa",
      convertColors: "cc",
      convertPathData: "cpd",
      convertTransform: "ct",
      convertOneStopGradients: "cog",
      removeOffCanvasPaths: "rocp",
      floatPrecision: "fp",
      removeViewBox: "rvb",
      removeDimensions: "rdim",
      removeXMLNS: "rxn",
      prefixIds: "pi",
      prettify: "pp",
      multipass: "mpass",
    });
  });

  it("places every toggle in exactly one group", () => {
    const grouped = SETTINGS_GROUP_META.flatMap((group) => group.keys);
    const toggles = SETTING_KEYS.filter(
      (key) => SETTING_DESCRIPTORS[key].control === "toggle",
    );
    expect([...grouped].sort()).toEqual([...toggles].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("pushes removeViewBox as a standalone plugin only when the toggle is on", () => {
    // removeViewBox left preset-default in SVGO 4; mapping it as an override
    // was a real bug (the toggle silently did nothing).
    expect(
      buildSvgoConfig({ ...DEFAULT_SETTINGS, removeViewBox: true }).plugins,
    ).toContain("removeViewBox");
    expect(buildSvgoConfig(DEFAULT_SETTINGS).plugins).not.toContain(
      "removeViewBox",
    );
  });

  it("maps every setting to the side of preset-default it actually lives on", async () => {
    // Pins the mapping kinds to SVGO's real preset-default membership, so an
    // SVGO upgrade that moves a plugin in or out of the preset fails loudly
    // instead of silently turning a toggle into a no-op.
    const { builtinPlugins } = await import("svgo/browser");
    const preset = builtinPlugins.find((p) => p.name === "preset-default") as {
      plugins?: { name: string }[];
    };
    const inPreset = new Set((preset.plugins ?? []).map((p) => p.name));
    expect(inPreset.size).toBeGreaterThan(0);

    for (const key of SETTING_KEYS) {
      const { svgo } = SETTING_DESCRIPTORS[key];
      if (svgo.kind === "preset-override") {
        expect(inPreset, `${key} → ${svgo.plugin}`).toContain(svgo.plugin);
      } else if (svgo.kind === "standalone") {
        expect(inPreset, `${key} → ${svgo.plugin}`).not.toContain(svgo.plugin);
      }
    }
  });
});

describe("parseSettingsOverride", () => {
  it("accepts a partial and strips foreign keys", () => {
    expect(
      parseSettingsOverride({ removeComments: false, fileType: "jsx", x: 1 }),
    ).toEqual({ removeComments: false });
  });

  it("returns an empty override for non-objects", () => {
    expect(parseSettingsOverride(undefined)).toEqual({});
    expect(parseSettingsOverride("nope")).toEqual({});
  });

  it("rejects the whole input on an out-of-range value", () => {
    expect(
      parseSettingsOverride({ removeComments: false, floatPrecision: 99 }),
    ).toEqual({});
  });
});
