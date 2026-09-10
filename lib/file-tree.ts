import type { FolderDocType, SvgDocType } from "./db";

/**
 * How the files sidebar arranges folders and files: interleaved by creation
 * time, grouped into date buckets, narrowed by the filter query. Pure, so
 * the visible order (which shift-click ranges over) is testable.
 */

export type Entry =
  | { kind: "folder"; folder: FolderDocType; files: SvgDocType[]; at: number }
  | { kind: "file"; svg: SvgDocType; at: number };

export const BUCKETS = ["Today", "Yesterday", "This week", "Earlier"] as const;
export type Bucket = (typeof BUCKETS)[number];

export function bucketOf(at: number, now: Date): Bucket {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = 24 * 60 * 60 * 1000;
  if (at >= startOfDay.getTime()) return "Today";
  if (at >= startOfDay.getTime() - day) return "Yesterday";
  if (at >= startOfDay.getTime() - 6 * day) return "This week";
  return "Earlier";
}

/** Group into date buckets. `query` is matched case-insensitively against names. */
export function groupEntries(
  svgs: readonly SvgDocType[],
  folders: readonly FolderDocType[],
  query: string,
  now: Date = new Date(),
): Map<Bucket, Entry[]> {
  const q = query.trim().toLowerCase();
  const byFolder = new Map<string, SvgDocType[]>();
  const loose: SvgDocType[] = [];
  for (const svg of svgs) {
    if (svg.folderId) {
      const list = byFolder.get(svg.folderId) ?? [];
      list.push(svg);
      byFolder.set(svg.folderId, list);
    } else {
      loose.push(svg);
    }
  }

  let entries: Entry[] = [
    ...folders.map((folder) => ({
      kind: "folder" as const,
      folder,
      files: byFolder.get(folder.id) ?? [],
      at: folder.createdAt,
    })),
    // Files whose folder no longer exists count as loose.
    ...[...byFolder.entries()]
      .filter(([id]) => !folders.some((f) => f.id === id))
      .flatMap(([, files]) => files)
      .concat(loose)
      .map((svg) => ({ kind: "file" as const, svg, at: svg.createdAt })),
  ];

  if (q) {
    entries = entries.flatMap((entry): Entry[] => {
      if (entry.kind === "file") {
        return entry.svg.name.toLowerCase().includes(q) ? [entry] : [];
      }
      if (entry.folder.name.toLowerCase().includes(q)) return [entry];
      const files = entry.files.filter((f) => f.name.toLowerCase().includes(q));
      return files.length > 0 ? [{ ...entry, files }] : [];
    });
  }

  entries.sort((a, b) => b.at - a.at);

  const buckets = new Map<Bucket, Entry[]>();
  for (const entry of entries) {
    const bucket = bucketOf(entry.at, now);
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), entry]);
  }
  return buckets;
}

/** File ids top to bottom as rendered; a collapsed folder's files are skipped. */
export function visibleFileOrder(
  buckets: Map<Bucket, Entry[]>,
  isFolderOpen: (folderId: string) => boolean,
): string[] {
  const order: string[] = [];
  for (const bucket of BUCKETS) {
    for (const entry of buckets.get(bucket) ?? []) {
      if (entry.kind === "file") {
        order.push(entry.svg.id);
      } else if (isFolderOpen(entry.folder.id)) {
        for (const svg of entry.files) order.push(svg.id);
      }
    }
  }
  return order;
}
