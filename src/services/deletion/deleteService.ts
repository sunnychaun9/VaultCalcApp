/**
 * VaultCalc - Deletion Service
 *
 * Orchestrates file deletion: removes encrypted files and thumbnails
 * from disk, then removes the database records.
 *
 * @see FEATURE_INDEX.md FILE-006
 */

import { deleteFile } from '@services/media';
import { mediaItems, type MediaItem } from '@services/storage/database';

/**
 * Result of a batch delete operation
 */
export interface DeleteResult {
  total: number;
  deleted: number;
  failed: { id: string; name: string; error: string }[];
}

/**
 * Delete multiple media items: remove encrypted files + thumbnails from disk,
 * then delete successfully-cleaned items from the database.
 */
export async function deleteMediaItems(items: MediaItem[]): Promise<DeleteResult> {
  const result: DeleteResult = {
    total: items.length,
    deleted: 0,
    failed: [],
  };

  const successIds: string[] = [];

  for (const item of items) {
    try {
      const fileDeleted = await deleteFile(item.encryptedPath);
      if (!fileDeleted) {
        result.failed.push({ id: item.id, name: item.name, error: 'Failed to delete encrypted file' });
        continue;
      }

      if (item.thumbnailPath !== null) {
        // Best-effort thumbnail cleanup — don't fail the whole item if thumb is already gone
        await deleteFile(item.thumbnailPath);
      }

      successIds.push(item.id);
      result.deleted++;
    } catch (e) {
      result.failed.push({
        id: item.id,
        name: item.name,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (successIds.length > 0) {
    await mediaItems.deleteByIds(successIds);
  }

  return result;
}
