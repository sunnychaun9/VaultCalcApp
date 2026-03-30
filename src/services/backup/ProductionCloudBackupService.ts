/**
 * VaultCalc - Production Cloud Backup Service
 *
 * Delegates to the existing Drive upload/restore services.
 * Implements the CloudBackupService interface for production builds.
 *
 * @see FEATURE_INDEX.md CLOUD-002, CLOUD-003, CLOUD-004
 */

import type { CloudBackupService } from './cloudBackupServiceInterface';
import {
  CloudSyncState,
  type CloudResult,
  type CloudUploadResult,
  type CloudUploadOptions,
  type CloudRestoreResult,
  type CloudRestoreOptions,
  type RemoteBackupInfo,
  type BackupPayload,
} from './cloudTypes';
import { uploadBackupToDrive } from './driveUploadService';
import { restoreBackupFromDrive } from './driveRestoreService';
import { getAccessToken } from '@services/googleDrive';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FOLDER_NAME = 'VaultCalc';

export class ProductionCloudBackupService implements CloudBackupService {
  private syncState: CloudSyncState = CloudSyncState.NEVER_SYNCED;

  async uploadBackup(
    _payload: BackupPayload,
    options?: CloudUploadOptions,
  ): Promise<CloudUploadResult> {
    this.syncState = CloudSyncState.SYNCING;
    try {
      const result = await uploadBackupToDrive({
        onProgress: options?.onProgress
          ? (p) => options.onProgress!({
              phase: p.phase === 'complete' ? 'finalizing' : p.phase,
              current: p.current,
              total: p.total,
              currentLabel: p.currentLabel,
            })
          : undefined,
      });

      this.syncState = result.success ? CloudSyncState.SYNCED : CloudSyncState.FAILED;

      return {
        success: result.success,
        uploadedCount: result.uploadedCount,
        totalCount: result.totalCount,
        failures: result.failures?.map(f => ({
          id: f.id,
          label: f.label,
          error: f.error,
        })),
        error: result.error,
      };
    } catch (e) {
      this.syncState = CloudSyncState.FAILED;
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async downloadManifest(): Promise<CloudResult<string>> {
    try {
      const tokenResult = await getAccessToken();
      if (!tokenResult.success || !tokenResult.token) {
        return { success: false, error: tokenResult.error ?? 'Failed to get access token' };
      }

      // Find folder
      const q = encodeURIComponent(
        `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`,
      );
      const searchRes = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)&spaces=drive`, {
        headers: { Authorization: `Bearer ${tokenResult.token}` },
      });
      if (!searchRes.ok) return { success: false, error: `Drive search failed: ${searchRes.status}` };

      const searchData: { files: Array<{ id: string }> } = await searchRes.json();
      if (searchData.files.length === 0) {
        return { success: false, error: 'No backup folder found' };
      }
      const folderId = searchData.files[0].id;

      // Find manifest
      const mq = encodeURIComponent(`name='manifest.json.enc' and '${folderId}' in parents and trashed=false`);
      const mRes = await fetch(`${DRIVE_API}/files?q=${mq}&fields=files(id)`, {
        headers: { Authorization: `Bearer ${tokenResult.token}` },
      });
      if (!mRes.ok) return { success: false, error: 'Failed to find manifest' };

      const mData: { files: Array<{ id: string }> } = await mRes.json();
      if (mData.files.length === 0) return { success: false, error: 'Manifest not found' };

      // Download manifest content
      const dlRes = await fetch(`${DRIVE_API}/files/${mData.files[0].id}?alt=media`, {
        headers: { Authorization: `Bearer ${tokenResult.token}` },
      });
      if (!dlRes.ok) return { success: false, error: 'Failed to download manifest' };

      const text = await dlRes.text();
      return { success: true, data: text };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async downloadFile(
    remoteId: string,
    localDestPath: string,
  ): Promise<CloudResult<boolean>> {
    try {
      const tokenResult = await getAccessToken();
      if (!tokenResult.success || !tokenResult.token) {
        return { success: false, error: 'Failed to get access token' };
      }

      const { NativeMedia } = require('@services/media/nativeMedia');
      const url = `${DRIVE_API}/files/${remoteId}?alt=media`;
      const ok = await NativeMedia.downloadFile(url, tokenResult.token, localDestPath);
      return { success: ok, data: ok };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async restoreBackup(options?: CloudRestoreOptions): Promise<CloudRestoreResult> {
    this.syncState = CloudSyncState.SYNCING;
    try {
      const result = await restoreBackupFromDrive({
        onProgress: options?.onProgress
          ? (p) => options.onProgress!({
              phase: p.phase === 'complete' ? 'finalizing' : p.phase === 'downloading' ? 'downloading' : 'preparing',
              current: p.current,
              total: p.total,
              currentLabel: p.currentLabel,
            })
          : undefined,
      });

      this.syncState = result.success ? CloudSyncState.SYNCED : CloudSyncState.FAILED;

      return {
        success: result.success,
        restoredCount: result.restoredCount,
        skippedCount: result.skippedCount,
        totalCount: result.totalCount,
        failures: result.failures?.map(f => ({
          id: f.id,
          label: f.label,
          error: f.error,
        })),
        error: result.error,
      };
    } catch (e) {
      this.syncState = CloudSyncState.FAILED;
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async hasRemoteBackup(): Promise<CloudResult<RemoteBackupInfo>> {
    try {
      const tokenResult = await getAccessToken();
      if (!tokenResult.success || !tokenResult.token) {
        return { success: false, error: 'Not authenticated' };
      }

      // Find folder
      const q = encodeURIComponent(
        `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`,
      );
      const searchRes = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)&spaces=drive`, {
        headers: { Authorization: `Bearer ${tokenResult.token}` },
      });
      if (!searchRes.ok) {
        return { success: true, data: { exists: false } };
      }

      const searchData: { files: Array<{ id: string }> } = await searchRes.json();
      if (searchData.files.length === 0) {
        return { success: true, data: { exists: false } };
      }
      const folderId = searchData.files[0].id;

      // Check for manifest + count files
      const fq = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
      const listRes = await fetch(
        `${DRIVE_API}/files?q=${fq}&fields=files(id,name,modifiedTime)&pageSize=1000`,
        { headers: { Authorization: `Bearer ${tokenResult.token}` } },
      );
      if (!listRes.ok) {
        return { success: true, data: { exists: false } };
      }

      const listData: { files: Array<{ id: string; name: string; modifiedTime?: string }> } = await listRes.json();
      const manifestFile = listData.files.find(f => f.name === 'manifest.json.enc');

      if (!manifestFile) {
        return { success: true, data: { exists: false } };
      }

      return {
        success: true,
        data: {
          exists: true,
          lastModified: manifestFile.modifiedTime ? new Date(manifestFile.modifiedTime).getTime() : undefined,
          fileCount: listData.files.length - 1, // exclude manifest
        },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  getSyncState(): CloudSyncState {
    return this.syncState;
  }
}
