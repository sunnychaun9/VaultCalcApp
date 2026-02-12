/**
 * VaultCalc - Storage Service Exports
 *
 * Central export point for storage services.
 */

// MMKV for preferences (fast, synchronous)
export { storage, mmkvStorage, storageUtils } from './mmkv';

// SQLite for file metadata (structured, queryable)
export {
  initializeDatabase,
  closeDatabase,
  mediaItems,
  intruderLogs,
  type MediaItem,
  type MediaType,
  type Album,
  type IntruderLog,
} from './database';
