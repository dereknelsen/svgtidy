import { describe, expect, it } from "vitest";
import { artworkBox, withPixelSize } from "./svg";

describe("artworkBox", () => {
  it("prefers viewBox, accepts commas", () => {
    expect(artworkBox('<svg viewBox="0,0,24,24" width="1em"/>')).toEqual({
      x: 0,
      y: 0,
      w: 24,
      h: 24,
    });
  });
  it("falls back to numeric width/height", () => {
    expect(artworkBox('<svg width="10px" height="5"/>')).toEqual({
      x: 0,
      y: 0,
      w: 10,
      h: 5,
    });
  });
  it("is null without any box", () => {
    expect(artworkBox("<svg/>")).toBeNull();
  });
});

describe("withPixelSize", () => {
  it("replaces unit sizes with pixels and keeps the viewBox", () => {
    expect(
      withPixelSize(
        '<svg width="1em" height="1em" viewBox="0 0 24 24"/>',
        96,
        96,
      ),
    ).toBe('<svg viewBox="0 0 24 24" width="96" height="96"/>');
  });
  it("promotes width/height to a viewBox so the artwork scales", () => {
    expect(withPixelSize('<svg width="10" height="5"><g/></svg>', 20, 10)).toBe(
      '<svg viewBox="0 0 10 5" width="20" height="10"><g/></svg>',
    );
  });
});
