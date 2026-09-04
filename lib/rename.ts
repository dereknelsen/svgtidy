/**
 * Series rename: Figma-style batch renaming over a list of file names.
 * Pure so the dialog preview and the commit share one implementation.
 *
 * Template tokens (inserted via the dialog's chips, but plain text — typing
 * them works too):
 *   $name — the file's current name (without extension)
 *   $n↑   — ascending number, starting at `startFrom`
 *   $n↓   — descending number, ending at `startFrom`
 */

export type SeriesRenameOptions = {
  /** Substring to replace within each name; empty replaces the whole name. */
  match: string;
  /** Replacement template. Empty with a match deletes the matched text. */
  renameTo: string;
  startFrom: number;
};

const EXT = /\.svg$/i;

function expand(
  template: string,
  stem: string,
  index: number,
  count: number,
  startFrom: number,
): string {
  return template
    .replaceAll("$name", stem)
    .replaceAll("$n↑", String(startFrom + index))
    .replaceAll("$n↓", String(startFrom + (count - 1 - index)));
}

/** The new name for every input name, extension preserved, order kept. */
export function applySeriesRename(
  names: string[],
  { match, renameTo, startFrom }: SeriesRenameOptions,
): string[] {
  return names.map((name, index) => {
    const ext = EXT.exec(name)?.[0] ?? "";
    const stem = name.replace(EXT, "");
    const expanded = expand(renameTo, stem, index, names.length, startFrom);
    let next: string;
    if (match) {
      next = stem.split(match).join(expanded);
    } else {
      // No match + no template = leave the name alone (nothing was asked).
      next = renameTo ? expanded : stem;
    }
    next = next.trim();
    return (next || stem) + ext;
  });
}
