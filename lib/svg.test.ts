import { describe, expect, it } from "vitest";
import { autoGroupName, ensureSvgXmlns } from "./svg";

describe("ensureSvgXmlns", () => {
  it("injects xmlns when the root tag lacks it", () => {
    expect(
      ensureSvgXmlns('<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>'),
    ).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0"/></svg>',
    );
  });

  it("leaves markup with a namespace untouched", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"/>';
    expect(ensureSvgXmlns(svg)).toBe(svg);
  });

  it("adds xmlns:xlink only when xlink: is used but undeclared", () => {
    const out = ensureSvgXmlns(
      '<svg viewBox="0 0 8 8"><use xlink:href="#a"/></svg>',
    );
    expect(out).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    const declared =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#a"/></svg>';
    expect(ensureSvgXmlns(declared)).toBe(declared);
  });

  it("returns non-svg input unchanged", () => {
    expect(ensureSvgXmlns("not markup")).toBe("not markup");
  });
});

describe("autoGroupName", () => {
  it("uses a meaningful common prefix trimmed at the separator", () => {
    expect(
      autoGroupName(["icon-home.svg", "icon-search.svg", "icon-house.svg"]),
    ).toBe("icon");
    expect(autoGroupName(["brand_logo.svg", "brand_mark.svg"])).toBe("brand");
  });

  it("falls back to date-time when the prefix is too short", () => {
    const name = autoGroupName(
      ["a.svg", "b.svg"],
      new Date("2026-08-17T14:45:00"),
    );
    expect(name).toBe("Aug 17, 2:45 PM");
  });

  it("uses the full shared stem when files share a whole name", () => {
    expect(autoGroupName(["logo.svg", "logo.svg"])).toBe("logo");
  });
});
