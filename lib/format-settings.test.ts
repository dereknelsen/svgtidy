import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORMAT,
  FORMAT_DESCRIPTORS,
  FORMAT_KEYS,
  parseFormatSettings,
} from "./format-settings";
import {
  DEFAULT_SETTINGS,
  SETTING_DESCRIPTORS,
  SETTING_KEYS,
  parseSettings,
} from "./settings";

describe("parseFormatSettings", () => {
  it("fills defaults for missing keys", () => {
    expect(parseFormatSettings({})).toEqual(DEFAULT_FORMAT);
    expect(parseFormatSettings(undefined)).toEqual(DEFAULT_FORMAT);
    expect(parseFormatSettings({ fileType: "jsx" })).toEqual({
      ...DEFAULT_FORMAT,
      fileType: "jsx",
    });
  });

  it("rejects invalid values wholesale", () => {
    expect(parseFormatSettings({ fileType: "png" })).toEqual(DEFAULT_FORMAT);
    expect(parseFormatSettings({ sizeValue: -3 })).toEqual(DEFAULT_FORMAT);
  });

  it("accepts fractional size values for em/rem", () => {
    expect(
      parseFormatSettings({ sizeMode: "em", sizeValue: 1.5 }).sizeValue,
    ).toBe(1.5);
  });

  // Presets store one flat object holding optimize + format keys. Each parser
  // must pick out its own keys and strip the other model's — this test is the
  // load-bearing assumption behind combined presets.
  it("round-trips a flat combined settings object through both parsers", () => {
    const combined = {
      ...DEFAULT_SETTINGS,
      ...DEFAULT_FORMAT,
      removeComments: false,
      fileType: "symbol",
    };
    const optimize = parseSettings(combined);
    const format = parseFormatSettings(combined);
    expect(optimize).toEqual({ ...DEFAULT_SETTINGS, removeComments: false });
    expect(format).toEqual({ ...DEFAULT_FORMAT, fileType: "symbol" });
    expect(Object.keys(optimize).sort()).toEqual([...SETTING_KEYS].sort());
    expect(Object.keys(format).sort()).toEqual([...FORMAT_KEYS].sort());
  });

  it("keeps format URL keys disjoint from optimize URL keys", () => {
    const optimizeKeys = new Set<string>(
      SETTING_KEYS.map((k) => SETTING_DESCRIPTORS[k].urlKey),
    );
    for (const key of FORMAT_KEYS) {
      expect(optimizeKeys.has(FORMAT_DESCRIPTORS[key].urlKey)).toBe(false);
    }
  });
});
