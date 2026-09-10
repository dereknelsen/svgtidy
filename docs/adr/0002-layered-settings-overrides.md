# ADR-0002: Layered settings overrides

**Status**: Accepted (2026-09-10)

## Context

Settings have always been one global set living in the URL, so any configuration is shareable by copying the address. That model has no room for "this folder exports as JSX at precision 1 while everything else stays at the defaults": every file in the workspace optimized and formatted the same way, and the only per-file data was part colors.

Folders needed to carry export and optimization settings that their files inherit, with per-file exceptions, without breaking shareable links or introducing a second grouping concept.

## Decision

Settings resolve in layers. The URL stays the workspace base. A folder may store an **override**, and a file may store one on top of its folder (or the workspace when loose). A file's **effective settings** are base ⊕ folder override ⊕ file override (`lib/effective-settings.ts`).

- An override is one flat partial of both halves (`Partial<Settings & FormatSettings>`), stored as `override` on the svg and folder documents (svg schema v3, folder schema v1). It is shaped like a preset but incomplete, so presets, the settings clipboard, and overrides all pass one object around.
- Stored overrides are untrusted, like presets: `parseOverride` validates each half with `v.partial` of the model's object schema at the seam, stripping foreign keys and rejecting an invalid half wholesale.
- A pinned key stays pinned even when it equals the value beneath it. "N overridden" counts pins, not differences, so a folder that pins precision 3 keeps precision 3 after the workspace moves to 1.
- Applying a preset, or pasting copied settings, in folder or file scope pins **every** key on that layer. A folder the user made "Aggressive" must not drift when the workspace changes. Copy captures the source's effective settings, so pasting across folders carries what the source inherited.
- The inspector edits one **scope** at a time (Workspace, Folder, File), defaulting to the selection's natural layer. Panels always show effective values; a dot marks keys pinned at that layer and an undo returns the key to inheriting.
- The optimizer runs per file with that file's effective settings. Jobs are keyed on `optimizeKey`, the optimization half only, so a format edit never re-optimizes and a folder edit re-runs only that folder (`lib/optimize/plan.ts`). Results carry per-file dispatch tokens instead of one global run id, so one file's edit no longer discards the others' in-flight work.
- Part colors stay outside the override: they are keyed by paint value, meaningful only per file, and never part of presets.

## Consequences

- Share links carry only the workspace base. A colleague opening a link gets the same base but none of the folder or file pins.
- Duplicating a file or folder copies its override. Moving a file between folders keeps its own pins and changes only the layer beneath.
- The last-used format snapshot in localStorage keeps writing only the base.
- Every export path (download, ZIP, sprite, raster batch, copy) formats each file with its own effective format, so one ZIP can hold a `.jsx` next to `.svg` files.
