import { describe, expect, it } from "vitest";
import {
  DEFAULT_EFFECTIVE,
  OVERRIDE_KEYS,
  clearOverrideKeys,
  diffKeys,
  isFullyOverridden,
  optimizeKey,
  overrideKeys,
  parseOverride,
  resolveAll,
  resolveSettings,
  setOverrideKeys,
  snapshotOverride,
} from "./effective-settings";
import { DEFAULT_SETTINGS, SETTING_KEYS } from "./settings";
import { DEFAULT_FORMAT, FORMAT_KEYS } from "./format-settings";

const base = DEFAULT_EFFECTIVE;

describe("resolveSettings", () => {
  it("returns the base itself when nothing is pinned", () => {
    expect(resolveSettings(base)).toBe(base);
    expect(resolveSettings(base, undefined, {})).toBe(base);
  });

  it("layers folder over base and file over folder", () => {
    const out = resolveSettings(
      base,
      { floatPrecision: 1, fileType: "jsx" },
      { floatPrecision: 5 },
    );
    expect(out.settings.floatPrecision).toBe(5);
    expect(out.format.fileType).toBe("jsx");
    expect(out.settings.removeComments).toBe(DEFAULT_SETTINGS.removeComments);
  });

  it("resolves the two halves independently", () => {
    const out = resolveSettings(base, { fileType: "css" });
    expect(out.settings).toEqual(DEFAULT_SETTINGS);
    expect(out.format).toEqual({ ...DEFAULT_FORMAT, fileType: "css" });
  });
});

describe("parseOverride", () => {
  it("strips foreign keys", () => {
    expect(parseOverride({ removeComments: false, nope: 1 })).toEqual({
      removeComments: false,
    });
  });

  it("drops only the invalid half", () => {
    expect(parseOverride({ floatPrecision: 99, fileType: "jsx" })).toEqual({
      fileType: "jsx",
    });
  });

  it("returns empty for garbage", () => {
    expect(parseOverride(null)).toEqual({});
    expect(parseOverride(42)).toEqual({});
  });
});

describe("pins", () => {
  it("counts a pin equal to the base value", () => {
    expect(
      overrideKeys({ removeComments: DEFAULT_SETTINGS.removeComments }),
    ).toEqual(["removeComments"]);
  });

  it("setOverrideKeys never mutates and ignores undefined", () => {
    const original = { floatPrecision: 2 };
    const next = setOverrideKeys(original, {
      fileType: "jsx",
      color: undefined,
    });
    expect(original).toEqual({ floatPrecision: 2 });
    expect(next).toEqual({ floatPrecision: 2, fileType: "jsx" });
  });

  it("clearOverrideKeys returns undefined once nothing is pinned", () => {
    expect(clearOverrideKeys({ floatPrecision: 2 }, ["floatPrecision"])).toBe(
      undefined,
    );
    expect(clearOverrideKeys({ floatPrecision: 2 })).toBe(undefined);
    expect(
      clearOverrideKeys({ floatPrecision: 2, fileType: "jsx" }, ["fileType"]),
    ).toEqual({ floatPrecision: 2 });
  });

  it("snapshotOverride pins every key", () => {
    const snap = snapshotOverride(base);
    expect(overrideKeys(snap)).toHaveLength(
      SETTING_KEYS.length + FORMAT_KEYS.length,
    );
    expect(OVERRIDE_KEYS).toHaveLength(
      SETTING_KEYS.length + FORMAT_KEYS.length,
    );
    expect(isFullyOverridden(snap)).toBe(true);
    expect(isFullyOverridden({ floatPrecision: 1 })).toBe(false);
  });

  it("diffKeys lists changed keys from both halves", () => {
    const other = resolveSettings(base, { floatPrecision: 1, fileType: "jsx" });
    expect(diffKeys(base, other)).toEqual(["floatPrecision", "fileType"]);
  });
});

describe("optimizeKey", () => {
  it("ignores key order and format keys, tracks one value change", () => {
    const a = optimizeKey(DEFAULT_SETTINGS);
    const reordered = Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).reverse(),
    ) as typeof DEFAULT_SETTINGS;
    expect(optimizeKey(reordered)).toBe(a);
    expect(optimizeKey({ ...DEFAULT_SETTINGS, floatPrecision: 1 })).not.toBe(a);
    expect(optimizeKey({ ...DEFAULT_SETTINGS, fileType: "jsx" } as never)).toBe(
      a,
    );
  });
});

describe("resolveAll", () => {
  it("uses the base for loose files and for files in unknown folders", () => {
    const { files, folders } = resolveAll(
      base,
      [{ id: "f1", override: { floatPrecision: 1 } }],
      [
        { id: "a" },
        { id: "b", folderId: "f1" },
        { id: "c", folderId: "gone", override: { fileType: "jsx" } },
        { id: "d", folderId: "f1", override: { floatPrecision: 7 } },
      ],
    );
    expect(files.get("a")).toBe(base);
    expect(folders.get("f1")?.settings.floatPrecision).toBe(1);
    expect(files.get("b")).toBe(folders.get("f1"));
    expect(files.get("c")?.settings.floatPrecision).toBe(
      DEFAULT_SETTINGS.floatPrecision,
    );
    expect(files.get("c")?.format.fileType).toBe("jsx");
    expect(files.get("d")?.settings.floatPrecision).toBe(7);
  });
});
