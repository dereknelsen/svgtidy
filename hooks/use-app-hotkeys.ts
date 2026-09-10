"use client";

import { useHotkey } from "@tanstack/react-hotkeys";
import { track } from "@/lib/analytics";

/** Don't let file shortcuts fire while the user is typing somewhere. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

/** A dialog or menu is open, so Escape belongs to it. */
function isOverlayOpen(): boolean {
  return !!document.querySelector(
    '[role="dialog"],[role="alertdialog"],[role="menu"]',
  );
}

type AppHotkeyActions = {
  onDuplicate: () => void;
  onDownload: () => void;
  onDelete: () => void;
  /** Opens series rename for the selection (or the file's folder). */
  onRename: () => void;
  /** ⌘G: move the selected files into a new folder. */
  onNewFolderFromSelection: () => void;
  /** Escape: collapse a multi-selection back to the anchor. */
  onEscape: () => void;
  /** Only files can be grouped; a folder selection can't. */
  canGroup: boolean;
  /** Escape only matters while more than one file is selected. */
  canEscape: boolean;
};

/**
 * Selection-scoped shortcuts. The sidebar-toggle shortcuts (Mod+B / Mod+I /
 * Mod+F) live next to their SidebarProviders in app/page.tsx because they
 * need each provider's context.
 */
export function useAppHotkeys(
  enabled: boolean,
  {
    onDuplicate,
    onDownload,
    onDelete,
    onRename,
    onNewFolderFromSelection,
    onEscape,
    canGroup,
    canEscape,
  }: AppHotkeyActions,
) {
  useHotkey(
    "Mod+R",
    (event) => {
      if (isTypingTarget(event.target)) return;
      track("hotkey", { key: "mod+r" });
      onRename();
    },
    { enabled, preventDefault: true },
  );
  useHotkey(
    "Mod+D",
    (event) => {
      if (isTypingTarget(event.target)) return;
      track("hotkey", { key: "mod+d" });
      onDuplicate();
    },
    { enabled, preventDefault: true },
  );
  useHotkey(
    "Mod+S",
    (event) => {
      if (isTypingTarget(event.target)) return;
      track("hotkey", { key: "mod+s" });
      onDownload();
    },
    { enabled, preventDefault: true },
  );
  useHotkey(
    "Mod+G",
    (event) => {
      if (isTypingTarget(event.target)) return;
      track("hotkey", { key: "mod+g" });
      onNewFolderFromSelection();
    },
    { enabled: enabled && canGroup, preventDefault: true },
  );
  useHotkey("Delete", (event) => {
    if (!enabled || isTypingTarget(event.target)) return;
    track("hotkey", { key: "delete" });
    onDelete();
  });
  useHotkey("Backspace", (event) => {
    if (!enabled || isTypingTarget(event.target)) return;
    track("hotkey", { key: "delete" });
    onDelete();
  });
  useHotkey(
    "Escape",
    (event) => {
      if (event.defaultPrevented || isOverlayOpen()) return;
      if (!isTypingTarget(event.target)) onEscape();
    },
    { enabled: enabled && canEscape },
  );
}
