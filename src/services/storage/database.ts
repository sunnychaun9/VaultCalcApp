/**
 * VaultCalc - SQLite Database Service
 *
 * Manages SQLite database for storing file metadata.
 * Does NOT store actual file content - only metadata.
 *
 * Schema based on 04-Technical-Architecture.md Section 5.1
 *
 * @see FILE-005 in FEATURE_INDEX.md
 */

import * as SQLite from 'expo-sqlite';
import { encryptString, decryptString } from '@services/crypto';

/**
 * Database name
 */
const DATABASE_NAME = 'vaultcalc.db';

/**
 * Database instance (lazily initialized)
 */
let db: SQLite.SQLiteDatabase | null = null;

/**
 * Media type enum
 */
export type MediaType = 'photo' | 'video' | 'document' | 'audio';

/**
 * Media item interface matching database schema
 */
export interface MediaItem {
  id: string;
  type: MediaType;
  name: string;
  encryptedPath: string;
  thumbnailPath: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  keyId: string;
  createdAt: number;
  importedAt: number;
  isFavorite: boolean;
  isDecoy: boolean;
  metadata: Record<string, unknown> | null;
  /** Last playback position in ms (for video/audio resume). Null = no saved position. */
  playbackPosition?: number | null;
}

/**
 * Album interface
 */
export interface Album {
  id: string;
  name: string;
  coverMediaId: string | null;
  createdAt: number;
  isDecoy: boolean;
}

/**
 * Minimal media info needed to display an album cover thumbnail
 */
export interface CoverMediaInfo {
  id: string;
  thumbnailPath: string | null;
  keyId: string;
}

/**
 * Note interface
 */
export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  isDecoy: boolean;
  isEncrypted: boolean;
}

/**
 * Risk level for intruder reports
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Intruder log entry interface
 */
export interface IntruderLog {
  id: string;
  photoPath: string | null;
  timestamp: number;
  failedPinHash: string | null;
  deviceInfo: Record<string, unknown> | null;
  latitude: number | null;
  longitude: number | null;
  cityName: string | null;
  riskLevel: RiskLevel;
  failedAttempts: number;
}

/**
 * Get or create database instance
 */
async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db === null) {
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return db;
}

/**
 * Initialize database with schema
 * Should be called on app startup
 */
export async function initializeDatabase(): Promise<void> {
  const database = await getDatabase();

  // Enable foreign keys
  await database.execAsync('PRAGMA foreign_keys = ON;');

  // Create tables
  await database.execAsync(`
    -- Media items table
    CREATE TABLE IF NOT EXISTS media_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('photo', 'video', 'document', 'audio')),
      name TEXT NOT NULL,
      encrypted_path TEXT NOT NULL,
      thumbnail_path TEXT,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      duration_ms INTEGER,
      width INTEGER,
      height INTEGER,
      key_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      imported_at INTEGER NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_decoy INTEGER NOT NULL DEFAULT 0,
      metadata TEXT
    );

    -- Indexes for media_items
    CREATE INDEX IF NOT EXISTS idx_media_type ON media_items(type);
    CREATE INDEX IF NOT EXISTS idx_media_created ON media_items(created_at);
    CREATE INDEX IF NOT EXISTS idx_media_is_decoy ON media_items(is_decoy);
    CREATE INDEX IF NOT EXISTS idx_media_is_favorite ON media_items(is_favorite);

    -- Albums table
    CREATE TABLE IF NOT EXISTS albums (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cover_media_id TEXT REFERENCES media_items(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      is_decoy INTEGER NOT NULL DEFAULT 0
    );

    -- Album membership (many-to-many)
    CREATE TABLE IF NOT EXISTS album_media (
      album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      media_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (album_id, media_id)
    );

    -- Intruder logs
    CREATE TABLE IF NOT EXISTS intruder_logs (
      id TEXT PRIMARY KEY,
      photo_path TEXT,
      timestamp INTEGER NOT NULL,
      failed_pin_hash TEXT,
      device_info TEXT,
      latitude REAL,
      longitude REAL,
      city_name TEXT,
      risk_level TEXT NOT NULL DEFAULT 'LOW',
      failed_attempts INTEGER NOT NULL DEFAULT 1
    );

    -- Notes table
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      is_decoy INTEGER NOT NULL DEFAULT 0,
      is_encrypted INTEGER NOT NULL DEFAULT 0
    );

    -- Indexes for notes
    CREATE INDEX IF NOT EXISTS idx_notes_is_decoy ON notes(is_decoy);
    CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);

    -- Schema version tracking
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  // Set initial schema version if not exists
  const versionResult = await database.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version LIMIT 1'
  );

  if (versionResult === null) {
    await database.runAsync('INSERT INTO schema_version (version) VALUES (?)', [5]);
  } else {
    let currentVersion = versionResult.version;

    if (currentVersion < 2) {
      // Migration v1 → v2: add is_encrypted column to notes (NOTES-003)
      await database.execAsync(
        'ALTER TABLE notes ADD COLUMN is_encrypted INTEGER NOT NULL DEFAULT 0'
      ).catch(() => {
        // Column may already exist if table was created with v2 schema
      });
      currentVersion = 2;
      await database.runAsync('UPDATE schema_version SET version = 2');
    }

    if (currentVersion < 3) {
      // Migration v2 → v3: encrypt sensitive metadata columns (SECURITY_DEEP_AUDIT C-3)
      await migrateV2ToV3(database);
      currentVersion = 3;
      await database.runAsync('UPDATE schema_version SET version = 3');
    }

    if (currentVersion < 4) {
      // Migration v3 → v4: add intruder intelligence columns (SEC-005)
      await migrateV3ToV4(database);
      currentVersion = 4;
      await database.runAsync('UPDATE schema_version SET version = 4');
    }

    if (currentVersion < 5) {
      // Migration v4 → v5: add playback position for video resume
      await database.execAsync(
        'ALTER TABLE media_items ADD COLUMN playback_position INTEGER'
      ).catch(() => {
        // Column may already exist
      });
      await database.runAsync('UPDATE schema_version SET version = 5');
    }
  }
}

/**
 * Migration v2 → v3: Encrypt sensitive plaintext metadata columns.
 *
 * Encrypts:
 * - media_items.original_name (reveals source filenames)
 * - notes.title (reveals note intent even when content is encrypted)
 * - intruder_logs.device_info (device fingerprint)
 *
 * Each value is encrypted with AES-256-GCM using a unique AAD
 * that ties the ciphertext to the specific row and column.
 */
async function migrateV2ToV3(database: SQLite.SQLiteDatabase): Promise<void> {
  // Encrypt media_items.original_name
  const mediaRows = await database.getAllAsync<{ id: string; original_name: string }>(
    'SELECT id, original_name FROM media_items'
  );
  for (const row of mediaRows) {
    const result = await encryptString(row.original_name, `media_name:${row.id}`);
    if (result.success && result.data !== undefined) {
      await database.runAsync(
        'UPDATE media_items SET original_name = ? WHERE id = ?',
        [result.data, row.id]
      );
    }
  }

  // Encrypt notes.title
  const noteRows = await database.getAllAsync<{ id: string; title: string }>(
    'SELECT id, title FROM notes'
  );
  for (const row of noteRows) {
    if (row.title.length > 0) {
      const result = await encryptString(row.title, `note_title:${row.id}`);
      if (result.success && result.data !== undefined) {
        await database.runAsync(
          'UPDATE notes SET title = ? WHERE id = ?',
          [result.data, row.id]
        );
      }
    }
  }

  // Encrypt intruder_logs.device_info
  const logRows = await database.getAllAsync<{ id: string; device_info: string | null }>(
    'SELECT id, device_info FROM intruder_logs WHERE device_info IS NOT NULL'
  );
  for (const row of logRows) {
    if (row.device_info !== null) {
      const result = await encryptString(row.device_info, `intruder_info:${row.id}`);
      if (result.success && result.data !== undefined) {
        await database.runAsync(
          'UPDATE intruder_logs SET device_info = ? WHERE id = ?',
          [result.data, row.id]
        );
      }
    }
  }
}

/**
 * Migration v3 → v4: Add intruder intelligence columns.
 *
 * Adds location, risk level, and failed attempt count to intruder_logs.
 */
async function migrateV3ToV4(database: SQLite.SQLiteDatabase): Promise<void> {
  const alterStatements = [
    'ALTER TABLE intruder_logs ADD COLUMN latitude REAL',
    'ALTER TABLE intruder_logs ADD COLUMN longitude REAL',
    'ALTER TABLE intruder_logs ADD COLUMN city_name TEXT',
    "ALTER TABLE intruder_logs ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'LOW'",
    'ALTER TABLE intruder_logs ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 1',
  ];

  for (const sql of alterStatements) {
    await database.execAsync(sql).catch(() => {
      // Column may already exist
    });
  }
}

/**
 * Close database connection
 * Should be called on app termination
 */
export async function closeDatabase(): Promise<void> {
  if (db !== null) {
    await db.closeAsync();
    db = null;
  }
}

/**
 * Database row type for media_items query results
 */
type MediaItemRow = {
  id: string;
  type: string;
  name: string;
  encrypted_path: string;
  thumbnail_path: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  key_id: string;
  created_at: number;
  imported_at: number;
  is_favorite: number;
  is_decoy: number;
  metadata: string | null;
  playback_position: number | null;
};

/**
 * Encrypt a field value before writing to the database.
 * Returns the encrypted string, or the original value if encryption fails.
 */
async function encryptField(value: string, aad: string): Promise<string> {
  if (value.length === 0) return value;
  const result = await encryptString(value, aad);
  return result.success && result.data !== undefined ? result.data : value;
}

/**
 * Decrypt a field value read from the database.
 * Returns the decrypted string, or the original value if decryption fails
 * (e.g. the value was stored before encryption was enabled).
 */
async function decryptField(value: string, aad: string): Promise<string> {
  if (value.length === 0) return value;
  const result = await decryptString(value, aad);
  return result.success && result.data !== undefined ? result.data : value;
}

/**
 * Decrypt a media_items row, decrypting the encrypted original_name column.
 */
async function decryptMediaItemRow(row: MediaItemRow): Promise<MediaItem> {
  const item = mapRowToMediaItem(row);
  item.originalName = await decryptField(row.original_name, `media_name:${row.id}`);
  return item;
}

/**
 * Decrypt an intruder_logs row, decrypting the encrypted device_info column.
 */
async function decryptIntruderLogRow(row: IntruderLogRow): Promise<IntruderLog> {
  const log = mapRowToIntruderLog(row);
  if (row.device_info !== null) {
    const decrypted = await decryptField(row.device_info, `intruder_info:${row.id}`);
    try {
      log.deviceInfo = JSON.parse(decrypted);
    } catch {
      log.deviceInfo = null;
    }
  }
  return log;
}

/**
 * Media items CRUD operations
 */
export const mediaItems = {
  /**
   * Get all media items by type
   */
  async getByType(type: MediaType, isDecoy: boolean): Promise<MediaItem[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<MediaItemRow>(
      `SELECT * FROM media_items WHERE type = ? AND is_decoy = ? ORDER BY created_at DESC`,
      [type, isDecoy ? 1 : 0]
    );

    return Promise.all(rows.map(decryptMediaItemRow));
  },

  /**
   * Get a single media item by ID
   */
  async getById(id: string): Promise<MediaItem | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<MediaItemRow>(
      'SELECT * FROM media_items WHERE id = ?', [id]
    );

    return row !== null ? decryptMediaItemRow(row) : null;
  },

  /**
   * Insert a new media item
   */
  async insert(item: Omit<MediaItem, 'importedAt'>): Promise<void> {
    const database = await getDatabase();
    const now = Date.now();

    // Encrypt original_name before writing
    const encryptedOriginalName = await encryptField(item.originalName, `media_name:${item.id}`);

    await database.runAsync(
      `INSERT INTO media_items (
        id, type, name, encrypted_path, thumbnail_path, original_name,
        mime_type, size_bytes, duration_ms, width, height, key_id,
        created_at, imported_at, is_favorite, is_decoy, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.type,
        item.name,
        item.encryptedPath,
        item.thumbnailPath,
        encryptedOriginalName,
        item.mimeType,
        item.sizeBytes,
        item.durationMs,
        item.width,
        item.height,
        item.keyId,
        item.createdAt,
        now,
        item.isFavorite ? 1 : 0,
        item.isDecoy ? 1 : 0,
        item.metadata !== null ? JSON.stringify(item.metadata) : null,
      ]
    );
  },

  /**
   * Delete media items by IDs
   */
  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const database = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    await database.runAsync(
      `DELETE FROM media_items WHERE id IN (${placeholders})`,
      ids
    );
  },

  /**
   * Toggle favorite status
   */
  async toggleFavorite(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'UPDATE media_items SET is_favorite = NOT is_favorite WHERE id = ?',
      [id]
    );
  },

  /**
   * Batch set favorite status for multiple items
   */
  async setFavorite(ids: string[], isFavorite: boolean): Promise<void> {
    if (ids.length === 0) return;

    const database = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    await database.runAsync(
      `UPDATE media_items SET is_favorite = ? WHERE id IN (${placeholders})`,
      [isFavorite ? 1 : 0, ...ids]
    );
  },

  /**
   * Save playback position for video resume.
   * Pass null to clear the saved position.
   */
  async savePlaybackPosition(id: string, positionMs: number | null): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'UPDATE media_items SET playback_position = ? WHERE id = ?',
      [positionMs, id],
    );
  },

  /**
   * Get saved playback position (returns null if none saved or < 5s).
   */
  async getPlaybackPosition(id: string): Promise<number | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ playback_position: number | null }>(
      'SELECT playback_position FROM media_items WHERE id = ?',
      [id],
    );
    const pos = row?.playback_position ?? null;
    // Ignore positions < 5 seconds (not worth resuming)
    return pos !== null && pos >= 5000 ? pos : null;
  },

  /**
   * Rename a media item's display name
   */
  async rename(id: string, newName: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'UPDATE media_items SET name = ? WHERE id = ?',
      [newName, id]
    );
  },

  /**
   * Get total count by type
   */
  async getCount(type: MediaType, isDecoy: boolean): Promise<number> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM media_items WHERE type = ? AND is_decoy = ?',
      [type, isDecoy ? 1 : 0]
    );
    return result?.count ?? 0;
  },

  /**
   * Get total size in bytes
   */
  async getTotalSize(isDecoy: boolean): Promise<number> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ total: number | null }>(
      'SELECT SUM(size_bytes) as total FROM media_items WHERE is_decoy = ?',
      [isDecoy ? 1 : 0]
    );
    return result?.total ?? 0;
  },
};

/**
 * Intruder logs CRUD operations
 */
export const intruderLogs = {
  /**
   * Insert a new intruder log entry
   */
  async insert(log: IntruderLog): Promise<void> {
    const database = await getDatabase();

    // Encrypt device_info before writing
    let storedDeviceInfo: string | null = null;
    if (log.deviceInfo !== null) {
      storedDeviceInfo = await encryptField(
        JSON.stringify(log.deviceInfo),
        `intruder_info:${log.id}`,
      );
    }

    await database.runAsync(
      `INSERT INTO intruder_logs (id, photo_path, timestamp, failed_pin_hash, device_info, latitude, longitude, city_name, risk_level, failed_attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.photoPath,
        log.timestamp,
        log.failedPinHash,
        storedDeviceInfo,
        log.latitude,
        log.longitude,
        log.cityName,
        log.riskLevel,
        log.failedAttempts,
      ]
    );
  },

  /**
   * Get all intruder logs, newest first
   */
  async getAll(): Promise<IntruderLog[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<IntruderLogRow>(
      'SELECT * FROM intruder_logs ORDER BY timestamp DESC'
    );
    return Promise.all(rows.map(decryptIntruderLogRow));
  },

  /**
   * Get total count of intruder logs
   */
  async getCount(): Promise<number> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM intruder_logs'
    );
    return result?.count ?? 0;
  },

  /**
   * Delete intruder logs by IDs
   */
  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const database = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    await database.runAsync(
      `DELETE FROM intruder_logs WHERE id IN (${placeholders})`,
      ids
    );
  },

  /**
   * Delete all intruder logs
   */
  async deleteAll(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM intruder_logs');
  },
};

/**
 * Albums CRUD operations
 */
export const albums = {
  async create(name: string, isDecoy: boolean): Promise<Album> {
    const database = await getDatabase();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    const now = Date.now();

    await database.runAsync(
      `INSERT INTO albums (id, name, cover_media_id, created_at, is_decoy)
       VALUES (?, ?, NULL, ?, ?)`,
      [id, name, now, isDecoy ? 1 : 0]
    );

    return { id, name, coverMediaId: null, createdAt: now, isDecoy };
  },

  async insertWithId(
    id: string,
    name: string,
    coverMediaId: string | null,
    createdAt: number,
    isDecoy: boolean,
  ): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT OR IGNORE INTO albums (id, name, cover_media_id, created_at, is_decoy)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, coverMediaId, createdAt, isDecoy ? 1 : 0]
    );
  },

  async getAll(isDecoy: boolean): Promise<Album[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{
      id: string;
      name: string;
      cover_media_id: string | null;
      created_at: number;
      is_decoy: number;
    }>(
      'SELECT * FROM albums WHERE is_decoy = ? ORDER BY created_at DESC',
      [isDecoy ? 1 : 0]
    );
    return rows.map(mapRowToAlbum);
  },

  async getById(id: string): Promise<Album | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{
      id: string;
      name: string;
      cover_media_id: string | null;
      created_at: number;
      is_decoy: number;
    }>('SELECT * FROM albums WHERE id = ?', [id]);
    return row !== null ? mapRowToAlbum(row) : null;
  },

  async rename(id: string, newName: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('UPDATE albums SET name = ? WHERE id = ?', [newName, id]);
  },

  async deleteById(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM album_media WHERE album_id = ?', [id]);
    await database.runAsync('DELETE FROM albums WHERE id = ?', [id]);
  },

  async getCount(isDecoy: boolean): Promise<number> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM albums WHERE is_decoy = ?',
      [isDecoy ? 1 : 0]
    );
    return result?.count ?? 0;
  },

  async getMediaCount(albumId: string): Promise<number> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM album_media WHERE album_id = ?',
      [albumId]
    );
    return result?.count ?? 0;
  },

  async getMediaCountsByDecoy(isDecoy: boolean): Promise<Record<string, number>> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{ id: string; count: number }>(
      `SELECT a.id, COUNT(am.media_id) as count FROM albums a
       LEFT JOIN album_media am ON a.id = am.album_id
       WHERE a.is_decoy = ? GROUP BY a.id`,
      [isDecoy ? 1 : 0]
    );
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.id] = row.count;
    }
    return result;
  },

  async updateCover(albumId: string, mediaId: string | null): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'UPDATE albums SET cover_media_id = ? WHERE id = ?',
      [mediaId, albumId]
    );
  },

  async getCoverMediaMap(isDecoy: boolean): Promise<Record<string, CoverMediaInfo>> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{
      album_id: string;
      id: string;
      thumbnail_path: string | null;
      key_id: string;
    }>(
      `SELECT a.id AS album_id, mi.id, mi.thumbnail_path, mi.key_id
       FROM albums a
       INNER JOIN media_items mi ON a.cover_media_id = mi.id
       WHERE a.is_decoy = ?`,
      [isDecoy ? 1 : 0]
    );
    const result: Record<string, CoverMediaInfo> = {};
    for (const row of rows) {
      result[row.album_id] = {
        id: row.id,
        thumbnailPath: row.thumbnail_path,
        keyId: row.key_id,
      };
    }
    return result;
  },
};

/**
 * Album media membership operations
 */
export const albumMedia = {
  async addBatch(albumId: string, mediaIds: string[]): Promise<number> {
    if (mediaIds.length === 0) return 0;
    const database = await getDatabase();
    const now = Date.now();
    let added = 0;
    await database.withTransactionAsync(async () => {
      for (const mediaId of mediaIds) {
        const result = await database.runAsync(
          'INSERT OR IGNORE INTO album_media (album_id, media_id, added_at) VALUES (?, ?, ?)',
          [albumId, mediaId, now]
        );
        if (result.changes > 0) added++;
      }
    });
    return added;
  },

  async add(albumId: string, mediaId: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'INSERT OR IGNORE INTO album_media (album_id, media_id, added_at) VALUES (?, ?, ?)',
      [albumId, mediaId, Date.now()]
    );
  },

  async removeBatch(albumId: string, mediaIds: string[]): Promise<void> {
    if (mediaIds.length === 0) return;
    const database = await getDatabase();
    const placeholders = mediaIds.map(() => '?').join(',');
    await database.runAsync(
      `DELETE FROM album_media WHERE album_id = ? AND media_id IN (${placeholders})`,
      [albumId, ...mediaIds]
    );
  },

  async remove(albumId: string, mediaId: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'DELETE FROM album_media WHERE album_id = ? AND media_id = ?',
      [albumId, mediaId]
    );
  },

  async getMediaIds(albumId: string): Promise<string[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{ media_id: string }>(
      'SELECT media_id FROM album_media WHERE album_id = ? ORDER BY added_at DESC',
      [albumId]
    );
    return rows.map(r => r.media_id);
  },

  async getAssociations(albumId: string): Promise<{ albumId: string; mediaId: string; addedAt: number }[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{
      album_id: string; media_id: string; added_at: number;
    }>(
      'SELECT album_id, media_id, added_at FROM album_media WHERE album_id = ? ORDER BY added_at DESC',
      [albumId]
    );
    return rows.map(r => ({ albumId: r.album_id, mediaId: r.media_id, addedAt: r.added_at }));
  },

  async getMediaItems(albumId: string): Promise<MediaItem[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<MediaItemRow>(
      `SELECT mi.* FROM media_items mi
       INNER JOIN album_media am ON mi.id = am.media_id
       WHERE am.album_id = ? ORDER BY am.added_at DESC`,
      [albumId]
    );
    return Promise.all(rows.map(decryptMediaItemRow));
  },
};

/**
 * Notes CRUD operations
 *
 * Content is encrypted at rest via AES-256-GCM (NOTES-003).
 * - getAll: returns notes with content as empty string (not decrypted for list perf)
 * - getById: decrypts content before returning
 * - insert/update: encrypts content before writing
 */
export const notes = {
  async getAll(isDecoy: boolean): Promise<Note[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<NoteRow>(
      'SELECT * FROM notes WHERE is_decoy = ? ORDER BY updated_at DESC',
      [isDecoy ? 1 : 0]
    );
    return Promise.all(rows.map(async (row) => {
      const note = mapRowToNote(row);
      // Decrypt title
      note.title = await decryptField(row.title, `note_title:${row.id}`);
      // Don't decrypt content for list — return empty for encrypted notes
      note.content = row.is_encrypted === 1 ? '' : row.content;
      return note;
    }));
  },

  async getById(id: string): Promise<Note | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<NoteRow>(
      'SELECT * FROM notes WHERE id = ?', [id],
    );
    if (row === null) return null;

    const note = mapRowToNote(row);
    // Decrypt title
    note.title = await decryptField(row.title, `note_title:${id}`);
    // Decrypt content
    if (row.is_encrypted === 1 && row.content.length > 0) {
      const result = await decryptString(row.content, `note:${id}`);
      if (result.success && result.data !== undefined) {
        note.content = result.data;
      } else {
        note.content = '';
      }
    }
    return note;
  },

  async insert(note: Omit<Note, 'updatedAt' | 'isEncrypted'>): Promise<Note> {
    const database = await getDatabase();
    const now = Date.now();

    // Encrypt title
    const encryptedTitle = await encryptField(note.title, `note_title:${note.id}`);

    let storedContent = note.content;
    let isEncrypted = false;
    if (note.content.length > 0) {
      const result = await encryptString(note.content, `note:${note.id}`);
      if (result.success && result.data !== undefined) {
        storedContent = result.data;
        isEncrypted = true;
      }
    }

    await database.runAsync(
      `INSERT INTO notes (id, title, content, created_at, updated_at, is_decoy, is_encrypted)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [note.id, encryptedTitle, storedContent, note.createdAt, now, note.isDecoy ? 1 : 0, isEncrypted ? 1 : 0]
    );
    return { ...note, updatedAt: now, isEncrypted };
  },

  async update(id: string, title: string, content: string): Promise<void> {
    const database = await getDatabase();
    const now = Date.now();

    // Encrypt title
    const encryptedTitle = await encryptField(title, `note_title:${id}`);

    let storedContent = content;
    let isEncrypted = false;
    if (content.length > 0) {
      const result = await encryptString(content, `note:${id}`);
      if (result.success && result.data !== undefined) {
        storedContent = result.data;
        isEncrypted = true;
      }
    }

    await database.runAsync(
      'UPDATE notes SET title = ?, content = ?, updated_at = ?, is_encrypted = ? WHERE id = ?',
      [encryptedTitle, storedContent, now, isEncrypted ? 1 : 0, id]
    );
  },

  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const database = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    await database.runAsync(
      `DELETE FROM notes WHERE id IN (${placeholders})`,
      ids
    );
  },

  async getCount(isDecoy: boolean): Promise<number> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM notes WHERE is_decoy = ?',
      [isDecoy ? 1 : 0]
    );
    return result?.count ?? 0;
  },
};

/**
 * Map database row to Album interface
 */
function mapRowToAlbum(row: {
  id: string;
  name: string;
  cover_media_id: string | null;
  created_at: number;
  is_decoy: number;
}): Album {
  return {
    id: row.id,
    name: row.name,
    coverMediaId: row.cover_media_id,
    createdAt: row.created_at,
    isDecoy: row.is_decoy === 1,
  };
}

/**
 * Intruder log database row type
 */
type IntruderLogRow = {
  id: string;
  photo_path: string | null;
  timestamp: number;
  failed_pin_hash: string | null;
  device_info: string | null;
  latitude: number | null;
  longitude: number | null;
  city_name: string | null;
  risk_level: string;
  failed_attempts: number;
};

/**
 * Map database row to IntruderLog interface.
 * Note: device_info is returned as-is (encrypted ciphertext).
 * Use decryptIntruderLogRow() for full decryption.
 */
function mapRowToIntruderLog(row: IntruderLogRow): IntruderLog {
  return {
    id: row.id,
    photoPath: row.photo_path,
    timestamp: row.timestamp,
    failedPinHash: row.failed_pin_hash,
    deviceInfo: null, // Decrypted separately by decryptIntruderLogRow
    latitude: row.latitude,
    longitude: row.longitude,
    cityName: row.city_name,
    riskLevel: (row.risk_level as RiskLevel) || 'LOW',
    failedAttempts: row.failed_attempts || 1,
  };
}

/**
 * Note database row type
 */
type NoteRow = {
  id: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
  is_decoy: number;
  is_encrypted: number;
};

/**
 * Map database row to Note interface
 */
function mapRowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDecoy: row.is_decoy === 1,
    isEncrypted: row.is_encrypted === 1,
  };
}

/**
 * Map database row to MediaItem interface
 */
function mapRowToMediaItem(row: {
  id: string;
  type: string;
  name: string;
  encrypted_path: string;
  thumbnail_path: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  key_id: string;
  created_at: number;
  imported_at: number;
  is_favorite: number;
  is_decoy: number;
  metadata: string | null;
  playback_position?: number | null;
}): MediaItem {
  return {
    id: row.id,
    type: row.type as MediaType,
    name: row.name,
    encryptedPath: row.encrypted_path,
    thumbnailPath: row.thumbnail_path,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    durationMs: row.duration_ms,
    width: row.width,
    height: row.height,
    keyId: row.key_id,
    createdAt: row.created_at,
    importedAt: row.imported_at,
    isFavorite: row.is_favorite === 1,
    isDecoy: row.is_decoy === 1,
    metadata: row.metadata !== null ? JSON.parse(row.metadata) : null,
    playbackPosition: row.playback_position ?? null,
  };
}
