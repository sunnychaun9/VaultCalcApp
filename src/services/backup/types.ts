/**
 * VaultCalc - Backup Types & Constants
 *
 * Types for encrypted backup manifest and file inventory.
 *
 * @see FEATURE_INDEX.md CLOUD-002
 */

import type { MediaType } from '@services/storage/database';

/** Schema version for forward compatibility */
export const BACKUP_MANIFEST_VERSION = 1;

/** AEAD associated data for domain separation */
export const MANIFEST_ASSOCIATED_DATA = 'vaultcalc-backup-manifest-v1';

/** MediaItem minus device-specific fields (encryptedPath, thumbnailPath, isDecoy) */
export interface BackupMediaItem {
  id: string;
  type: MediaType;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  keyId: string;
  createdAt: number;
  importedAt: number;
  isFavorite: boolean;
  metadata: Record<string, unknown> | null;
}

/** Album minus isDecoy */
export interface BackupAlbum {
  id: string;
  name: string;
  coverMediaId: string | null;
  createdAt: number;
}

/** Album-media association tuple */
export interface BackupAlbumMedia {
  albumId: string;
  mediaId: string;
  addedAt: number;
}

/** Backup manifest containing all vault metadata */
export interface BackupManifest {
  version: number;
  createdAt: number;
  mediaItems: BackupMediaItem[];
  albums: BackupAlbum[];
  albumMedia: BackupAlbumMedia[];
}

/** File entry for CLOUD-003 upload */
export interface BackupFileEntry {
  id: string;
  localPath: string;
  isThumbnail: boolean;
  sizeBytes: number;
}

/** Result of creating an encrypted backup */
export interface BackupResult {
  success: boolean;
  encryptedManifest?: string;
  files?: BackupFileEntry[];
  totalSizeBytes?: number;
  error?: string;
}

/** Result of decrypting a backup manifest */
export interface ManifestDecryptResult {
  success: boolean;
  manifest?: BackupManifest;
  error?: string;
}

/** Progress callback payload for backup upload (CLOUD-003) */
export interface BackupUploadProgress {
  phase: 'preparing' | 'uploading' | 'complete';
  current: number;
  total: number;
  currentLabel: string;
}

/** Options for uploadBackupToDrive (CLOUD-003) */
export interface BackupUploadOptions {
  onProgress?: (progress: BackupUploadProgress) => void;
}

/** Individual file upload failure (CLOUD-003) */
export interface BackupUploadFailure {
  id: string;
  label: string;
  error: string;
}

/** Result of a full backup upload (CLOUD-003) */
export interface BackupUploadResult {
  success: boolean;
  uploadedCount?: number;
  totalCount?: number;
  failures?: BackupUploadFailure[];
  error?: string;
}

/** Progress callback payload for backup restore (CLOUD-004) */
export interface RestoreProgress {
  phase: 'preparing' | 'downloading' | 'complete';
  current: number;
  total: number;
  currentLabel: string;
}

/** Options for restoreBackupFromDrive (CLOUD-004) */
export interface RestoreOptions {
  onProgress?: (progress: RestoreProgress) => void;
}

/** Individual file restore failure (CLOUD-004) */
export interface RestoreFailure {
  id: string;
  label: string;
  error: string;
}

/** Result of a full backup restore (CLOUD-004) */
export interface RestoreResult {
  success: boolean;
  restoredCount?: number;
  skippedCount?: number;
  totalCount?: number;
  failures?: RestoreFailure[];
  error?: string;
}
