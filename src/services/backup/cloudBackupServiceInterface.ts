/**
 * VaultCalc - CloudBackupService Interface
 *
 * Abstract interface for cloud backup storage operations.
 * Implementations handle only encrypted blob transport — all
 * cryptographic operations happen upstream via createEncryptedBackup().
 *
 * Implementations:
 * - MockCloudBackupService: local file simulation with scenarios
 * - ProductionCloudBackupService: delegates to Google Drive (stub)
 *
 * @see FEATURE_INDEX.md CLOUD-002, CLOUD-003, CLOUD-004
 */

import type {
  CloudResult,
  CloudUploadResult,
  CloudRestoreResult,
  CloudUploadOptions,
  CloudRestoreOptions,
  CloudSyncState,
  RemoteBackupInfo,
  BackupPayload,
} from './cloudTypes';

export interface CloudBackupService {
  /**
   * Upload an encrypted backup payload to the cloud.
   * The payload is already fully encrypted — the implementation
   * MUST NOT inspect or transform it.
   */
  uploadBackup(
    payload: BackupPayload,
    options?: CloudUploadOptions,
  ): Promise<CloudUploadResult>;

  /**
   * Download and return the encrypted manifest from the cloud.
   * Returns the raw encrypted string for upstream decryption.
   */
  downloadManifest(): Promise<CloudResult<string>>;

  /**
   * Download an encrypted file from the cloud to a local path.
   * The file remains encrypted — decryption happens upstream.
   */
  downloadFile(
    remoteId: string,
    localDestPath: string,
  ): Promise<CloudResult<boolean>>;

  /**
   * Restore a full backup from the cloud.
   * Orchestrates manifest download + file downloads with progress.
   */
  restoreBackup(options?: CloudRestoreOptions): Promise<CloudRestoreResult>;

  /** Check whether a remote backup exists and get basic info */
  hasRemoteBackup(): Promise<CloudResult<RemoteBackupInfo>>;

  /** Get the current sync state */
  getSyncState(): CloudSyncState;
}
