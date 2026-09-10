/**
 * The files sidebar's selection model, kept pure so the click semantics are
 * testable without React. A selection is either a set of files (with one
 * anchor, the last plain/meta-clicked file, which the canvas previews) or a
 * single folder. Folder selection keeps the anchor so the preview stays put.
 */

export type Selection = {
  /** Multi-selected files. Empty means "just the anchor" (or nothing). */
  fileIds: ReadonlySet<string>;
  /** Last plain/meta-clicked file; drives the canvas preview. */
  anchorId: string | null;
  /** The selected folder. Exclusive with a non-empty fileIds. */
  folderId: string | null;
};

export const EMPTY_SELECTION: Selection = {
  fileIds: new Set(),
  anchorId: null,
  folderId: null,
};

export type SelectModifiers = { shift?: boolean; meta?: boolean };

/** Ids in `order` between `a` and `b`, inclusive, in visible order. */
export function rangeBetween(
  order: readonly string[],
  a: string,
  b: string,
): string[] {
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia < 0 || ib < 0) return ib >= 0 ? [b] : [];
  const [lo, hi] = ia < ib ? [ia, ib] : [ib, ia];
  return order.slice(lo, hi + 1);
}

function lastInOrder(
  ids: ReadonlySet<string>,
  order: readonly string[],
): string | null {
  for (let i = order.length - 1; i >= 0; i--) {
    if (ids.has(order[i])) return order[i];
  }
  const [first] = ids;
  return first ?? null;
}

function firstInOrder(
  ids: ReadonlySet<string>,
  order: readonly string[],
): string | null {
  for (const id of order) if (ids.has(id)) return id;
  const [first] = ids;
  return first ?? null;
}

/**
 * What the user sees as selected before a modifier click: with a folder
 * selected, no files; otherwise the explicit set, or the anchor (or the
 * fallback file the UI highlights when nothing was ever clicked).
 */
function materialize(prev: Selection, fallbackId: string | null): Selection {
  if (prev.folderId) return { ...prev, fileIds: new Set(), folderId: null };
  if (prev.fileIds.size > 0) return prev;
  const id = prev.anchorId ?? fallbackId;
  return id
    ? { fileIds: new Set([id]), anchorId: id, folderId: null }
    : { ...prev, folderId: null };
}

/**
 * Plain click: select just `id`. Meta: toggle `id`. Shift: range from the
 * anchor over `order` (visible rows). A shift-click whose anchor isn't
 * visible degrades to a plain click.
 */
export function reduceSelect(
  prev: Selection,
  id: string,
  mods: SelectModifiers,
  order: readonly string[],
  fallbackId: string | null = null,
): Selection {
  const cur = materialize(prev, fallbackId);
  if (
    mods.shift &&
    cur.anchorId &&
    order.includes(cur.anchorId) &&
    order.includes(id)
  ) {
    return {
      fileIds: new Set(rangeBetween(order, cur.anchorId, id)),
      anchorId: cur.anchorId,
      folderId: null,
    };
  }
  if (mods.meta) {
    const next = new Set(cur.fileIds);
    if (next.has(id)) {
      next.delete(id);
      return {
        fileIds: next,
        anchorId: cur.anchorId === id ? lastInOrder(next, order) : cur.anchorId,
        folderId: null,
      };
    }
    next.add(id);
    return { fileIds: next, anchorId: id, folderId: null };
  }
  return { fileIds: new Set([id]), anchorId: id, folderId: null };
}

/** Select a folder (or none). Files deselect; the anchor stays for the preview. */
export function selectFolder(
  prev: Selection,
  folderId: string | null,
): Selection {
  return { fileIds: new Set(), anchorId: prev.anchorId, folderId };
}

export function selectMany(
  ids: readonly string[],
  anchorId?: string,
): Selection {
  return {
    fileIds: new Set(ids),
    anchorId: anchorId ?? ids[0] ?? null,
    folderId: null,
  };
}

/** Escape: back to just the anchor. */
export function collapseToAnchor(prev: Selection): Selection {
  if (!prev.anchorId) return EMPTY_SELECTION;
  return {
    fileIds: new Set([prev.anchorId]),
    anchorId: prev.anchorId,
    folderId: null,
  };
}

/**
 * Drop ids that no longer exist. A vanished anchor moves to the first
 * surviving selected file (in `order`); a vanished folder deselects.
 * Returns `sel` itself when nothing changed.
 */
export function pruneSelection(
  sel: Selection,
  fileIds: ReadonlySet<string>,
  folderIds: ReadonlySet<string>,
  order: readonly string[],
): Selection {
  const kept = new Set([...sel.fileIds].filter((id) => fileIds.has(id)));
  const anchorAlive = sel.anchorId !== null && fileIds.has(sel.anchorId);
  const anchorId = anchorAlive ? sel.anchorId : firstInOrder(kept, order);
  const folderId =
    sel.folderId !== null && folderIds.has(sel.folderId) ? sel.folderId : null;
  if (
    kept.size === sel.fileIds.size &&
    anchorId === sel.anchorId &&
    folderId === sel.folderId
  ) {
    return sel;
  }
  return { fileIds: kept, anchorId, folderId };
}

/**
 * The files that actions and row highlighting operate on: the explicit set,
 * else the anchor (or the UI's fallback file), else nothing. With a folder
 * selected, no files.
 */
export function effectiveFileIds(
  sel: Selection,
  fallbackId: string | null,
): ReadonlySet<string> {
  if (sel.fileIds.size > 0) return sel.fileIds;
  if (sel.folderId) return EMPTY_SELECTION.fileIds;
  const id = sel.anchorId ?? fallbackId;
  return id ? new Set([id]) : EMPTY_SELECTION.fileIds;
}

/**
 * For the Move to… menu: the folder (null = loose) every one of `ids`
 * already lives in, or undefined when they're spread across places.
 */
export function sharedFolderOf(
  ids: readonly string[],
  files: readonly { id: string; folderId?: string }[],
): string | null | undefined {
  const want = new Set(ids);
  const places = new Set<string | null>();
  for (const file of files) {
    if (want.has(file.id)) places.add(file.folderId ?? null);
  }
  if (places.size !== 1) return undefined;
  const [only] = places;
  return only;
}
