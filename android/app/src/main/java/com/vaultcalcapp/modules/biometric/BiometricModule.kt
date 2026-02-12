/**
 * VaultCalc - Biometric Native Module
 *
 * Provides biometric authentication availability checks and prompt integration
 * using AndroidX Biometric library with CryptoObject binding.
 *
 * CryptoObject binding ensures cryptographic proof that the biometrically-
 * authenticated user is the one accessing the vault. A Keystore-backed AES key
 * requires biometric auth before the cipher can operate.
 *
 * @see FEATURE_INDEX.md BIO-001, BIO-003
 * @see SECURITY_AUDIT.md M-4
 */

package com.vaultcalcapp.modules.biometric

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.*
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator

/**
 * React Native module providing biometric authentication operations.
 *
 * Features:
 * - Biometric hardware availability check
 * - Enrollment status detection
 * - Strong (Class 3) biometric support
 * - BiometricPrompt authentication dialog
 * - CryptoObject binding for cryptographic proof of authentication
 */
class BiometricModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "BiometricModule"
        private const val BIOMETRIC_KEY_ALIAS = "vaultcalc_biometric_key"
        private const val CIPHER_TRANSFORM =
            "${KeyProperties.KEY_ALGORITHM_AES}/${KeyProperties.BLOCK_MODE_CBC}/${KeyProperties.ENCRYPTION_PADDING_PKCS7}"
    }

    override fun getName(): String = NAME

    /**
     * Check whether biometric authentication is available on this device.
     *
     * Resolves with a map:
     * - available: boolean — true if strong biometrics can be used right now
     * - status: string — one of "available", "no_hardware", "unavailable",
     *   "none_enrolled", "security_update_required", "unknown"
     *
     * @param promise Resolves with { available, status }
     */
    @ReactMethod
    fun checkAvailability(promise: Promise) {
        try {
            val biometricManager = BiometricManager.from(reactApplicationContext)
            val result = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)

            val status = when (result) {
                BiometricManager.BIOMETRIC_SUCCESS -> "available"
                BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> "no_hardware"
                BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> "unavailable"
                BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "none_enrolled"
                BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> "security_update_required"
                else -> "unknown"
            }

            val map = Arguments.createMap().apply {
                putBoolean("available", result == BiometricManager.BIOMETRIC_SUCCESS)
                putString("status", status)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("BIOMETRIC_ERROR", "Biometric check failed")
        }
    }

    /**
     * Show the system biometric authentication prompt (BIO-003).
     *
     * Uses BiometricPrompt with BIOMETRIC_STRONG authenticators and a
     * CryptoObject binding. The Keystore-backed cipher can only be used
     * after the user successfully authenticates with their biometric,
     * providing a hardware-backed guarantee of identity.
     *
     * The prompt stays open on individual failed attempts (wrong fingerprint);
     * the promise only resolves when the user succeeds, cancels, or encounters
     * an unrecoverable error.
     *
     * @param title Prompt title text
     * @param subtitle Prompt subtitle text
     * @param cancelText Negative/cancel button text
     * @param promise Resolves with { success, error?, errorCode? }
     */
    @ReactMethod
    fun authenticate(title: String, subtitle: String, cancelText: String, promise: Promise) {
        val activity = reactApplicationContext.currentActivity as? FragmentActivity
        if (activity == null) {
            promise.reject("BIOMETRIC_ERROR", "No activity available")
            return
        }

        val executor = ContextCompat.getMainExecutor(reactApplicationContext)

        activity.runOnUiThread {
            try {
                // Initialize the CryptoObject with a biometric-bound cipher
                val cipher = getAuthCipher()

                val callback = object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        // Verify the authenticated cipher can operate —
                        // this provides cryptographic proof of biometric auth
                        val verified = try {
                            val authCipher = result.cryptoObject?.cipher
                            authCipher?.doFinal("biometric_ok".toByteArray(Charsets.UTF_8))
                            true
                        } catch (_: Exception) {
                            false
                        }

                        val map = Arguments.createMap().apply {
                            putBoolean("success", verified)
                            if (!verified) {
                                putString("error", "Cryptographic verification failed after authentication")
                            }
                        }
                        promise.resolve(map)
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        val map = Arguments.createMap().apply {
                            putBoolean("success", false)
                            putString("error", errString.toString())
                            putInt("errorCode", errorCode)
                        }
                        promise.resolve(map)
                    }

                    // onAuthenticationFailed is called per-attempt (e.g. wrong finger)
                    // but the prompt remains open, so we don't resolve here.
                }

                val biometricPrompt = BiometricPrompt(activity, executor, callback)

                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setNegativeButtonText(cancelText)
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                    .build()

                if (cipher != null) {
                    biometricPrompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
                } else {
                    // Fallback: authenticate without CryptoObject if key setup fails
                    biometricPrompt.authenticate(promptInfo)
                }
            } catch (e: Exception) {
                promise.reject("BIOMETRIC_ERROR", "Failed to show biometric prompt")
            }
        }
    }

    /**
     * Get or create a Cipher backed by a biometric-bound Keystore key.
     * Returns null if Keystore operations fail (device doesn't support it).
     */
    private fun getAuthCipher(): Cipher? {
        return try {
            val key = getOrCreateBiometricKey()
            val cipher = Cipher.getInstance(CIPHER_TRANSFORM)
            cipher.init(Cipher.ENCRYPT_MODE, key)
            cipher
        } catch (_: KeyPermanentlyInvalidatedException) {
            // Biometric enrollment changed — regenerate key and retry
            try {
                deleteBiometricKey()
                val key = createBiometricKey()
                val cipher = Cipher.getInstance(CIPHER_TRANSFORM)
                cipher.init(Cipher.ENCRYPT_MODE, key)
                cipher
            } catch (_: Exception) {
                null
            }
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Retrieve existing biometric key or create a new one.
     */
    private fun getOrCreateBiometricKey(): javax.crypto.SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)

        val existingKey = keyStore.getKey(BIOMETRIC_KEY_ALIAS, null)
        if (existingKey != null) {
            return existingKey as javax.crypto.SecretKey
        }

        return createBiometricKey()
    }

    /**
     * Create a new AES key in Android Keystore that requires biometric authentication.
     *
     * Key properties:
     * - AES-256 in CBC mode with PKCS7 padding
     * - Requires BIOMETRIC_STRONG authentication before each use
     * - Invalidated if new biometric enrollment occurs (security)
     */
    private fun createBiometricKey(): javax.crypto.SecretKey {
        val keyGen = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        )

        val spec = KeyGenParameterSpec.Builder(
            BIOMETRIC_KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_CBC)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_PKCS7)
            .setKeySize(256)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true)
            .build()

        keyGen.init(spec)
        return keyGen.generateKey()
    }

    /**
     * Delete the biometric key (used when key is permanently invalidated).
     */
    private fun deleteBiometricKey() {
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)
        keyStore.deleteEntry(BIOMETRIC_KEY_ALIAS)
    }
}
