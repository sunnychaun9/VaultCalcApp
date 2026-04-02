/**
 * VaultCalc - Centralized Permission Service
 *
 * TypeScript wrapper around the native PermissionModule.
 * Provides a single API for checking and requesting permissions
 * with rationale dialogs and permanent-denial handling.
 *
 * Permission keys (platform-agnostic):
 *   "camera"        → CAMERA
 *   "location"      → ACCESS_COARSE_LOCATION
 *   "photos"        → READ_MEDIA_IMAGES (API 33+) or READ_EXTERNAL_STORAGE
 *   "videos"        → READ_MEDIA_VIDEO (API 33+) or READ_EXTERNAL_STORAGE
 *   "notifications" → POST_NOTIFICATIONS (API 33+, auto-granted below)
 */

import { NativeModules, Platform } from 'react-native';

export type PermissionKey =
  | 'camera'
  | 'location'
  | 'photos'
  | 'videos'
  | 'notifications';

export type PermissionStatus = 'granted' | 'denied' | 'permanently_denied';

interface PermissionModuleInterface {
  check(key: string): Promise<boolean>;
  request(key: string): Promise<string>;
  requestMultiple(keys: string[]): Promise<Record<string, string>>;
}

function getModule(): PermissionModuleInterface {
  if (Platform.OS !== 'android') {
    throw new Error('PermissionModule is only available on Android');
  }
  const mod = NativeModules.PermissionModule as PermissionModuleInterface | undefined;
  if (!mod) {
    throw new Error(
      'PermissionModule is not available. Did you register PermissionPackage?',
    );
  }
  return mod;
}

/**
 * Check if a permission is currently granted (no prompt).
 */
export async function checkPermission(key: PermissionKey): Promise<boolean> {
  try {
    return await getModule().check(key);
  } catch {
    return false;
  }
}

/**
 * Request a single permission with the full native flow:
 * 1. Rationale dialog (if needed)
 * 2. System permission prompt
 * 3. Settings redirect on permanent denial
 *
 * @returns The final permission status
 */
export async function requestPermission(
  key: PermissionKey,
): Promise<PermissionStatus> {
  try {
    const result = await getModule().request(key);
    return result as PermissionStatus;
  } catch {
    return 'denied';
  }
}

/**
 * Request multiple permissions in one flow.
 *
 * @returns Map of permission key → status
 */
export async function requestMultiplePermissions(
  keys: PermissionKey[],
): Promise<Record<PermissionKey, PermissionStatus>> {
  try {
    const result = await getModule().requestMultiple(keys);
    return result as Record<PermissionKey, PermissionStatus>;
  } catch {
    return Object.fromEntries(
      keys.map(k => [k, 'denied' as PermissionStatus]),
    ) as Record<PermissionKey, PermissionStatus>;
  }
}

/**
 * Convenience: request a permission and return a simple boolean.
 * Use when you only care about granted/not-granted.
 */
export async function ensurePermission(key: PermissionKey): Promise<boolean> {
  const status = await requestPermission(key);
  return status === 'granted';
}
