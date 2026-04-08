/**
 * VaultCalc - Thumbnail Cache Service
 *
 * Manages decrypted thumbnail files for display in the vault grid.
 * Encrypted thumbnails are decrypted to a cache directory on demand;
 * an in-memory map avoids redundant decryption for the same item.
 *
 * Cache is cleared when the vault locks (call `clearThumbnailCache`).
 *
 * @see FEATURE_INDEX.md VAULT-004
 */

import { decryptFile, getVaultDirectory } from '@services/crypto';

/** Subdirectory under the vault dir for cached (decrypted) thumbnails */
const CACHE_SUBDIR = 'thumbcache';

/**
 * LRU cache: MediaItem id → resolved decrypted path (or null if failed).
 * Capped at MAX_ENTRIES to prevent unbounded memory growth for large vaults.
 * Least-recently-accessed entries are evicted first.
 */
const MAX_ENTRIES = 500;
const cache = new Map<string, string | null>();

/** Touch an entry to mark it as recently used (move to end of Map insertion order). */
function cacheTouchAndGet(key: string): string | null | undefined {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key)!;
  // Map iteration order is insertion order — delete + re-set moves to end
  cache.delete(key);
  cache.set(key, value);
  return value;
}

/** Set a cache entry, evicting the oldest if at capacity. */
function cacheSet(key: string, value: string | null): void {
  // If key already exists, delete first so the re-set puts it at the end
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  // Evict oldest entries (first in iteration order) if over limit
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/**
 * In-flight decrypt promises keyed by item id.
 * Ensures only one decrypt runs per item at a time.
 */
const pending = new Map<string, Promise<string | null>>();

/**
 * Resolve the cache directory path (lazily).
 */
let cachedDir: string | null = null;

async function getCacheDir(): Promise<string> {
  if (cachedDir !== null) return cachedDir;
  const result = await getVaultDirectory();
  if (!result.success || !result.data) {
    throw new Error('Failed to resolve vault directory');
  }
  cachedDir = `${result.data}/${CACHE_SUBDIR}`;
  return cachedDir;
}

/**
 * Get the decrypted thumbnail path for a media item.
 *
 * - Returns immediately from memory cache if already decrypted.
 * - Otherwise decrypts the encrypted thumbnail to the cache dir.
 * - Returns `null` if the item has no thumbnail or decryption fails.
 *
 * @param id       MediaItem.id (also used as the cache key)
 * @param thumbPath MediaItem.thumbnailPath (encrypted .thumb file)
 * @param keyId    MediaItem.keyId (decryption context)
 */
export async function getDecryptedThumbnail(
  id: string,
  thumbPath: string | null,
  keyId: string,
): Promise<string | null> {
  if (thumbPath === null) return null;

  // 1. Already cached in memory (touch to mark as recently used)
  const cached = cacheTouchAndGet(id);
  if (cached !== undefined) return cached;

  // 2. Decrypt already in flight — wait for it
  const inflight = pending.get(id);
  if (inflight) return inflight;

  // 3. Kick off decryption
  const promise = (async (): Promise<string | null> => {
    try {
      const dir = await getCacheDir();
      const destPath = `${dir}/${id}.jpg`;
      const result = await decryptFile(thumbPath, destPath, keyId);
      const resolved = result.success ? destPath : null;
      cacheSet(id, resolved);
      return resolved;
    } catch {
      cacheSet(id, null);
      return null;
    } finally {
      pending.delete(id);
    }
  })();

  pending.set(id, promise);
  return promise;
}

/**
 * Synchronously check the in-memory cache for a decrypted thumbnail.
 * Returns the cached path, null if decryption previously failed,
 * or undefined if the item has not been decrypted yet.
 */
export function getCachedThumbnailSync(id: string): string | null | undefined {
  return cacheTouchAndGet(id);
}

/**
 * Clear the in-memory cache and securely delete all cached thumbnail files.
 * Call this when the vault locks to remove decrypted data from disk.
 *
 * Sweeps the entire thumbcache directory to catch any files the in-memory
 * map may have missed (e.g. from a previous session or crash).
 */
export async function clearThumbnailCache(): Promise<void> {
  // Snapshot the dir before clearing state — we need it for the directory sweep
  const dir = cachedDir;

  // Clear memory state
  cache.clear();
  pending.clear();
  cachedDir = null;

  // Best-effort directory sweep via native secure delete
  if (dir) {
    try {
      const { secureDeleteDirectoryContents } = await import('@services/media');
      await secureDeleteDirectoryContents(dir);
    } catch {
      // Best-effort — secure delete handles overwrite on native side
    }
  }
}
