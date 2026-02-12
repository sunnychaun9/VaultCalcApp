/**
 * VaultCalc - Backup Service
 *
 * Creates encrypted backup manifests and file inventories for cloud backup.
 * Never throws — returns result objects.
 *
 * @see FEATURE_INDEX.md CLOUD-002
 */

import { encryptString, decryptString } from '@services/crypto';
import { mediaItems, albums, albumMedia, type MediaItem, type Album } from '@services/storage/database';
import {
  BACKUP_MANIFEST_VERSION,
  MANIFEST_ASSOCIATED_DATA,
  type BackupMediaItem,
  type BackupAlbum,
  type BackupAlbumMedia,
  type BackupManifest,
  type BackupFileEntry,
  type BackupResult,
  type ManifestDecryptResult,
} from './types';

/**
 * Create an encrypted backup of all non-decoy vault data.
 * Queries the DB, builds a manifest, encrypts it, and returns a file list for upload.
 */
export async function createEncryptedBackup(): Promise<BackupResult> {
  try {
    // 1. Query all non-decoy media items (all types in parallel)
    const [photos, videos, documents] = await Promise.all([
      mediaItems.getByType('photo', false),
      mediaItems.getByType('video', false),
      mediaItems.getByType('document', false),
    ]);
    const allMedia = [...photos, ...videos, ...documents];

    // 2. Query all non-decoy albums and their associations
    const allAlbums = await albums.getAll(false);
    const allAlbumMedia: BackupAlbumMedia[] = [];
    for (const album of allAlbums) {
      const associations = await albumMedia.getAssociations(album.id);
      for (const assoc of associations) {
        allAlbumMedia.push(assoc);
      }
    }

    // 3. Assemble manifest
    const manifest: BackupManifest = {
      version: BACKUP_MANIFEST_VERSION,
      createdAt: Date.now(),
      mediaItems: allMedia.map(toBackupMediaItem),
      albums: allAlbums.map(toBackupAlbum),
      albumMedia: allAlbumMedia,
    };

    // 4. Encrypt manifest
    const json = JSON.stringify(manifest);
    const encryptResult = await encryptString(json, MANIFEST_ASSOCIATED_DATA);
    if (!encryptResult.success || encryptResult.data === undefined) {
      return { success: false, error: encryptResult.error?.message ?? 'Encryption failed' };
    }

    // 5. Build file list
    const files = buildFileList(allMedia);
    const totalSizeBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);

    return {
      success: true,
      encryptedManifest: encryptResult.data,
      files,
      totalSizeBytes,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Decrypt and parse a backup manifest.
 * Validates version for forward compatibility.
 */
export async function decryptBackupManifest(encrypted: string): Promise<ManifestDecryptResult> {
  try {
    // 1. Decrypt
    const decryptResult = await decryptString(encrypted, MANIFEST_ASSOCIATED_DATA);
    if (!decryptResult.success || decryptResult.data === undefined) {
      return { success: false, error: decryptResult.error?.message ?? 'Decryption failed' };
    }

    // 2. Parse
    const manifest: BackupManifest = JSON.parse(decryptResult.data);

    // 3. Validate
    if (typeof manifest.version !== 'number' || !Array.isArray(manifest.mediaItems)) {
      return { success: false, error: 'Invalid manifest format' };
    }

    if (manifest.version > BACKUP_MANIFEST_VERSION) {
      return { success: false, error: 'Backup was created by a newer version of VaultCalc. Please update the app.' };
    }

    return { success: true, manifest };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Map MediaItem to BackupMediaItem (strip device-specific fields) */
function toBackupMediaItem(item: MediaItem): BackupMediaItem {
  return {
    id: item.id,
    type: item.type,
    name: item.name,
    originalName: item.originalName,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    durationMs: item.durationMs,
    width: item.width,
    height: item.height,
    keyId: item.keyId,
    createdAt: item.createdAt,
    importedAt: item.importedAt,
    isFavorite: item.isFavorite,
    metadata: item.metadata,
  };
}

/** Map Album to BackupAlbum (strip isDecoy) */
function toBackupAlbum(album: Album): BackupAlbum {
  return {
    id: album.id,
    name: album.name,
    coverMediaId: album.coverMediaId,
    createdAt: album.createdAt,
  };
}

/** Build file list from media items (encrypted files + thumbnails) */
function buildFileList(allMedia: MediaItem[]): BackupFileEntry[] {
  const files: BackupFileEntry[] = [];

  for (const item of allMedia) {
    // Encrypted media file
    files.push({
      id: item.id,
      localPath: item.encryptedPath,
      isThumbnail: false,
      sizeBytes: item.sizeBytes,
    });

    // Encrypted thumbnail (if exists)
    if (item.thumbnailPath) {
      files.push({
        id: item.id,
        localPath: item.thumbnailPath,
        isThumbnail: true,
        sizeBytes: 0, // Thumbnail size not tracked in DB; CLOUD-003 will stat
      });
    }
  }

  return files;
}
