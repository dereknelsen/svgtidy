import { describe, expect, it } from "vitest";
import { BUILT_IN_PRESETS, DEFAULT_SETTINGS } from "../settings";
import { optimizeSvg, prettifySvg } from "./core";

/**
 * The core value proposition, tested through its real interface: this SVG +
 * these settings → this output. It runs real SVGO in-process without a
 * worker or any mocks.
 */

const FIXTURE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <!-- a comment -->
  <title>Icon</title>
  <g id="wrapper">
    <rect id="shape" x="1.00000" y="1.00000" width="10.00000" height="10.00000" fill="rgb(255, 0, 0)"/>
  </g>
</svg>`;

describe("optimizeSvg", () => {
  it("produces smaller output with the default settings", () => {
    const out = optimizeSvg(FIXTURE, DEFAULT_SETTINGS);
    expect(out.length).toBeLessThan(FIXTURE.length);
    expect(out).toContain("<svg");
    expect(out).toContain('viewBox="0 0 24 24"');
  });

  it("removes comments by default and keeps them when the setting is off", () => {
    expect(optimizeSvg(FIXTURE, DEFAULT_SETTINGS)).not.toContain("a comment");
    expect(
      optimizeSvg(FIXTURE, { ...DEFAULT_SETTINGS, removeComments: false }),
    ).toContain("a comment");
  });

  it("keeps <title> by default and drops it when the risky setting is on", () => {
    expect(optimizeSvg(FIXTURE, DEFAULT_SETTINGS)).toContain("<title>");
    expect(
      optimizeSvg(FIXTURE, { ...DEFAULT_SETTINGS, removeTitle: true }),
    ).not.toContain("<title>");
  });

  it("respects floatPrecision", () => {
    const wide = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M 1.23456 2.34567 L 3.45678 4.56789"/></svg>`;
    const precise = optimizeSvg(wide, {
      ...DEFAULT_SETTINGS,
      floatPrecision: 5,
    });
    const coarse = optimizeSvg(wide, {
      ...DEFAULT_SETTINGS,
      floatPrecision: 1,
    });
    expect(precise).toContain("1.23456");
    expect(coarse).not.toContain("1.23456");
    expect(coarse).toContain("1.2");
  });

  it("prefixes ids from the filename when prefixIds is on", () => {
    // cleanupIds would minify/remove the ids first, so isolate prefixIds.
    const out = optimizeSvg(
      FIXTURE,
      { ...DEFAULT_SETTINGS, prefixIds: true, cleanupIds: false },
      { filename: "App Icon (1).svg" },
    );
    expect(out).toContain('id="App-Icon-1__shape"');
  });

  it("preserves the viewBox by default and strips it when the risky setting is on", () => {
    // removeViewBox only strips a viewBox that matches explicit width/height.
    const sized = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="1" y="1" width="10" height="10"/></svg>`;
    expect(optimizeSvg(sized, DEFAULT_SETTINGS)).toContain("viewBox");
    expect(
      optimizeSvg(sized, { ...DEFAULT_SETTINGS, removeViewBox: true }),
    ).not.toContain("viewBox");
  });

  it("throws on markup SVGO cannot parse", () => {
    expect(() => optimizeSvg("<svg><unclosed", DEFAULT_SETTINGS)).toThrow();
  });

  // Every preset must survive a real SVGO run. A settings row mapped to a
  // nonexistent plugin name only blows up here, at optimize time. The config
  // builder happily emits it (this is how the Aggressive preset once broke).
  it.each(BUILT_IN_PRESETS)(
    "the $id preset optimizes without error",
    (preset) => {
      const out = optimizeSvg(FIXTURE, preset.settings);
      expect(out.length).toBeGreaterThan(0);
      expect(out).toContain("<svg");
    },
  );
});

describe("prettifySvg", () => {
  it("re-expands minified markup without optimizing it", () => {
    const minified = `<svg xmlns="http://www.w3.org/2000/svg"><!-- keep me --><g><rect x="1"/></g></svg>`;
    const pretty = prettifySvg(minified);
    expect(pretty.split("\n").length).toBeGreaterThan(1);
    // A plugin-free pass must not strip anything, even with prettify defaults.
    expect(pretty).toContain("keep me");
  });
});
