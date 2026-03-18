/**
 * VaultCalc - App Lock Manager
 *
 * Manages the set of locked app package names.
 * Persists via SharedPreferences. Tracks which apps
 * the user has just authenticated so they aren't
 * immediately re-locked when the lock screen closes.
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

    /**
     * Set of packages that were just unlocked and should be skipped ONCE
     * when they return to the foreground (i.e., when the lock screen closes
     * and the locked app resumes underneath).
     *
     * Cleared per-package as soon as the user navigates away to a
     * different app, so the next open will trigger the lock again.
     */
    private val justUnlockedApps = mutableSetOf<String>()

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
     * The next foreground event for this package will be skipped (one-shot).
     */
    fun recordUnlock(packageName: String) {
        synchronized(justUnlockedApps) {
            justUnlockedApps.add(packageName)
        }
    }

    /**
     * Check if a package was just unlocked and should be skipped once.
     * Returns true (and consumes the skip) if the app was just unlocked.
     */
    fun isInCooldown(packageName: String): Boolean {
        synchronized(justUnlockedApps) {
            return justUnlockedApps.remove(packageName)
        }
    }

    /**
     * Called when the foreground changes to a different (non-locked) app.
     * Clears all one-shot skips so locked apps will trigger on next open.
     */
    fun onNavigatedAway() {
        synchronized(justUnlockedApps) {
            justUnlockedApps.clear()
        }
    }

    /**
     * Clear all state (e.g. on screen off).
     */
    fun clearAllCooldowns() {
        synchronized(justUnlockedApps) {
            justUnlockedApps.clear()
        }
    }
}
