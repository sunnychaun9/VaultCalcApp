/**
 * VaultCalc - Production Cloud Backup Service (Stub)
 *
 * Placeholder implementation that returns not-configured errors.
 * When Google Drive integration is wired, this will delegate to
 * the existing driveUploadService.ts and driveRestoreService.ts.
 *
 * @see FEATURE_INDEX.md CLOUD-002, CLOUD-003, CLOUD-004
 */

import type { CloudBackupService } from './cloudBackupServiceInterface';
import {
  CloudSyncState,
  type CloudResult,
  type CloudUploadResult,
  type CloudRestoreResult,
  type RemoteBackupInfo,
  type BackupPayload,
} from './cloudTypes';

const NOT_CONFIGURED_MSG = 'Production cloud backup not yet configured';

export class ProductionCloudBackupService implements CloudBackupService {
  async uploadBackup(
    _payload: BackupPayload,
  ): Promise<CloudUploadResult> {
    return { success: false, error: NOT_CONFIGURED_MSG };
  }

  async downloadManifest(): Promise<CloudResult<string>> {
    return { success: false, error: NOT_CONFIGURED_MSG };
  }

  async downloadFile(): Promise<CloudResult<boolean>> {
    return { success: false, error: NOT_CONFIGURED_MSG };
  }

  async restoreBackup(): Promise<CloudRestoreResult> {
    return { success: false, error: NOT_CONFIGURED_MSG };
  }

  async hasRemoteBackup(): Promise<CloudResult<RemoteBackupInfo>> {
    return { success: false, error: NOT_CONFIGURED_MSG };
  }

  getSyncState(): CloudSyncState {
    return CloudSyncState.NEVER_SYNCED;
  }
}
