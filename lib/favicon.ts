/**
 * The favicon package: every file a site needs to cover browsers, iOS home
 * screens, Android/PWA installs, and Windows tiles, from one SVG. The pure
 * parts (ICO container, manifest, browserconfig, HTML snippet, file plan)
 * live here and are unit-tested; the rasterizing is injected so this module
 * never touches the DOM itself.
 */

export type FaviconOptions = {
  /** Web-app name for the manifest ("Acme Dashboard"). */
  name: string;
  /** Short name shown under the home-screen icon; falls back to `name`. */
  shortName?: string;
  /** The manifest theme color and Windows tile color. */
  themeColor: string;
  /**
   * Painted under icons that platforms display without transparency (iOS
   * touch icon, Windows tile, maskable Android icon).
   */
  backgroundColor: string;
  /** Fraction of the icon left empty around the glyph on padded icons (0–0.45). */
  padding: number;
};

export const DEFAULT_FAVICON_OPTIONS: FaviconOptions = {
  name: "",
  shortName: "",
  themeColor: "#ffffff",
  backgroundColor: "#ffffff",
  padding: 0.1,
};

export type FaviconPng = {
  filename: string;
  size: number;
  /** Opaque background + padding — for platforms that don't do transparency. */
  padded: boolean;
  /** What the file is for; shown in the dialog's file list. */
  purpose: string;
};

/** Sizes folded into favicon.ico, smallest first. */
export const ICO_SIZES = [16, 32, 48] as const;

/** Every PNG in the package. Order is the order the ZIP lists them. */
export const FAVICON_PNGS: FaviconPng[] = [
  {
    filename: "favicon-16x16.png",
    size: 16,
    padded: false,
    purpose: "Browser tab",
  },
  {
    filename: "favicon-32x32.png",
    size: 32,
    padded: false,
    purpose: "Browser tab, HiDPI",
  },
  {
    filename: "favicon-48x48.png",
    size: 48,
    padded: false,
    purpose: "Windows shortcuts",
  },
  {
    filename: "favicon-96x96.png",
    size: 96,
    padded: false,
    purpose: "Google TV, bookmarks",
  },
  {
    filename: "apple-touch-icon.png",
    size: 180,
    padded: true,
    purpose: "iOS home screen",
  },
  {
    filename: "android-chrome-192x192.png",
    size: 192,
    padded: false,
    purpose: "Android, PWA",
  },
  {
    filename: "android-chrome-512x512.png",
    size: 512,
    padded: false,
    purpose: "Android splash, PWA",
  },
  {
    filename: "maskable-icon-512x512.png",
    size: 512,
    padded: true,
    purpose: "Android adaptive icon",
  },
  {
    filename: "mstile-150x150.png",
    size: 150,
    padded: true,
    purpose: "Windows start tile",
  },
];

/** Everything the ZIP contains, for the dialog's summary. */
export const FAVICON_FILE_LIST = [
  "favicon.ico",
  "favicon.svg",
  ...FAVICON_PNGS.map((p) => p.filename),
  "site.webmanifest",
  "browserconfig.xml",
  "favicon.html",
];

/* -------------------------------------------------------------------- ICO */

/**
 * Pack PNG-encoded images into one .ico. Modern Windows and every browser
 * read PNG entries directly, so no BMP conversion is needed. Layout: a 6-byte
 * header, one 16-byte directory entry per image, then the image data.
 */
export function buildIco(
  images: { size: number; png: Uint8Array }[],
): Uint8Array {
  const headerSize = 6;
  const entrySize = 16;
  const dirSize = headerSize + entrySize * images.length;
  const total = images.reduce((sum, img) => sum + img.png.byteLength, dirSize);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: 1 = icon
  view.setUint16(4, images.length, true);

  let offset = dirSize;
  images.forEach((img, i) => {
    const at = headerSize + i * entrySize;
    // 256px is written as 0 per the format's one-byte width/height.
    out[at] = img.size >= 256 ? 0 : img.size;
    out[at + 1] = img.size >= 256 ? 0 : img.size;
    out[at + 2] = 0; // palette size
    out[at + 3] = 0; // reserved
    view.setUint16(at + 4, 1, true); // color planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, img.png.byteLength, true);
    view.setUint32(at + 12, offset, true);
    out.set(img.png, offset);
    offset += img.png.byteLength;
  });
  return out;
}

/* ------------------------------------------------------------ text files */

export function buildWebManifest(options: FaviconOptions): string {
  const manifest = {
    name: options.name,
    short_name: options.shortName?.trim() || options.name,
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    theme_color: options.themeColor,
    background_color: options.backgroundColor,
    display: "standalone",
  };
  return JSON.stringify(manifest, null, 2) + "\n";
}

export function buildBrowserconfig(options: FaviconOptions): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<browserconfig>",
    "  <msapplication>",
    "    <tile>",
    '      <square150x150logo src="/mstile-150x150.png"/>',
    `      <TileColor>${options.themeColor}</TileColor>`,
    "    </tile>",
    "  </msapplication>",
    "</browserconfig>",
    "",
  ].join("\n");
}

/** The <head> tags to paste, in the order browsers prefer them. */
export function buildFaviconHtml(options: FaviconOptions): string {
  return [
    '<link rel="icon" href="/favicon.ico" sizes="32x32">',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '<link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png">',
    '<link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png">',
    '<link rel="icon" href="/favicon-96x96.png" sizes="96x96" type="image/png">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">',
    '<link rel="manifest" href="/site.webmanifest">',
    `<meta name="theme-color" content="${options.themeColor}">`,
    '<meta name="msapplication-config" content="/browserconfig.xml">',
    "",
  ].join("\n");
}

/* ---------------------------------------------------------------- package */

export type FaviconEntry = { filename: string; content: string | Uint8Array };

/**
 * A rasterizer the package builder calls once per PNG. Padded icons get the
 * opaque background and inset; plain ones render edge to edge on alpha.
 */
export type FaviconRasterizer = (spec: {
  size: number;
  background?: string;
  padding: number;
}) => Promise<Uint8Array>;

/** Assemble every entry of the ZIP. `svg` is the markup written to favicon.svg. */
export async function buildFaviconPackage(
  svg: string,
  options: FaviconOptions,
  rasterize: FaviconRasterizer,
): Promise<FaviconEntry[]> {
  const pngs = new Map<string, Uint8Array>();
  const render = (spec: FaviconPng) =>
    rasterize({
      size: spec.size,
      background: spec.padded ? options.backgroundColor : undefined,
      padding: spec.padded ? options.padding : 0,
    });

  await Promise.all(
    FAVICON_PNGS.map(async (spec) => {
      pngs.set(spec.filename, await render(spec));
    }),
  );

  // The ICO reuses the tab-sized PNGs rather than rendering them twice.
  const ico = buildIco(
    ICO_SIZES.map((size) => ({
      size,
      png: pngs.get(`favicon-${size}x${size}.png`)!,
    })),
  );

  return [
    { filename: "favicon.ico", content: ico },
    { filename: "favicon.svg", content: svg },
    ...FAVICON_PNGS.map((spec) => ({
      filename: spec.filename,
      content: pngs.get(spec.filename)!,
    })),
    { filename: "site.webmanifest", content: buildWebManifest(options) },
    { filename: "browserconfig.xml", content: buildBrowserconfig(options) },
    { filename: "favicon.html", content: buildFaviconHtml(options) },
  ];
}
