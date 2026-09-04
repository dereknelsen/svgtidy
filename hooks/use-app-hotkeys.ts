"use client";

import { useHotkey } from "@tanstack/react-hotkeys";

/** Don't let file shortcuts fire while the user is typing somewhere. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

type AppHotkeyActions = {
  onDuplicate: () => void;
  onDownload: () => void;
  onDelete: () => void;
  /** Opens series rename for the selection's folder (or the file alone). */
  onRename: () => void;
};

/**
 * File-level shortcuts, acting on the current selection. The sidebar-toggle
 * shortcuts (Mod+B / Mod+I / Mod+F) live next to their SidebarProviders in
 * app/page.tsx because they need each provider's context.
 */
export function useAppHotkeys(
  enabled: boolean,
  { onDuplicate, onDownload, onDelete, onRename }: AppHotkeyActions,
) {
  useHotkey(
    "Mod+R",
    (event) => {
      if (!isTypingTarget(event.target)) onRename();
    },
    { enabled, preventDefault: true },
  );
  useHotkey(
    "Mod+D",
    (event) => {
      if (!isTypingTarget(event.target)) onDuplicate();
    },
    { enabled, preventDefault: true },
  );
  useHotkey(
    "Mod+S",
    (event) => {
      if (!isTypingTarget(event.target)) onDownload();
    },
    { enabled, preventDefault: true },
  );
  useHotkey("Delete", (event) => {
    if (enabled && !isTypingTarget(event.target)) onDelete();
  });
  useHotkey("Backspace", (event) => {
    if (enabled && !isTypingTarget(event.target)) onDelete();
  });
}
