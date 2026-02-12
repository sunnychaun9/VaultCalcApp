/**
 * VaultCalc - Unhide (Export to Gallery) Service
 *
 * Decrypts selected vault media items and saves them back to the
 * device's public gallery via MediaStore. Does NOT delete from vault.
 */

import { NativeMedia, deleteFile } from '@services/media';
import { decryptFile, decryptFileStreaming, getVaultDirectory } from '@services/crypto';
import type { MediaItem } from '@services/storage/database';

export interface UnhideResult {
  total: number;
  saved: number;
  failed: { id: string; name: string; error: string }[];
}

/**
 * Extract file extension including the dot, e.g. ".jpg"
 */
function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.substring(dot) : '';
}

/**
 * Decrypt vault media items and save them to the device gallery.
 *
 * Flow per item:
 * 1. Decrypt to temp file
 * 2. Save to public storage via NativeMedia.saveToPublicStorage
 * 3. Delete temp file
 */
export async function unhideMediaItems(items: MediaItem[]): Promise<UnhideResult> {
  const result: UnhideResult = {
    total: items.length,
    saved: 0,
    failed: [],
  };

  if (items.length === 0) return result;

  const vaultDirResult = await getVaultDirectory();
  if (!vaultDirResult.success || !vaultDirResult.data) {
    result.failed = items.map(item => ({
      id: item.id,
      name: item.originalName,
      error: 'Could not access vault directory',
    }));
    return result;
  }

  const vaultDir = vaultDirResult.data;

  for (const item of items) {
    const ext = getExtension(item.originalName);
    const tempPath = `${vaultDir}/unhide_${item.id}${ext}`;

    try {
      // Step 1: Decrypt to temp
      const decryptFn = item.type === 'video' ? decryptFileStreaming : decryptFile;
      const decryptResult = await decryptFn(
        item.encryptedPath,
        tempPath,
        item.keyId,
      );

      if (!decryptResult.success) {
        result.failed.push({
          id: item.id,
          name: item.originalName,
          error: 'Failed to decrypt file',
        });
        continue;
      }

      // Step 2: Save to gallery
      await NativeMedia.saveToPublicStorage(tempPath, item.originalName, item.mimeType);
      result.saved++;
    } catch (e) {
      result.failed.push({
        id: item.id,
        name: item.originalName,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      // Step 3: Clean up temp
      await deleteFile(tempPath);
    }
  }

  return result;
}
