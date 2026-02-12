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
} from './services';
export type { PinCredentials, AuthResult } from './services';

// Hooks
export { usePinAuth, useBiometricAuth, useAuthSession, useActivityTracker, useFailedAttempts } from './hooks';
export type { PinAuthResult } from './hooks';

// Components
export { AuthGuard } from './components';

// Screens
export { PinSetupScreen, ChangePinScreen, DecoyPinSetupScreen } from './screens';
