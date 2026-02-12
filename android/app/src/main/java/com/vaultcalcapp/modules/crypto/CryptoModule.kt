/**
 * VaultCalc - Crypto Native Module
 *
 * Provides cryptographic operations using Google Tink library.
 * Implements AES-256-GCM encryption with Android Keystore integration.
 * Includes Argon2id key derivation for PIN-based encryption.
 *
 * @see FEATURE_INDEX.md CRYPTO-001, CRYPTO-002
 */

package com.vaultcalcapp.modules.crypto

import android.net.Uri
import android.util.Base64
import com.facebook.react.bridge.*
import com.google.crypto.tink.Aead
import com.google.crypto.tink.KeyTemplates
import com.google.crypto.tink.KeysetHandle
import com.google.crypto.tink.StreamingAead
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.integration.android.AndroidKeysetManager
import com.google.crypto.tink.streamingaead.StreamingAeadConfig
import kotlinx.coroutines.*
import org.bouncycastle.crypto.generators.Argon2BytesGenerator
import org.bouncycastle.crypto.params.Argon2Parameters
import java.io.File
import java.security.GeneralSecurityException
import java.security.MessageDigest

/**
 * React Native module providing cryptographic operations.
 *
 * Features:
 * - AES-256-GCM encryption/decryption
 * - Android Keystore for master key protection
 * - Argon2id key derivation for PIN-based keys
 * - Secure key generation
 * - Base64 encoding for JS bridge compatibility
 */
class CryptoModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "CryptoModule"
        private const val KEYSET_NAME = "vaultcalc_master_keyset"
        private const val STREAMING_KEYSET_NAME = "vaultcalc_streaming_keyset"
        private const val PREF_FILE_NAME = "vaultcalc_crypto_prefs"
        private const val MASTER_KEY_URI = "android-keystore://vaultcalc_master_key"

        // Argon2id parameters per security spec (64MB memory)
        private const val ARGON2_MEMORY_KB = 65536  // 64MB
        private const val ARGON2_ITERATIONS = 3
        private const val ARGON2_PARALLELISM = 4
        private const val ARGON2_HASH_LENGTH = 32   // 256 bits for AES-256
        private const val ARGON2_SALT_LENGTH = 16   // 128 bits
    }

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var aead: Aead? = null
    private var streamingAead: StreamingAead? = null
    private var isInitialized = false

    /** The app-private files directory — all file operations must stay within this boundary. */
    private val appFilesDir: String by lazy {
        reactApplicationContext.filesDir.canonicalPath
    }

    init {
        // Register Tink configurations
        try {
            AeadConfig.register()
            StreamingAeadConfig.register()
        } catch (e: GeneralSecurityException) {
            // Config already registered, ignore
        }
    }

    /**
     * Validate that a destination path resolves within the app's private files directory.
     * Prevents path traversal attacks (e.g. "../../system/app/attacker.apk").
     *
     * @throws SecurityException if the path escapes the allowed directory
     */
    private fun validatePath(path: String) {
        val canonical = File(path).canonicalPath
        if (!canonical.startsWith(appFilesDir)) {
            throw SecurityException("Path traversal not allowed: path escapes app files directory")
        }
    }

    override fun getName(): String = NAME

    /**
     * Initialize the crypto module with Android Keystore.
     * Must be called before any encryption/decryption operations.
     */
    @ReactMethod
    fun initialize(promise: Promise) {
        scope.launch {
            try {
                if (isInitialized && aead != null) {
                    promise.resolve(true)
                    return@launch
                }

                val context = reactApplicationContext

                // Get or create a keyset handle protected by Android Keystore
                val keysetHandle = AndroidKeysetManager.Builder()
                    .withSharedPref(context, KEYSET_NAME, PREF_FILE_NAME)
                    .withKeyTemplate(KeyTemplates.get("AES256_GCM"))
                    .withMasterKeyUri(MASTER_KEY_URI)
                    .build()
                    .keysetHandle

                // Get the AEAD primitive for encryption/decryption
                aead = keysetHandle.getPrimitive(Aead::class.java)

                // Get or create a streaming keyset for large file operations (VIDEO-001)
                val streamingKeysetHandle = AndroidKeysetManager.Builder()
                    .withSharedPref(context, STREAMING_KEYSET_NAME, PREF_FILE_NAME)
                    .withKeyTemplate(KeyTemplates.get("AES256_GCM_HKDF_4KB"))
                    .withMasterKeyUri(MASTER_KEY_URI)
                    .build()
                    .keysetHandle

                streamingAead = streamingKeysetHandle.getPrimitive(StreamingAead::class.java)
                isInitialized = true

                withContext(Dispatchers.Main) {
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CRYPTO_INIT_ERROR", "Failed to initialize crypto")
                }
            }
        }
    }

    /**
     * Encrypt data using AES-256-GCM.
     *
     * @param plaintext Base64-encoded plaintext data
     * @param associatedData Optional associated data for authentication (not encrypted)
     * @return Base64-encoded ciphertext
     */
    @ReactMethod
    fun encrypt(plaintext: String, associatedData: String?, promise: Promise) {
        scope.launch {
            try {
                val aeadInstance = aead
                if (aeadInstance == null) {
                    withContext(Dispatchers.Main) {
                        promise.reject("CRYPTO_NOT_INITIALIZED", "Crypto module not initialized. Call initialize() first.")
                    }
                    return@launch
                }

                // Decode plaintext from Base64
                val plaintextBytes = Base64.decode(plaintext, Base64.NO_WRAP)
                val associatedDataBytes = associatedData?.toByteArray(Charsets.UTF_8) ?: ByteArray(0)

                // Encrypt
                val ciphertext = aeadInstance.encrypt(plaintextBytes, associatedDataBytes)

                // Encode ciphertext as Base64 for JS bridge
                val ciphertextBase64 = Base64.encodeToString(ciphertext, Base64.NO_WRAP)

                withContext(Dispatchers.Main) {
                    promise.resolve(ciphertextBase64)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CRYPTO_ENCRYPT_ERROR", "Encryption failed")
                }
            }
        }
    }

    /**
     * Decrypt data using AES-256-GCM.
     *
     * @param ciphertext Base64-encoded ciphertext
     * @param associatedData Optional associated data (must match what was used during encryption)
     * @return Base64-encoded plaintext
     */
    @ReactMethod
    fun decrypt(ciphertext: String, associatedData: String?, promise: Promise) {
        scope.launch {
            try {
                val aeadInstance = aead
                if (aeadInstance == null) {
                    withContext(Dispatchers.Main) {
                        promise.reject("CRYPTO_NOT_INITIALIZED", "Crypto module not initialized. Call initialize() first.")
                    }
                    return@launch
                }

                // Decode ciphertext from Base64
                val ciphertextBytes = Base64.decode(ciphertext, Base64.NO_WRAP)
                val associatedDataBytes = associatedData?.toByteArray(Charsets.UTF_8) ?: ByteArray(0)

                // Decrypt
                val plaintext = aeadInstance.decrypt(ciphertextBytes, associatedDataBytes)

                // Encode plaintext as Base64 for JS bridge
                val plaintextBase64 = Base64.encodeToString(plaintext, Base64.NO_WRAP)

                withContext(Dispatchers.Main) {
                    promise.resolve(plaintextBase64)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CRYPTO_DECRYPT_ERROR", "Decryption failed")
                }
            }
        }
    }

    /**
     * Encrypt a string directly (convenience method).
     *
     * @param text Plain text string to encrypt
     * @param associatedData Optional associated data
     * @return Base64-encoded ciphertext
     */
    @ReactMethod
    fun encryptString(text: String, associatedData: String?, promise: Promise) {
        scope.launch {
            try {
                val aeadInstance = aead
                if (aeadInstance == null) {
                    withContext(Dispatchers.Main) {
                        promise.reject("CRYPTO_NOT_INITIALIZED", "Crypto module not initialized. Call initialize() first.")
                    }
                    return@launch
                }

                val plaintextBytes = text.toByteArray(Charsets.UTF_8)
                val associatedDataBytes = associatedData?.toByteArray(Charsets.UTF_8) ?: ByteArray(0)

                val ciphertext = aeadInstance.encrypt(plaintextBytes, associatedDataBytes)
                val ciphertextBase64 = Base64.encodeToString(ciphertext, Base64.NO_WRAP)

                withContext(Dispatchers.Main) {
                    promise.resolve(ciphertextBase64)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CRYPTO_ENCRYPT_ERROR", "Encryption failed")
                }
            }
        }
    }

    /**
     * Decrypt to a string directly (convenience method).
     *
     * @param ciphertext Base64-encoded ciphertext
     * @param associatedData Optional associated data
     * @return Decrypted plain text string
     */
    @ReactMethod
    fun decryptString(ciphertext: String, associatedData: String?, promise: Promise) {
        scope.launch {
            try {
                val aeadInstance = aead
                if (aeadInstance == null) {
                    withContext(Dispatchers.Main) {
                        promise.reject("CRYPTO_NOT_INITIALIZED", "Crypto module not initialized. Call initialize() first.")
                    }
                    return@launch
                }

                val ciphertextBytes = Base64.decode(ciphertext, Base64.NO_WRAP)
                val associatedDataBytes = associatedData?.toByteArray(Charsets.UTF_8) ?: ByteArray(0)

                val plaintext = aeadInstance.decrypt(ciphertextBytes, associatedDataBytes)
                val plaintextString = String(plaintext, Charsets.UTF_8)

                withContext(Dispatchers.Main) {
                    promise.resolve(plaintextString)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CRYPTO_DECRYPT_ERROR", "Decryption failed")
                }
            }
        }
    }

    /**
     * Generate a random key (returns Base64-encoded bytes).
     * Useful for generating per-file encryption keys.
     *
     * @param length Number of bytes to generate (default 32 for 256-bit key)
     */
    @ReactMethod
    fun generateRandomKey(length: Int, promise: Promise) {
        scope.launch {
            try {
                val secureRandom = java.security.SecureRandom()
                val keyBytes = ByteArray(if (length > 0) length else 32)
                secureRandom.nextBytes(keyBytes)

                val keyBase64 = Base64.encodeToString(keyBytes, Base64.NO_WRAP)

                withContext(Dispatchers.Main) {
                    promise.resolve(keyBase64)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CRYPTO_KEYGEN_ERROR", "Key generation failed")
                }
            }
        }
    }

    /**
     * Check if the crypto module is initialized.
     */
    @ReactMethod
    fun isInitialized(promise: Promise) {
        promise.resolve(isInitialized && aead != null)
    }

    /**
     * Derive a key from a PIN using Argon2id.
     * Uses memory-hard parameters to resist GPU/ASIC attacks.
     *
     * @param pin The PIN to derive key from
     * @param saltBase64 Base64-encoded salt (16 bytes). If null, generates new salt.
     * @return Object containing derivedKey (Base64) and salt (Base64)
     */
    @ReactMethod
    fun deriveKeyFromPin(pin: String, saltBase64: String?, promise: Promise) {
        scope.launch {
            try {
                // Generate or decode salt
                val salt: ByteArray = if (saltBase64 != null) {
                    Base64.decode(saltBase64, Base64.NO_WRAP)
                } else {
                    val secureRandom = java.security.SecureRandom()
                    ByteArray(ARGON2_SALT_LENGTH).also { secureRandom.nextBytes(it) }
                }

                // Configure Argon2id parameters
                val params = Argon2Parameters.Builder(Argon2Parameters.ARGON2_id)
                    .withSalt(salt)
                    .withMemoryAsKB(ARGON2_MEMORY_KB)
                    .withIterations(ARGON2_ITERATIONS)
                    .withParallelism(ARGON2_PARALLELISM)
                    .build()

                // Generate the derived key
                val generator = Argon2BytesGenerator()
                generator.init(params)

                val derivedKey = ByteArray(ARGON2_HASH_LENGTH)
                val pinChars = pin.toCharArray()
                try {
                    generator.generateBytes(pinChars, derivedKey)

                    // Return both key and salt as Base64
                    val result = Arguments.createMap().apply {
                        putString("derivedKey", Base64.encodeToString(derivedKey, Base64.NO_WRAP))
                        putString("salt", Base64.encodeToString(salt, Base64.NO_WRAP))
                    }

                    withContext(Dispatchers.Main) {
                        promise.resolve(result)
                    }
                } finally {
                    pinChars.fill('\u0000')
                    derivedKey.fill(0)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CRYPTO_KDF_ERROR", "Key derivation failed")
                }
            }
        }
    }

    /**
     * Hash a PIN for storage verification using Argon2id.
     * Uses the same parameters as key derivation for consistency.
     *
     * @param pin The PIN to hash
     * @param saltBase64 Base64-encoded salt. If null, generates new salt.
     * @return Object containing hash (Base64) and salt (Base64)
     */
    @ReactMethod
    fun hashPin(pin: String, saltBase64: String?, promise: Promise) {
        // Use the same Argon2id derivation for PIN hashing
        deriveKeyFromPin(pin, saltBase64, promise)
    }

    /**
     * Verify a PIN against a stored hash using constant-time comparison.
     *
     * @param pin The PIN to verify
     * @param storedHashBase64 The stored hash to compare against
     * @param saltBase64 The salt used for the stored hash
     * @return Boolean indicating if PIN matches
     */
    @ReactMethod
    fun verifyPin(pin: String, storedHashBase64: String, saltBase64: String, promise: Promise) {
        scope.launch {
            try {
                // Derive hash from provided PIN using same salt
                val params = Argon2Parameters.Builder(Argon2Parameters.ARGON2_id)
                    .withSalt(Base64.decode(saltBase64, Base64.NO_WRAP))
                    .withMemoryAsKB(ARGON2_MEMORY_KB)
                    .withIterations(ARGON2_ITERATIONS)
                    .withParallelism(ARGON2_PARALLELISM)
                    .build()

                val generator = Argon2BytesGenerator()
                generator.init(params)

                val derivedHash = ByteArray(ARGON2_HASH_LENGTH)
                val pinChars = pin.toCharArray()
                try {
                    generator.generateBytes(pinChars, derivedHash)

                    // Constant-time comparison to prevent timing attacks
                    val storedHash = Base64.decode(storedHashBase64, Base64.NO_WRAP)
                    val isValid = MessageDigest.isEqual(derivedHash, storedHash)

                    withContext(Dispatchers.Main) {
                        promise.resolve(isValid)
                    }
                } finally {
                    pinChars.fill('\u0000')
                    derivedHash.fill(0)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CRYPTO_VERIFY_ERROR", "PIN verification failed")
                }
            }
        }
    }

    /**
     * Encrypt a file from a content URI to a destination path.
     * Reads, encrypts, and writes entirely on the native side to avoid
     * shuttling large base64 strings across the JS bridge.
     *
     * @param sourceUri content:// URI from file picker
     * @param destPath Absolute path for the encrypted output file
     * @param associatedData Optional associated data for authentication
     */
    @ReactMethod
    fun encryptFile(sourceUri: String, destPath: String, associatedData: String?, promise: Promise) {
        scope.launch {
            try {
                validatePath(destPath)

                val aeadInstance = aead
                if (aeadInstance == null) {
                    withContext(Dispatchers.Main) {
                        promise.reject("CRYPTO_NOT_INITIALIZED", "Crypto module not initialized. Call initialize() first.")
                    }
                    return@launch
                }

                val context = reactApplicationContext
                val inputStream = if (sourceUri.startsWith("/")) {
                    java.io.FileInputStream(java.io.File(sourceUri))
                } else {
                    val uri = Uri.parse(sourceUri)
                    context.contentResolver.openInputStream(uri)
                        ?: throw Exception("Cannot open input stream for URI: $sourceUri")
                }

                val plaintextBytes = inputStream.use { it.readBytes() }
                val associatedDataBytes = associatedData?.toByteArray(Charsets.UTF_8) ?: ByteArray(0)

                val ciphertext = aeadInstance.encrypt(plaintextBytes, associatedDataBytes)

                val destFile = File(destPath)
                destFile.parentFile?.mkdirs()
                destFile.writeBytes(ciphertext)

                withContext(Dispatchers.Main) {
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CRYPTO_FILE_ENCRYPT_ERROR", "File encryption failed")
                }
            }
        }
    }

    /**
     * Decrypt a file from an encrypted path to a destination path.
     *
     * @param sourcePath Absolute path to the encrypted file
     * @param destPath Absolute path for the decrypted output file
     * @param associatedData Optional associated data (must match encryption)
     */
    @ReactMethod
    fun decryptFile(sourcePath: String, destPath: String, associatedData: String?, promise: Promise) {
        scope.launch {
            try {
                validatePath(sourcePath)
                validatePath(destPath)

                val aeadInstance = aead
                if (aeadInstance == null) {
                    withContext(Dispatchers.Main) {
                        promise.reject("CRYPTO_NOT_INITIALIZED", "Crypto module not initialized. Call initialize() first.")
                    }
                    return@launch
                }

                val sourceFile = File(sourcePath)
                val ciphertextBytes = sourceFile.readBytes()
                val associatedDataBytes = associatedData?.toByteArray(Charsets.UTF_8) ?: ByteArray(0)

                val plaintext = aeadInstance.decrypt(ciphertextBytes, associatedDataBytes)

                val destFile = File(destPath)
                destFile.parentFile?.mkdirs()
                destFile.writeBytes(plaintext)

                withContext(Dispatchers.Main) {
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CRYPTO_FILE_DECRYPT_ERROR", "File decryption failed")
                }
            }
        }
    }

    /**
     * Encrypt a file using streaming AEAD for large file support (VIDEO-001).
     * Processes the file in chunks to avoid loading entire file into memory.
     *
     * @param sourceUri content:// URI or absolute path of the source file
     * @param destPath Absolute path for the encrypted output file
     * @param associatedData Optional associated data for authentication
     */
    @ReactMethod
    fun encryptFileStreaming(sourceUri: String, destPath: String, associatedData: String?, promise: Promise) {
        scope.launch {
            try {
                validatePath(destPath)

                val sAead = streamingAead
                if (sAead == null) {
                    withContext(Dispatchers.Main) {
                        promise.reject("CRYPTO_NOT_INITIALIZED", "Crypto module not initialized. Call initialize() first.")
                    }
                    return@launch
                }

                val context = reactApplicationContext
                val inputStream = if (sourceUri.startsWith("/")) {
                    java.io.FileInputStream(java.io.File(sourceUri))
                } else {
                    val uri = Uri.parse(sourceUri)
                    context.contentResolver.openInputStream(uri)
                        ?: throw Exception("Cannot open input stream for URI: $sourceUri")
                }

                val associatedDataBytes = associatedData?.toByteArray(Charsets.UTF_8) ?: ByteArray(0)

                val destFile = File(destPath)
                destFile.parentFile?.mkdirs()

                inputStream.use { input ->
                    val fileOut = java.io.FileOutputStream(destFile)
                    try {
                        sAead.newEncryptingStream(fileOut, associatedDataBytes).use { output ->
                            input.copyTo(output)
                        }
                    } catch (e: Exception) {
                        fileOut.close()
                        throw e
                    }
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CRYPTO_FILE_ENCRYPT_ERROR", "Streaming file encryption failed")
                }
            }
        }
    }

    /**
     * Decrypt a file using streaming AEAD for large file support (VIDEO-001).
     * Processes the file in chunks to avoid loading entire file into memory.
     *
     * @param sourcePath Absolute path to the streaming-encrypted file
     * @param destPath Absolute path for the decrypted output file
     * @param associatedData Optional associated data (must match encryption)
     */
    @ReactMethod
    fun decryptFileStreaming(sourcePath: String, destPath: String, associatedData: String?, promise: Promise) {
        scope.launch {
            try {
                validatePath(sourcePath)
                validatePath(destPath)

                val sAead = streamingAead
                if (sAead == null) {
                    withContext(Dispatchers.Main) {
                        promise.reject("CRYPTO_NOT_INITIALIZED", "Crypto module not initialized. Call initialize() first.")
                    }
                    return@launch
                }

                val associatedDataBytes = associatedData?.toByteArray(Charsets.UTF_8) ?: ByteArray(0)

                val destFile = File(destPath)
                destFile.parentFile?.mkdirs()

                val fileIn = java.io.FileInputStream(File(sourcePath))
                try {
                    sAead.newDecryptingStream(fileIn, associatedDataBytes).use { input ->
                        java.io.FileOutputStream(destFile).use { output ->
                            input.copyTo(output)
                        }
                    }
                } catch (e: Exception) {
                    fileIn.close()
                    throw e
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CRYPTO_FILE_DECRYPT_ERROR", "Streaming file decryption failed")
                }
            }
        }
    }

    /**
     * Get the app-private vault directory path.
     */
    @ReactMethod
    fun getVaultDirectory(promise: Promise) {
        promise.resolve(reactApplicationContext.filesDir.absolutePath + "/vault")
    }

    /**
     * Clean up resources when module is destroyed.
     */
    override fun invalidate() {
        super.invalidate()
        scope.cancel()
    }
}
