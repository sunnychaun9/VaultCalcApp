/**
 * VaultCalc - App Lock Manager
 *
 * Manages the set of locked app package names.
 * Persists via SharedPreferences. Provides unlock cooldown
 * to prevent repeated lock triggers.
 *
 * @see App Lock feature
 */

package com.vaultcalcapp.modules.applock

import android.content.Context
import android.content.SharedPreferences

class AppLockManager private constructor(context: Context) {

    companion object {
        private const val PREFS_NAME = "vaultcalc_applock"
        private const val KEY_LOCKED_APPS = "locked_apps"
        private const val KEY_APP_LOCK_ENABLED = "app_lock_enabled"
        /** Cooldown after unlock — don't re-lock for 30 seconds */
        const val UNLOCK_COOLDOWN_MS = 30_000L

        @Volatile
        private var instance: AppLockManager? = null

        fun getInstance(context: Context): AppLockManager {
            return instance ?: synchronized(this) {
                instance ?: AppLockManager(context.applicationContext).also { instance = it }
            }
        }
    }

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // In-memory cache of unlock timestamps per package
    private val unlockTimestamps = mutableMapOf<String, Long>()

    /**
     * Whether the app lock feature is globally enabled.
     */
    var isEnabled: Boolean
        get() = prefs.getBoolean(KEY_APP_LOCK_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_APP_LOCK_ENABLED, value).apply()

    /**
     * Get the set of locked package names.
     */
    fun getLockedApps(): Set<String> {
        return prefs.getStringSet(KEY_LOCKED_APPS, emptySet()) ?: emptySet()
    }

    /**
     * Set the locked package names.
     */
    fun setLockedApps(packages: Set<String>) {
        prefs.edit().putStringSet(KEY_LOCKED_APPS, packages).apply()
    }

    /**
     * Add a package to the locked set.
     */
    fun lockApp(packageName: String) {
        val current = getLockedApps().toMutableSet()
        current.add(packageName)
        setLockedApps(current)
    }

    /**
     * Remove a package from the locked set.
     */
    fun unlockApp(packageName: String) {
        val current = getLockedApps().toMutableSet()
        current.remove(packageName)
        setLockedApps(current)
    }

    /**
     * Check if a package is locked.
     */
    fun isAppLocked(packageName: String): Boolean {
        return getLockedApps().contains(packageName)
    }

    /**
     * Record that the user just authenticated to unlock a specific app.
     * Starts the cooldown timer for that package.
     */
    fun recordUnlock(packageName: String) {
        synchronized(unlockTimestamps) {
            unlockTimestamps[packageName] = System.currentTimeMillis()
        }
    }

    /**
     * Check if a package is still within the cooldown window.
     * Returns true if the app was unlocked recently and should NOT be locked.
     */
    fun isInCooldown(packageName: String): Boolean {
        synchronized(unlockTimestamps) {
            val timestamp = unlockTimestamps[packageName] ?: return false
            val elapsed = System.currentTimeMillis() - timestamp
            if (elapsed > UNLOCK_COOLDOWN_MS) {
                unlockTimestamps.remove(packageName)
                return false
            }
            return true
        }
    }

    /**
     * Clear all cooldowns (e.g. on screen off).
     */
    fun clearAllCooldowns() {
        synchronized(unlockTimestamps) {
            unlockTimestamps.clear()
        }
    }
}
