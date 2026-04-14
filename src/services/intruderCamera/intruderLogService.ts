/**
 * VaultCalc - Intruder Log Service
 *
 * Orchestrates intruder photo capture, location capture, encryption,
 * risk scoring, notification, and database logging.
 *
 * Called on failed PIN attempts ONLY when:
 * 1. The user has explicitly enabled "Intruder Selfie Detection" in Settings
 * 2. CAMERA permission has been granted after the user saw an explanation dialog
 *
 * Always logs the attempt even if photo/location capture fails.
 * Never throws — returns a result object.
 *
 * @see FEATURE_INDEX.md SEC-002, SEC-005
 */

import { Platform, NativeModules } from 'react-native';
import { captureIntruderPhoto } from './intruderCameraService';
import { encryptFile, generateKey, getVaultDirectory } from '@services/crypto';
import { deleteFile } from '@services/media';
import { intruderLogs, type IntruderLog, type RiskLevel } from '@services/storage';
import { trackEvent } from '@services/analytics';

const { IntruderLocationModule, IntruderNotificationModule } = NativeModules;

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
 * Compute risk level from failed attempt count.
 */
function computeRiskLevel(attempts: number): RiskLevel {
  if (attempts >= 3) return 'HIGH';
  if (attempts === 2) return 'MEDIUM';
  return 'LOW';
}

/**
 * Fetch device location if permission was granted. Never throws.
 */
async function fetchLocation(): Promise<{
  latitude: number | null;
  longitude: number | null;
  cityName: string | null;
}> {
  try {
    if (!IntruderLocationModule) {
      return { latitude: null, longitude: null, cityName: null };
    }
    const hasPermission = await IntruderLocationModule.hasPermission();
    if (!hasPermission) {
      return { latitude: null, longitude: null, cityName: null };
    }
    const loc = await IntruderLocationModule.getLocation();
    if (!loc || (loc.latitude === 0 && loc.longitude === 0)) {
      return { latitude: null, longitude: null, cityName: loc?.cityName || null };
    }
    return {
      latitude: loc.latitude,
      longitude: loc.longitude,
      cityName: loc.cityName || null,
    };
  } catch {
    return { latitude: null, longitude: null, cityName: null };
  }
}

/**
 * Show intruder notification. Never throws.
 */
async function showNotification(riskLevel: RiskLevel, attempts: number): Promise<void> {
  try {
    if (!IntruderNotificationModule) return;
    await IntruderNotificationModule.showIntruderAlert(riskLevel, attempts);
  } catch {
    // Notification is optional — don't block logging
  }
}

/**
 * Record an intruder attempt: capture photo + location, encrypt, score risk, and log to DB.
 *
 * @param failedAttempts - Current number of consecutive failed PIN attempts
 * @param locationEnabled - Whether the user has enabled optional location logging in Settings
 *
 * 1. Captures a photo via the front camera (if user enabled + permission granted)
 * 2. Fetches device location (only if user enabled location logging + permission granted)
 * 3. Generates a unique ID for the log entry
 * 4. If photo was captured, encrypts it and removes the raw JPEG
 * 5. Computes risk level from attempt count
 * 6. Inserts a database record (always, even without a photo/location)
 * 7. Fires a notification alert
 *
 * Never throws — returns { success, error? }.
 */
export async function recordIntruderAttempt(
  failedAttempts: number = 1,
  locationEnabled: boolean = false,
): Promise<IntruderLogResult> {
  try {
    // 1. Capture photo and (optionally) location in parallel
    const [captureResult, location] = await Promise.all([
      captureIntruderPhoto(),
      locationEnabled ? fetchLocation() : Promise.resolve({ latitude: null, longitude: null, cityName: null }),
    ]);

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

    // 5. Compute risk level
    const riskLevel = computeRiskLevel(failedAttempts);

    // 6. Insert DB record (always — even if photo/location failed)
    const log: IntruderLog = {
      id: logId,
      photoPath: encryptedPhotoPath,
      timestamp: Date.now(),
      failedPinHash: null,
      deviceInfo,
      latitude: location.latitude,
      longitude: location.longitude,
      cityName: location.cityName,
      riskLevel,
      failedAttempts,
    };

    await intruderLogs.insert(log);

    // 7. Fire notification (fire-and-forget)
    showNotification(riskLevel, failedAttempts);

    trackEvent('intruder_alert_triggered', {
      risk_level: riskLevel.toLowerCase() as 'low' | 'medium' | 'high',
    });

    return { success: true };
  } catch {
    return { success: false, error: 'Intruder log recording failed unexpectedly' };
  }
}
