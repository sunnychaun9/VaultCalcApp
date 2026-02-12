/**
 * VaultCalc - Share Service
 *
 * High-level service for sharing vault items via Android's native share sheet.
 * Handles decryption to temp files, sharing, and cleanup.
 *
 * @see FEATURE_INDEX.md ENH-001
 */

import { NativeShare } from './nativeShare';
import { decryptFile, decryptFileStreaming, getVaultDirectory } from '@services/crypto';
import { secureDeleteDirectoryContents } from '@services/media';
import type { MediaItem } from '@services/storage/database';

/**
 * Result of a batch share operation
 */
export interface ShareResult {
  success: boolean;
  shared: number;
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
 * Share one or more media items via the native share sheet.
 * Decrypts items to temp files, shares them, then cleans up.
 *
 * @param items Media items to share
 * @returns Share result with success/failure counts
 */
export async function shareMediaItems(items: MediaItem[]): Promise<ShareResult> {
  const result: ShareResult = {
    success: false,
    shared: 0,
    failed: [],
  };

  if (items.length === 0) {
    return result;
  }

  // Get vault directory for temp files
  const vaultDirResult = await getVaultDirectory();
  if (!vaultDirResult.success || !vaultDirResult.data) {
    result.failed = items.map(item => ({
      id: item.id,
      name: item.originalName,
      error: 'Could not access vault directory',
    }));
    return result;
  }

  const shareDir = `${vaultDirResult.data}/share_temp`;
  const tempPaths: string[] = [];

  try {
    // Decrypt all items to temp files in the share_temp subdirectory
    const decryptedItems: { path: string; mimeType: string }[] = [];

    for (const item of items) {
      const ext = getExtension(item.originalName);
      const tempPath = `${shareDir}/${item.id}${ext}`;

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

      tempPaths.push(tempPath);
      decryptedItems.push({ path: tempPath, mimeType: item.mimeType });
      result.shared++;
    }

    if (decryptedItems.length === 0) {
      return result;
    }

    // Share via native module
    if (decryptedItems.length === 1) {
      await NativeShare.shareFile(
        decryptedItems[0].path,
        decryptedItems[0].mimeType,
        'Share file',
      );
    } else {
      await NativeShare.shareFiles(
        decryptedItems.map(d => d.path),
        decryptedItems.map(d => d.mimeType),
        'Share files',
      );
    }

    result.success = true;
  } finally {
    // Securely wipe temp files after a short delay to let the share intent read them.
    // Uses random-overwrite + sync before unlinking to minimize the plaintext window.
    setTimeout(async () => {
      try {
        await secureDeleteDirectoryContents(shareDir);
      } catch {
        // Best-effort cleanup — temp files will be overwritten on next share
      }
    }, 5000);
  }

  return result;
}

/**
 * Share a note's content as plain text via the native share sheet.
 *
 * @param title Note title (used as share subject)
 * @param content Note text content
 */
export async function shareNoteAsText(title: string, content: string): Promise<void> {
  const text = title ? `${title}\n\n${content}` : content;
  await NativeShare.shareText(text, title || 'Share note');
}
