# Cloud Backup Architecture

## Overview

The cloud backup abstraction layer provides a swappable storage backend
so development and testing can proceed without Google Drive credentials
or network connectivity.

```
SettingsScreen / autoBackupService
        |
        +-- createEncryptedBackup()    <-- encryption boundary
        |         |
        |    BackupPayload (encrypted blobs only)
        |         |
        +-- getCloudBackupService()
                  |
          CloudBackupService interface
                  |
           +------+------+
           |             |
     MockCloud      ProductionCloud
   (dev builds)     (release builds)
```

## CLOUD_MODE

Defined in `src/services/backup/cloudConfig.ts`:

```ts
const CLOUD_MODE: CloudMode = __DEV__ ? 'mock' : 'production';
```

- **`mock`** — Uses `MockCloudBackupService` with in-memory storage and configurable scenarios
- **`production`** — Uses `ProductionCloudBackupService` (stub until Google Drive is wired)

`getCloudBackupService()` returns a singleton for the active mode.

## Encryption Boundary Rules

The cloud layer is a **dumb encrypted-blob transport**. All cryptographic
operations happen BEFORE data reaches the `CloudBackupService`:

| Rule | Description |
|------|-------------|
| 1. Per-file encryption | Media files are AES-GCM encrypted on import. Cloud only sees `*.enc` blobs. |
| 2. Manifest AEAD | Manifest encrypted with context `'vaultcalc-backup-manifest-v1'`. Cloud stores ciphertext as-is. |
| 3. No key exposure | Encryption keys (keyId refs) are inside the encrypted manifest. Never in API calls. |
| 4. Device-bound keys | Decryption keys derive from device keystore. Never leave the device. |
| 5. Opaque transport | CloudBackupService MUST NOT inspect, parse, or transform encrypted payloads. |

### Data Flow

```
Plaintext media  ──[AES-GCM]──>  *.enc files  ──>  CloudBackupService.uploadBackup()
Vault metadata   ──[AEAD]──────>  manifest.enc ──>  (inside BackupPayload)
```

On restore:
```
CloudBackupService.restoreBackup()  ──>  *.enc files  ──[AES-GCM decrypt]──>  Plaintext
                                    ──>  manifest.enc ──[AEAD decrypt]──────>  BackupManifest
```

## BackupPayload Schema

```ts
interface BackupPayload {
  encryptedManifest: string;      // AEAD ciphertext
  files: BackupFileEntry[];       // { id, localPath, isThumbnail, sizeBytes }
  totalSizeBytes: number;
  createdAt: number;
}
```

Created by `createEncryptedBackup()` — the cloud layer receives this
fully-encrypted package and stores it without inspection.

## CloudSyncState

```
NEVER_SYNCED ──> SYNCING ──> SYNCED
                    |           |
                    v           v
                  FAILED     PENDING ──> SYNCING
```

| State | Description |
|-------|-------------|
| `NEVER_SYNCED` | No backup has ever been performed |
| `SYNCING` | Upload or restore in progress |
| `SYNCED` | Last sync succeeded, local matches remote |
| `PENDING` | Local vault has unsynced changes |
| `FAILED` | Last sync attempt failed |

## CloudBackupService Interface

```ts
interface CloudBackupService {
  uploadBackup(payload, options?): Promise<CloudUploadResult>;
  downloadManifest(): Promise<CloudResult<string>>;
  downloadFile(remoteId, localDestPath): Promise<CloudResult<boolean>>;
  restoreBackup(options?): Promise<CloudRestoreResult>;
  hasRemoteBackup(): Promise<CloudResult<RemoteBackupInfo>>;
  getSyncState(): CloudSyncState;
}
```

## MockCloudBackupService Scenarios

Control via `mockCloudConfig`:

```ts
import { mockCloudConfig } from '@services/backup';

mockCloudConfig.scenario = 'network_failure';
mockCloudConfig.latencyMs = 1000;
```

| Scenario | `uploadBackup()` | `restoreBackup()` | `downloadManifest()` | State |
|----------|---|---|---|---|
| `success` | Stores all blobs, reports progress | Downloads all, reports progress | Returns stored manifest | `SYNCED` |
| `network_failure` | Returns error immediately | Returns error immediately | Returns error | `FAILED` |
| `corrupt_backup` | Normal upload | Returns AEAD error | Returns garbage ciphertext | `FAILED` |

### Progress Phases

**Upload:** `preparing` → `uploading` (per file) → `finalizing`
**Restore:** `preparing` → `downloading` (per file) → `finalizing`

## Migration Path: Wiring ProductionCloudBackupService

When Google Drive integration is ready:

1. Open `src/services/backup/ProductionCloudBackupService.ts`
2. Import from existing services:
   - `createEncryptedBackup` from `./backupService`
   - `uploadBackupToDrive` from `./driveUploadService`
   - `restoreBackupFromDrive` from `./driveRestoreService`
   - `getAccessToken` from `@services/googleDrive`
3. Delegate each method:
   - `uploadBackup()` → `uploadBackupToDrive()` (map progress phases)
   - `restoreBackup()` → `restoreBackupFromDrive()` (map progress phases)
   - `downloadManifest()` → Drive API download of `manifest.json.enc`
   - `downloadFile()` → Drive API download by file ID
   - `hasRemoteBackup()` → check for VaultCalc folder + manifest
4. Result types are compatible — `CloudUploadResult` mirrors `BackupUploadResult`

## Existing Files Preserved

These files are **not modified** by the abstraction layer:

- `backupService.ts` — Local encrypted backup creation + manifest decryption
- `driveUploadService.ts` — Google Drive upload orchestration
- `driveRestoreService.ts` — Google Drive restore orchestration
- `autoBackupService.ts` — Silent auto-backup on app launch
- `types.ts` — Existing backup types (BackupManifest, etc.)

They remain available for `ProductionCloudBackupService` to delegate to.
