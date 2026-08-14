import {
  createRxDatabase,
  type RxDatabase,
  type RxCollection,
  type RxDocument,
} from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import type { Settings } from "./settings";

export type SvgDocType = {
  id: string;
  name: string;
  svg: string;
  size: number;
  createdAt: number;
};

export type PresetDocType = {
  id: string;
  name: string;
  settings: Settings;
  createdAt: number;
};

export type SvgDocument = RxDocument<SvgDocType>;
export type PresetDocument = RxDocument<PresetDocType>;

export type AppCollections = {
  svgs: RxCollection<SvgDocType>;
  presets: RxCollection<PresetDocType>;
};

export type AppDatabase = RxDatabase<AppCollections>;

const svgSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    name: { type: "string" },
    svg: { type: "string" },
    size: { type: "number" },
    createdAt: { type: "number" },
  },
  required: ["id", "name", "svg", "size", "createdAt"],
} as const;

const presetSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    name: { type: "string" },
    settings: { type: "object", additionalProperties: true },
    createdAt: { type: "number" },
  },
  required: ["id", "name", "settings", "createdAt"],
} as const;

let dbPromise: Promise<AppDatabase> | null = null;

/**
 * Create (or reuse) the local-first database. Everything lives in the browser
 * via IndexedDB (Dexie) — no server, no network, no auth.
 */
export function getDatabase(): Promise<AppDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const db = await createRxDatabase<AppCollections>({
      name: "vector_svgo",
      storage: getRxStorageDexie(),
      multiInstance: true,
      eventReduce: true,
      // Reuse the existing instance across HMR reloads instead of throwing.
      closeDuplicates: true,
    });

    await db.addCollections({
      svgs: { schema: svgSchema },
      presets: { schema: presetSchema },
    });

    return db;
  })();

  return dbPromise;
}
