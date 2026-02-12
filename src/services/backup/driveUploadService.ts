/**
 * VaultCalc - Drive Upload Service
 *
 * Uploads encrypted backup files to a "VaultCalc" folder on Google Drive.
 * Uses REST API v3 with multipart upload. Never throws — returns result objects.
 *
 * @see FEATURE_INDEX.md CLOUD-003
 */

import { getAccessToken } from '@services/googleDrive';
import { NativeMedia } from '@services/media/nativeMedia';
import { createEncryptedBackup } from './backupService';
import type {
  BackupFileEntry,
  BackupUploadOptions,
  BackupUploadFailure,
  BackupUploadResult,
} from './types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FOLDER_NAME = 'VaultCalc';

/**
 * Find or create the "VaultCalc" app folder on Google Drive.
 * Returns the folder's Drive file ID.
 */
async function ensureAppFolder(token: string): Promise<{ id: string } | { error: string }> {
  try {
    // Search for existing folder
    const q = encodeURIComponent(
      `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`,
    );
    const searchRes = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)&spaces=drive`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!searchRes.ok) {
      return { error: `Drive search failed: ${searchRes.status}` };
    }

    const searchData: { files: Array<{ id: string }> } = await searchRes.json();
    if (searchData.files.length > 0) {
      return { id: searchData.files[0].id };
    }

    // Create folder
    const createRes = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: FOLDER_MIME,
      }),
    });

    if (!createRes.ok) {
      return { error: `Drive folder creation failed: ${createRes.status}` };
    }

    const createData: { id: string } = await createRes.json();
    return { id: createData.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Upload an in-memory string (e.g. encrypted manifest) to Drive.
 * Two-step: create metadata → PATCH content.
 */
async function uploadStringToDrive(
  token: string,
  folderId: string,
  fileName: string,
  content: string,
): Promise<{ id: string } | { error: string }> {
  try {
    // Step 1: Create file metadata
    const metaRes = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId],
      }),
    });

    if (!metaRes.ok) {
      return { error: `Manifest metadata creation failed: ${metaRes.status}` };
    }

    const metaData: { id: string } = await metaRes.json();

    // Step 2: Upload content
    const uploadRes = await fetch(
      `${DRIVE_UPLOAD_API}/files/${metaData.id}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: content,
      },
    );

    if (!uploadRes.ok) {
      return { error: `Manifest content upload failed: ${uploadRes.status}` };
    }

    return { id: metaData.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Upload a local file to Drive via two-step: create metadata → PATCH content with file URI.
 * Uses fetch with file:// URI so RN streams from disk without loading into JS memory.
 */
async function uploadFileToDrive(
  token: string,
  folderId: string,
  fileName: string,
  localPath: string,
): Promise<{ id: string } | { error: string }> {
  try {
    // Step 1: Create file metadata
    const metaRes = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId],
      }),
    });

    if (!metaRes.ok) {
      return { error: `File metadata creation failed: ${metaRes.status}` };
    }

    const metaData: { id: string } = await metaRes.json();

    // Step 2: Upload file content from disk
    // RN fetch supports file:// URIs — streams from disk, no JS memory bloat
    const fileUri = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
    const uploadRes = await fetch(
      `${DRIVE_UPLOAD_API}/files/${metaData.id}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: { uri: fileUri } as any,
      },
    );

    if (!uploadRes.ok) {
      return { error: `File upload failed: ${uploadRes.status}` };
    }

    return { id: metaData.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Derive Drive filename from a backup file entry */
function getDriveFileName(entry: BackupFileEntry): string {
  return entry.isThumbnail ? `${entry.id}_thumb.enc` : `${entry.id}.enc`;
}

/**
 * Upload a full encrypted backup to Google Drive.
 *
 * Flow:
 * 1. Get access token
 * 2. Create encrypted backup (manifest + file list)
 * 3. Stat thumbnails to fill in sizeBytes
 * 4. Find/create "VaultCalc" folder
 * 5. Upload manifest (critical — abort on failure)
 * 6. Upload each file, tracking failures
 * 7. Return result
 */
export async function uploadBackupToDrive(
  options?: BackupUploadOptions,
): Promise<BackupUploadResult> {
  const onProgress = options?.onProgress;

  try {
    // Phase: preparing
    onProgress?.({ phase: 'preparing', current: 0, total: 0, currentLabel: 'Preparing backup...' });

    // 1. Get access token
    const tokenResult = await getAccessToken();
    if (!tokenResult.success || !tokenResult.token) {
      return { success: false, error: tokenResult.error ?? 'Failed to get access token' };
    }
    const token = tokenResult.token;

    // 2. Create encrypted backup
    const backupResult = await createEncryptedBackup();
    if (!backupResult.success || !backupResult.encryptedManifest || !backupResult.files) {
      return { success: false, error: backupResult.error ?? 'Failed to create backup' };
    }

    const { encryptedManifest, files } = backupResult;

    // 3. Stat thumbnails to fill in sizeBytes: 0 entries
    for (const file of files) {
      if (file.sizeBytes === 0) {
        const size = await NativeMedia.getFileSize(file.localPath);
        if (size > 0) {
          file.sizeBytes = size;
        }
      }
    }

    // 4. Find/create app folder
    const folderResult = await ensureAppFolder(token);
    if ('error' in folderResult) {
      return { success: false, error: folderResult.error };
    }
    const folderId = folderResult.id;

    // 5. Upload manifest (critical)
    const manifestResult = await uploadStringToDrive(token, folderId, 'manifest.json.enc', encryptedManifest);
    if ('error' in manifestResult) {
      return { success: false, error: `Manifest upload failed: ${manifestResult.error}` };
    }

    // 6. Upload files with progress
    const total = files.length;
    const failures: BackupUploadFailure[] = [];
    let uploadedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const driveName = getDriveFileName(file);

      onProgress?.({
        phase: 'uploading',
        current: i + 1,
        total,
        currentLabel: driveName,
      });

      const fileResult = await uploadFileToDrive(token, folderId, driveName, file.localPath);
      if ('error' in fileResult) {
        failures.push({ id: file.id, label: driveName, error: fileResult.error });
      } else {
        uploadedCount++;
      }
    }

    // 7. Complete
    onProgress?.({ phase: 'complete', current: total, total, currentLabel: '' });

    return {
      success: failures.length === 0,
      uploadedCount,
      totalCount: total,
      failures: failures.length > 0 ? failures : undefined,
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
