/**
 * VaultCalc - MMKV Storage Service
 *
 * Provides fast, synchronous key-value storage using MMKV.
 * Used for app settings and preferences (NOT for sensitive data).
 *
 * For sensitive data, use the native CryptoModule with Android Keystore.
 *
 * @see PROJECT_CONTEXT.md Section 9
 * @see 04-Technical-Architecture.md Section 4
 */

import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Main MMKV storage instance for app preferences
 *
 * Note: This is NOT encrypted. Do not store:
 * - PINs or passwords
 * - Encryption keys
 * - Sensitive user data
 *
 * Safe to store:
 * - Theme preference
 * - Lock timeout setting
 * - Feature flags
 * - First launch status
 */
export const storage: MMKV = createMMKV({
  id: 'vaultcalc-preferences',
});

/**
 * Zustand persist storage adapter for MMKV
 *
 * Implements the StateStorage interface required by Zustand's
 * persist middleware.
 */
export const mmkvStorage = {
  getItem: (name: string): string | null => {
    const value = storage.getString(name);
    return value ?? null;
  },

  setItem: (name: string, value: string): void => {
    storage.set(name, value);
  },

  removeItem: (name: string): void => {
    storage.remove(name);
  },
};

/**
 * Storage utility functions
 */
export const storageUtils = {
  /**
   * Clear all stored preferences
   * Use with caution - this resets all settings
   */
  clearAll: (): void => {
    storage.clearAll();
  },

  /**
   * Check if a key exists
   */
  hasKey: (key: string): boolean => {
    return storage.contains(key);
  },

  /**
   * Get all stored keys
   */
  getAllKeys: (): string[] => {
    return storage.getAllKeys();
  },
};
