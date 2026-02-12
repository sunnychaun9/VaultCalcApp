/**
 * VaultCalc - Google Drive Types
 *
 * TypeScript interfaces for Google Sign-In operations.
 *
 * @see FEATURE_INDEX.md CLOUD-001
 */

export interface GoogleAccount {
  email: string;
  displayName: string | null;
  photo: string | null;
}

export type GoogleSignInErrorCode =
  | 'SIGN_IN_CANCELLED'
  | 'PLAY_SERVICES_NOT_AVAILABLE'
  | 'CONFIGURATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface GoogleSignInResult {
  success: boolean;
  account?: GoogleAccount;
  error?: string;
  errorCode?: GoogleSignInErrorCode;
}

export interface AccessTokenResult {
  success: boolean;
  token?: string;
  error?: string;
}
