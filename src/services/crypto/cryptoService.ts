/**
 * VaultCalc - Crypto Service
 *
 * High-level cryptographic service wrapping the native module.
 * Provides a clean API for encryption/decryption and PIN operations.
 *
 * @see FEATURE_INDEX.md CRYPTO-001, CRYPTO-002
 */

import { NativeCrypto, CryptoErrorCodes, type CryptoErrorCode } from './nativeCrypto';

/**
 * Crypto operation result
 */
export interface CryptoResult<T> {
  success: boolean;
  data?: T;
  error?: CryptoError;
}

/**
 * Crypto error
 */
export interface CryptoError {
  code: CryptoErrorCode | 'UNKNOWN_ERROR';
  message: string;
}

/**
 * Singleton state for initialization
 */
let isInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

/**
 * Initialize the crypto service.
 * Safe to call multiple times - will only initialize once.
 */
export async function initializeCrypto(): Promise<CryptoResult<boolean>> {
  // Return cached promise if initialization is in progress
  if (initializationPromise) {
    try {
      const result = await initializationPromise;
      return { success: true, data: result };
    } catch (error) {
      return handleError(error);
    }
  }

  // Already initialized
  if (isInitialized) {
    return { success: true, data: true };
  }

  // Start initialization
  initializationPromise = NativeCrypto.initialize();

  try {
    const result = await initializationPromise;
    isInitialized = result;
    return { success: true, data: result };
  } catch (error) {
    initializationPromise = null;
    return handleError(error);
  }
}

/**
 * Check if crypto service is ready.
 */
export async function isCryptoReady(): Promise<boolean> {
  if (isInitialized) {
    return true;
  }

  try {
    return await NativeCrypto.isInitialized();
  } catch {
    return false;
  }
}

/**
 * Ensure crypto is initialized before operation.
 */
async function ensureInitialized(): Promise<void> {
  if (!isInitialized) {
    const result = await initializeCrypto();
    if (!result.success) {
      throw new Error(result.error?.message ?? 'Crypto initialization failed');
    }
  }
}

/**
 * Encrypt a string.
 *
 * @param plaintext The string to encrypt
 * @param context Optional context string for authenticated encryption
 * @returns Encrypted ciphertext (Base64)
 */
export async function encryptString(
  plaintext: string,
  context?: string
): Promise<CryptoResult<string>> {
  try {
    await ensureInitialized();
    const ciphertext = await NativeCrypto.encryptString(plaintext, context ?? null);
    return { success: true, data: ciphertext };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Decrypt a string.
 *
 * @param ciphertext The ciphertext to decrypt (Base64)
 * @param context Optional context string (must match encryption)
 * @returns Decrypted plaintext string
 */
export async function decryptString(
  ciphertext: string,
  context?: string
): Promise<CryptoResult<string>> {
  try {
    await ensureInitialized();
    const plaintext = await NativeCrypto.decryptString(ciphertext, context ?? null);
    return { success: true, data: plaintext };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Encrypt binary data (provided as Base64).
 *
 * @param dataBase64 Base64-encoded data to encrypt
 * @param context Optional context for authenticated encryption
 * @returns Encrypted ciphertext (Base64)
 */
export async function encryptData(
  dataBase64: string,
  context?: string
): Promise<CryptoResult<string>> {
  try {
    await ensureInitialized();
    const ciphertext = await NativeCrypto.encrypt(dataBase64, context ?? null);
    return { success: true, data: ciphertext };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Decrypt binary data.
 *
 * @param ciphertext Base64-encoded ciphertext
 * @param context Optional context (must match encryption)
 * @returns Decrypted data (Base64)
 */
export async function decryptData(
  ciphertext: string,
  context?: string
): Promise<CryptoResult<string>> {
  try {
    await ensureInitialized();
    const plaintext = await NativeCrypto.decrypt(ciphertext, context ?? null);
    return { success: true, data: plaintext };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Generate a random encryption key.
 *
 * @param bytes Number of bytes (default 32 for 256-bit key)
 * @returns Base64-encoded random key
 */
export async function generateKey(bytes: number = 32): Promise<CryptoResult<string>> {
  try {
    await ensureInitialized();
    const key = await NativeCrypto.generateRandomKey(bytes);
    return { success: true, data: key };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Generate a random nonce/IV.
 *
 * @param bytes Number of bytes (default 12 for GCM nonce)
 * @returns Base64-encoded random nonce
 */
export async function generateNonce(bytes: number = 12): Promise<CryptoResult<string>> {
  return generateKey(bytes);
}

/**
 * Generate a random salt.
 *
 * @param bytes Number of bytes (default 16)
 * @returns Base64-encoded random salt
 */
export async function generateSalt(bytes: number = 16): Promise<CryptoResult<string>> {
  return generateKey(bytes);
}

// ============================================================================
// PIN Operations (CRYPTO-002)
// ============================================================================

/**
 * PIN hash result containing hash and salt
 */
export interface PinHashResult {
  /** Argon2id hash (Base64) */
  hash: string;
  /** Salt used for hashing (Base64) */
  salt: string;
}

/**
 * Derived key result containing key and salt
 */
export interface DerivedKeyResult {
  /** Derived encryption key (Base64) */
  key: string;
  /** Salt used for derivation (Base64) */
  salt: string;
}

/**
 * Hash a PIN for secure storage using Argon2id.
 * Generates a new random salt if not provided.
 *
 * Security parameters:
 * - Memory: 64MB (memory-hard to resist GPU attacks)
 * - Iterations: 3
 * - Parallelism: 4
 * - Output: 256-bit hash
 *
 * @param pin The PIN to hash
 * @param existingSalt Optional existing salt (for re-hashing)
 * @returns Hash and salt for storage
 */
export async function hashPin(
  pin: string,
  existingSalt?: string
): Promise<CryptoResult<PinHashResult>> {
  try {
    await ensureInitialized();
    const result = await NativeCrypto.hashPin(pin, existingSalt ?? null);
    return {
      success: true,
      data: {
        hash: result.derivedKey,
        salt: result.salt,
      },
    };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Verify a PIN against a stored hash.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param pin The PIN to verify
 * @param storedHash The stored Argon2id hash
 * @param salt The salt used when hashing
 * @returns Whether the PIN matches
 */
export async function verifyPin(
  pin: string,
  storedHash: string,
  salt: string
): Promise<CryptoResult<boolean>> {
  try {
    await ensureInitialized();
    const isValid = await NativeCrypto.verifyPin(pin, storedHash, salt);
    return { success: true, data: isValid };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Derive an encryption key from a PIN using Argon2id.
 * Used for PIN-based file encryption.
 *
 * @param pin The PIN to derive key from
 * @param existingSalt Optional existing salt (for re-derivation)
 * @returns Derived key and salt
 */
export async function deriveKeyFromPin(
  pin: string,
  existingSalt?: string
): Promise<CryptoResult<DerivedKeyResult>> {
  try {
    await ensureInitialized();
    const result = await NativeCrypto.deriveKeyFromPin(pin, existingSalt ?? null);
    return {
      success: true,
      data: {
        key: result.derivedKey,
        salt: result.salt,
      },
    };
  } catch (error) {
    return handleError(error);
  }
}

// ============================================================================
// File Operations (FILE-002)
// ============================================================================

/**
 * Encrypt a file from a content URI to a destination path.
 * Performed entirely on the native side for efficiency.
 *
 * @param sourceUri content:// URI from file picker
 * @param destPath Absolute destination path for encrypted output
 * @param context Optional context string for authenticated encryption
 */
export async function encryptFile(
  sourceUri: string,
  destPath: string,
  context?: string
): Promise<CryptoResult<boolean>> {
  try {
    await ensureInitialized();
    const result = await NativeCrypto.encryptFile(sourceUri, destPath, context ?? null);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Decrypt a file from an encrypted path to a destination path.
 *
 * @param sourcePath Absolute path to encrypted file
 * @param destPath Absolute destination path for decrypted output
 * @param context Optional context string (must match encryption)
 */
export async function decryptFile(
  sourcePath: string,
  destPath: string,
  context?: string
): Promise<CryptoResult<boolean>> {
  try {
    await ensureInitialized();
    const result = await NativeCrypto.decryptFile(sourcePath, destPath, context ?? null);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Encrypt a file using streaming AEAD for large file support (VIDEO-001).
 * Processes in chunks — safe for arbitrarily large files (videos, etc.).
 *
 * @param sourceUri content:// URI or absolute path of source file
 * @param destPath Absolute destination path for encrypted output
 * @param context Optional context string for authenticated encryption
 */
export async function encryptFileStreaming(
  sourceUri: string,
  destPath: string,
  context?: string
): Promise<CryptoResult<boolean>> {
  try {
    await ensureInitialized();
    const result = await NativeCrypto.encryptFileStreaming(sourceUri, destPath, context ?? null);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Decrypt a streaming-AEAD encrypted file (VIDEO-001).
 * Processes in chunks — safe for arbitrarily large files.
 *
 * @param sourcePath Absolute path to the streaming-encrypted file
 * @param destPath Absolute destination path for decrypted output
 * @param context Optional context string (must match encryption)
 */
export async function decryptFileStreaming(
  sourcePath: string,
  destPath: string,
  context?: string
): Promise<CryptoResult<boolean>> {
  try {
    await ensureInitialized();
    const result = await NativeCrypto.decryptFileStreaming(sourcePath, destPath, context ?? null);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Get the app-private vault directory path.
 */
export async function getVaultDirectory(): Promise<CryptoResult<string>> {
  try {
    const dir = await NativeCrypto.getVaultDirectory();
    return { success: true, data: dir };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Handle errors from native module.
 */
function handleError(error: unknown): CryptoResult<never> {
  if (error instanceof Error) {
    // Check for known error codes
    const message = error.message;

    for (const code of Object.values(CryptoErrorCodes)) {
      if (message.includes(code)) {
        return {
          success: false,
          error: { code, message },
        };
      }
    }

    return {
      success: false,
      error: { code: 'UNKNOWN_ERROR', message: message },
    };
  }

  return {
    success: false,
    error: { code: 'UNKNOWN_ERROR', message: String(error) },
  };
}
