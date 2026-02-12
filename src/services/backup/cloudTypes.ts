/**
 * VaultCalc - Cloud Backup Abstraction Types
 *
 * Foundation types for the cloud backup abstraction layer.
 * Defines the sync lifecycle, payload schema, and encryption boundary rules.
 *
 * ## Encryption Boundary Rules
 *
 * The cloud layer is a **dumb encrypted-blob transport**. All cryptographic
 * operations happen BEFORE data reaches the CloudBackupService:
 *
 * 1. Media files are encrypted with per-file AES-GCM keys on import.
 *    The cloud layer only ever sees `*.enc` blobs.
 *
 * 2. The backup manifest is encrypted with AEAD (AES-GCM + associated data
 *    context `'vaultcalc-backup-manifest-v1'`). The cloud layer receives the
 *    ciphertext string and stores it as-is.
 *
 * 3. Encryption keys (keyId references) are embedded inside the encrypted
 *    manifest. They NEVER appear in any cloud API call or payload metadata.
 *
 * 4. Decryption keys are derived from the device keystore and NEVER leave
 *    the device. A backup restored on a different device requires the same
 *    keystore seed (or key export/import flow).
 *
 * 5. The CloudBackupService implementation MUST NOT inspect, parse, or
 *    transform encrypted payloads — pass them through opaquely.
 *
 * @see FEATURE_INDEX.md CLOUD-002, CLOUD-003, CLOUD-004
 */

import type { BackupFileEntry } from './types';

/** Sync lifecycle states */
export enum CloudSyncState {
  /** No backup has ever been performed */
  NEVER_SYNCED = 'NEVER_SYNCED',
  /** A sync operation is currently in progress */
  SYNCING = 'SYNCING',
  /** Last sync completed successfully and local vault matches remote */
  SYNCED = 'SYNCED',
  /** Local vault has changes not yet uploaded */
  PENDING = 'PENDING',
  /** Last sync attempt failed */
  FAILED = 'FAILED',
}

/**
 * Complete backup payload ready for cloud upload.
 *
 * Created by `createEncryptedBackup()` — the cloud layer receives this
 * fully-encrypted package and stores it without inspection.
 */
export interface BackupPayload {
  /** AES-GCM encrypted manifest JSON (contains all vault metadata) */
  encryptedManifest: string;
  /** Inventory of encrypted files to upload (media + thumbnails) */
  files: BackupFileEntry[];
  /** Total size of all files in bytes (for progress estimation) */
  totalSizeBytes: number;
  /** Timestamp when this payload was created */
  createdAt: number;
}

/** Progress callback for cloud upload operations */
export interface CloudUploadProgress {
  phase: 'preparing' | 'uploading' | 'finalizing';
  current: number;
  total: number;
  currentLabel: string;
}

/** Progress callback for cloud restore operations */
export interface CloudRestoreProgress {
  phase: 'preparing' | 'downloading' | 'finalizing';
  current: number;
  total: number;
  currentLabel: string;
}

/** Options for cloud upload */
export interface CloudUploadOptions {
  onProgress?: (progress: CloudUploadProgress) => void;
}

/** Options for cloud restore */
export interface CloudRestoreOptions {
  onProgress?: (progress: CloudRestoreProgress) => void;
}

/** Individual file failure record */
export interface CloudFileFailure {
  id: string;
  label: string;
  error: string;
}

/** Generic result envelope for cloud operations */
export interface CloudResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Result of a cloud upload operation */
export interface CloudUploadResult {
  success: boolean;
  uploadedCount?: number;
  totalCount?: number;
  failures?: CloudFileFailure[];
  error?: string;
}

/** Result of a cloud restore operation */
export interface CloudRestoreResult {
  success: boolean;
  restoredCount?: number;
  skippedCount?: number;
  totalCount?: number;
  failures?: CloudFileFailure[];
  error?: string;
}

/** Remote backup metadata (returned by hasRemoteBackup) */
export interface RemoteBackupInfo {
  /** Whether a remote backup exists */
  exists: boolean;
  /** Timestamp of the remote backup (if available) */
  lastModified?: number;
  /** Number of files in the remote backup (if available) */
  fileCount?: number;
}

/** Runtime cloud mode */
export type CloudMode = 'mock' | 'production';
