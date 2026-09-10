# SVGtidy

A local-first SVG optimizer and exporter that runs entirely in your browser. Drop files, tune settings, and export smaller SVGs, plus WebP, AVIF, PNG, and favicon packages.

Live at [svgtidy.com](https://svgtidy.com).

## How it works

- **Nothing is uploaded.** Files, folders, presets, and per-file colors live in IndexedDB. Optimization runs in a pool of web workers via [SVGO](https://github.com/svg/svgo). Raster export uses the browser's canvas, with WASM encoders for WebP and AVIF where the browser can't.
- **Settings live in the URL.** Share a link and the recipient gets the same optimization and format settings.
- **Export formats.** SVG, JSX, `<symbol>`, and CSS snippets, plus PNG, WebP, AVIF, and a complete favicon ZIP.

See [CONTEXT.md](CONTEXT.md) for the domain language and [docs/adr/](docs/adr/) for design decisions.

## Privacy and analytics

Your files never leave your browser. There is no server-side processing, no account, and no storage outside your own device.

The hosted site at svgtidy.com uses a self-hosted [Umami](https://umami.is) instance for lightweight, cookie-less page-view counts. It records no personal data, sets no cookies, honors the Do Not Track header, and strips the query string (where your settings live) before reporting. No file contents, filenames, or settings are ever sent.

The tracker only renders when the analytics environment variables are set and only reports from the configured hostname, so forks and local builds send nothing. See [.env.example](.env.example).

## Development

```sh
pnpm install
pnpm dev
```

Other scripts: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm build`.

## License

[MIT](LICENSE)
