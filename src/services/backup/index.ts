/**
 * VaultCalc - Backup Service Exports
 *
 * @see FEATURE_INDEX.md CLOUD-002, CLOUD-003, CLOUD-004
 */

// Existing exports (unchanged)
export { createEncryptedBackup, decryptBackupManifest } from './backupService';
export { uploadBackupToDrive } from './driveUploadService';
export { restoreBackupFromDrive } from './driveRestoreService';
export { tryAutoBackup } from './autoBackupService';

export {
  BACKUP_MANIFEST_VERSION,
  MANIFEST_ASSOCIATED_DATA,
} from './types';

export type {
  BackupMediaItem,
  BackupAlbum,
  BackupAlbumMedia,
  BackupManifest,
  BackupFileEntry,
  BackupResult,
  ManifestDecryptResult,
  BackupUploadProgress,
  BackupUploadOptions,
  BackupUploadFailure,
  BackupUploadResult,
  RestoreProgress,
  RestoreOptions,
  RestoreFailure,
  RestoreResult,
} from './types';

// Cloud abstraction layer types
export {
  CloudSyncState,
  type CloudMode,
  type BackupPayload,
  type CloudUploadProgress,
  type CloudRestoreProgress,
  type CloudUploadOptions,
  type CloudRestoreOptions,
  type CloudFileFailure,
  type CloudResult,
  type CloudUploadResult,
  type CloudRestoreResult,
  type RemoteBackupInfo,
} from './cloudTypes';

// Cloud interface
export type { CloudBackupService } from './cloudBackupServiceInterface';

// Cloud factory + config
export { CLOUD_MODE, getCloudBackupService } from './cloudConfig';

// Mock cloud config
export { mockCloudConfig, type CloudMockScenario } from './MockCloudBackupService';
