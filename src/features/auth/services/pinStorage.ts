/**
 * VaultCalc - PIN Storage Service
 *
 * Securely stores and retrieves PIN credentials.
 * PIN is never stored in plain text - only Argon2id hash and salt.
 *
 * @see FEATURE_INDEX.md AUTH-002
 */

import { encryptString, decryptString, initializeCrypto } from '@services/crypto';
import { mmkvStorage } from '@services/storage/mmkv';

/** Storage keys */
const STORAGE_KEYS = {
  PIN_HASH: 'vaultcalc_pin_hash',
  PIN_SALT: 'vaultcalc_pin_salt',
  DECOY_PIN_HASH: 'vaultcalc_decoy_pin_hash',
  DECOY_PIN_SALT: 'vaultcalc_decoy_pin_salt',
  PIN_CONFIGURED: 'vaultcalc_pin_configured',
} as const;

/** PIN credentials (hash + salt) */
export interface PinCredentials {
  hash: string;
  salt: string;
}

/**
 * Check if a PIN has been configured.
 */
export function isPinConfigured(): boolean {
  return mmkvStorage.getItem(STORAGE_KEYS.PIN_CONFIGURED) === 'true';
}

/**
 * Store PIN credentials securely.
 * The hash and salt are encrypted before storage.
 *
 * @param credentials The PIN hash and salt to store
 * @param isDecoy Whether this is for the decoy PIN
 */
export async function storePinCredentials(
  credentials: PinCredentials,
  isDecoy: boolean = false
): Promise<boolean> {
  try {
    // Initialize crypto if needed
    await initializeCrypto();

    const hashKey = isDecoy ? STORAGE_KEYS.DECOY_PIN_HASH : STORAGE_KEYS.PIN_HASH;
    const saltKey = isDecoy ? STORAGE_KEYS.DECOY_PIN_SALT : STORAGE_KEYS.PIN_SALT;

    // Encrypt the hash and salt before storage (defense in depth)
    const encryptedHash = await encryptString(credentials.hash, 'pin_hash');
    const encryptedSalt = await encryptString(credentials.salt, 'pin_salt');

    if (!encryptedHash.success || !encryptedSalt.success) {
      return false;
    }

    // Store encrypted credentials
    mmkvStorage.setItem(hashKey, encryptedHash.data!);
    mmkvStorage.setItem(saltKey, encryptedSalt.data!);

    // Mark PIN as configured (only for primary PIN)
    if (!isDecoy) {
      mmkvStorage.setItem(STORAGE_KEYS.PIN_CONFIGURED, 'true');
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieve stored PIN credentials.
 *
 * @param isDecoy Whether to retrieve decoy PIN credentials
 * @returns PIN credentials or null if not found
 */
export async function getPinCredentials(
  isDecoy: boolean = false
): Promise<PinCredentials | null> {
  try {
    const hashKey = isDecoy ? STORAGE_KEYS.DECOY_PIN_HASH : STORAGE_KEYS.PIN_HASH;
    const saltKey = isDecoy ? STORAGE_KEYS.DECOY_PIN_SALT : STORAGE_KEYS.PIN_SALT;

    const encryptedHash = mmkvStorage.getItem(hashKey);
    const encryptedSalt = mmkvStorage.getItem(saltKey);

    if (!encryptedHash || !encryptedSalt) {
      return null;
    }

    // Decrypt the stored credentials
    const hash = await decryptString(encryptedHash, 'pin_hash');
    const salt = await decryptString(encryptedSalt, 'pin_salt');

    if (!hash.success || !salt.success) {
      return null;
    }

    return {
      hash: hash.data!,
      salt: salt.data!,
    };
  } catch {
    return null;
  }
}

/**
 * Clear all stored PIN credentials.
 * Used when resetting the app or changing PIN.
 */
export function clearPinCredentials(): void {
  mmkvStorage.removeItem(STORAGE_KEYS.PIN_HASH);
  mmkvStorage.removeItem(STORAGE_KEYS.PIN_SALT);
  mmkvStorage.removeItem(STORAGE_KEYS.PIN_CONFIGURED);
}

/**
 * Clear decoy PIN credentials.
 */
export function clearDecoyPinCredentials(): void {
  mmkvStorage.removeItem(STORAGE_KEYS.DECOY_PIN_HASH);
  mmkvStorage.removeItem(STORAGE_KEYS.DECOY_PIN_SALT);
}

/**
 * Check if decoy PIN is configured.
 */
export async function isDecoyPinConfigured(): Promise<boolean> {
  const credentials = await getPinCredentials(true);
  return credentials !== null;
}
