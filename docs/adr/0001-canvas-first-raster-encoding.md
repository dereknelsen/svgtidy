# ADR-0001: Canvas first, WASM fallback for raster encoding

**Status**: Accepted — 2026-09-04

## Context

Raster export and the favicon package need PNG, WebP, and AVIF bytes produced entirely in the browser (the app is local-first with no server). Every browser encodes PNG from a canvas; WebP is native in Chromium and Firefox but not everywhere; AVIF encoding is native almost nowhere. `canvas.toBlob` never throws for an unsupported type — it silently returns PNG.

## Decision

`lib/raster.ts` renders the SVG to a canvas and asks the browser's encoder first. A memoized 1×1 probe checks the MIME the canvas actually returns; when it isn't the requested one, encoding falls through to the jSquash WASM codecs (`@jsquash/webp`, `@jsquash/avif`), dynamically imported so the multi-megabyte codecs stay out of the main bundle. Turbopack resolves the codecs' `new URL('*.wasm', import.meta.url)` references as static assets without extra config.

The multithreaded AVIF build is never selected because the app does not send the cross-origin isolation headers it needs; the single-threaded build is fast enough for icon-sized artwork.

## Consequences

- Output is identical across browsers where native and WASM agree on the format; quality settings map 1–100 in both paths.
- Adding another format means adding a `RASTER_FORMATS` row and, if browsers can't encode it, a fallback branch.
- The favicon package always uses PNG, so it never touches the WASM path.
