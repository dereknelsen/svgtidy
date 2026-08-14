"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getDatabase,
  type AppDatabase,
  type SvgDocType,
  type PresetDocType,
} from "@/lib/db";
import type { Settings } from "@/lib/settings";

/** Resolve the shared database once, exposing a loading flag for the UI. */
export function useDatabase() {
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    getDatabase()
      .then((instance) => {
        if (active) setDb(instance);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err : new Error(String(err)));
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
 * value only changes identity when the underlying data actually changes — this
 * is what keeps downstream effects (like optimization) from looping.
 */
function useCollectionArray<T extends { createdAt: number }>(
  db: AppDatabase | null,
  collectionName: "svgs" | "presets",
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
    const sub = collection
      .find()
      .$.subscribe((docs) => {
        const next = docs
          .map((d) => d.toJSON() as T)
          .sort((a, b) => b.createdAt - a.createdAt);
        setRows(next);
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

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Mutation helpers for stored SVGs and presets. */
export function useSvgActions(db: AppDatabase | null) {
  const addSvgs = useCallback(
    async (files: { name: string; svg: string; size: number }[]) => {
      if (!db) return;
      const now = Date.now();
      await db.svgs.bulkInsert(
        files.map((f, i) => ({
          id: randomId(),
          name: f.name,
          svg: f.svg,
          size: f.size,
          createdAt: now + i,
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
  }, [db]);

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

  return { addSvgs, removeSvg, clearSvgs, savePreset, removePreset };
}
