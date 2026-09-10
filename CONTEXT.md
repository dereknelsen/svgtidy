# SVGtidy

A local-first, browser-only SVG optimizer: files and presets live in IndexedDB, the current settings live in the URL, and SVGO runs in a worker pool.

## Language

**Setting**:
One user-facing optimization option, named for what it does to the user's file rather than for the SVGO plugin behind it.
_Avoid_: option, flag, plugin toggle

**Setting descriptor**:
The single row in `SETTING_DESCRIPTORS` (`lib/settings.ts`) holding everything the app knows about one setting: default, URL key, control, panel copy, risk flag, and SVGO mapping. The type, schema, defaults, URL parsers, panel groups, and SVGO config are all derived from it.
_Avoid_: config entry, settings metadata

**URL key**:
The compact query-param name for a setting (`rc`, `fp`, `mpass`). Frozen: they are baked into shared links and must never change meaning.
_Avoid_: param, short code

**Preset**:
A complete, named snapshot of both halves of the model (optimization `Settings` plus `FormatSettings`, stored flat), built-in (ships with the app) or saved (user-created, stored in the DB). Saved presets are unvalidated until they cross into the models via `parseSettings` / `parseFormatSettings`; presets that predate format settings apply with format defaults. Applied in folder or file scope, a preset pins every key on that layer.
_Avoid_: profile, template

**Override**:
The partial, flat snapshot of settings (both halves, `Partial<Settings & FormatSettings>`) a folder or file pins for itself, stored as `override` on the document. A pinned key stays pinned even when it equals the value beneath it, so counts are pins, not differences. Validated at the seam by `parseOverride` (`lib/effective-settings.ts`). See ADR-0002.
_Avoid_: per-file settings, custom settings, exception

**Effective settings**:
What a file is actually optimized and formatted with: the workspace base (URL) ⊕ its folder's override ⊕ its own override. Resolved for every file and folder in one pass by `resolveAll`; every consumer (optimizer jobs, preview, download, ZIP, sprite, raster) reads a file's effective settings, never the base directly.
_Avoid_: resolved settings, merged settings, computed settings

**Scope**:
Which layer the inspector is editing: Workspace (the URL), Folder, or File. Defaults to the selection's natural layer and can be stepped up with the segmented control under the stat card. Panels always show effective values; a dot marks a key pinned at the current scope (or, in workspace scope, changed from default) and its undo returns the key to inheriting.
_Avoid_: level, mode, target layer

**Settings clipboard**:
The in-memory copy taken by "Copy settings" on a file or folder: its effective settings, both halves. "Paste settings" replaces the target's override with every key pinned, the same as applying a preset; "Clear overrides" returns the target to inheriting.
_Avoid_: settings buffer, template

**Risky**:
A setting that can change how the SVG renders, not just its size. Flagged in the panel with a warning.
_Avoid_: unsafe, destructive

**Canvas**:
The full-bleed main area, split into two stacked panels and permanently a dropzone. The top panel shows the artwork (Preview or Compare, chosen by the floating switcher); the bottom, shorter panel holds the text views (Diff or Code) behind its own toggle. The split is user-resizable and remembered between visits.
_Avoid_: preview pane, viewer area

**Split**:
The canvas' two stacked, resizable panels. The bottom panel collapses to just its header bar and never fully disappears, so it can always be reopened. Diff always compares original against optimized. The Format layer's output appears only in Code.
_Avoid_: pane divider, layout

**Format**:
The export-shaping layer applied after the Optimizer: file name, file type (SVG / JSX / Symbol / CSS), size, colors, and the empty-rectangle extra. A pure projection: it never changes the Optimizer's output, and Preview, Code, Copy, and Download all consume the same formatted result. Lives in `lib/format-output.ts` + `lib/format-settings.ts`, edited in the inspector's Format panel, exported from the header's Copy/Download group.
_Avoid_: export settings, output options

**CSS snippet**:
The CSS written around the data URI when the file type is CSS: bare data URI, `url()`, a custom property named after the file, a `background` shorthand, or a `mask` with `background-color: currentColor`. Alongside it, the encoding (URL-encoded or base64) and the wrapper quote. The SVG's attribute quotes flip to the opposite of the wrapper quote, and `xmlns` is restored if the optimizer stripped it, since a data URI renders as a standalone document.
_Avoid_: CSS template, wrapper, output mode

**Part**:
One distinct paint value (fill or stroke) in the optimized output, the unit of recoloring. The paint value itself is the part's stable key, so per-part color overrides survive re-optimization. Part colors are per-file data stored on the file, never part of presets. Hovering a part's slot in the Format panel dims every other part in the preview.
_Avoid_: layer, shape, element

**Series rename**:
The Figma-style batch rename dialog (Match, Rename-to with name/number tokens, start-from, live preview) over a folder's files, or a single loose file. Opened from a folder's menu, the Format panel's name row, or `⌘R`.
_Avoid_: batch rename, bulk edit

**Last-used**:
The localStorage snapshot that seeds format settings when the URL carries none. A shared link always wins: any format param in the URL disables the snapshot for that visit entirely.
_Avoid_: sticky settings, remembered settings

**Files sidebar**:
The collapsible left rail listing folders and files, grouped by date, with the filter box and the [+] menu (add files, new folder) at the top. It is the only file list. Rows multi-select with shift-click (a range over visible rows) and ⌘-click (toggle); a folder row selects the folder. Every row action lives in both the row's "…" menu and the right-click context menu, and files drag into folders (or onto the top strip to move out). Collapses to an icon rail of thumbnails on desktop (`⌘B`) and to a sheet on mobile.
_Avoid_: file tray, file list panel

**Selection**:
The sidebar's current pick: a set of files with one **anchor** (the last plain- or ⌘-clicked file, which the canvas previews and shift-click ranges from), or a single folder. Hotkeys, the "…" menu, and the context menu act on the whole selection. Nothing explicitly selected means the anchor alone, falling back to the newest file. Pure model in `lib/selection.ts`.
_Avoid_: active files, checked files, highlighted rows

**Folder**:
A one-level-deep, named grouping of files, created by hand ([+] menu, `⌘G` from a selection) or automatically when several files arrive in one gesture (named by their common filename prefix, else the drop's date-time). Selectable, a drop target, and the unit of "export like this": a folder may carry an override its files inherit, and downloads as a ZIP where each file uses its own effective settings. Deleting a folder deletes the files inside it, behind a confirmation.
_Avoid_: group, export group, collection, directory

**Inspector**:
The collapsible right rail (`⌘I`; a sheet on mobile) holding the stat card, the scope control, the preset picker, the Format panel, and the Optimizations panel. Download and copy actions live in the header, not here.
_Avoid_: settings panel, sidebar

**Stat card**:
The block at the top of the inspector showing original → optimized bytes and the savings percentage for the anchor file, or the aggregate over the selected folder or multi-selection.
_Avoid_: totals strip, stats bar

**Raster export**:
The header menu's "Export as image" flow: the selected file's visual projection (the same markup Preview shows, colors and size from the Format panel) rendered to PNG, WebP, or AVIF at a scale or exact width, optionally on a solid background. Lives in `lib/raster.ts`, edited in the Export-as-image dialog, batch-zipped for all files. The browser's canvas encodes when it can; jSquash WASM encoders cover WebP/AVIF where it can't (see ADR-0001).
_Avoid_: image download, bitmap export, convert to PNG

**Favicon package**:
The ZIP the "Generate favicons" dialog builds from the selected file: `favicon.ico` (16/32/48 PNG entries), `favicon.svg`, the standard PNG set (tab sizes, Apple touch, Android/PWA, maskable, Windows tile), `site.webmanifest`, `browserconfig.xml`, and a `favicon.html` snippet of link tags. Solid-background icons (touch, tile, maskable) take the dialog's background color and padding; tab icons stay edge to edge on alpha. The file plan and text builders are pure (`lib/favicon.ts`); rasterizing is injected.
_Avoid_: icon set, app icons, favicon bundle

**Stale**:
A prior optimized output still shown (dimmed) while a re-optimize is in flight. The stale-while-revalidate rule lives in `lib/optimize/result.ts`: every consumer (canvas, stats, downloads, copies) uses the same stale bytes via `outputOf`, never a mix.
_Avoid_: outdated, pending

**Optimizer**:
The module behind `lib/optimize` that turns an SVG plus `Settings` into optimized (or prettified) markup. Its interface speaks the app's vocabulary: `optimize(svg, settings, { filename })`, `prettify(svg)`. Everything SVGO (configs, plugins, the worker wire protocol) stays behind the seam. Two adapters satisfy it: the worker pool in the browser, and the pure core (`lib/optimize/core.ts`) that tests call in-process.
_Avoid_: pool, worker (those name the browser adapter, not the module)
