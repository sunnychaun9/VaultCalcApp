/**
 * VaultCalc - Intruder Camera Service
 *
 * High-level service for capturing intruder photos on failed PIN attempts.
 * The user must explicitly enable this feature in Settings, which shows
 * an explanation dialog and requests CAMERA permission before activation.
 * Camera is ONLY used when both the feature toggle is ON and permission
 * has been granted by the user.
 *
 * @see FEATURE_INDEX.md SEC-001
 */

import { PermissionsAndroid, Platform } from 'react-native';
import { NativeIntruderCamera, type CaptureResult } from './nativeIntruderCamera';
import { getVaultDirectory } from '@services/crypto';

/** Subdirectory for intruder photos within the vault */
const INTRUDER_SUBDIR = 'intruder';

/**
 * Request camera permission from the user with a clear rationale.
 * Returns true if already granted or newly granted.
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message:
          'VaultCalc uses the front camera to photograph unauthorized access attempts when someone enters the wrong PIN.',
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
 * Capture an intruder photo using the front camera.
 *
 * Prerequisites (enforced by the caller and Settings toggle flow):
 * - User has explicitly enabled "Intruder Selfie Detection" in Settings
 * - CAMERA permission was granted after the user saw an explanation dialog
 *
 * The photo is saved as a raw JPEG in the vault's intruder subdirectory.
 * Encryption and DB logging are handled separately by SEC-002.
 *
 * This function never throws — it returns a result object indicating
 * success or failure. Failed captures do not disrupt the calculator UX.
 *
 * @returns Capture result with the file path on success
 */
export async function captureIntruderPhoto(): Promise<CaptureResult> {
  try {
    // Verify permission is still granted (user may have revoked in system settings)
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
