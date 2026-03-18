/**
 * VaultCalc - Auth Services
 *
 * Export all authentication services.
 */

export {
  isPinConfigured,
  storePinCredentials,
  getPinCredentials,
  clearPinCredentials,
  clearDecoyPinCredentials,
  isDecoyPinConfigured,
} from './pinStorage';
export type { PinCredentials } from './pinStorage';

export {
  isValidPinFormat,
  isPotentialPin,
  attemptPinAuth,
  setupPin,
  changePin,
  isAuthRequired,
  getPinRules,
} from './authService';
export type { AuthResult } from './authService';

export {
  FAILED_ATTEMPT_CONFIG,
  getWarningLevel,
  getWarningMessage,
  calculateAttemptDelay,
  shouldTriggerLockout,
  calculateLockoutDuration,
  formatLockoutTime,
  handleFailedAttempt,
  checkAndClearLockout,
  getRemainingLockoutTime,
} from './failedAttempts';
export type { WarningLevel } from './failedAttempts';

export {
  isPatternConfigured,
  storePatternHash,
  verifyPattern,
  clearPatternCredentials,
} from './patternStorage';

export {
  validatePattern,
  setupPattern,
  attemptPatternAuth,
  changePattern,
  MIN_PATTERN_LENGTH,
  MAX_PATTERN_LENGTH,
} from './patternManager';
export type { PatternValidation } from './patternManager';
