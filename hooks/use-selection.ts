"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FolderDocType, SvgDocType } from "@/lib/db";
import {
  EMPTY_SELECTION,
  collapseToAnchor,
  effectiveFileIds,
  pruneSelection,
  reduceSelect,
  selectFolder,
  selectMany,
  type SelectModifiers,
  type Selection,
} from "@/lib/selection";

/**
 * The sidebar's selection as page state. Pruning is derived, not reconciled
 * in an effect, so a deleted file never strands the UI: the anchor falls
 * back to the newest file, exactly as the single-select model did.
 */
export function useSelection(svgs: SvgDocType[], folders: FolderDocType[]) {
  const [raw, setRaw] = useState<Selection>(EMPTY_SELECTION);

  const order = useMemo(() => svgs.map((s) => s.id), [svgs]);
  const selection = useMemo(
    () =>
      pruneSelection(
        raw,
        new Set(order),
        new Set(folders.map((f) => f.id)),
        order,
      ),
    [raw, order, folders],
  );

  /** The previewed file: the anchor, else the newest file, else none. */
  const anchor = useMemo(
    () => svgs.find((s) => s.id === selection.anchorId) ?? svgs[0] ?? null,
    [svgs, selection.anchorId],
  );

  /** What actions and row highlighting operate on. */
  const fileIds = useMemo(
    () => effectiveFileIds(selection, anchor?.id ?? null),
    [selection, anchor],
  );
  const selectedFiles = useMemo(
    () => svgs.filter((s) => fileIds.has(s.id)),
    [svgs, fileIds],
  );

  // Reducers read the pruned selection and the visible fallback, not the raw
  // state, so a click after a deletion starts from what the user sees.
  const latest = useRef({ selection, fallbackId: anchor?.id ?? null });
  useEffect(() => {
    latest.current = { selection, fallbackId: anchor?.id ?? null };
  });

  const select = useCallback(
    (id: string, mods: SelectModifiers, visibleOrder: readonly string[]) => {
      const { selection: cur, fallbackId } = latest.current;
      setRaw(reduceSelect(cur, id, mods, visibleOrder, fallbackId));
    },
    [],
  );
  const pickFolder = useCallback((id: string | null) => {
    setRaw(selectFolder(latest.current.selection, id));
  }, []);
  const pickMany = useCallback((ids: readonly string[], anchorId?: string) => {
    setRaw(selectMany(ids, anchorId));
  }, []);
  const clearSelection = useCallback(() => setRaw(EMPTY_SELECTION), []);
  const collapse = useCallback(() => {
    setRaw(collapseToAnchor(latest.current.selection));
  }, []);

  return {
    selection,
    anchor,
    fileIds,
    selectedFiles,
    select,
    selectFolder: pickFolder,
    selectMany: pickMany,
    clearSelection,
    collapseToAnchor: collapse,
  };
}
