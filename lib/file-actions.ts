/**
 * What the files sidebar (rows, "…" menus, context menu, hotkeys) can do to
 * files and folders. Implemented once in app/page.tsx. File actions always
 * take arrays: a single row is a selection of one.
 */

export type MenuTarget =
  | { kind: "files"; ids: string[] }
  | { kind: "folder"; id: string }
  | { kind: "empty" };

/** A target that can carry a settings override. */
export type SettingsTarget = Exclude<MenuTarget, { kind: "empty" }>;

export type RenameTarget = { kind: "file" | "folder"; id: string };

export type FileActions = {
  removeSvgs: (ids: string[]) => void;
  duplicateSvgs: (ids: string[]) => void;
  /** One id downloads a file; several download a ZIP. */
  downloadSvgs: (ids: string[]) => void;
  renameSvg: (id: string, name: string) => void;
  /** Open the series rename dialog over exactly these files. */
  seriesRenameFiles: (ids: string[]) => void;
  /** Move into a folder, or out to loose when null. */
  moveSvgs: (ids: string[], folderId: string | null) => void;
  /** ⌘G: a new folder named after the files, then rename. */
  newFolderFromSelection: (ids: string[]) => void;
  /** An empty folder, then rename. */
  newFolder: () => void;

  renameFolder: (id: string, name: string) => void;
  removeFolder: (id: string) => void;
  duplicateFolder: (id: string) => void;
  downloadFolder: (id: string) => void;
  /** Open the series rename dialog for a folder's files. */
  seriesRename: (folderId: string) => void;

  /** Settings clipboard: copy a target's effective settings… */
  copySettings: (target: SettingsTarget) => void;
  /** …and pin every key of them onto another target. */
  pasteSettings: (target: SettingsTarget) => void;
  /** Back to inheriting from the layer beneath. */
  clearOverrides: (target: SettingsTarget) => void;
  canPasteSettings: boolean;
  hasOverrides: (target: SettingsTarget) => boolean;

  /** ZIP every stored source file (folders nested) as a backup. */
  backupAll: () => Promise<void>;
  clearAll: () => void;
};
