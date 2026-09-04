import { describe, expect, it } from "vitest";
import {
  buildBrowserconfig,
  buildFaviconHtml,
  buildFaviconPackage,
  buildIco,
  buildWebManifest,
  FAVICON_FILE_LIST,
  FAVICON_PNGS,
  ICO_SIZES,
  type FaviconOptions,
} from "./favicon";

const options: FaviconOptions = {
  name: "Acme",
  shortName: "",
  themeColor: "#123456",
  backgroundColor: "#ffffff",
  padding: 0.1,
};

describe("buildIco", () => {
  it("writes a valid header, directory, and image data", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5]);
    const ico = buildIco([
      { size: 16, png: a },
      { size: 256, png: b },
    ]);
    const view = new DataView(ico.buffer);
    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(2);
    // First entry: 16px, 3 bytes, right after the 6 + 2×16 byte directory.
    expect(ico[6]).toBe(16);
    expect(view.getUint16(6 + 6, true)).toBe(32);
    expect(view.getUint32(6 + 8, true)).toBe(3);
    expect(view.getUint32(6 + 12, true)).toBe(38);
    // Second entry: 256px is encoded as 0, and follows the first image.
    expect(ico[22]).toBe(0);
    expect(view.getUint32(22 + 12, true)).toBe(41);
    expect(Array.from(ico.subarray(38))).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("text files", () => {
  it("falls back to the name when short name is blank", () => {
    const manifest = JSON.parse(buildWebManifest(options));
    expect(manifest.short_name).toBe("Acme");
    expect(manifest.theme_color).toBe("#123456");
    expect(manifest.icons.map((i: { src: string }) => i.src)).toEqual([
      "/android-chrome-192x192.png",
      "/android-chrome-512x512.png",
      "/maskable-icon-512x512.png",
    ]);
    expect(manifest.icons[2].purpose).toBe("maskable");
  });

  it("writes the tile color into browserconfig", () => {
    expect(buildBrowserconfig(options)).toContain(
      "<TileColor>#123456</TileColor>",
    );
  });

  it("links every icon the package ships", () => {
    const html = buildFaviconHtml(options);
    for (const href of [
      "/favicon.ico",
      "/favicon.svg",
      "/apple-touch-icon.png",
      "/site.webmanifest",
      "/browserconfig.xml",
    ]) {
      expect(html).toContain(href);
    }
    expect(html).toContain('content="#123456"');
  });
});

describe("buildFaviconPackage", () => {
  it("renders each PNG once and lists every planned file", async () => {
    const calls: { size: number; background?: string; padding: number }[] = [];
    const entries = await buildFaviconPackage(
      "<svg/>",
      options,
      async (spec) => {
        calls.push(spec);
        return new Uint8Array([spec.size]);
      },
    );
    expect(entries.map((e) => e.filename)).toEqual(FAVICON_FILE_LIST);
    expect(calls).toHaveLength(FAVICON_PNGS.length);

    const touch = calls.find((c) => c.size === 180);
    expect(touch).toEqual({ size: 180, background: "#ffffff", padding: 0.1 });
    const tab = calls.find((c) => c.size === 16);
    expect(tab).toEqual({ size: 16, background: undefined, padding: 0 });

    const ico = entries[0].content as Uint8Array;
    expect(new DataView(ico.buffer).getUint16(4, true)).toBe(ICO_SIZES.length);
    expect(entries[1]).toEqual({ filename: "favicon.svg", content: "<svg/>" });
  });
});
