/**
 * VaultCalc - Auto-Backup Service (CLOUD-005)
 *
 * Silent one-shot backup check at app startup.
 * Runs uploadBackupToDrive() if auto-backup is enabled,
 * Google Drive is connected, not in decoy mode, and
 * enough time has passed since the last backup.
 */

import { useSettingsStore } from '@store/settingsStore';
import { useAuthStore } from '@store/authStore';
import { uploadBackupToDrive } from './driveUploadService';
import { mediaItems } from '@services/storage/database';

/** Minimum interval between auto-backups (1 hour) */
const AUTO_BACKUP_INTERVAL_MS = 3_600_000;

/**
 * Attempt a silent auto-backup if conditions are met.
 * Fire-and-forget — errors are silently swallowed.
 */
export async function tryAutoBackup(): Promise<void> {
  try {
    const { autoBackupEnabled, googleDriveEmail, lastBackupAt } =
      useSettingsStore.getState();
    const { isDecoyMode } = useAuthStore.getState();

    // Guard: must be enabled, connected, and not in decoy mode
    if (!autoBackupEnabled || !googleDriveEmail || isDecoyMode) {
      return;
    }

    // Throttle: skip if last backup was within the interval
    if (lastBackupAt !== null && Date.now() - lastBackupAt < AUTO_BACKUP_INTERVAL_MS) {
      return;
    }

    // Silent upload — no progress callback
    const result = await uploadBackupToDrive();

    // Update timestamp and item count on success or partial success
    if (result.success || (result.failures && result.failures.length > 0)) {
      const [photos, videos, docs] = await Promise.all([
        mediaItems.getCount('photo', false),
        mediaItems.getCount('video', false),
        mediaItems.getCount('document', false),
      ]);
      const settings = useSettingsStore.getState();
      settings.setLastBackupAt(Date.now());
      settings.setLastBackupItemCount(photos + videos + docs);
    }
  } catch (e) {
    console.warn('Auto-backup failed:', e instanceof Error ? e.message : e);
  }
}
