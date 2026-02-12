/**
 * VaultCalc - Drive Restore Service
 *
 * Downloads encrypted backup files from a "VaultCalc" folder on Google Drive
 * and registers the metadata in the database.
 * Never throws — returns result objects.
 *
 * @see FEATURE_INDEX.md CLOUD-004
 */

import { getAccessToken } from '@services/googleDrive';
import { getVaultDirectory } from '@services/crypto';
import { NativeMedia } from '@services/media/nativeMedia';
import { mediaItems, albums, albumMedia, type MediaType } from '@services/storage/database';
import { decryptBackupManifest } from './backupService';
import type {
  BackupMediaItem,
  RestoreOptions,
  RestoreFailure,
  RestoreResult,
} from './types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FOLDER_NAME = 'VaultCalc';

interface DriveFile {
  id: string;
  name: string;
}

/** Map MediaType to subdirectory under vault */
const TYPE_SUBDIR: Record<MediaType, string> = {
  photo: 'photos',
  video: 'videos',
  document: 'documents',
};

/**
 * Find the "VaultCalc" folder on Google Drive.
 * Does NOT create one — returns error if not found.
 */
async function findAppFolder(
  token: string,
): Promise<{ id: string } | { error: string }> {
  try {
    const q = encodeURIComponent(
      `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`,
    );
    const res = await fetch(
      `${DRIVE_API}/files?q=${q}&fields=files(id)&spaces=drive`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) {
      return { error: `Drive search failed: ${res.status}` };
    }

    const data: { files: Array<{ id: string }> } = await res.json();
    if (data.files.length === 0) {
      return { error: 'No VaultCalc backup folder found on Google Drive' };
    }

    return { id: data.files[0].id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * List all files in a Drive folder.
 * Handles pagination via nextPageToken.
 */
async function listDriveFiles(
  token: string,
  folderId: string,
): Promise<{ files: DriveFile[] } | { error: string }> {
  try {
    const allFiles: DriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
      let url = `${DRIVE_API}/files?q=${q}&fields=nextPageToken,files(id,name)&pageSize=1000`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        return { error: `Drive list failed: ${res.status}` };
      }

      const data: {
        files: DriveFile[];
        nextPageToken?: string;
      } = await res.json();
      allFiles.push(...data.files);
      pageToken = data.nextPageToken;
    } while (pageToken);

    return { files: allFiles };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Download a Drive file's content as text (for manifest).
 */
async function downloadDriveString(
  token: string,
  driveFileId: string,
): Promise<{ text: string } | { error: string }> {
  try {
    const res = await fetch(
      `${DRIVE_API}/files/${driveFileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) {
      return { error: `Download failed: ${res.status}` };
    }

    const text = await res.text();
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Restore a full backup from Google Drive.
 *
 * Flow:
 * 1. Get access token
 * 2. Find "VaultCalc" folder (fail if not found)
 * 3. List all files in folder
 * 4. Download & decrypt manifest
 * 5. For each media item not in DB: download file + thumbnail, insert into DB
 * 6. Restore albums & album_media associations
 * 7. Return result
 */
export async function restoreBackupFromDrive(
  options?: RestoreOptions,
): Promise<RestoreResult> {
  const onProgress = options?.onProgress;

  try {
    // Phase: preparing
    onProgress?.({ phase: 'preparing', current: 0, total: 0, currentLabel: 'Preparing restore...' });

    // 1. Get access token
    const tokenResult = await getAccessToken();
    if (!tokenResult.success || !tokenResult.token) {
      return { success: false, error: tokenResult.error ?? 'Failed to get access token' };
    }
    const token = tokenResult.token;

    // 2. Find app folder
    const folderResult = await findAppFolder(token);
    if ('error' in folderResult) {
      return { success: false, error: folderResult.error };
    }
    const folderId = folderResult.id;

    // 3. List all files
    const listResult = await listDriveFiles(token, folderId);
    if ('error' in listResult) {
      return { success: false, error: listResult.error };
    }
    const driveFiles = listResult.files;

    // 4. Find & download manifest
    const manifestFile = driveFiles.find(f => f.name === 'manifest.json.enc');
    if (!manifestFile) {
      return { success: false, error: 'Manifest file not found in backup' };
    }

    const manifestResult = await downloadDriveString(token, manifestFile.id);
    if ('error' in manifestResult) {
      return { success: false, error: `Manifest download failed: ${manifestResult.error}` };
    }

    const decryptResult = await decryptBackupManifest(manifestResult.text);
    if (!decryptResult.success || !decryptResult.manifest) {
      return { success: false, error: decryptResult.error ?? 'Failed to decrypt manifest' };
    }
    const manifest = decryptResult.manifest;

    // 5. Get vault directory
    const vaultDirResult = await getVaultDirectory();
    if (!vaultDirResult.success || !vaultDirResult.data) {
      return { success: false, error: 'Failed to resolve vault directory' };
    }
    const vaultDir = vaultDirResult.data;

    // Build a lookup map for Drive files by name
    const driveFileMap = new Map<string, string>();
    for (const df of driveFiles) {
      driveFileMap.set(df.name, df.id);
    }

    // 6. Restore media items
    const total = manifest.mediaItems.length;
    const failures: RestoreFailure[] = [];
    let restoredCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < manifest.mediaItems.length; i++) {
      const item: BackupMediaItem = manifest.mediaItems[i];

      onProgress?.({
        phase: 'downloading',
        current: i + 1,
        total,
        currentLabel: item.name,
      });

      // Skip if already in DB (idempotent restore)
      const existing = await mediaItems.getById(item.id);
      if (existing !== null) {
        skippedCount++;
        continue;
      }

      // Download media file
      const mediaFileName = `${item.id}.enc`;
      const mediaDriveId = driveFileMap.get(mediaFileName);
      if (!mediaDriveId) {
        failures.push({ id: item.id, label: item.name, error: 'File not found on Drive' });
        continue;
      }

      const subdir = TYPE_SUBDIR[item.type];
      const destPath = `${vaultDir}/${subdir}/${item.id}.enc`;
      const downloadUrl = `${DRIVE_API}/files/${mediaDriveId}?alt=media`;

      const downloaded = await NativeMedia.downloadFile(downloadUrl, token, destPath);
      if (!downloaded) {
        failures.push({ id: item.id, label: item.name, error: 'Download failed' });
        continue;
      }

      // Download thumbnail (optional — soft failure)
      let thumbnailPath: string | null = null;
      const thumbFileName = `${item.id}_thumb.enc`;
      const thumbDriveId = driveFileMap.get(thumbFileName);
      if (thumbDriveId) {
        const thumbDest = `${vaultDir}/thumbnails/${item.id}.thumb`;
        const thumbUrl = `${DRIVE_API}/files/${thumbDriveId}?alt=media`;
        const thumbOk = await NativeMedia.downloadFile(thumbUrl, token, thumbDest);
        if (thumbOk) {
          thumbnailPath = thumbDest;
        }
      }

      // Insert into database
      try {
        await mediaItems.insert({
          id: item.id,
          type: item.type,
          name: item.name,
          encryptedPath: destPath,
          thumbnailPath,
          originalName: item.originalName,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          durationMs: item.durationMs,
          width: item.width,
          height: item.height,
          keyId: item.keyId,
          createdAt: item.createdAt,
          isFavorite: item.isFavorite,
          isDecoy: false,
          metadata: item.metadata,
        });
        restoredCount++;
      } catch (e) {
        failures.push({
          id: item.id,
          label: item.name,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // 7. Restore albums
    for (const album of manifest.albums) {
      const existingAlbum = await albums.getById(album.id);
      if (existingAlbum !== null) continue;

      await albums.insertWithId(
        album.id,
        album.name,
        album.coverMediaId,
        album.createdAt,
        false,
      );
    }

    // 8. Restore album_media associations
    for (const album of manifest.albums) {
      const associatedMediaIds = manifest.albumMedia
        .filter(am => am.albumId === album.id)
        .map(am => am.mediaId);

      if (associatedMediaIds.length > 0) {
        await albumMedia.addBatch(album.id, associatedMediaIds);
      }
    }

    // Complete
    onProgress?.({ phase: 'complete', current: total, total, currentLabel: '' });

    return {
      success: failures.length === 0,
      restoredCount,
      skippedCount,
      totalCount: total,
      failures: failures.length > 0 ? failures : undefined,
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
