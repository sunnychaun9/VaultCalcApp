/**
 * VaultCalc - Notification Filter Manager
 *
 * Manages the set of protected app package names and masking settings.
 * Persists via SharedPreferences. Singleton pattern matches AppLockManager.
 *
 * @see Notification Privacy feature
 */

package com.vaultcalcapp.modules.notificationprivacy

import android.content.Context
import android.content.SharedPreferences

class NotificationFilterManager private constructor(context: Context) {

    companion object {
        private const val PREFS_NAME = "vaultcalc_notification_privacy"
        private const val KEY_PROTECTED_APPS = "protected_apps"
        private const val KEY_ENABLED = "notification_privacy_enabled"
        private const val KEY_HIDE_CONTENT = "hide_content"
        private const val KEY_HIDE_SENDER = "hide_sender"
        private const val KEY_BLOCK_ENTIRELY = "block_entirely"

        @Volatile
        private var instance: NotificationFilterManager? = null

        fun getInstance(context: Context): NotificationFilterManager {
            return instance ?: synchronized(this) {
                instance ?: NotificationFilterManager(context.applicationContext).also { instance = it }
            }
        }
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * Whether notification privacy is globally enabled.
     */
    var isEnabled: Boolean
        get() = prefs.getBoolean(KEY_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()

    /**
     * Whether to hide message content (replace with generic text).
     */
    var hideContent: Boolean
        get() = prefs.getBoolean(KEY_HIDE_CONTENT, true)
        set(value) = prefs.edit().putBoolean(KEY_HIDE_CONTENT, value).apply()

    /**
     * Whether to hide sender name.
     */
    var hideSender: Boolean
        get() = prefs.getBoolean(KEY_HIDE_SENDER, false)
        set(value) = prefs.edit().putBoolean(KEY_HIDE_SENDER, value).apply()

    /**
     * Whether to block notifications entirely (cancel them).
     */
    var blockEntirely: Boolean
        get() = prefs.getBoolean(KEY_BLOCK_ENTIRELY, false)
        set(value) = prefs.edit().putBoolean(KEY_BLOCK_ENTIRELY, value).apply()

    /**
     * Get the set of protected package names.
     */
    fun getProtectedApps(): Set<String> {
        return prefs.getStringSet(KEY_PROTECTED_APPS, emptySet()) ?: emptySet()
    }

    /**
     * Set the protected package names.
     */
    fun setProtectedApps(packages: Set<String>) {
        prefs.edit().putStringSet(KEY_PROTECTED_APPS, packages).apply()
    }

    /**
     * Add a package to the protected set.
     */
    fun protectApp(packageName: String) {
        val current = getProtectedApps().toMutableSet()
        current.add(packageName)
        setProtectedApps(current)
    }

    /**
     * Remove a package from the protected set.
     */
    fun unprotectApp(packageName: String) {
        val current = getProtectedApps().toMutableSet()
        current.remove(packageName)
        setProtectedApps(current)
    }

    /**
     * Check if a package is protected.
     */
    fun isAppProtected(packageName: String): Boolean {
        return getProtectedApps().contains(packageName)
    }
}
