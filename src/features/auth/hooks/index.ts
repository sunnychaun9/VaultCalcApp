/**
 * VaultCalc - Auth Hooks
 *
 * Export all authentication hooks.
 */

export { usePinAuth } from './usePinAuth';
export type { PinAuthResult } from './usePinAuth';
export { useBiometricAuth } from './useBiometricAuth';
export { useAuthSession, useActivityTracker } from './useAuthSession';
export { useFailedAttempts } from './useFailedAttempts';
export { useShakeLock } from './useShakeLock';
