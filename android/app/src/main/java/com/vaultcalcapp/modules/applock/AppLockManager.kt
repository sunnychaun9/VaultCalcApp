/**
 * VaultCalc - App Lock Manager
 *
 * Manages the set of locked app package names.
 * Persists via SharedPreferences. Tracks which apps
 * the user has authenticated in the current session so
 * they aren't re-locked while actively using them.
 *
 * Session-based: once authenticated, an app stays unlocked
 * until the user genuinely navigates to a different user app,
 * the screen turns off, or the app is killed.
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
        private const val KEY_UNLOCK_METHOD = "unlock_method" // "pin" or "pattern"
        private const val KEY_PATTERN_HASH = "pattern_hash_sha256"

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
     * Set of packages that the user has authenticated in the current session.
     * Unlike the old one-shot approach, these persist until the user genuinely
     * navigates to a different real app, the screen turns off, or the app is killed.
     *
     * This prevents re-locking when:
     * - Keyboard/IME appears (different package but not a real app switch)
     * - System UI overlays appear (notifications, permission dialogs)
     * - Internal activity transitions within the same app
     */
    private val authenticatedApps = mutableSetOf<String>()

    var isEnabled: Boolean
        get() = prefs.getBoolean(KEY_APP_LOCK_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_APP_LOCK_ENABLED, value).apply()

    fun getLockedApps(): Set<String> {
        return prefs.getStringSet(KEY_LOCKED_APPS, emptySet()) ?: emptySet()
    }

    fun setLockedApps(packages: Set<String>) {
        prefs.edit().putStringSet(KEY_LOCKED_APPS, packages).apply()
    }

    fun lockApp(packageName: String) {
        val current = getLockedApps().toMutableSet()
        current.add(packageName)
        setLockedApps(current)
    }

    fun unlockApp(packageName: String) {
        val current = getLockedApps().toMutableSet()
        current.remove(packageName)
        setLockedApps(current)
    }

    fun isAppLocked(packageName: String): Boolean {
        return getLockedApps().contains(packageName)
    }

    /**
     * Record that the user just authenticated to unlock a specific app.
     * The app will remain authenticated for the entire session until
     * the user navigates to a different real app.
     */
    fun recordUnlock(packageName: String) {
        synchronized(authenticatedApps) {
            authenticatedApps.add(packageName)
        }
    }

    /**
     * Check if a package has been authenticated in this session.
     * Does NOT consume the authentication — it persists until explicitly revoked.
     */
    fun isAuthenticated(packageName: String): Boolean {
        synchronized(authenticatedApps) {
            return authenticatedApps.contains(packageName)
        }
    }

    /**
     * Revoke authentication for a specific app.
     * Called when the user genuinely leaves a locked app
     * (navigates to a different real user-facing app).
     */
    fun revokeAuth(packageName: String) {
        synchronized(authenticatedApps) {
            authenticatedApps.remove(packageName)
        }
    }

    /**
     * Clear all authentications (e.g. on screen off).
     */
    fun clearAllAuth() {
        synchronized(authenticatedApps) {
            authenticatedApps.clear()
        }
    }

    // ── Unlock method (PIN or Pattern) ──

    /**
     * Get the configured default unlock method ("pin" or "pattern").
     */
    fun getUnlockMethod(): String {
        return prefs.getString(KEY_UNLOCK_METHOD, "pin") ?: "pin"
    }

    /**
     * Set the default unlock method for the app lock screen.
     */
    fun setUnlockMethod(method: String) {
        prefs.edit().putString(KEY_UNLOCK_METHOD, method).apply()
    }

    /**
     * Get the unlock method for a specific app.
     * Falls back to the global default if not set per-app.
     */
    fun getUnlockMethodForApp(packageName: String): String {
        return prefs.getString("unlock_method_$packageName", null) ?: getUnlockMethod()
    }

    /**
     * Set the unlock method for a specific app ("pin" or "pattern").
     * Pass null to clear the per-app override and use the global default.
     */
    fun setUnlockMethodForApp(packageName: String, method: String?) {
        val editor = prefs.edit()
        if (method == null) {
            editor.remove("unlock_method_$packageName")
        } else {
            editor.putString("unlock_method_$packageName", method)
        }
        editor.apply()
    }

    /**
     * Get per-app unlock methods for all locked apps.
     * Returns a map of packageName → method ("pin" or "pattern").
     */
    fun getAllAppUnlockMethods(): Map<String, String> {
        val result = mutableMapOf<String, String>()
        for (pkg in getLockedApps()) {
            result[pkg] = getUnlockMethodForApp(pkg)
        }
        return result
    }

    /**
     * Store a SHA-256 hash of the pattern for native lock screen verification.
     * The pattern is converted to "0-1-4-7-8" format then hashed.
     */
    fun setPatternHash(hash: String) {
        prefs.edit().putString(KEY_PATTERN_HASH, hash).apply()
    }

    /**
     * Get the stored SHA-256 pattern hash for verification.
     */
    fun getPatternHash(): String? {
        return prefs.getString(KEY_PATTERN_HASH, null)
    }

    /**
     * Verify a drawn pattern against the stored hash.
     */
    fun verifyPatternHash(patternDots: List<Int>): Boolean {
        val storedHash = getPatternHash() ?: return false
        val patternStr = patternDots.joinToString("-")
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(patternStr.toByteArray())
            .joinToString("") { "%02x".format(it) }
        return hash == storedHash
    }

    // ── Backward-compatible aliases ──

    /** @deprecated Use isAuthenticated instead */
    fun isInCooldown(packageName: String): Boolean = isAuthenticated(packageName)

    /** @deprecated Use revokeAuth instead */
    fun onNavigatedAway() {
        clearAllAuth()
    }

    /** @deprecated Use clearAllAuth instead */
    fun clearAllCooldowns() {
        clearAllAuth()
    }
}
