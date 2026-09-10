import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  collapseToAnchor,
  effectiveFileIds,
  pruneSelection,
  rangeBetween,
  reduceSelect,
  selectFolder,
  selectMany,
  sharedFolderOf,
  type Selection,
} from "./selection";

const order = ["a", "b", "c", "d", "e"];
const sel = (
  ids: string[],
  anchorId: string | null = ids[0] ?? null,
): Selection => ({
  fileIds: new Set(ids),
  anchorId,
  folderId: null,
});

describe("reduceSelect", () => {
  it("plain click selects just the file", () => {
    const out = reduceSelect(sel(["a", "b"]), "d", {}, order);
    expect([...out.fileIds]).toEqual(["d"]);
    expect(out.anchorId).toBe("d");
    expect(out.folderId).toBeNull();
  });

  it("shift click ranges from the anchor over visible order, anchor stays", () => {
    const out = reduceSelect(sel(["b"]), "d", { shift: true }, order);
    expect([...out.fileIds]).toEqual(["b", "c", "d"]);
    expect(out.anchorId).toBe("b");
    const back = reduceSelect(out, "a", { shift: true }, order);
    expect([...back.fileIds]).toEqual(["a", "b"]);
  });

  it("shift click with a hidden anchor degrades to a plain click", () => {
    const out = reduceSelect(sel(["b"]), "d", { shift: true }, ["a", "d"]);
    expect([...out.fileIds]).toEqual(["d"]);
    expect(out.anchorId).toBe("d");
  });

  it("shift click from the fallback file when nothing was clicked yet", () => {
    const out = reduceSelect(EMPTY_SELECTION, "c", { shift: true }, order, "a");
    expect([...out.fileIds]).toEqual(["a", "b", "c"]);
    expect(out.anchorId).toBe("a");
  });

  it("meta click toggles and moves the anchor", () => {
    const added = reduceSelect(sel(["a"]), "c", { meta: true }, order);
    expect([...added.fileIds]).toEqual(["a", "c"]);
    expect(added.anchorId).toBe("c");
    const removed = reduceSelect(added, "c", { meta: true }, order);
    expect([...removed.fileIds]).toEqual(["a"]);
    expect(removed.anchorId).toBe("a");
  });

  it("meta click includes the fallback file", () => {
    const out = reduceSelect(EMPTY_SELECTION, "c", { meta: true }, order, "a");
    expect([...out.fileIds].sort()).toEqual(["a", "c"]);
  });

  it("meta click off the last file leaves nothing selected", () => {
    const out = reduceSelect(sel(["a"]), "a", { meta: true }, order);
    expect(out.fileIds.size).toBe(0);
    expect(out.anchorId).toBeNull();
  });

  it("any click on a file deselects a folder", () => {
    const folder = selectFolder(sel(["a"]), "f1");
    expect(folder.folderId).toBe("f1");
    expect(folder.fileIds.size).toBe(0);
    expect(folder.anchorId).toBe("a");
    const out = reduceSelect(folder, "b", { meta: true }, order);
    expect(out.folderId).toBeNull();
    expect([...out.fileIds]).toEqual(["b"]);
  });
});

describe("rangeBetween", () => {
  it("is inclusive in either direction", () => {
    expect(rangeBetween(order, "b", "d")).toEqual(["b", "c", "d"]);
    expect(rangeBetween(order, "d", "b")).toEqual(["b", "c", "d"]);
    expect(rangeBetween(order, "zz", "b")).toEqual(["b"]);
  });
});

describe("pruneSelection", () => {
  const files = new Set(["a", "c", "d"]);
  const folders = new Set(["f1"]);

  it("returns the same object when nothing changed", () => {
    const s = sel(["a", "c"]);
    expect(pruneSelection(s, files, folders, order)).toBe(s);
  });

  it("drops vanished files and re-anchors to the first survivor", () => {
    const out = pruneSelection(
      sel(["b", "d", "c"], "b"),
      files,
      folders,
      order,
    );
    expect([...out.fileIds].sort()).toEqual(["c", "d"]);
    expect(out.anchorId).toBe("c");
  });

  it("clears a vanished folder and anchor", () => {
    const out = pruneSelection(
      { ...selectFolder(sel(["b"]), "gone") },
      files,
      folders,
      order,
    );
    expect(out.folderId).toBeNull();
    expect(out.anchorId).toBeNull();
  });
});

describe("effectiveFileIds", () => {
  it("falls back to the anchor, then the fallback file", () => {
    expect([...effectiveFileIds(sel([], "b"), "a")]).toEqual(["b"]);
    expect([...effectiveFileIds(EMPTY_SELECTION, "a")]).toEqual(["a"]);
    expect(effectiveFileIds(EMPTY_SELECTION, null).size).toBe(0);
  });

  it("is empty while a folder is selected", () => {
    expect(effectiveFileIds(selectFolder(sel(["a"]), "f1"), "a").size).toBe(0);
  });
});

describe("helpers", () => {
  it("selectMany and collapseToAnchor", () => {
    const many = selectMany(["b", "c"]);
    expect(many.anchorId).toBe("b");
    expect([...collapseToAnchor(many).fileIds]).toEqual(["b"]);
    expect(collapseToAnchor(EMPTY_SELECTION)).toBe(EMPTY_SELECTION);
  });

  it("sharedFolderOf", () => {
    const files = [
      { id: "a", folderId: "f1" },
      { id: "b", folderId: "f1" },
      { id: "c" },
    ];
    expect(sharedFolderOf(["a", "b"], files)).toBe("f1");
    expect(sharedFolderOf(["c"], files)).toBeNull();
    expect(sharedFolderOf(["a", "c"], files)).toBeUndefined();
  });
});
