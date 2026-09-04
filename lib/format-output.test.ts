import { describe, expect, it } from "vitest";
import { DEFAULT_FORMAT } from "./format-settings";
import {
  buildSprite,
  extractPalette,
  formatCss,
  formatOutput,
  formatPreviewSvg,
  highlightPartSvg,
} from "./format-output";

const MONO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#1a1a1a" d="M0 0h24v24z"/></svg>`;
const MULTI = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#1A1A1A" d="M0 0"/><circle stroke="#e4572e" r="4"/><rect fill="#1a1a1a" width="2" height="2"/></svg>`;
const BARE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24"/></svg>`;

const ctx = { name: "icon-home.svg" };

describe("extractPalette", () => {
  it("returns distinct paints in document order, lowercased", () => {
    expect(extractPalette(MULTI)).toEqual(["#1a1a1a", "#e4572e"]);
  });

  it("skips none, url() references, and files with no explicit paints", () => {
    const svg = `<svg><path fill="none"/><path fill="url(#g)"/><path stroke="currentColor"/></svg>`;
    expect(extractPalette(svg)).toEqual(["currentcolor"]);
    expect(extractPalette(BARE)).toEqual([]);
  });

  it("reads paints out of style attributes", () => {
    const svg = `<svg><path style="fill:#123456;stroke: red"/></svg>`;
    expect(extractPalette(svg)).toEqual(["#123456", "red"]);
  });
});

describe("formatPreviewSvg — size", () => {
  it("leaves markup untouched in auto mode", () => {
    const out = formatPreviewSvg(
      MONO,
      { ...DEFAULT_FORMAT, color: "", sizeMode: "auto", sizeValue: 32 },
      ctx,
    );
    expect(out).toBe(MONO);
  });

  it("writes px sizes onto the root tag", () => {
    const out = formatPreviewSvg(
      MONO,
      { ...DEFAULT_FORMAT, color: "", sizeMode: "px", sizeValue: 32 },
      ctx,
    );
    expect(out).toContain('width="32px"');
    expect(out).toContain('height="32px"');
  });

  it("writes em/rem units and fractional values", () => {
    const out = formatPreviewSvg(
      MONO,
      { ...DEFAULT_FORMAT, color: "", sizeMode: "em", sizeValue: 1.5 },
      ctx,
    );
    expect(out).toContain('width="1.5em"');
  });

  it("strips width/height for none and replaces existing attributes", () => {
    const sized = MONO.replace("<svg ", `<svg width="24" height="24" `);
    const none = formatPreviewSvg(
      sized,
      { ...DEFAULT_FORMAT, color: "", sizeMode: "none" },
      ctx,
    );
    expect(none).not.toContain("width=");
    const px = formatPreviewSvg(
      sized,
      { ...DEFAULT_FORMAT, color: "", sizeMode: "px", sizeValue: 48 },
      ctx,
    );
    expect(px).toContain('width="48px"');
    expect(px).not.toContain('width="24"');
  });
});

describe("formatPreviewSvg — color", () => {
  it("recolors monochrome files with the base color", () => {
    const out = formatPreviewSvg(MONO, DEFAULT_FORMAT, ctx);
    expect(out).toContain('fill="currentColor"');
    expect(out).not.toContain("#1a1a1a");
  });

  it("leaves multi-color files alone unless a part is overridden", () => {
    expect(formatPreviewSvg(MULTI, DEFAULT_FORMAT, ctx)).toBe(MULTI);
    const out = formatPreviewSvg(MULTI, DEFAULT_FORMAT, {
      ...ctx,
      partColors: { "#e4572e": "#00ff00" },
    });
    expect(out).toContain('stroke="#00ff00"');
    expect(out).toContain('fill="#1A1A1A"'); // untouched, original casing kept
  });

  it("part overrides win over the base color and match case-insensitively", () => {
    const out = formatPreviewSvg(MONO, DEFAULT_FORMAT, {
      ...ctx,
      partColors: { "#1a1a1a": "#ff0000" },
    });
    expect(out).toContain('fill="#ff0000"');
  });

  it("applies the base color as a root fill when no explicit paints exist", () => {
    const out = formatPreviewSvg(BARE, DEFAULT_FORMAT, ctx);
    expect(out).toMatch(/<svg[^>]*fill="currentColor"/);
  });

  it('keeps original paints when color is ""', () => {
    expect(formatPreviewSvg(MONO, { ...DEFAULT_FORMAT, color: "" }, ctx)).toBe(
      MONO,
    );
    expect(formatPreviewSvg(BARE, { ...DEFAULT_FORMAT, color: "" }, ctx)).toBe(
      BARE,
    );
  });

  it("recolors style-declared paints too", () => {
    const svg = `<svg><path style="fill:#1a1a1a"/></svg>`;
    const out = formatPreviewSvg(svg, DEFAULT_FORMAT, ctx);
    expect(out).toContain("fill:currentColor");
  });
});

describe("formatPreviewSvg — empty rect", () => {
  const f = { ...DEFAULT_FORMAT, color: "", includeEmptyRect: true };

  it("inserts a viewBox-sized invisible rect as the first child", () => {
    const out = formatPreviewSvg(MONO, f, ctx);
    expect(out).toContain('><rect width="24" height="24" fill="none"/><path');
  });

  it("carries viewBox offsets", () => {
    const svg = `<svg viewBox="-8 -4 48 32"><path d="M0 0"/></svg>`;
    expect(formatPreviewSvg(svg, f, ctx)).toContain(
      '<rect x="-8" y="-4" width="48" height="32" fill="none"/>',
    );
  });

  it("falls back to width/height and skips when neither exists", () => {
    const sized = `<svg width="10" height="20"><path d="M0 0"/></svg>`;
    expect(formatPreviewSvg(sized, f, ctx)).toContain(
      '<rect width="10" height="20" fill="none"/>',
    );
    const bare = `<svg><path d="M0 0"/></svg>`;
    expect(formatPreviewSvg(bare, f, ctx)).toBe(bare);
  });
});

describe("highlightPartSvg", () => {
  it("dims every slot except the target", () => {
    const out = highlightPartSvg(MULTI, "#e4572e");
    expect(out).toContain('stroke="#e4572e"');
    expect(out).not.toContain('fill="#1A1A1A"');
    // The dimmed paint is 15%-alpha; the exact color serialization is
    // culori's business, so only the alpha is pinned here.
    expect(out).toMatch(/fill="[^"]*\/ 0\.15\)"/);
  });

  it("dims unparseable paints to translucent black", () => {
    const svg = `<svg><path fill="currentColor"/><path fill="#e4572e"/></svg>`;
    const out = highlightPartSvg(svg, "#e4572e");
    expect(out).toContain('fill="rgba(0,0,0,0.15)"');
  });
});

describe("formatOutput — file types", () => {
  it("svg: passthrough with .svg filename and svg mime", () => {
    const out = formatOutput(MONO, { ...DEFAULT_FORMAT, color: "" }, ctx);
    expect(out).toEqual({
      content: MONO,
      filename: "icon-home.svg",
      mime: "image/svg+xml",
      language: "xml",
    });
  });

  it("jsx: wraps a PascalCase component with a props spread", () => {
    const out = formatOutput(
      MONO,
      { ...DEFAULT_FORMAT, color: "", fileType: "jsx" },
      ctx,
    );
    expect(out.filename).toBe("icon-home.tsx");
    expect(out.content).toMatchSnapshot();
    expect(out.content).toContain("export function IconHome(");
    expect(out.content).toContain("{...props}>");
    expect(out.content).toContain('import type { SVGProps } from "react";');
  });

  it("symbol: emits a hidden sprite svg with a usage comment", () => {
    const out = formatOutput(
      MONO,
      { ...DEFAULT_FORMAT, color: "", fileType: "symbol" },
      ctx,
    );
    expect(out.filename).toBe("icon-home.svg");
    expect(out.content).toContain(
      '<symbol id="icon-home" viewBox="0 0 24 24">',
    );
    expect(out.content).toContain('<use href="#icon-home"/>');
    expect(out.content).toContain('<path fill="#1a1a1a"'); // inner preserved
    expect(out.content).not.toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox=',
    ); // root tag replaced
  });
});

describe("formatOutput — css", () => {
  const css = { ...DEFAULT_FORMAT, color: "", fileType: "css" as const };
  const URL = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%231a1a1a' d='M0 0h24v24z'/%3E%3C/svg%3E")`;

  it("background (default): a centered, contained, non-repeating shorthand", () => {
    const out = formatOutput(MONO, css, ctx);
    expect(out.filename).toBe("icon-home.css");
    expect(out.mime).toBe("text/css");
    expect(out.language).toBe("css");
    expect(out.content).toBe(`background: ${URL} center / contain no-repeat;`);
  });

  it("mask: tints with background-color so the icon is visible", () => {
    const out = formatOutput(MONO, { ...css, cssSnippet: "mask" }, ctx);
    expect(out.content).toBe(
      `background-color: currentColor;\nmask: ${URL} center / contain no-repeat;`,
    );
  });

  it("property: names the custom property after the file", () => {
    const out = formatOutput(MONO, { ...css, cssSnippet: "property" }, ctx);
    expect(out.content).toBe(`--icon-home: ${URL};`);
  });

  it("url and uri: the bare wrapper and the bare URI", () => {
    expect(formatOutput(MONO, { ...css, cssSnippet: "url" }, ctx).content).toBe(
      URL,
    );
    expect(formatOutput(MONO, { ...css, cssSnippet: "uri" }, ctx).content).toBe(
      URL.slice(5, -2),
    );
  });

  it("writes the Size setting as inline-size/block-size", () => {
    const out = formatOutput(
      MONO,
      { ...css, cssSnippet: "mask", sizeMode: "rem", sizeValue: 1.5 },
      ctx,
    ).content;
    expect(out.startsWith("inline-size: 1.5rem;\nblock-size: 1.5rem;\n")).toBe(
      true,
    );
    // The SVG itself carries the size too, as for every other file type.
    expect(out).toContain("width='1.5rem'");
  });

  it("restores xmlns so the data URI renders standalone", () => {
    const stripped = MONO.replace(' xmlns="http://www.w3.org/2000/svg"', "");
    const out = formatCss(stripped, { ...css, cssSnippet: "uri" }, ctx);
    expect(out).toContain("xmlns='http://www.w3.org/2000/svg'");
  });

  it("honors single quotes (attribute quotes stay double) and base64", () => {
    const single = formatCss(
      MONO,
      { ...css, cssSnippet: "url", cssQuotes: "single" },
      ctx,
    );
    expect(single.startsWith(`url('data:image/svg+xml,%3Csvg xmlns="`)).toBe(
      true,
    );
    expect(single.endsWith("')")).toBe(true);
    const b64 = formatCss(
      MONO,
      { ...css, cssSnippet: "url", cssEncoding: "base64" },
      ctx,
    );
    expect(b64.startsWith('url("data:image/svg+xml;base64,')).toBe(true);
  });

  it("bakes the base color into the URI", () => {
    const out = formatOutput(MONO, { ...css, color: "#ff0000" }, ctx).content;
    expect(out).toContain("fill='%23ff0000'");
  });
});

describe("buildSprite", () => {
  it("bundles one symbol per file", () => {
    const sprite = buildSprite([
      { symbolId: "a", svg: MONO },
      { symbolId: "b", svg: MULTI },
    ]);
    expect(sprite).toContain('<symbol id="a" viewBox="0 0 24 24">');
    expect(sprite).toContain('<symbol id="b"');
    expect(sprite.startsWith("<svg xmlns=")).toBe(true);
    expect(sprite.endsWith("</svg>")).toBe(true);
  });
});
