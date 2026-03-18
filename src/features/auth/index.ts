/**
 * VaultCalc - Auth Feature Module
 *
 * Public exports for the authentication feature.
 */

// Services
export {
  // PIN Storage
  isPinConfigured,
  storePinCredentials,
  getPinCredentials,
  clearPinCredentials,
  // Auth Service
  isValidPinFormat,
  isPotentialPin,
  attemptPinAuth,
  setupPin,
  changePin,
  isAuthRequired,
  getPinRules,
  // Pattern Lock
  isPatternConfigured,
  setupPattern,
  attemptPatternAuth,
  changePattern,
  validatePattern,
  clearPatternCredentials,
  MIN_PATTERN_LENGTH,
} from './services';
export type { PinCredentials, AuthResult, PatternValidation } from './services';

// Hooks
export { usePinAuth, useBiometricAuth, useAuthSession, useActivityTracker, useFailedAttempts } from './hooks';
export type { PinAuthResult } from './hooks';

// Components
export { AuthGuard } from './components';
export { PatternView } from './components/PatternView';
export type { PatternState } from './components/PatternView';
export { LockScreenContainer } from './components/LockScreenContainer';

// Screens
export { PinSetupScreen, ChangePinScreen, DecoyPinSetupScreen, PatternSetupScreen, ChangePatternScreen, PatternUnlockScreen } from './screens';
