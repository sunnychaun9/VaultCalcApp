/**
 * VaultCalc - Native Crypto Module Interface
 *
 * TypeScript interface for the native CryptoModule.
 * Provides type-safe access to cryptographic operations.
 *
 * @see FEATURE_INDEX.md CRYPTO-001, CRYPTO-002
 */

import { NativeModules, Platform } from 'react-native';

/**
 * Native CryptoModule interface
 */
interface CryptoModuleInterface {
  /**
   * Initialize the crypto module with Android Keystore.
   * Must be called before any encryption/decryption operations.
   */
  initialize(): Promise<boolean>;

  /**
   * Check if the crypto module is initialized.
   */
  isInitialized(): Promise<boolean>;

  /**
   * Encrypt data using AES-256-GCM.
   * @param plaintext Base64-encoded plaintext data
   * @param associatedData Optional associated data for authentication
   * @returns Base64-encoded ciphertext
   */
  encrypt(plaintext: string, associatedData: string | null): Promise<string>;

  /**
   * Decrypt data using AES-256-GCM.
   * @param ciphertext Base64-encoded ciphertext
   * @param associatedData Optional associated data (must match encryption)
   * @returns Base64-encoded plaintext
   */
  decrypt(ciphertext: string, associatedData: string | null): Promise<string>;

  /**
   * Encrypt a string directly.
   * @param text Plain text string to encrypt
   * @param associatedData Optional associated data
   * @returns Base64-encoded ciphertext
   */
  encryptString(text: string, associatedData: string | null): Promise<string>;

  /**
   * Decrypt to a string directly.
   * @param ciphertext Base64-encoded ciphertext
   * @param associatedData Optional associated data
   * @returns Decrypted plain text string
   */
  decryptString(ciphertext: string, associatedData: string | null): Promise<string>;

  /**
   * Generate a random key.
   * @param length Number of bytes (default 32 for 256-bit)
   * @returns Base64-encoded random bytes
   */
  generateRandomKey(length: number): Promise<string>;

  /**
   * Derive a key from a PIN using Argon2id.
   * Uses memory-hard parameters (64MB) to resist attacks.
   * @param pin The PIN to derive key from
   * @param salt Base64-encoded salt, or null to generate new
   * @returns Object with derivedKey and salt (both Base64)
   */
  deriveKeyFromPin(
    pin: string,
    salt: string | null
  ): Promise<{ derivedKey: string; salt: string }>;

  /**
   * Hash a PIN for storage using Argon2id.
   * @param pin The PIN to hash
   * @param salt Base64-encoded salt, or null to generate new
   * @returns Object with hash and salt (both Base64)
   */
  hashPin(pin: string, salt: string | null): Promise<{ derivedKey: string; salt: string }>;

  /**
   * Verify a PIN against a stored hash.
   * Uses constant-time comparison to prevent timing attacks.
   * @param pin The PIN to verify
   * @param storedHash The stored hash to compare against
   * @param salt The salt used for the stored hash
   * @returns Boolean indicating if PIN matches
   */
  verifyPin(pin: string, storedHash: string, salt: string): Promise<boolean>;

  /**
   * Encrypt a file from a content URI to a destination path.
   * Reads, encrypts, and writes entirely on the native side.
   * @param sourceUri content:// URI from file picker
   * @param destPath Absolute path for encrypted output
   * @param associatedData Optional associated data for authentication
   */
  encryptFile(sourceUri: string, destPath: string, associatedData: string | null): Promise<boolean>;

  /**
   * Decrypt a file from an encrypted path to a destination path.
   * @param sourcePath Absolute path to encrypted file
   * @param destPath Absolute path for decrypted output
   * @param associatedData Optional associated data (must match encryption)
   */
  decryptFile(sourcePath: string, destPath: string, associatedData: string | null): Promise<boolean>;

  /**
   * Encrypt a file using streaming AEAD for large file support (VIDEO-001).
   * Processes in chunks — safe for arbitrarily large files.
   * @param sourceUri content:// URI or absolute path of source file
   * @param destPath Absolute path for encrypted output
   * @param associatedData Optional associated data for authentication
   */
  encryptFileStreaming(sourceUri: string, destPath: string, associatedData: string | null): Promise<boolean>;

  /**
   * Decrypt a streaming-AEAD encrypted file (VIDEO-001).
   * Processes in chunks — safe for arbitrarily large files.
   * @param sourcePath Absolute path to the streaming-encrypted file
   * @param destPath Absolute path for decrypted output
   * @param associatedData Optional associated data (must match encryption)
   */
  decryptFileStreaming(sourcePath: string, destPath: string, associatedData: string | null): Promise<boolean>;

  /**
   * Get the app-private vault directory path.
   * @returns Absolute path to the vault directory
   */
  getVaultDirectory(): Promise<string>;
}

/**
 * Get the native CryptoModule (lazy — resolved on first access)
 */
let cachedModule: CryptoModuleInterface | null = null;

function getCryptoModule(): CryptoModuleInterface {
  if (cachedModule) {
    return cachedModule;
  }

  if (Platform.OS !== 'android') {
    throw new Error('CryptoModule is only available on Android');
  }

  const { CryptoModule } = NativeModules;

  if (!CryptoModule) {
    throw new Error(
      'CryptoModule is not available. Make sure the native module is properly linked.'
    );
  }

  cachedModule = CryptoModule as CryptoModuleInterface;
  return cachedModule;
}

/**
 * Native crypto module proxy — lazily resolves the native module on first method call.
 * This avoids accessing NativeModules at import time, which can fail if the
 * React Native bridge hasn't finished initializing.
 */
export const NativeCrypto: CryptoModuleInterface = new Proxy({} as CryptoModuleInterface, {
  get(_target, prop: string) {
    const module = getCryptoModule();
    return module[prop as keyof CryptoModuleInterface];
  },
});

/**
 * Crypto error codes
 */
export const CryptoErrorCodes = {
  NOT_INITIALIZED: 'CRYPTO_NOT_INITIALIZED',
  INIT_ERROR: 'CRYPTO_INIT_ERROR',
  ENCRYPT_ERROR: 'CRYPTO_ENCRYPT_ERROR',
  DECRYPT_ERROR: 'CRYPTO_DECRYPT_ERROR',
  KEYGEN_ERROR: 'CRYPTO_KEYGEN_ERROR',
  KDF_ERROR: 'CRYPTO_KDF_ERROR',
  VERIFY_ERROR: 'CRYPTO_VERIFY_ERROR',
  FILE_ENCRYPT_ERROR: 'CRYPTO_FILE_ENCRYPT_ERROR',
  FILE_DECRYPT_ERROR: 'CRYPTO_FILE_DECRYPT_ERROR',
} as const;

export type CryptoErrorCode = (typeof CryptoErrorCodes)[keyof typeof CryptoErrorCodes];
