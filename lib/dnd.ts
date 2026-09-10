/**
 * Internal drag-and-drop between sidebar rows and folders. Rows carry their
 * file ids under a private MIME type, which is what makes an internal drag
 * distinguishable from an OS file drag: react-dropzone only reacts to
 * `Files`, so the canvas drop overlay stays quiet during these.
 */

/** Lowercase on purpose: Safari lowercases DataTransfer types. */
export const SVGTIDY_IDS_MIME = "application/x-svgtidy-ids";

/** True for a drag started by a sidebar row. Safe during dragover (types only). */
export function isInternalDrag(dt: Pick<DataTransfer, "types">): boolean {
  return Array.from(dt.types).includes(SVGTIDY_IDS_MIME);
}

/** The dragged file ids, or null when the payload isn't ours or is garbage. */
export function readDraggedIds(
  dt: Pick<DataTransfer, "getData">,
): string[] | null {
  let raw = "";
  try {
    raw = dt.getData(SVGTIDY_IDS_MIME);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const ids = parsed.filter((x): x is string => typeof x === "string");
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}
