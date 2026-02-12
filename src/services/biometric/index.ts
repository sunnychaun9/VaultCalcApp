/**
 * VaultCalc - Biometric Service Barrel
 *
 * @see FEATURE_INDEX.md BIO-001
 */

export {
  checkBiometricAvailability,
  promptBiometricAuth,
  getBiometricStatusMessage,
} from './biometricService';

export type {
  BiometricAvailability,
  BiometricAuthResult,
  BiometricStatus,
} from './biometricService';
