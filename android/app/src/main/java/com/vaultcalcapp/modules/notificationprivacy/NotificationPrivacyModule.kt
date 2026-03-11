/**
 * VaultCalc - Notification Privacy Native Module
 *
 * React Native bridge for the Notification Privacy feature.
 * Exposes methods to manage protected apps, check listener service
 * status, and configure masking options.
 *
 * @see Notification Privacy feature
 */

package com.vaultcalcapp.modules.notificationprivacy

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.*
import kotlinx.coroutines.*

class NotificationPrivacyModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "NotificationPrivacyModule"
    }

    private val filterManager = NotificationFilterManager.getInstance(reactContext)
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    // Reuse InstalledAppsScanner from applock module
    private val scanner = com.vaultcalcapp.modules.applock.InstalledAppsScanner(reactContext)

    override fun getName(): String = NAME

    /**
     * Get list of installed user apps (reuses applock scanner).
     */
    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        scope.launch {
            try {
                val apps = scanner.getInstalledApps()
                withContext(Dispatchers.Main) {
                    promise.resolve(apps)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("SCAN_ERROR", "Failed to scan apps: ${e.message}", e)
                }
            }
        }
    }

    /**
     * Get the list of currently protected package names.
     */
    @ReactMethod
    fun getProtectedApps(promise: Promise) {
        val protected_ = filterManager.getProtectedApps()
        val result = Arguments.createArray()
        for (pkg in protected_) {
            result.pushString(pkg)
        }
        promise.resolve(result)
    }

    /**
     * Protect a single app's notifications.
     */
    @ReactMethod
    fun protectApp(packageName: String, promise: Promise) {
        filterManager.protectApp(packageName)
        promise.resolve(true)
    }

    /**
     * Unprotect a single app's notifications.
     */
    @ReactMethod
    fun unprotectApp(packageName: String, promise: Promise) {
        filterManager.unprotectApp(packageName)
        promise.resolve(true)
    }

    /**
     * Enable or disable notification privacy globally.
     */
    @ReactMethod
    fun setEnabled(enabled: Boolean, promise: Promise) {
        filterManager.isEnabled = enabled
        promise.resolve(true)
    }

    /**
     * Check if notification privacy is enabled.
     */
    @ReactMethod
    fun isEnabled(promise: Promise) {
        promise.resolve(filterManager.isEnabled)
    }

    /**
     * Set whether to hide message content.
     */
    @ReactMethod
    fun setHideContent(enabled: Boolean, promise: Promise) {
        filterManager.hideContent = enabled
        promise.resolve(true)
    }

    /**
     * Get whether hide content is enabled.
     */
    @ReactMethod
    fun getHideContent(promise: Promise) {
        promise.resolve(filterManager.hideContent)
    }

    /**
     * Set whether to hide sender name.
     */
    @ReactMethod
    fun setHideSender(enabled: Boolean, promise: Promise) {
        filterManager.hideSender = enabled
        promise.resolve(true)
    }

    /**
     * Get whether hide sender is enabled.
     */
    @ReactMethod
    fun getHideSender(promise: Promise) {
        promise.resolve(filterManager.hideSender)
    }

    /**
     * Set whether to block notifications entirely.
     */
    @ReactMethod
    fun setBlockEntirely(enabled: Boolean, promise: Promise) {
        filterManager.blockEntirely = enabled
        promise.resolve(true)
    }

    /**
     * Get whether block entirely is enabled.
     */
    @ReactMethod
    fun getBlockEntirely(promise: Promise) {
        promise.resolve(filterManager.blockEntirely)
    }

    /**
     * Check if the notification listener service is enabled.
     */
    @ReactMethod
    fun isListenerServiceEnabled(promise: Promise) {
        try {
            val cn = ComponentName(
                reactApplicationContext,
                NotificationPrivacyListener::class.java
            )
            val flat = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                "enabled_notification_listeners"
            )
            val enabled = flat != null && flat.contains(cn.flattenToString())
            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Open notification listener settings so user can enable the service.
     */
    @ReactMethod
    fun openListenerSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", "Failed to open settings: ${e.message}", e)
        }
    }

    override fun onCatalystInstanceDestroy() {
        scope.cancel()
        super.onCatalystInstanceDestroy()
    }
}
