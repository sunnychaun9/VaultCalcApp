/**
 * VaultCalc - Crypto Service Exports
 *
 * Public API for cryptographic operations.
 *
 * @see FEATURE_INDEX.md CRYPTO-001, CRYPTO-002
 */

// Main crypto service
export {
  // Initialization
  initializeCrypto,
  isCryptoReady,
  // Encryption/Decryption
  encryptString,
  decryptString,
  encryptData,
  decryptData,
  // Key generation
  generateKey,
  generateNonce,
  generateSalt,
  // PIN operations (CRYPTO-002)
  hashPin,
  verifyPin,
  deriveKeyFromPin,
  // File operations (FILE-002)
  encryptFile,
  decryptFile,
  // Streaming file operations (VIDEO-001)
  encryptFileStreaming,
  decryptFileStreaming,
  getVaultDirectory,
} from './cryptoService';

export type {
  CryptoResult,
  CryptoError,
  PinHashResult,
  DerivedKeyResult,
} from './cryptoService';

// Native module (for advanced use)
export { NativeCrypto, CryptoErrorCodes } from './nativeCrypto';
export type { CryptoErrorCode } from './nativeCrypto';
