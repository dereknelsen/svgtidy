"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  AppDatabase,
  FolderDocType,
  PresetDocType,
  SvgDocType,
} from "@/lib/db";
import type { Settings } from "@/lib/settings";

/**
 * Resolve the shared database once, exposing a loading flag for the UI.
 * RxDB + Dexie are dynamically imported here so the ~500KB storage chunk stays
 * off the critical path, so the page becomes interactive before it loads.
 */
export function useDatabase() {
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    import("@/lib/db")
      .then(({ getDatabase }) => getDatabase())
      .then((instance) => {
        if (active) setDb(instance);
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      active = false;
    };
  }, []);

  return { db, ready: !!db, error };
}

/**
 * Subscribe to a collection and keep a stable array reference between renders.
 * The rows are sorted at subscription time (newest first), so the returned
 * value only changes identity when the underlying data actually changes. This
 * is what keeps downstream effects (like optimization) from looping.
 */
function useCollectionArray<T extends { id: string; createdAt: number }>(
  db: AppDatabase | null,
  collectionName: "svgs" | "presets" | "folders",
): T[] {
  const [rows, setRows] = useState<T[]>([]);

  useEffect(() => {
    if (!db) return;
    const collection = db[collectionName] as unknown as {
      find: () => {
        $: {
          subscribe: (cb: (docs: { toJSON: () => T }[]) => void) => {
            unsubscribe: () => void;
          };
        };
      };
    };
    const sub = collection.find().$.subscribe((docs) => {
      const next = docs
        .map((d) => d.toJSON() as T)
        .sort((a, b) => b.createdAt - a.createdAt);
      // RxDB emits fresh objects on every change anywhere in the collection.
      // Mutations here are insert/remove, renames, folder moves, and part
      // color edits, so the identity guard checks id, name, folderId, and
      // partColors (tiny maps, so stringify is cheap). An unchanged sequence
      // keeps the previous array so downstream effects don't re-fire.
      type Row = {
        id: string;
        name?: string;
        folderId?: string;
        partColors?: Record<string, string>;
      };
      setRows((prev) =>
        prev.length === next.length &&
        prev.every((row, i) => {
          const a = row as Row;
          const b = next[i] as Row;
          return (
            a.id === b.id &&
            a.name === b.name &&
            a.folderId === b.folderId &&
            JSON.stringify(a.partColors) === JSON.stringify(b.partColors)
          );
        })
          ? prev
          : next,
      );
    });
    return () => sub.unsubscribe();
  }, [db, collectionName]);

  return rows;
}

/** Reactively read all stored SVGs, newest first. */
export function useSvgs(db: AppDatabase | null): SvgDocType[] {
  return useCollectionArray<SvgDocType>(db, "svgs");
}

/** Reactively read all saved user presets, newest first. */
export function usePresets(db: AppDatabase | null): PresetDocType[] {
  return useCollectionArray<PresetDocType>(db, "presets");
}

/** Reactively read all folders, newest first. */
export function useFolders(db: AppDatabase | null): FolderDocType[] {
  return useCollectionArray<FolderDocType>(db, "folders");
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** "arrows.svg" → "arrows copy.svg" */
function copyName(name: string) {
  return name.replace(/(\.svg)?$/i, (ext) => ` copy${ext}`);
}

/** Mutation helpers for stored SVGs, folders, and presets. */
export function useSvgActions(db: AppDatabase | null) {
  const addSvgs = useCallback(
    async (
      files: { name: string; svg: string; size: number }[],
      folderId?: string,
    ) => {
      if (!db) return;
      const now = Date.now();
      await db.svgs.bulkInsert(
        files.map((f, i) => ({
          id: randomId(),
          name: f.name,
          svg: f.svg,
          size: f.size,
          createdAt: now + i,
          ...(folderId ? { folderId } : {}),
        })),
      );
    },
    [db],
  );

  const removeSvg = useCallback(
    async (id: string) => {
      if (!db) return;
      const doc = await db.svgs.findOne(id).exec();
      await doc?.remove();
    },
    [db],
  );

  const clearSvgs = useCallback(async () => {
    if (!db) return;
    await db.svgs.find().remove();
    await db.folders.find().remove();
  }, [db]);

  const duplicateSvg = useCallback(
    async (id: string) => {
      if (!db) return;
      const doc = await db.svgs.findOne(id).exec();
      if (!doc) return;
      const src = doc.toJSON();
      await db.svgs.insert({
        ...src,
        id: randomId(),
        name: copyName(src.name),
        createdAt: Date.now(),
      });
    },
    [db],
  );

  const renameSvg = useCallback(
    async (id: string, name: string) => {
      if (!db) return;
      const doc = await db.svgs.findOne(id).exec();
      await doc?.patch({ name });
    },
    [db],
  );

  /** Series rename: patch many files in one gesture. */
  const renameSvgs = useCallback(
    async (updates: { id: string; name: string }[]) => {
      if (!db) return;
      for (const { id, name } of updates) {
        const doc = await db.svgs.findOne(id).exec();
        await doc?.patch({ name });
      }
    },
    [db],
  );

  /** Replace a file's per-part color overrides (Format layer). */
  const setPartColors = useCallback(
    async (id: string, partColors: Record<string, string>) => {
      if (!db) return;
      const doc = await db.svgs.findOne(id).exec();
      await doc?.patch({ partColors });
    },
    [db],
  );

  const addFolder = useCallback(
    async (name: string): Promise<string | undefined> => {
      if (!db) return undefined;
      const id = randomId();
      await db.folders.insert({ id, name, createdAt: Date.now() });
      return id;
    },
    [db],
  );

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      if (!db) return;
      const doc = await db.folders.findOne(id).exec();
      await doc?.patch({ name });
    },
    [db],
  );

  /** Deleting a folder deletes the files inside it (confirmed in the UI). */
  const removeFolder = useCallback(
    async (id: string) => {
      if (!db) return;
      await db.svgs.find({ selector: { folderId: id } }).remove();
      const doc = await db.folders.findOne(id).exec();
      await doc?.remove();
    },
    [db],
  );

  const duplicateFolder = useCallback(
    async (id: string) => {
      if (!db) return;
      const folder = await db.folders.findOne(id).exec();
      if (!folder) return;
      const children = await db.svgs
        .find({ selector: { folderId: id } })
        .exec();
      const newId = randomId();
      await db.folders.insert({
        id: newId,
        name: `${folder.get("name")} copy`,
        createdAt: Date.now(),
      });
      const now = Date.now();
      await db.svgs.bulkInsert(
        children.map((child, i) => ({
          ...child.toJSON(),
          id: randomId(),
          folderId: newId,
          createdAt: now + i,
        })),
      );
    },
    [db],
  );

  const savePreset = useCallback(
    async (name: string, settings: Settings) => {
      if (!db) return;
      await db.presets.insert({
        id: randomId(),
        name,
        settings,
        createdAt: Date.now(),
      });
    },
    [db],
  );

  const removePreset = useCallback(
    async (id: string) => {
      if (!db) return;
      const doc = await db.presets.findOne(id).exec();
      await doc?.remove();
    },
    [db],
  );

  return {
    addSvgs,
    removeSvg,
    clearSvgs,
    duplicateSvg,
    renameSvg,
    renameSvgs,
    setPartColors,
    addFolder,
    renameFolder,
    removeFolder,
    duplicateFolder,
    savePreset,
    removePreset,
  };
}
