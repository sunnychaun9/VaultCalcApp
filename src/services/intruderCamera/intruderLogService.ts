/**
 * VaultCalc - Intruder Log Service
 *
 * Orchestrates intruder photo capture, encryption, and database logging.
 * Called on failed PIN attempts when intruder detection is enabled.
 *
 * Always logs the attempt even if photo capture fails.
 * Never throws — returns a result object.
 *
 * @see FEATURE_INDEX.md SEC-002
 */

import { Platform } from 'react-native';
import { captureIntruderPhoto } from './intruderCameraService';
import { encryptFile, generateKey, getVaultDirectory } from '@services/crypto';
import { deleteFile } from '@services/media';
import { intruderLogs, type IntruderLog } from '@services/storage';

/**
 * Result of recording an intruder attempt
 */
export interface IntruderLogResult {
  success: boolean;
  error?: string;
}

/** Subdirectory for encrypted intruder photos within the vault */
const INTRUDER_SUBDIR = 'intruder';

/**
 * Convert a base64 string to a hex string (for use as IDs).
 */
function base64ToHex(b64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bits = '';
  for (const c of b64) {
    if (c === '=') break;
    const idx = chars.indexOf(c);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(6, '0');
  }
  let hex = '';
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    hex += parseInt(bits.substring(i, i + 4), 2).toString(16);
  }
  return hex;
}

/**
 * Record an intruder attempt: capture photo, encrypt it, and log to DB.
 *
 * 1. Captures a photo via the front camera (may fail silently)
 * 2. Generates a unique ID for the log entry
 * 3. If photo was captured, encrypts it and removes the raw JPEG
 * 4. Inserts a database record (always, even without a photo)
 *
 * Never throws — returns { success, error? }.
 */
export async function recordIntruderAttempt(): Promise<IntruderLogResult> {
  try {
    // 1. Attempt photo capture (may fail — that's OK)
    const captureResult = await captureIntruderPhoto();

    // 2. Generate unique 16-byte hex ID
    const keyResult = await generateKey(16);
    if (!keyResult.success || !keyResult.data) {
      return { success: false, error: 'Failed to generate log ID' };
    }
    const logId = base64ToHex(keyResult.data);

    // 3. Encrypt photo if captured
    let encryptedPhotoPath: string | null = null;

    if (captureResult.success && captureResult.path) {
      const vaultDirResult = await getVaultDirectory();
      if (vaultDirResult.success && vaultDirResult.data) {
        const destPath = `${vaultDirResult.data}/${INTRUDER_SUBDIR}/${logId}.enc`;

        const encResult = await encryptFile(
          captureResult.path,
          destPath,
          logId,
        );

        if (encResult.success) {
          encryptedPhotoPath = destPath;
          // Remove unencrypted JPEG
          await deleteFile(captureResult.path);
        }
      }
    }

    // 4. Collect device info
    const deviceInfo: Record<string, unknown> = {
      platform: Platform.OS,
      osVersion: Platform.Version,
    };

    // 5. Insert DB record (always — even if photo failed)
    const log: IntruderLog = {
      id: logId,
      photoPath: encryptedPhotoPath,
      timestamp: Date.now(),
      failedPinHash: null,
      deviceInfo,
    };

    await intruderLogs.insert(log);

    return { success: true };
  } catch {
    return { success: false, error: 'Intruder log recording failed unexpectedly' };
  }
}
