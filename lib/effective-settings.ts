import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  parseSettingsOverride,
  type SettingKey,
  type Settings,
} from "./settings";
import {
  DEFAULT_FORMAT,
  FORMAT_KEYS,
  parseFormatOverride,
  type FormatKey,
  type FormatSettings,
} from "./format-settings";

/**
 * Layered settings. The URL-held workspace settings are the base; a folder
 * may pin a partial override on top, and a file may pin one on top of its
 * folder. What a file is actually optimized and formatted with is its
 * effective settings: base ⊕ folder override ⊕ file override.
 *
 * An override is one flat partial holding keys from both halves, exactly like
 * a preset but incomplete. A pinned key stays pinned even when it equals the
 * value beneath it, so "N overridden" counts pins, not differences.
 */

export type SettingsOverride = Partial<Settings & FormatSettings>;
export type OverrideKey = SettingKey | FormatKey;
export type Effective = { settings: Settings; format: FormatSettings };
export type OverrideTarget = { kind: "file" | "folder"; id: string };

export const OVERRIDE_KEYS: readonly OverrideKey[] = [
  ...SETTING_KEYS,
  ...FORMAT_KEYS,
];

export const DEFAULT_EFFECTIVE: Effective = {
  settings: DEFAULT_SETTINGS,
  format: DEFAULT_FORMAT,
};

/** Validate a stored or pasted partial at the seam. Both halves parse independently. */
export function parseOverride(input: unknown): SettingsOverride {
  if (typeof input !== "object" || input === null) return {};
  return { ...parseSettingsOverride(input), ...parseFormatOverride(input) };
}

/**
 * base ⊕ layers, left to right. Returns `base` itself when no layer pins
 * anything, so memoized consumers keep their identity.
 */
export function resolveSettings(
  base: Effective,
  ...layers: (SettingsOverride | undefined)[]
): Effective {
  const settings: Partial<Settings> = {};
  const format: Partial<FormatSettings> = {};
  let pinned = false;
  for (const layer of layers) {
    if (!layer) continue;
    for (const key of SETTING_KEYS) {
      const value = layer[key];
      if (value !== undefined) {
        (settings as Record<string, unknown>)[key] = value;
        pinned = true;
      }
    }
    for (const key of FORMAT_KEYS) {
      const value = layer[key];
      if (value !== undefined) {
        (format as Record<string, unknown>)[key] = value;
        pinned = true;
      }
    }
  }
  if (!pinned) return base;
  return {
    settings: { ...base.settings, ...settings },
    format: { ...base.format, ...format },
  };
}

export function overrideKeys(
  override: SettingsOverride | undefined,
): OverrideKey[] {
  if (!override) return [];
  return OVERRIDE_KEYS.filter((key) => override[key] !== undefined);
}

export function overrideCount(override: SettingsOverride | undefined): number {
  return overrideKeys(override).length;
}

export function isOverridden(
  override: SettingsOverride | undefined,
  key: OverrideKey,
): boolean {
  return override?.[key] !== undefined;
}

/** Every key pinned. */
export function isFullyOverridden(
  override: SettingsOverride | undefined,
): boolean {
  return overrideCount(override) === OVERRIDE_KEYS.length;
}

/** Pin `patch`'s keys on top of `override`. Never mutates its inputs. */
export function setOverrideKeys(
  override: SettingsOverride | undefined,
  patch: SettingsOverride,
): SettingsOverride {
  const next: SettingsOverride = { ...(override ?? {}) };
  for (const key of OVERRIDE_KEYS) {
    const value = patch[key];
    if (value !== undefined) (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

/**
 * Unpin `keys` (or everything when omitted). Returns undefined once nothing
 * is pinned, so the stored field is deleted rather than left as `{}`.
 */
export function clearOverrideKeys(
  override: SettingsOverride | undefined,
  keys?: readonly OverrideKey[],
): SettingsOverride | undefined {
  if (!override) return undefined;
  if (!keys) return undefined;
  const drop = new Set<string>(keys);
  const next: SettingsOverride = {};
  let any = false;
  for (const key of OVERRIDE_KEYS) {
    const value = override[key];
    if (value !== undefined && !drop.has(key)) {
      (next as Record<string, unknown>)[key] = value;
      any = true;
    }
  }
  return any ? next : undefined;
}

/** Every key pinned to the effective value: what preset-apply and paste write. */
export function snapshotOverride(effective: Effective): SettingsOverride {
  return { ...effective.settings, ...effective.format };
}

/** Keys whose effective value differs between two resolutions. */
export function diffKeys(a: Effective, b: Effective): OverrideKey[] {
  const keys: OverrideKey[] = [];
  for (const key of SETTING_KEYS) {
    if (a.settings[key] !== b.settings[key]) keys.push(key);
  }
  for (const key of FORMAT_KEYS) {
    if (a.format[key] !== b.format[key]) keys.push(key);
  }
  return keys;
}

/**
 * Canonical cache key for the optimizer: the optimization values in
 * descriptor order. Format keys are excluded on purpose, so a Format edit
 * never re-optimizes anything.
 */
export function optimizeKey(settings: Settings): string {
  return SETTING_KEYS.map((key) => String(settings[key])).join(",");
}

export type Resolved = {
  files: Map<string, Effective>;
  folders: Map<string, Effective>;
};

/**
 * Resolve every folder and file in one pass. Stored overrides are validated
 * here (docs are untrusted, like presets). A file whose folder no longer
 * exists resolves as loose.
 */
export function resolveAll(
  base: Effective,
  folders: readonly { id: string; override?: unknown }[],
  svgs: readonly { id: string; folderId?: string; override?: unknown }[],
): Resolved {
  const folderMap = new Map<string, Effective>();
  for (const folder of folders) {
    folderMap.set(
      folder.id,
      resolveSettings(base, parseOverride(folder.override)),
    );
  }
  const fileMap = new Map<string, Effective>();
  for (const svg of svgs) {
    const parent = (svg.folderId && folderMap.get(svg.folderId)) || base;
    fileMap.set(svg.id, resolveSettings(parent, parseOverride(svg.override)));
  }
  return { files: fileMap, folders: folderMap };
}
