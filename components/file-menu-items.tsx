"use client";

import { createContext, useContext } from "react";
import {
  ClipboardCopyIcon,
  ClipboardPasteIcon,
  CopyIcon,
  DownloadIcon,
  FolderArchiveIcon,
  FolderInputIcon,
  FolderPlusIcon,
  PencilIcon,
  RotateCcwIcon,
  TextCursorInputIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import type { FolderDocType, SvgDocType } from "@/lib/db";
import type { FileActions, MenuTarget, RenameTarget } from "@/lib/file-actions";
import { sharedFolderOf } from "@/lib/selection";

/**
 * Both menu families are Base UI Menu parts under the hood, so the item
 * components are prop-compatible. A kit picks the styled wrappers, and one
 * item tree serves the row "…" dropdowns and the right-click context menu.
 */
export type MenuKit = {
  Item: typeof DropdownMenuItem;
  Separator: typeof DropdownMenuSeparator;
  Shortcut: typeof DropdownMenuShortcut;
  Sub: typeof DropdownMenuSub;
  SubTrigger: typeof DropdownMenuSubTrigger;
  SubContent: typeof DropdownMenuSubContent;
};

export const dropdownKit: MenuKit = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Shortcut: DropdownMenuShortcut,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

export const contextKit: MenuKit = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Shortcut: ContextMenuShortcut,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};

export type MenuContextValue = {
  actions: FileActions;
  svgs: SvgDocType[];
  folders: FolderDocType[];
  onRenameRequest: (target: RenameTarget) => void;
  /** Confirm before deleting a folder or several files. */
  onDeleteRequest: (target: MenuTarget) => void;
  /** Opens the OS file picker. */
  onAddFiles: () => void;
};

const MenuContext = createContext<MenuContextValue | null>(null);
export const MenuContextProvider = MenuContext.Provider;

function useMenuContext(): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("FileMenuItems needs a MenuContextProvider");
  return ctx;
}

const plural = (n: number, word: string) =>
  `${n} ${n === 1 ? word : `${word}s`}`;

export function FileMenuItems({
  kit: K,
  target,
}: {
  kit: MenuKit;
  target: MenuTarget;
}) {
  const {
    actions,
    svgs,
    folders,
    onRenameRequest,
    onDeleteRequest,
    onAddFiles,
  } = useMenuContext();

  if (target.kind === "empty") {
    return (
      <>
        <K.Item onClick={actions.newFolder}>
          <FolderPlusIcon />
          New folder
        </K.Item>
        <K.Item onClick={onAddFiles}>
          <UploadIcon />
          Add files…
        </K.Item>
      </>
    );
  }

  const settingsItems = (
    <>
      <K.Item
        onClick={() => actions.copySettings(target)}
        disabled={target.kind === "files" && target.ids.length > 1}
      >
        <ClipboardCopyIcon />
        Copy settings
      </K.Item>
      <K.Item
        onClick={() => actions.pasteSettings(target)}
        disabled={!actions.canPasteSettings}
      >
        <ClipboardPasteIcon />
        Paste settings
      </K.Item>
      <K.Item
        onClick={() => actions.clearOverrides(target)}
        disabled={!actions.hasOverrides(target)}
      >
        <RotateCcwIcon />
        Clear overrides
      </K.Item>
    </>
  );

  if (target.kind === "folder") {
    const { id } = target;
    return (
      <>
        <K.Item onClick={() => onRenameRequest({ kind: "folder", id })}>
          <PencilIcon />
          Rename…
        </K.Item>
        <K.Item onClick={() => actions.seriesRename(id)}>
          <TextCursorInputIcon />
          Rename files…
          <K.Shortcut>⌘R</K.Shortcut>
        </K.Item>
        <K.Item onClick={() => actions.duplicateFolder(id)}>
          <CopyIcon />
          Duplicate
          <K.Shortcut>⌘D</K.Shortcut>
        </K.Item>
        <K.Item onClick={() => actions.downloadFolder(id)}>
          <FolderArchiveIcon />
          Download ZIP
          <K.Shortcut>⌘S</K.Shortcut>
        </K.Item>
        <K.Separator />
        {settingsItems}
        <K.Separator />
        <K.Item variant="destructive" onClick={() => onDeleteRequest(target)}>
          <Trash2Icon />
          Delete…
          <K.Shortcut>⌫</K.Shortcut>
        </K.Item>
      </>
    );
  }

  const { ids } = target;
  const n = ids.length;
  const sameFolder = sharedFolderOf(ids, svgs);
  const sortedFolders = [...folders].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <>
      {n === 1 ? (
        <K.Item onClick={() => onRenameRequest({ kind: "file", id: ids[0] })}>
          <PencilIcon />
          Rename…
        </K.Item>
      ) : (
        <K.Item onClick={() => actions.seriesRenameFiles(ids)}>
          <TextCursorInputIcon />
          Rename {plural(n, "file")}…<K.Shortcut>⌘R</K.Shortcut>
        </K.Item>
      )}
      <K.Item onClick={() => actions.duplicateSvgs(ids)}>
        <CopyIcon />
        Duplicate
        <K.Shortcut>⌘D</K.Shortcut>
      </K.Item>
      <K.Item onClick={() => actions.downloadSvgs(ids)}>
        <DownloadIcon />
        {n === 1 ? "Download" : `Download ${n} as ZIP`}
        <K.Shortcut>⌘S</K.Shortcut>
      </K.Item>
      <K.Item onClick={() => actions.newFolderFromSelection(ids)}>
        <FolderPlusIcon />
        New folder from selection
        <K.Shortcut>⌘G</K.Shortcut>
      </K.Item>
      <K.Sub>
        <K.SubTrigger className="gap-2.5">
          <FolderInputIcon />
          Move to
        </K.SubTrigger>
        <K.SubContent>
          {sortedFolders.map((folder) => (
            <K.Item
              key={folder.id}
              disabled={sameFolder === folder.id}
              onClick={() => actions.moveSvgs(ids, folder.id)}
            >
              {folder.name}
            </K.Item>
          ))}
          {sortedFolders.length > 0 && <K.Separator />}
          <K.Item
            disabled={sameFolder === null}
            onClick={() => actions.moveSvgs(ids, null)}
          >
            No folder
          </K.Item>
        </K.SubContent>
      </K.Sub>
      <K.Separator />
      {settingsItems}
      <K.Separator />
      {n === 1 ? (
        <K.Item variant="destructive" onClick={() => actions.removeSvgs(ids)}>
          <Trash2Icon />
          Delete
          <K.Shortcut>⌫</K.Shortcut>
        </K.Item>
      ) : (
        <K.Item variant="destructive" onClick={() => onDeleteRequest(target)}>
          <Trash2Icon />
          Delete {plural(n, "file")}…<K.Shortcut>⌫</K.Shortcut>
        </K.Item>
      )}
    </>
  );
}
