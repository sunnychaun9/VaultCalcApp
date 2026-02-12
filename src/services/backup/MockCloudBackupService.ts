/**
 * VaultCalc - Mock Cloud Backup Service
 *
 * Development-only cloud backup implementation that simulates sync
 * operations using in-memory storage. Supports configurable scenarios
 * for testing success, network failure, and corrupt backup flows.
 *
 * No actual files are written to disk — the mock stores encrypted blobs
 * in memory to simulate a remote backend.
 *
 * @see FEATURE_INDEX.md CLOUD-002, CLOUD-003, CLOUD-004
 */

import type { CloudBackupService } from './cloudBackupServiceInterface';
import {
  CloudSyncState,
  type CloudResult,
  type CloudUploadResult,
  type CloudRestoreResult,
  type CloudUploadOptions,
  type CloudRestoreOptions,
  type RemoteBackupInfo,
  type BackupPayload,
  type CloudFileFailure,
} from './cloudTypes';

/** Configurable scenario for simulating different cloud outcomes */
export type CloudMockScenario = 'success' | 'network_failure' | 'corrupt_backup';

/** Mutable config for controlling mock cloud behavior at runtime */
export const mockCloudConfig = {
  scenario: 'success' as CloudMockScenario,
  latencyMs: 600,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simulated remote file store */
interface MockRemoteStore {
  manifest: string | null;
  files: Map<string, string>; // remoteId → "simulated-blob"
  uploadedAt: number | null;
}

export class MockCloudBackupService implements CloudBackupService {
  private state: CloudSyncState = CloudSyncState.NEVER_SYNCED;
  private remote: MockRemoteStore = {
    manifest: null,
    files: new Map(),
    uploadedAt: null,
  };

  async uploadBackup(
    payload: BackupPayload,
    options?: CloudUploadOptions,
  ): Promise<CloudUploadResult> {
    // --- Network failure scenario ---
    if (mockCloudConfig.scenario === 'network_failure') {
      await delay(mockCloudConfig.latencyMs);
      this.state = CloudSyncState.FAILED;
      return { success: false, error: 'Mock network failure — simulated connection timeout' };
    }

    this.state = CloudSyncState.SYNCING;

    // Preparing phase
    options?.onProgress?.({
      phase: 'preparing',
      current: 0,
      total: payload.files.length,
      currentLabel: 'Preparing backup...',
    });
    await delay(mockCloudConfig.latencyMs);

    // Upload manifest
    this.remote.manifest = payload.encryptedManifest;

    // Upload files with progress
    const failures: CloudFileFailure[] = [];
    for (let i = 0; i < payload.files.length; i++) {
      const file = payload.files[i];
      options?.onProgress?.({
        phase: 'uploading',
        current: i + 1,
        total: payload.files.length,
        currentLabel: file.isThumbnail ? `${file.id} (thumb)` : file.id,
      });

      await delay(Math.max(50, mockCloudConfig.latencyMs / 4));

      // Simulate storing the encrypted blob reference
      const remoteKey = file.isThumbnail ? `${file.id}_thumb.enc` : `${file.id}.enc`;
      this.remote.files.set(remoteKey, `mock-blob-${file.id}`);
    }

    // Finalizing
    options?.onProgress?.({
      phase: 'finalizing',
      current: payload.files.length,
      total: payload.files.length,
      currentLabel: 'Finalizing...',
    });
    await delay(mockCloudConfig.latencyMs / 2);

    this.remote.uploadedAt = Date.now();
    this.state = CloudSyncState.SYNCED;

    return {
      success: true,
      uploadedCount: payload.files.length - failures.length,
      totalCount: payload.files.length,
      failures: failures.length > 0 ? failures : undefined,
    };
  }

  async downloadManifest(): Promise<CloudResult<string>> {
    await delay(mockCloudConfig.latencyMs);

    if (mockCloudConfig.scenario === 'network_failure') {
      this.state = CloudSyncState.FAILED;
      return { success: false, error: 'Mock network failure — simulated connection timeout' };
    }

    if (mockCloudConfig.scenario === 'corrupt_backup') {
      // Return garbage that will fail AEAD decryption upstream
      return { success: true, data: 'CORRUPT::not-valid-aes-gcm-ciphertext::CORRUPT' };
    }

    if (this.remote.manifest === null) {
      return { success: false, error: 'No remote backup found' };
    }

    return { success: true, data: this.remote.manifest };
  }

  async downloadFile(
    remoteId: string,
    _localDestPath: string,
  ): Promise<CloudResult<boolean>> {
    await delay(Math.max(50, mockCloudConfig.latencyMs / 4));

    if (mockCloudConfig.scenario === 'network_failure') {
      return { success: false, error: 'Mock network failure' };
    }

    if (!this.remote.files.has(remoteId)) {
      return { success: false, error: `File not found in mock remote: ${remoteId}` };
    }

    // In a real implementation, this would write to localDestPath.
    // Mock just confirms the file "exists" in the simulated store.
    return { success: true, data: true };
  }

  async restoreBackup(options?: CloudRestoreOptions): Promise<CloudRestoreResult> {
    // --- Network failure scenario ---
    if (mockCloudConfig.scenario === 'network_failure') {
      await delay(mockCloudConfig.latencyMs);
      this.state = CloudSyncState.FAILED;
      return { success: false, error: 'Mock network failure — simulated connection timeout' };
    }

    // --- Corrupt backup scenario ---
    if (mockCloudConfig.scenario === 'corrupt_backup') {
      await delay(mockCloudConfig.latencyMs);
      options?.onProgress?.({
        phase: 'preparing',
        current: 0,
        total: 0,
        currentLabel: 'Downloading manifest...',
      });
      await delay(mockCloudConfig.latencyMs);
      this.state = CloudSyncState.FAILED;
      return {
        success: false,
        error: 'Backup manifest is corrupt — AEAD decryption failed',
      };
    }

    // --- Success scenario ---
    if (this.remote.manifest === null) {
      return { success: false, error: 'No remote backup found' };
    }

    this.state = CloudSyncState.SYNCING;
    const fileCount = this.remote.files.size;

    options?.onProgress?.({
      phase: 'preparing',
      current: 0,
      total: fileCount,
      currentLabel: 'Downloading manifest...',
    });
    await delay(mockCloudConfig.latencyMs);

    // Simulate downloading each file
    let restored = 0;
    const remoteIds = Array.from(this.remote.files.keys());
    for (let i = 0; i < remoteIds.length; i++) {
      options?.onProgress?.({
        phase: 'downloading',
        current: i + 1,
        total: fileCount,
        currentLabel: remoteIds[i],
      });
      await delay(Math.max(50, mockCloudConfig.latencyMs / 4));
      restored++;
    }

    options?.onProgress?.({
      phase: 'finalizing',
      current: fileCount,
      total: fileCount,
      currentLabel: 'Finalizing...',
    });
    await delay(mockCloudConfig.latencyMs / 2);

    this.state = CloudSyncState.SYNCED;

    return {
      success: true,
      restoredCount: restored,
      skippedCount: 0,
      totalCount: fileCount,
    };
  }

  async hasRemoteBackup(): Promise<CloudResult<RemoteBackupInfo>> {
    await delay(mockCloudConfig.latencyMs / 2);

    if (mockCloudConfig.scenario === 'network_failure') {
      return { success: false, error: 'Mock network failure' };
    }

    return {
      success: true,
      data: {
        exists: this.remote.manifest !== null,
        lastModified: this.remote.uploadedAt ?? undefined,
        fileCount: this.remote.files.size,
      },
    };
  }

  getSyncState(): CloudSyncState {
    return this.state;
  }
}
