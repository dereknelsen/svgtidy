import { describe, expect, it } from "vitest";
import { SVGTIDY_IDS_MIME, isInternalDrag, readDraggedIds } from "./dnd";

describe("isInternalDrag", () => {
  it("recognizes only our MIME type", () => {
    expect(isInternalDrag({ types: [SVGTIDY_IDS_MIME] })).toBe(true);
    expect(isInternalDrag({ types: ["Files"] })).toBe(false);
  });
});

describe("readDraggedIds", () => {
  const dt = (data: string) => ({ getData: () => data });

  it("parses a JSON array of ids", () => {
    expect(readDraggedIds(dt('["a","b"]'))).toEqual(["a", "b"]);
  });

  it("rejects empty, non-array, and malformed payloads", () => {
    expect(readDraggedIds(dt(""))).toBeNull();
    expect(readDraggedIds(dt('{"a":1}'))).toBeNull();
    expect(readDraggedIds(dt("not json"))).toBeNull();
    expect(readDraggedIds(dt("[1,2]"))).toBeNull();
  });
});
