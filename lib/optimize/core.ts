import { optimize } from "svgo/browser";
import { buildSvgoConfig, type Settings, type SvgoConfig } from "../settings";

/**
 * The pure core of the app: this SVG + these settings → this smaller SVG.
 * Synchronous and DOM-free, so tests exercise real SVGO in-process. The
 * worker pool is just the adapter that runs the same functions off the main
 * thread.
 */

type NativeSvgoConfig = Parameters<typeof optimize>[1];

// Minified SVG is a single line, so diffing needs both sides re-expanded: a
// plugin-free SVGO pass that only pretty-prints.
const PRETTIFY_CONFIG: SvgoConfig = {
  multipass: false,
  floatPrecision: 3, // unused with no plugins, but the config type requires it
  plugins: [],
  js2svg: { pretty: true, indent: 2 },
};

export function optimizeSvg(
  svg: string,
  settings: Settings,
  opts?: { filename?: string },
): string {
  // SvgoConfig is deliberately loose to keep svgo types out of the app bundle;
  // this is the one place it meets svgo's own config type.
  const config = buildSvgoConfig(settings, opts) as NativeSvgoConfig;
  return optimize(svg, config).data;
}

export function prettifySvg(svg: string): string {
  return optimize(svg, PRETTIFY_CONFIG as NativeSvgoConfig).data;
}
