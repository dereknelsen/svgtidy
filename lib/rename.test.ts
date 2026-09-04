import { describe, expect, it } from "vitest";
import { applySeriesRename } from "./rename";

const NAMES = ["icon-home.svg", "icon-search.svg", "icon-user.svg"];

describe("applySeriesRename", () => {
  it("replaces the whole name with the template when match is empty", () => {
    expect(
      applySeriesRename(NAMES, {
        match: "",
        renameTo: "nav-$n↑",
        startFrom: 1,
      }),
    ).toEqual(["nav-1.svg", "nav-2.svg", "nav-3.svg"]);
  });

  it("numbers descending with $n↓, ending at startFrom", () => {
    expect(
      applySeriesRename(NAMES, { match: "", renameTo: "x$n↓", startFrom: 1 }),
    ).toEqual(["x3.svg", "x2.svg", "x1.svg"]);
  });

  it("respects startFrom for ascending numbers", () => {
    expect(
      applySeriesRename(["a.svg", "b.svg"], {
        match: "",
        renameTo: "$n↑",
        startFrom: 10,
      }),
    ).toEqual(["10.svg", "11.svg"]);
  });

  it("keeps the current name available as $name", () => {
    expect(
      applySeriesRename(["home.svg"], {
        match: "",
        renameTo: "$name-24px",
        startFrom: 1,
      }),
    ).toEqual(["home-24px.svg"]);
  });

  it("replaces only the matched substring when match is set", () => {
    expect(
      applySeriesRename(NAMES, { match: "icon-", renameTo: "", startFrom: 1 }),
    ).toEqual(["home.svg", "search.svg", "user.svg"]);
    expect(
      applySeriesRename(NAMES, {
        match: "icon",
        renameTo: "glyph",
        startFrom: 1,
      }),
    ).toEqual(["glyph-home.svg", "glyph-search.svg", "glyph-user.svg"]);
  });

  it("leaves names alone with no match and no template", () => {
    expect(
      applySeriesRename(NAMES, { match: "", renameTo: "", startFrom: 1 }),
    ).toEqual(NAMES);
  });

  it("never produces an empty stem and preserves the extension case", () => {
    expect(
      applySeriesRename(["logo.SVG"], {
        match: "logo",
        renameTo: "",
        startFrom: 1,
      }),
    ).toEqual(["logo.SVG"]);
  });
});
