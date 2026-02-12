/**
 * VaultCalc - Import Service
 *
 * Orchestrates the file import pipeline:
 * pick → generate ID → encrypt → store to disk → record metadata.
 *
 * @see FEATURE_INDEX.md FILE-002
 */

import type { PickedFile } from '@services/filePicker';
import { mediaItems, type MediaType } from '@services/storage/database';
import { encryptFile, encryptFileStreaming, generateKey, getVaultDirectory } from '@services/crypto';
import { generateThumbnail, generateVideoThumbnail, deleteFile, deleteContentUri } from '@services/media';
import { generatePdfThumbnail } from '@services/pdf';

/**
 * Progress update for the import operation (FILE-010)
 */
export interface ImportProgress {
  /** 1-based index of the file currently being processed */
  current: number;
  /** Total number of files in the batch */
  total: number;
  /** Name of the file currently being processed */
  currentFileName: string;
}

/**
 * Options for the import operation
 */
export interface ImportOptions {
  /** Whether to delete original source files after successful import (FILE-009) */
  deleteOriginals?: boolean;
  /** Called after each file is processed (FILE-010) */
  onProgress?: (progress: ImportProgress) => void;
  /** Whether items are being imported into the decoy vault (DECOY-002) */
  isDecoy?: boolean;
}

/**
 * Result of an import operation
 */
export interface ImportResult {
  total: number;
  imported: number;
  failed: { name: string; error: string }[];
  /** Number of original source files successfully deleted (FILE-009) */
  originalsDeleted: number;
  /** Number of originals that could not be deleted (permission denied, cloud files, etc.) */
  originalsDeleteFailed: number;
}

/** Map MediaType → subdirectory under vault */
const TYPE_SUBDIR: Record<MediaType, string> = {
  photo: 'photos',
  video: 'videos',
  document: 'documents',
};

/** Subdirectory for thumbnails */
const THUMBNAIL_SUBDIR = 'thumbnails';

/**
 * Convert a base64 string to a hex string (for use as file IDs).
 */
function base64ToHex(b64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bits = '';
  for (const c of b64) {
    if (c === '=') break;
    const idx = chars.indexOf(c);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(6, '0');
  }
  let hex = '';
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    hex += parseInt(bits.substring(i, i + 4), 2).toString(16);
  }
  return hex;
}

/**
 * Import files into the vault.
 *
 * For each file:
 * 1. Generate a unique ID (16 random bytes → hex)
 * 2. Build destination path: {vaultDir}/{typeSubdir}/{id}.enc
 * 3. Encrypt file natively (content URI → encrypted file on disk)
 * 4. Insert metadata into SQLite
 *
 * Continues on individual file failures; returns a summary.
 */
export async function importFiles(
  files: PickedFile[],
  mediaType: MediaType,
  options?: ImportOptions,
): Promise<ImportResult> {
  const result: ImportResult = {
    total: files.length,
    imported: 0,
    failed: [],
    originalsDeleted: 0,
    originalsDeleteFailed: 0,
  };

  // Get vault directory
  const vaultDirResult = await getVaultDirectory();
  if (!vaultDirResult.success || !vaultDirResult.data) {
    return {
      ...result,
      failed: files.map(f => ({ name: f.name, error: 'Failed to resolve vault directory' })),
    };
  }
  const vaultDir = vaultDirResult.data;
  const subdir = TYPE_SUBDIR[mediaType];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    options?.onProgress?.({ current: i + 1, total: files.length, currentFileName: file.name });

    try {
      // 1. Generate unique file ID
      const keyResult = await generateKey(16);
      if (!keyResult.success || !keyResult.data) {
        result.failed.push({ name: file.name, error: 'Failed to generate file ID' });
        continue;
      }
      const fileId = base64ToHex(keyResult.data);

      // 2. Build destination path
      const destPath = `${vaultDir}/${subdir}/${fileId}.enc`;

      // 3. Encrypt file (native side: read URI → encrypt → write)
      // Use streaming AEAD for videos to handle large files (VIDEO-001)
      const encryptFn = mediaType === 'video' ? encryptFileStreaming : encryptFile;
      const encryptResult = await encryptFn(file.uri, destPath, fileId);
      if (!encryptResult.success) {
        result.failed.push({
          name: file.name,
          error: encryptResult.error?.message ?? 'Encryption failed',
        });
        continue;
      }

      // 4. Generate thumbnail (photos & videos — soft failure)
      let thumbnailPath: string | null = null;
      let width: number | null = null;
      let height: number | null = null;
      let durationMs: number | null = null;

      if (mediaType === 'photo') {
        const thumbTemp = `${vaultDir}/${THUMBNAIL_SUBDIR}/${fileId}.tmp`;
        const thumbDest = `${vaultDir}/${THUMBNAIL_SUBDIR}/${fileId}.thumb`;
        const thumbResult = await generateThumbnail(file.uri, thumbTemp);
        if (thumbResult.success && thumbResult.data) {
          const encThumbResult = await encryptFile(thumbTemp, thumbDest, fileId);
          await deleteFile(thumbTemp);
          if (encThumbResult.success) {
            thumbnailPath = thumbDest;
            width = thumbResult.data.width;
            height = thumbResult.data.height;
          }
        }
      } else if (mediaType === 'video') {
        // VIDEO-002: Extract frame thumbnail + video metadata
        const thumbTemp = `${vaultDir}/${THUMBNAIL_SUBDIR}/${fileId}.tmp`;
        const thumbDest = `${vaultDir}/${THUMBNAIL_SUBDIR}/${fileId}.thumb`;
        const thumbResult = await generateVideoThumbnail(file.uri, thumbTemp);
        if (thumbResult.success && thumbResult.data) {
          const encThumbResult = await encryptFile(thumbTemp, thumbDest, fileId);
          await deleteFile(thumbTemp);
          if (encThumbResult.success) {
            thumbnailPath = thumbDest;
            width = thumbResult.data.videoWidth || thumbResult.data.width;
            height = thumbResult.data.videoHeight || thumbResult.data.height;
          }
          durationMs = thumbResult.data.durationMs || null;
        }
      } else if (mediaType === 'document' && file.mimeType === 'application/pdf') {
        // DOC-004: Generate first-page thumbnail for PDF documents
        const thumbTemp = `${vaultDir}/${THUMBNAIL_SUBDIR}/${fileId}.tmp`;
        const thumbDest = `${vaultDir}/${THUMBNAIL_SUBDIR}/${fileId}.thumb`;
        const thumbResult = await generatePdfThumbnail(file.uri, thumbTemp);
        if (thumbResult.success && thumbResult.data) {
          const encThumbResult = await encryptFile(thumbTemp, thumbDest, fileId);
          await deleteFile(thumbTemp);
          if (encThumbResult.success) {
            thumbnailPath = thumbDest;
            width = thumbResult.data.width;
            height = thumbResult.data.height;
          }
        }
      }

      // 5. Insert metadata into SQLite
      await mediaItems.insert({
        id: fileId,
        type: mediaType,
        name: file.name,
        encryptedPath: destPath,
        thumbnailPath,
        originalName: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.size,
        durationMs,
        width,
        height,
        keyId: fileId,
        createdAt: Date.now(),
        isFavorite: false,
        isDecoy: options?.isDecoy ?? false,
        metadata: null,
      });

      result.imported++;

      // Delete original source file if requested (FILE-009)
      if (options?.deleteOriginals) {
        const deleted = await deleteContentUri(file.uri);
        if (deleted) {
          result.originalsDeleted++;
        } else {
          result.originalsDeleteFailed++;
        }
      }
    } catch (e) {
      result.failed.push({
        name: file.name,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}
