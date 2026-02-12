/**
 * VaultCalc - Google Auth Service
 *
 * High-level API for Google Sign-In with Drive scope.
 * Never throws — all functions return result objects.
 * Follows the same pattern as biometricService.
 *
 * @see FEATURE_INDEX.md CLOUD-001
 */

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_DRIVE_SCOPES, isGoogleDriveConfigured } from './config';
import type { GoogleSignInResult, GoogleSignInErrorCode, AccessTokenResult } from './types';

let configured = false;

/** Configure GoogleSignin once per session. Returns false if placeholder client ID. */
function ensureConfigured(): boolean {
  if (configured) return true;

  if (!isGoogleDriveConfigured()) {
    return false;
  }

  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: GOOGLE_DRIVE_SCOPES,
    offlineAccess: true,
  });

  configured = true;
  return true;
}

/** Map native error code to our error code union */
function mapErrorCode(code: string): GoogleSignInErrorCode {
  if (code === statusCodes.SIGN_IN_CANCELLED) return 'SIGN_IN_CANCELLED';
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'PLAY_SERVICES_NOT_AVAILABLE';
  return 'UNKNOWN_ERROR';
}

/**
 * Show the Google account picker and request Drive permissions.
 * Returns the signed-in account on success.
 */
export async function signInToGoogle(): Promise<GoogleSignInResult> {
  try {
    if (!ensureConfigured()) {
      return {
        success: false,
        error: getErrorMessage('CONFIGURATION_ERROR'),
        errorCode: 'CONFIGURATION_ERROR',
      };
    }

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();

    if (response.type === 'cancelled') {
      return {
        success: false,
        error: getErrorMessage('SIGN_IN_CANCELLED'),
        errorCode: 'SIGN_IN_CANCELLED',
      };
    }

    const { user } = response.data;
    return {
      success: true,
      account: {
        email: user.email,
        displayName: user.name,
        photo: user.photo,
      },
    };
  } catch (error: unknown) {
    const code = error instanceof Error && 'code' in error
      ? mapErrorCode((error as { code: string }).code)
      : 'UNKNOWN_ERROR';

    return {
      success: false,
      error: getErrorMessage(code),
      errorCode: code,
    };
  }
}

/**
 * Sign out and revoke access. Returns true on success.
 */
export async function signOutFromGoogle(): Promise<boolean> {
  try {
    if (!ensureConfigured()) return false;
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
    return true;
  } catch {
    // Best-effort sign out
    try {
      await GoogleSignin.signOut();
    } catch {
      // ignore
    }
    return true;
  }
}

/**
 * Check if the user has a valid Google session.
 */
export function isSignedIn(): boolean {
  try {
    if (!ensureConfigured()) return false;
    return GoogleSignin.hasPreviousSignIn();
  } catch {
    return false;
  }
}

/**
 * Get a fresh access token for Google Drive API calls.
 * The library handles token refresh automatically.
 */
export async function getAccessToken(): Promise<AccessTokenResult> {
  try {
    if (!ensureConfigured()) {
      return { success: false, error: getErrorMessage('CONFIGURATION_ERROR') };
    }

    const tokens = await GoogleSignin.getTokens();
    return { success: true, token: tokens.accessToken };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get access token';
    return { success: false, error: message };
  }
}

/**
 * Restore a previous Google session without showing UI.
 * Used on app launch to silently reconnect.
 * Returns true if the session was restored.
 */
export async function signInSilently(): Promise<boolean> {
  try {
    if (!ensureConfigured()) return false;

    const response = await GoogleSignin.signInSilently();
    return response.type === 'success';
  } catch {
    return false;
  }
}

/**
 * User-friendly error message for each error code.
 */
export function getErrorMessage(code: GoogleSignInErrorCode): string {
  switch (code) {
    case 'SIGN_IN_CANCELLED':
      return 'Sign-in was cancelled.';
    case 'PLAY_SERVICES_NOT_AVAILABLE':
      return 'Google Play Services is not available on this device.';
    case 'CONFIGURATION_ERROR':
      return 'Google Drive is not configured. Please set a valid Web Client ID.';
    case 'NETWORK_ERROR':
      return 'A network error occurred. Please check your connection.';
    case 'UNKNOWN_ERROR':
      return 'An unexpected error occurred during sign-in.';
  }
}
