/**
 * VaultCalc - Google Drive Service
 *
 * Public API for Google Drive authentication.
 *
 * @see FEATURE_INDEX.md CLOUD-001
 */

export {
  signInToGoogle,
  signOutFromGoogle,
  isSignedIn,
  getAccessToken,
  signInSilently,
  getErrorMessage,
} from './googleAuthService';

export { isGoogleDriveConfigured } from './config';

export type {
  GoogleAccount,
  GoogleSignInResult,
  GoogleSignInErrorCode,
  AccessTokenResult,
} from './types';
