import * as SQLite from 'expo-sqlite';

import { catalog } from '@/lib/catalog';
import type { CollectionItem, IngestionSource } from '@/types';

const DATABASE_NAME = 'mug-tracker.db';
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

function database(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= SQLite.openDatabaseAsync(DATABASE_NAME);
  return databasePromise;
}

export async function initializeDatabase(): Promise<void> {
  const db = await database();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS series (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mug_catalog (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      location_key TEXT NOT NULL,
      level TEXT NOT NULL CHECK (level IN ('city', 'state')),
      state_code TEXT NOT NULL,
      state_name TEXT NOT NULL,
      city TEXT,
      aliases_json TEXT NOT NULL,
      series_id TEXT NOT NULL REFERENCES series(id),
      active INTEGER NOT NULL DEFAULT 1,
      inventory_status TEXT NOT NULL,
      catalog_version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS collection_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_mug_id TEXT REFERENCES mug_catalog(id),
      confirmed_location TEXT NOT NULL,
      photo_uri TEXT NOT NULL,
      source_asset_id TEXT,
      source TEXT NOT NULL CHECK (source IN ('camera', 'photo_import', 'album_scan')),
      ocr_text TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS processed_assets (
      asset_id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('saved', 'ignored', 'failed')),
      error_message TEXT,
      processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_history (
      catalog_mug_id TEXT NOT NULL REFERENCES mug_catalog(id),
      location_key TEXT NOT NULL,
      local_date TEXT NOT NULL,
      notified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (catalog_mug_id, location_key, local_date)
    );
  `);

  await db.withTransactionAsync(async () => {
    for (const series of catalog.series) {
      await db.runAsync(
        `INSERT INTO series (id, name) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
        series.id,
        series.name,
      );
    }

    for (const mug of catalog.mugs) {
      await db.runAsync(
        `INSERT INTO mug_catalog (
          id, display_name, location_key, level, state_code, state_name, city,
          aliases_json, series_id, active, inventory_status, catalog_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          display_name = excluded.display_name,
          location_key = excluded.location_key,
          level = excluded.level,
          state_code = excluded.state_code,
          state_name = excluded.state_name,
          city = excluded.city,
          aliases_json = excluded.aliases_json,
          series_id = excluded.series_id,
          active = excluded.active,
          inventory_status = excluded.inventory_status,
          catalog_version = excluded.catalog_version`,
        mug.id,
        mug.displayName,
        mug.locationKey,
        mug.level,
        mug.stateCode,
        mug.stateName,
        mug.city ?? null,
        JSON.stringify(mug.aliases),
        mug.seriesId,
        mug.active ? 1 : 0,
        mug.inventoryStatus,
        catalog.version,
      );
    }
  });
}

type CollectionRow = {
  id: number;
  catalog_mug_id: string | null;
  mug_name: string | null;
  confirmed_location: string;
  photo_uri: string;
  source_asset_id: string | null;
  source: IngestionSource;
  ocr_text: string | null;
  created_at: string;
};

export async function listCollectionItems(): Promise<CollectionItem[]> {
  const db = await database();
  const rows = await db.getAllAsync<CollectionRow>(
    `SELECT c.id, c.catalog_mug_id, m.display_name AS mug_name, c.confirmed_location,
            c.photo_uri, c.source_asset_id, c.source, c.ocr_text, c.created_at
     FROM collection_items c
     LEFT JOIN mug_catalog m ON m.id = c.catalog_mug_id
     ORDER BY c.created_at DESC, c.id DESC`,
  );

  return rows.map((row) => ({
    id: row.id,
    catalogMugId: row.catalog_mug_id,
    mugName: row.mug_name,
    confirmedLocation: row.confirmed_location,
    photoUri: row.photo_uri,
    sourceAssetId: row.source_asset_id,
    source: row.source,
    ocrText: row.ocr_text,
    createdAt: row.created_at,
  }));
}

export async function addCollectionItem(input: {
  catalogMugId: string | null;
  confirmedLocation: string;
  photoUri: string;
  sourceAssetId?: string;
  source: IngestionSource;
  ocrText?: string;
}): Promise<number> {
  const db = await database();
  const result = await db.runAsync(
    `INSERT INTO collection_items (
      catalog_mug_id, confirmed_location, photo_uri, source_asset_id, source, ocr_text
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    input.catalogMugId,
    input.confirmedLocation.trim(),
    input.photoUri,
    input.sourceAssetId ?? null,
    input.source,
    input.ocrText ?? null,
  );
  return result.lastInsertRowId;
}

export async function removeCollectionItem(id: number): Promise<string | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ photo_uri: string }>(
    'SELECT photo_uri FROM collection_items WHERE id = ?',
    id,
  );
  await db.runAsync('DELETE FROM collection_items WHERE id = ?', id);
  return row?.photo_uri ?? null;
}

export async function ownedMugIds(): Promise<Set<string>> {
  const db = await database();
  const rows = await db.getAllAsync<{ catalog_mug_id: string }>(
    'SELECT DISTINCT catalog_mug_id FROM collection_items WHERE catalog_mug_id IS NOT NULL',
  );
  return new Set(rows.map((row) => row.catalog_mug_id));
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

export async function isAssetProcessed(assetId: string): Promise<boolean> {
  const db = await database();
  const row = await db.getFirstAsync<{ found: number }>(
    'SELECT 1 AS found FROM processed_assets WHERE asset_id = ?',
    assetId,
  );
  return row?.found === 1;
}

export async function markAssetProcessed(
  assetId: string,
  status: 'saved' | 'ignored' | 'failed',
  errorMessage?: string,
): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT INTO processed_assets (asset_id, status, error_message)
     VALUES (?, ?, ?)
     ON CONFLICT(asset_id) DO UPDATE SET
       status = excluded.status,
       error_message = excluded.error_message,
       processed_at = CURRENT_TIMESTAMP`,
    assetId,
    status,
    errorMessage ?? null,
  );
}

export async function notifiedMugIds(
  localDate: string,
  locationKeys: readonly string[],
): Promise<Set<string>> {
  if (locationKeys.length === 0) return new Set();
  const db = await database();
  const placeholders = locationKeys.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ catalog_mug_id: string }>(
    `SELECT catalog_mug_id FROM notification_history
     WHERE local_date = ? AND location_key IN (${placeholders})`,
    localDate,
    ...locationKeys,
  );
  return new Set(rows.map((row) => row.catalog_mug_id));
}

export async function recordNotifications(
  mugs: readonly { id: string; locationKey: string }[],
  localDate: string,
): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const mug of mugs) {
      await db.runAsync(
        `INSERT OR IGNORE INTO notification_history
         (catalog_mug_id, location_key, local_date) VALUES (?, ?, ?)`,
        mug.id,
        mug.locationKey,
        localDate,
      );
    }
    await db.runAsync(
      "DELETE FROM notification_history WHERE local_date < date(?, '-14 days')",
      localDate,
    );
  });
}
