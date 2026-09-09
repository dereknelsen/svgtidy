import {
  addRxPlugin,
  createRxDatabase,
  type RxDatabase,
  type RxCollection,
  type RxDocument,
} from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import type { Settings } from "./settings";

addRxPlugin(RxDBMigrationSchemaPlugin);

export type SvgDocType = {
  id: string;
  name: string;
  svg: string;
  size: number;
  createdAt: number;
  /** One level deep: set when the file lives in a folder, absent otherwise. */
  folderId?: string;
  /**
   * Per-part color overrides for the Format layer, keyed by the part's
   * original paint value (lowercased). Per-file data, never part of presets.
   */
  partColors?: Record<string, string>;
};

export type FolderDocType = {
  id: string;
  name: string;
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
  folders: RxCollection<FolderDocType>;
  presets: RxCollection<PresetDocType>;
};

export type AppDatabase = RxDatabase<AppCollections>;

const svgSchema = {
  version: 2,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    name: { type: "string" },
    svg: { type: "string" },
    size: { type: "number" },
    createdAt: { type: "number" },
    folderId: { type: "string", maxLength: 100 },
    partColors: { type: "object", additionalProperties: true },
  },
  required: ["id", "name", "svg", "size", "createdAt"],
} as const;

const folderSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    name: { type: "string" },
    createdAt: { type: "number" },
  },
  required: ["id", "name", "createdAt"],
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
 * via IndexedDB (Dexie). Nothing touches a server or the network.
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
      svgs: {
        schema: svgSchema,
        migrationStrategies: {
          // v0 → v1 added the optional folderId; existing docs stay loose.
          1: (doc) => doc,
          // v1 → v2 added the optional partColors map.
          2: (doc) => doc,
        },
      },
      folders: { schema: folderSchema },
      presets: { schema: presetSchema },
    });

    return db;
  })();

  return dbPromise;
}
