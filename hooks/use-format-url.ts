"use client";

import {
  parseAsBoolean,
  parseAsFloat,
  parseAsString,
  parseAsStringLiteral,
  throttle,
  useQueryStates,
} from "nuqs";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  CSS_ENCODINGS,
  CSS_QUOTES,
  CSS_SNIPPETS,
  DEFAULT_FORMAT,
  FILE_TYPES,
  FORMAT_DESCRIPTORS,
  FORMAT_KEYS,
  SIZE_MODES,
  parseFormatSettings,
  type FormatSettings,
} from "@/lib/format-settings";
import { readLocal, writeLocal } from "@/lib/local-storage";

const LAST_USED_KEY = "svgtidy:format:last-used";

const parsers = {
  fileType: parseAsStringLiteral(FILE_TYPES).withDefault(
    DEFAULT_FORMAT.fileType,
  ),
  sizeMode: parseAsStringLiteral(SIZE_MODES).withDefault(
    DEFAULT_FORMAT.sizeMode,
  ),
  sizeValue: parseAsFloat.withDefault(DEFAULT_FORMAT.sizeValue),
  color: parseAsString.withDefault(DEFAULT_FORMAT.color),
  includeEmptyRect: parseAsBoolean.withDefault(DEFAULT_FORMAT.includeEmptyRect),
  cssSnippet: parseAsStringLiteral(CSS_SNIPPETS).withDefault(
    DEFAULT_FORMAT.cssSnippet,
  ),
  cssEncoding: parseAsStringLiteral(CSS_ENCODINGS).withDefault(
    DEFAULT_FORMAT.cssEncoding,
  ),
  cssQuotes: parseAsStringLiteral(CSS_QUOTES).withDefault(
    DEFAULT_FORMAT.cssQuotes,
  ),
};

const urlKeys = Object.fromEntries(
  FORMAT_KEYS.map((key) => [key, FORMAT_DESCRIPTORS[key].urlKey]),
) as Record<keyof FormatSettings, string>;

/**
 * Format settings live in the URL exactly like optimization settings — same
 * share-by-copying-the-address model, disjoint param names. On top of that,
 * the last-used values are snapshotted to localStorage so a fresh visit picks
 * up where the user left off. Precedence: any format param in the URL wins
 * entirely (a shared link must reproduce exactly — absent keys mean defaults,
 * not last-used); only a URL with zero format params hydrates from the
 * snapshot.
 */
export function useFormatUrl() {
  const [format, setStates] = useQueryStates(parsers, {
    urlKeys,
    history: "replace",
    clearOnDefault: true,
    limitUrlUpdates: throttle(150),
  });

  // Hydrate from last-used, once, before any snapshot writes are allowed.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const hasFormatParam = FORMAT_KEYS.some((key) =>
      params.has(FORMAT_DESCRIPTORS[key].urlKey),
    );
    if (hasFormatParam) return;
    const stored = readLocal(LAST_USED_KEY);
    if (stored === undefined) return;
    const lastUsed = parseFormatSettings(stored);
    const changed = Object.fromEntries(
      FORMAT_KEYS.filter((key) => lastUsed[key] !== DEFAULT_FORMAT[key]).map(
        (key) => [key, lastUsed[key]],
      ),
    );
    if (Object.keys(changed).length > 0) void setStates(changed);
    // setStates identity is stable per nuqs; run-once is enforced by the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snapshot the current values (debounced, suppressed until hydration ran).
  const typed = format as FormatSettings;
  useEffect(() => {
    if (!hydratedRef.current) return;
    const timer = window.setTimeout(() => {
      writeLocal(LAST_USED_KEY, typed);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [typed]);

  const setFormat = useCallback(
    <K extends keyof FormatSettings>(key: K, value: FormatSettings[K]) => {
      setStates({ [key]: value } as Partial<FormatSettings>);
    },
    [setStates],
  );

  const applyFormatPreset = useCallback(
    (preset: unknown) => {
      setStates(parseFormatSettings(preset));
    },
    [setStates],
  );

  const reset = useCallback(() => {
    setStates(DEFAULT_FORMAT);
  }, [setStates]);

  const changedCount = useMemo(() => {
    let n = 0;
    for (const key of FORMAT_KEYS) {
      if (typed[key] !== DEFAULT_FORMAT[key]) n++;
    }
    return n;
  }, [typed]);

  return { format: typed, setFormat, applyFormatPreset, reset, changedCount };
}
