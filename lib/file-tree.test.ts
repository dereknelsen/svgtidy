import { describe, expect, it } from "vitest";
import { groupEntries, visibleFileOrder } from "./file-tree";
import type { FolderDocType, SvgDocType } from "./db";

const now = new Date(2026, 8, 10, 12, 0, 0);
const t = (hoursAgo: number) => now.getTime() - hoursAgo * 60 * 60 * 1000;

const file = (
  id: string,
  name: string,
  at: number,
  folderId?: string,
): SvgDocType => ({
  id,
  name,
  svg: "<svg/>",
  size: 10,
  createdAt: at,
  ...(folderId ? { folderId } : {}),
});

const folders: FolderDocType[] = [
  { id: "f1", name: "icons", createdAt: t(2) },
  { id: "f2", name: "logos", createdAt: t(30) },
];
const svgs = [
  file("a", "home.svg", t(1)),
  file("b", "icon-a.svg", t(3), "f1"),
  file("c", "icon-b.svg", t(4), "f1"),
  file("d", "logo.svg", t(31), "f2"),
  file("e", "orphan.svg", t(50), "gone"),
];

describe("groupEntries", () => {
  it("interleaves folders and files newest first and buckets by date", () => {
    const buckets = groupEntries(svgs, folders, "", now);
    const today = buckets.get("Today")!;
    expect(
      today.map((e) => (e.kind === "folder" ? e.folder.id : e.svg.id)),
    ).toEqual(["a", "f1"]);
    expect(buckets.get("Yesterday")!.map((e) => e.kind)).toEqual(["folder"]);
    expect(buckets.get("This week")!.map((e) => e.kind)).toEqual(["file"]);
  });

  it("treats files in a missing folder as loose", () => {
    const buckets = groupEntries(svgs, folders, "", now);
    const all = [...buckets.values()].flat();
    expect(all.some((e) => e.kind === "file" && e.svg.id === "e")).toBe(true);
  });

  it("a folder name match keeps every file; a file match narrows", () => {
    const byName = groupEntries(svgs, folders, "icons", now);
    const folder = [...byName.values()].flat()[0];
    expect(folder.kind === "folder" && folder.files.length).toBe(2);
    const byFile = groupEntries(svgs, folders, "icon-b", now);
    const narrowed = [...byFile.values()].flat()[0];
    expect(
      narrowed.kind === "folder" && narrowed.files.map((f) => f.id),
    ).toEqual(["c"]);
  });
});

describe("visibleFileOrder", () => {
  it("skips collapsed folders and follows bucket order", () => {
    const buckets = groupEntries(svgs, folders, "", now);
    expect(visibleFileOrder(buckets, () => true)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
    expect(visibleFileOrder(buckets, (id) => id !== "f1")).toEqual([
      "a",
      "d",
      "e",
    ]);
  });
});
