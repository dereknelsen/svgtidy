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
import type { SettingsOverride } from "./effective-settings";

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
  /**
   * Settings this file pins on top of its folder (or the workspace when
   * loose). A flat partial of both halves; absent when nothing is pinned.
   */
  override?: SettingsOverride;
};

export type FolderDocType = {
  id: string;
  name: string;
  createdAt: number;
  /** Settings this folder pins on top of the workspace for its files. */
  override?: SettingsOverride;
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
  version: 3,
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
    override: { type: "object", additionalProperties: true },
  },
  required: ["id", "name", "svg", "size", "createdAt"],
} as const;

const folderSchema = {
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    name: { type: "string" },
    createdAt: { type: "number" },
    override: { type: "object", additionalProperties: true },
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
 * The free Dexie storage prints a premium upsell on the first write. There is
 * no supported switch for it short of buying a key, so this drops that one
 * message and puts console.warn back as soon as it has passed.
 */
function muteStorageUpsell() {
  if (typeof console === "undefined") return;
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("RxDB Open Core RxStorage")
    ) {
      console.warn = original;
      return;
    }
    original.apply(console, args);
  };
}

/**
 * Create (or reuse) the local-first database. Everything lives in the browser
 * via IndexedDB (Dexie). Nothing touches a server or the network.
 */
export function getDatabase(): Promise<AppDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    muteStorageUpsell();
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
          // v2 → v3 added the optional settings override.
          3: (doc) => doc,
        },
      },
      folders: {
        schema: folderSchema,
        migrationStrategies: {
          // v0 → v1 added the optional settings override.
          1: (doc) => doc,
        },
      },
      presets: { schema: presetSchema },
    });

    return db;
  })();

  return dbPromise;
}
