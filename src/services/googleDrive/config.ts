/**
 * VaultCalc - Google Drive Configuration
 *
 * Constants for Google Sign-In with Drive scope.
 * Replace GOOGLE_WEB_CLIENT_ID with your actual Web OAuth client ID
 * from Google Cloud Console.
 *
 * @see FEATURE_INDEX.md CLOUD-001
 */

export const GOOGLE_WEB_CLIENT_ID = '592721351328-5t5npunkln76pj2clhchbvn41lno1qdo.apps.googleusercontent.com';

export const GOOGLE_DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/** Returns false if the placeholder client ID has not been replaced */
export function isGoogleDriveConfigured(): boolean {
  return !GOOGLE_WEB_CLIENT_ID.startsWith('YOUR_');
}
