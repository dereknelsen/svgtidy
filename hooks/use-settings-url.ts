"use client";

import { parseAsBoolean, parseAsInteger, throttle, useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";
import {
  DEFAULT_SETTINGS,
  parseSettings,
  SETTING_DESCRIPTORS,
  SETTING_KEYS,
  type Settings,
} from "@/lib/settings";

type SettingParsers = {
  [K in keyof Settings]: Settings[K] extends boolean
    ? ReturnType<typeof parseAsBoolean.withDefault>
    : ReturnType<typeof parseAsInteger.withDefault>;
};

// Parsers and the compact URL param names both derive from the descriptor
// table, so a new setting is URL-syncable the moment its row exists.
const parsers = Object.fromEntries(
  SETTING_KEYS.map((key) => {
    const descriptor = SETTING_DESCRIPTORS[key];
    return [
      key,
      descriptor.control === "toggle"
        ? parseAsBoolean.withDefault(DEFAULT_SETTINGS[key] as boolean)
        : parseAsInteger.withDefault(DEFAULT_SETTINGS[key] as number),
    ];
  }),
) as SettingParsers;

const urlKeys = Object.fromEntries(
  SETTING_KEYS.map((key) => [key, SETTING_DESCRIPTORS[key].urlKey]),
) as Record<keyof Settings, string>;

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
    // Settings state updates live; only the history.replaceState writes are
    // throttled so slider drags don't hammer the URL at pointer-move rate.
    limitUrlUpdates: throttle(150),
  });

  const setSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setStates({ [key]: value } as Partial<Settings>);
    },
    [setStates],
  );

  const applyPreset = useCallback(
    (preset: unknown) => {
      // Presets arrive from the DB unvalidated (and may predate the current
      // settings shape); validate where they cross into the settings model.
      setStates(parseSettings(preset));
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
    for (const key of SETTING_KEYS) {
      if (typed[key] !== DEFAULT_SETTINGS[key]) n++;
    }
    return n;
  }, [typed]);

  return { settings: typed, setSetting, applyPreset, reset, changedCount };
}
