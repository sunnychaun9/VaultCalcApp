/**
 * VaultCalc - Intruder Camera Service
 *
 * High-level service for capturing intruder photos on failed PIN attempts.
 * Handles permission checks, file path management, and error handling.
 *
 * @see FEATURE_INDEX.md SEC-001
 */

import { PermissionsAndroid, Platform } from 'react-native';
import { NativeIntruderCamera, type CaptureResult } from './nativeIntruderCamera';
import { getVaultDirectory } from '@services/crypto';

/** Subdirectory for intruder photos within the vault */
const INTRUDER_SUBDIR = 'intruder';

/**
 * Request camera permission from the user.
 * Returns true if already granted or newly granted.
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message: 'VaultCalc needs camera access for security features.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Check if camera permission is currently granted.
 */
export async function hasCameraPermission(): Promise<boolean> {
  try {
    return await NativeIntruderCamera.hasPermission();
  } catch {
    return false;
  }
}

/**
 * Capture an intruder photo silently using the front camera.
 *
 * The photo is saved as a raw JPEG in the vault's intruder subdirectory.
 * Encryption and DB logging are handled separately by SEC-002.
 *
 * This function never throws — it returns a result object indicating
 * success or failure. Failed captures are silently ignored to avoid
 * disrupting the normal calculator UX.
 *
 * @returns Capture result with the file path on success
 */
export async function captureIntruderPhoto(): Promise<CaptureResult> {
  try {
    // Check permission (don't prompt — that would reveal the feature)
    const hasPermission = await NativeIntruderCamera.hasPermission();
    if (!hasPermission) {
      return { success: false, error: 'Camera permission not granted' };
    }

    // Get vault directory for storage
    const vaultDirResult = await getVaultDirectory();
    if (!vaultDirResult.success || !vaultDirResult.data) {
      return { success: false, error: 'Failed to resolve vault directory' };
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const destPath = `${vaultDirResult.data}/${INTRUDER_SUBDIR}/${timestamp}.jpg`;

    // Capture photo
    return await NativeIntruderCamera.capturePhoto(destPath);
  } catch {
    return { success: false, error: 'Capture failed unexpectedly' };
  }
}
