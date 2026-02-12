/**
 * VaultCalc - Biometric Service
 *
 * High-level API for biometric authentication operations.
 * Wraps the native BiometricModule with error handling.
 *
 * @see FEATURE_INDEX.md BIO-001
 */

import { NativeBiometric, type BiometricAvailability, type BiometricStatus, type BiometricAuthResult } from './nativeBiometric';

export type { BiometricAvailability, BiometricStatus, BiometricAuthResult } from './nativeBiometric';

/**
 * Check whether biometric authentication is available on this device.
 *
 * Returns availability and detailed status. Never throws — returns
 * a safe fallback on error.
 */
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    return await NativeBiometric.checkAvailability();
  } catch {
    return { available: false, status: 'unknown' };
  }
}

/**
 * Human-readable message for each biometric status.
 */
/**
 * Show the system biometric authentication prompt (BIO-003).
 *
 * Never throws — returns a safe fallback on error.
 */
export async function promptBiometricAuth(): Promise<BiometricAuthResult> {
  try {
    return await NativeBiometric.authenticate(
      'Unlock Vault',
      'Verify your identity',
      'Use PIN',
    );
  } catch {
    return { success: false, error: 'Biometric prompt failed' };
  }
}

export function getBiometricStatusMessage(status: BiometricStatus): string {
  switch (status) {
    case 'available':
      return 'Biometric authentication is available.';
    case 'no_hardware':
      return 'This device does not have biometric hardware.';
    case 'unavailable':
      return 'Biometric hardware is currently unavailable.';
    case 'none_enrolled':
      return 'No biometrics are enrolled. Please add a fingerprint or face in device settings.';
    case 'security_update_required':
      return 'A security update is required to use biometrics.';
    default:
      return 'Biometric status could not be determined.';
  }
}
