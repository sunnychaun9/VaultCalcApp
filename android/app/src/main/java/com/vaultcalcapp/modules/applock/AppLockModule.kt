/**
 * VaultCalc - App Lock Native Module
 *
 * React Native bridge for the App Lock feature.
 * Exposes methods to scan installed apps, manage locked apps,
 * and check accessibility service status.
 *
 * @see App Lock feature
 */

package com.vaultcalcapp.modules.applock

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import com.facebook.react.bridge.*
import kotlinx.coroutines.*

class AppLockModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AppLockModule"
    }

    private val scanner = InstalledAppsScanner(reactContext)
    private val lockManager = AppLockManager.getInstance(reactContext)
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    override fun getName(): String = NAME

    /**
     * Get list of installed user apps.
     * Returns array of { packageName, appName, icon }.
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
     * Get the list of currently locked package names.
     */
    @ReactMethod
    fun getLockedApps(promise: Promise) {
        val locked = lockManager.getLockedApps()
        val result = Arguments.createArray()
        for (pkg in locked) {
            result.pushString(pkg)
        }
        promise.resolve(result)
    }

    /**
     * Set the list of locked package names.
     */
    @ReactMethod
    fun setLockedApps(packages: ReadableArray, promise: Promise) {
        try {
            val set = mutableSetOf<String>()
            for (i in 0 until packages.size()) {
                packages.getString(i)?.let { set.add(it) }
            }
            lockManager.setLockedApps(set)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LOCK_ERROR", "Failed to set locked apps: ${e.message}", e)
        }
    }

    /**
     * Lock a single app.
     */
    @ReactMethod
    fun lockApp(packageName: String, promise: Promise) {
        lockManager.lockApp(packageName)
        promise.resolve(true)
    }

    /**
     * Unlock a single app.
     */
    @ReactMethod
    fun unlockApp(packageName: String, promise: Promise) {
        lockManager.unlockApp(packageName)
        promise.resolve(true)
    }

    /**
     * Enable or disable the app lock feature globally.
     */
    @ReactMethod
    fun setEnabled(enabled: Boolean, promise: Promise) {
        lockManager.isEnabled = enabled
        promise.resolve(true)
    }

    /**
     * Check if the app lock feature is enabled.
     */
    @ReactMethod
    fun isEnabled(promise: Promise) {
        promise.resolve(lockManager.isEnabled)
    }

    /**
     * Check if the accessibility service is enabled.
     */
    @ReactMethod
    fun isAccessibilityServiceEnabled(promise: Promise) {
        val am = reactApplicationContext.getSystemService(Context.ACCESSIBILITY_SERVICE)
            as AccessibilityManager
        val enabledServices = am.getEnabledAccessibilityServiceList(
            AccessibilityServiceInfo.FEEDBACK_GENERIC
        )
        val serviceId = "${reactApplicationContext.packageName}/" +
            "${AppLockAccessibilityService::class.java.canonicalName}"

        val isEnabled = enabledServices.any { info ->
            info.resolveInfo.serviceInfo.let {
                "${it.packageName}/${it.name}" == serviceId
            }
        }
        promise.resolve(isEnabled)
    }

    /**
     * Set the unlock method for the app lock screen ("pin" or "pattern").
     * If pattern, also provide the pattern dots array to store a SHA-256 hash
     * for native lock screen verification.
     */
    @ReactMethod
    fun setAppLockCredentials(method: String, patternDots: ReadableArray?, promise: Promise) {
        try {
            lockManager.setUnlockMethod(method)
            if (method == "pattern" && patternDots != null) {
                val dots = mutableListOf<Int>()
                for (i in 0 until patternDots.size()) {
                    dots.add(patternDots.getInt(i))
                }
                val patternStr = dots.joinToString("-")
                val digest = java.security.MessageDigest.getInstance("SHA-256")
                val hash = digest.digest(patternStr.toByteArray())
                    .joinToString("") { "%02x".format(it) }
                lockManager.setPatternHash(hash)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CRED_ERROR", "Failed to set credentials: ${e.message}", e)
        }
    }

    /**
     * Get the current unlock method ("pin" or "pattern").
     */
    @ReactMethod
    fun getUnlockMethod(promise: Promise) {
        promise.resolve(lockManager.getUnlockMethod())
    }

    /**
     * Open Android accessibility settings so user can enable the service.
     */
    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
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
