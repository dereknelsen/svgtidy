"use client";

import { parseAsBoolean, parseAsInteger, useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";

const b = (key: keyof Settings) => parseAsBoolean.withDefault(DEFAULT_SETTINGS[key] as boolean);

const parsers = {
  removeComments: b("removeComments"),
  removeMetadata: b("removeMetadata"),
  removeTitle: b("removeTitle"),
  removeDesc: b("removeDesc"),
  removeEditorNS: b("removeEditorNS"),
  removeDoctype: b("removeDoctype"),
  removeXMLProcInst: b("removeXMLProcInst"),
  removeHiddenElems: b("removeHiddenElems"),
  removeEmptyContainers: b("removeEmptyContainers"),
  removeUnknownsAndDefaults: b("removeUnknownsAndDefaults"),
  removeUselessStrokeFill: b("removeUselessStrokeFill"),
  cleanupIds: b("cleanupIds"),
  minifyStyles: b("minifyStyles"),
  inlineStyles: b("inlineStyles"),
  convertStyleToAttrs: b("convertStyleToAttrs"),
  collapseGroups: b("collapseGroups"),
  mergePaths: b("mergePaths"),
  sortAttrs: b("sortAttrs"),
  convertColors: b("convertColors"),
  convertPathData: b("convertPathData"),
  convertTransform: b("convertTransform"),
  floatPrecision: parseAsInteger.withDefault(DEFAULT_SETTINGS.floatPrecision),
  removeViewBox: b("removeViewBox"),
  removeDimensions: b("removeDimensions"),
  removeXMLNS: b("removeXMLNS"),
  prettify: b("prettify"),
  multipass: b("multipass"),
};

// Compact param names keep shareable links short.
const urlKeys: Record<keyof Settings, string> = {
  removeComments: "rc",
  removeMetadata: "rm",
  removeTitle: "rt",
  removeDesc: "rd",
  removeEditorNS: "rns",
  removeDoctype: "rdt",
  removeXMLProcInst: "rxp",
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
  sortAttrs: "sa",
  convertColors: "cc",
  convertPathData: "cpd",
  convertTransform: "ct",
  floatPrecision: "fp",
  removeViewBox: "rvb",
  removeDimensions: "rdim",
  removeXMLNS: "rxn",
  prettify: "pp",
  multipass: "mpass",
};

/**
 * The single source of truth for the current settings lives in the URL, so any
 * configuration is instantly shareable by copying the address. Defaults are
 * omitted from the query string to keep links tidy.
 */
export function useSettingsUrl() {
  const [settings, setStates] = useQueryStates(parsers, {
    urlKeys,
    history: "replace",
    clearOnDefault: true,
  });

  const setSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setStates({ [key]: value } as Partial<Settings>);
    },
    [setStates],
  );

  const applyPreset = useCallback(
    (preset: Settings) => {
      setStates(preset);
    },
    [setStates],
  );

  const reset = useCallback(() => {
    setStates(DEFAULT_SETTINGS);
  }, [setStates]);

  const typed = settings as Settings;

  // Which keys currently differ from defaults (for the "modified" indicator).
  const changedCount = useMemo(() => {
    let n = 0;
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      if (typed[key] !== DEFAULT_SETTINGS[key]) n++;
    }
    return n;
  }, [typed]);

  return { settings: typed, setSetting, applyPreset, reset, changedCount };
}
