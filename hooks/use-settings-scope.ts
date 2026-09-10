"use client";

import { useCallback, useMemo } from "react";
import { trackDebounced } from "@/lib/analytics";
import type { FolderDocType, SvgDocType } from "@/lib/db";
import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  parseSettings,
  type SettingKey,
  type Settings,
} from "@/lib/settings";
import {
  DEFAULT_FORMAT,
  FORMAT_KEYS,
  parseFormatSettings,
  type FormatKey,
  type FormatSettings,
} from "@/lib/format-settings";
import {
  overrideKeys,
  snapshotOverride,
  type Effective,
  type OverrideKey,
  type OverrideTarget,
  type Resolved,
  type SettingsOverride,
} from "@/lib/effective-settings";

/** Which layer the inspector is editing. */
export type Scope = "workspace" | "folder" | "file";

export type SettingsScopeArgs = {
  scope: Scope;
  base: Effective;
  effective: Resolved;
  /** The previewed file. File scope shows its values and edits every selected file. */
  focusFile: SvgDocType | null;
  selectedFiles: SvgDocType[];
  /** The folder in scope: the selected one, or the one the selected files share. */
  folder: FolderDocType | null;
  url: {
    setSetting: <K extends SettingKey>(key: K, value: Settings[K]) => void;
    setFormat: <K extends FormatKey>(key: K, value: FormatSettings[K]) => void;
    resetSettings: () => void;
    resetFormat: () => void;
    applySettingsPreset: (preset: unknown) => void;
    applyFormatPreset: (preset: unknown) => void;
  };
  db: {
    patchOverride: (
      targets: OverrideTarget[],
      patch: SettingsOverride,
    ) => Promise<void>;
    clearOverride: (
      targets: OverrideTarget[],
      keys?: readonly OverrideKey[],
    ) => Promise<void>;
    replaceOverride: (
      targets: OverrideTarget[],
      override: SettingsOverride | undefined,
    ) => Promise<void>;
  };
};

export type SettingsScope = {
  scope: Scope;
  /** The effective values for the scope's layer. */
  settings: Settings;
  format: FormatSettings;
  /** Workspace: keys that differ from defaults. Folder/file: pinned keys. */
  marked: ReadonlySet<OverrideKey>;
  onSetting: <K extends SettingKey>(key: K, value: Settings[K]) => void;
  onFormat: <K extends FormatKey>(key: K, value: FormatSettings[K]) => void;
  /** Unpin keys so they inherit again. Null in workspace scope. */
  onClear: ((keys: readonly OverrideKey[]) => void) | null;
  resetSettings: () => void;
  resetFormat: () => void;
  canResetSettings: boolean;
  canResetFormat: boolean;
  status: { settings: string; format: string };
  /** A preset in folder/file scope pins every key on that layer. */
  applyPreset: (preset: unknown) => void;
  targets: OverrideTarget[];
};

/**
 * One binding the inspector consumes regardless of scope: the workspace edits
 * the URL, a folder or file edits its override. Values shown are always the
 * effective ones, so a pinned key reads exactly as it will export.
 */
export function useSettingsScope({
  scope,
  base,
  effective,
  focusFile,
  selectedFiles,
  folder,
  url,
  db,
}: SettingsScopeArgs): SettingsScope {
  const files = useMemo(
    () =>
      scope === "file"
        ? selectedFiles.length > 0
          ? selectedFiles
          : focusFile
            ? [focusFile]
            : []
        : [],
    [scope, selectedFiles, focusFile],
  );

  const targets = useMemo<OverrideTarget[]>(() => {
    if (scope === "folder" && folder)
      return [{ kind: "folder", id: folder.id }];
    if (scope === "file") return files.map((f) => ({ kind: "file", id: f.id }));
    return [];
  }, [scope, folder, files]);

  const current: Effective =
    scope === "folder" && folder
      ? (effective.folders.get(folder.id) ?? base)
      : scope === "file" && focusFile
        ? (effective.files.get(focusFile.id) ?? base)
        : base;

  const marked = useMemo(() => {
    const set = new Set<OverrideKey>();
    if (scope === "workspace") {
      for (const key of SETTING_KEYS) {
        if (base.settings[key] !== DEFAULT_SETTINGS[key]) set.add(key);
      }
      for (const key of FORMAT_KEYS) {
        if (base.format[key] !== DEFAULT_FORMAT[key]) set.add(key);
      }
    } else if (scope === "folder") {
      for (const key of overrideKeys(folder?.override)) set.add(key);
    } else {
      for (const file of files) {
        for (const key of overrideKeys(file.override)) set.add(key);
      }
    }
    return set;
  }, [scope, base, folder, files]);

  const onSetting = useCallback(
    <K extends SettingKey>(key: K, value: Settings[K]) => {
      // Debounced per key so a precision slider drag lands as one event.
      trackDebounced(`setting:${key}`, "setting-change", {
        key,
        value: String(value),
        scope,
      });
      if (scope === "workspace") url.setSetting(key, value);
      else void db.patchOverride(targets, { [key]: value } as SettingsOverride);
    },
    [scope, url, db, targets],
  );
  const onFormat = useCallback(
    <K extends FormatKey>(key: K, value: FormatSettings[K]) => {
      // Typed values (color, size) are only reported as edited, not echoed.
      trackDebounced(`format:${key}`, "format-change", {
        key,
        value:
          key === "color" || key === "sizeValue" ? "(edited)" : String(value),
        scope,
      });
      if (scope === "workspace") url.setFormat(key, value);
      else void db.patchOverride(targets, { [key]: value } as SettingsOverride);
    },
    [scope, url, db, targets],
  );
  const onClear = useMemo(
    () =>
      scope === "workspace"
        ? null
        : (keys: readonly OverrideKey[]) =>
            void db.clearOverride(targets, keys),
    [scope, db, targets],
  );
  const resetSettings = useCallback(() => {
    trackDebounced(
      "reset",
      "settings-reset",
      { section: "optimize", scope },
      0,
    );
    if (scope === "workspace") url.resetSettings();
    else void db.clearOverride(targets, SETTING_KEYS);
  }, [scope, url, db, targets]);
  const resetFormat = useCallback(() => {
    trackDebounced("reset", "settings-reset", { section: "format", scope }, 0);
    if (scope === "workspace") url.resetFormat();
    else void db.clearOverride(targets, FORMAT_KEYS);
  }, [scope, url, db, targets]);
  const applyPreset = useCallback(
    (preset: unknown) => {
      if (scope === "workspace") {
        url.applySettingsPreset(preset);
        url.applyFormatPreset(preset);
        return;
      }
      void db.replaceOverride(
        targets,
        snapshotOverride({
          settings: parseSettings(preset),
          format: parseFormatSettings(preset),
        }),
      );
    },
    [scope, url, db, targets],
  );

  const settingsCount = SETTING_KEYS.filter((k) => marked.has(k)).length;
  const formatCount = FORMAT_KEYS.filter((k) => marked.has(k)).length;
  const inherit =
    scope === "file" && folder
      ? "Using folder settings"
      : "Using workspace settings";
  const prefix =
    scope === "file" && files.length > 1
      ? `Editing ${files.length} files · `
      : "";
  const statusFor = (n: number, total: number) => {
    if (scope === "workspace") {
      return n === 0 ? "Using defaults" : `${n} changed from default`;
    }
    const text =
      n === 0 ? inherit : n === total ? "Fully overridden" : `${n} overridden`;
    return prefix + text;
  };

  return {
    scope,
    settings: current.settings,
    format: current.format,
    marked,
    onSetting,
    onFormat,
    onClear,
    resetSettings,
    resetFormat,
    canResetSettings: settingsCount > 0,
    canResetFormat: formatCount > 0,
    status: {
      settings: statusFor(settingsCount, SETTING_KEYS.length),
      format: statusFor(formatCount, FORMAT_KEYS.length),
    },
    applyPreset,
    targets,
  };
}
