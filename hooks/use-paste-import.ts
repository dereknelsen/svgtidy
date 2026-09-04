"use client";

import { useEffect } from "react";
import { byteLength } from "@/lib/format";
import type { IncomingSvg } from "@/components/dropzone";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

let pasteCounter = 0;

/**
 * Import SVGs pasted anywhere on the page: copied files from a file manager
 * come through `clipboardData.files`, copied markup comes through as text.
 * Pastes into inputs and other editable targets are left alone.
 */
export function usePasteImport(onFiles: (files: IncomingSvg[]) => void) {
  useEffect(() => {
    async function onPaste(event: ClipboardEvent) {
      if (isTypingTarget(event.target)) return;
      const data = event.clipboardData;
      if (!data) return;

      const files = Array.from(data.files).filter(
        (f) =>
          f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg"),
      );
      if (files.length > 0) {
        event.preventDefault();
        const parsed: IncomingSvg[] = [];
        for (const file of files) {
          const text = await file.text();
          if (text.includes("<svg")) {
            parsed.push({ name: file.name, svg: text, size: byteLength(text) });
          }
        }
        if (parsed.length > 0) onFiles(parsed);
        return;
      }

      const text = data.getData("text/plain");
      if (text && text.includes("<svg")) {
        event.preventDefault();
        pasteCounter += 1;
        onFiles([
          {
            name: `pasted-${pasteCounter}.svg`,
            svg: text,
            size: byteLength(text),
          },
        ]);
      }
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFiles]);
}
