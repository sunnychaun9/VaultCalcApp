/**
 * VaultCalc - Pattern Lock Storage Service
 *
 * Securely stores and retrieves pattern lock credentials.
 * Pattern is never stored in plain text - hashed with Argon2id (same as PIN).
 * Uses the same encryption layer as PIN storage for defense-in-depth.
 *
 * @see AUTH-009 Pattern Lock
 */

import { hashPin, verifyPin, initializeCrypto } from '@services/crypto';
import { encryptString, decryptString } from '@services/crypto';
import { mmkvStorage } from '@services/storage/mmkv';
import { NativeModules } from 'react-native';

/** Storage keys */
const STORAGE_KEYS = {
  PATTERN_HASH: 'vaultcalc_pattern_hash',
  PATTERN_SALT: 'vaultcalc_pattern_salt',
  PATTERN_CONFIGURED: 'vaultcalc_pattern_configured',
} as const;

/**
 * Convert pattern sequence to a string for hashing.
 * Uses a deterministic format that the Argon2id hasher accepts.
 */
function patternToString(pattern: number[]): string {
  return pattern.join('-');
}

/**
 * Check if a pattern has been configured.
 */
export function isPatternConfigured(): boolean {
  return mmkvStorage.getItem(STORAGE_KEYS.PATTERN_CONFIGURED) === 'true';
}

/**
 * Store pattern hash securely.
 * Uses Argon2id hashing (same as PIN) + encryption before storage.
 */
export async function storePatternHash(pattern: number[]): Promise<boolean> {
  try {
    await initializeCrypto();

    const patternStr = patternToString(pattern);

    // Hash with Argon2id
    const hashResult = await hashPin(patternStr);
    if (!hashResult.success || !hashResult.data) {
      return false;
    }

    // Encrypt hash and salt before storage (defense in depth)
    const encryptedHash = await encryptString(hashResult.data.hash, 'pattern_hash');
    const encryptedSalt = await encryptString(hashResult.data.salt, 'pattern_salt');

    if (!encryptedHash.success || !encryptedSalt.success) {
      return false;
    }

    mmkvStorage.setItem(STORAGE_KEYS.PATTERN_HASH, encryptedHash.data!);
    mmkvStorage.setItem(STORAGE_KEYS.PATTERN_SALT, encryptedSalt.data!);
    mmkvStorage.setItem(STORAGE_KEYS.PATTERN_CONFIGURED, 'true');

    // Sync pattern to native AppLockModule for native lock screen verification
    try {
      await NativeModules.AppLockModule?.setAppLockCredentials('pattern', pattern);
    } catch {}

    return true;
  } catch {
    return false;
  }
}

/**
 * Verify a drawn pattern against the stored hash.
 */
export async function verifyPattern(pattern: number[]): Promise<boolean> {
  try {
    const encryptedHash = mmkvStorage.getItem(STORAGE_KEYS.PATTERN_HASH);
    const encryptedSalt = mmkvStorage.getItem(STORAGE_KEYS.PATTERN_SALT);

    if (!encryptedHash || !encryptedSalt) {
      return false;
    }

    // Decrypt stored credentials
    const hash = await decryptString(encryptedHash, 'pattern_hash');
    const salt = await decryptString(encryptedSalt, 'pattern_salt');

    if (!hash.success || !salt.success || !hash.data || !salt.data) {
      return false;
    }

    // Verify using constant-time comparison via native module
    const patternStr = patternToString(pattern);
    const result = await verifyPin(patternStr, hash.data, salt.data);

    return result.success && result.data === true;
  } catch {
    return false;
  }
}

/**
 * Clear stored pattern credentials.
 */
export function clearPatternCredentials(): void {
  mmkvStorage.removeItem(STORAGE_KEYS.PATTERN_HASH);
  mmkvStorage.removeItem(STORAGE_KEYS.PATTERN_SALT);
  mmkvStorage.removeItem(STORAGE_KEYS.PATTERN_CONFIGURED);
}
