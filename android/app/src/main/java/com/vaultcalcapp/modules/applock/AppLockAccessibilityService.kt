/**
 * VaultCalc - App Lock Accessibility Service
 *
 * Monitors foreground app changes and launches LockScreenActivity
 * when a locked app is detected.
 *
 * Session-based auth: once a user authenticates for an app, it stays
 * unlocked until they genuinely leave to a different real app.
 * Keyboard/IME, system UI, permission dialogs, and internal activity
 * transitions do NOT trigger re-lock.
 *
 * Also manages a black overlay that hides locked app content
 * in the Android recents/task switcher.
 *
 * @see App Lock feature
 */

package com.vaultcalcapp.modules.applock

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.view.accessibility.AccessibilityEvent

class AppLockAccessibilityService : AccessibilityService() {

    private var lockManager: AppLockManager? = null
    private var recentsCover: RecentsCoverManager? = null
    private var screenOffReceiver: BroadcastReceiver? = null

    /** The real user-facing app currently in the foreground (excludes system/IME). */
    private var currentUserApp: String? = null

    /** Raw foreground package (includes system/IME for dedup). */
    private var lastRawPackage: String? = null

    /**
     * Packages that should NOT be treated as "user navigated to a different app".
     * These are transient overlays (keyboard, system UI, permission dialogs, etc.)
     * that appear on top of the real app but don't represent a genuine app switch.
     */
    private fun isTransientSystemPackage(pkg: String): Boolean {
        if (pkg == applicationContext.packageName) return true
        if (pkg == "com.android.systemui") return true
        // Common keyboard/IME packages
        if (pkg.contains("inputmethod") || pkg.contains("keyboard") || pkg.contains("swiftkey")
            || pkg.contains("gboard")) return true
        // Permission dialogs, package installer
        if (pkg == "com.google.android.permissioncontroller") return true
        if (pkg == "com.android.permissioncontroller") return true
        if (pkg == "com.android.packageinstaller") return true
        if (pkg == "com.google.android.packageinstaller") return true
        // System popups
        if (pkg == "android") return true
        return false
    }

    private fun isLauncherPackage(pkg: String): Boolean {
        return pkg.contains("launcher") || pkg.contains("home")
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        lockManager = AppLockManager.getInstance(this)
        recentsCover = RecentsCoverManager(this)
        RecentsCoverBridge.register(recentsCover!!)

        serviceInfo = serviceInfo.apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                AccessibilityEvent.TYPE_WINDOWS_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS or
                AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            notificationTimeout = 100
        }

        screenOffReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action == Intent.ACTION_SCREEN_OFF) {
                    lockManager?.clearAllAuth()
                    currentUserApp = null
                    lastRawPackage = null
                    recentsCover?.hideCover()
                }
            }
        }
        val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(screenOffReceiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(screenOffReceiver, filter)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val ev = event ?: return
        val manager = lockManager ?: return
        if (!manager.isEnabled) return

        // Resolve the foreground package from the event
        val packageName: String? = when (ev.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> ev.packageName?.toString()
            AccessibilityEvent.TYPE_WINDOWS_CHANGED -> {
                try { rootInActiveWindow?.packageName?.toString() } catch (_: Exception) { null }
            }
            else -> null
        }

        if (packageName.isNullOrEmpty()) return

        // Skip if same raw package as last event (no change at all)
        if (packageName == lastRawPackage) return
        lastRawPackage = packageName

        // ── Classify the package ──
        val isTransient = isTransientSystemPackage(packageName)
        val isLauncher = isLauncherPackage(packageName)

        // If it's a transient system package (keyboard, system UI, etc.),
        // DON'T update currentUserApp — the real app is still underneath.
        // Also don't trigger any lock logic.
        if (isTransient) return

        // ── Recents cover logic ──
        // If the user is leaving a locked app, show cover for recents
        val previousUserApp = currentUserApp

        // If it's a launcher, handle recents cover but don't lock
        if (isLauncher) {
            if (previousUserApp != null && manager.isAppLocked(previousUserApp)) {
                recentsCover?.showCover()
                // Revoke auth for the app they left — next open will require PIN
                manager.revokeAuth(previousUserApp)
            }
            currentUserApp = null
            return
        }

        // ── This is a genuine user app transition ──
        currentUserApp = packageName

        // If the user left a locked app to go to a DIFFERENT real app,
        // revoke authentication so next open requires PIN again
        if (previousUserApp != null && previousUserApp != packageName
            && manager.isAppLocked(previousUserApp)) {
            manager.revokeAuth(previousUserApp)
        }

        // Check if this app needs locking
        if (!manager.isAppLocked(packageName)) {
            // Not a locked app — safe to hide the recents cover
            recentsCover?.hideCover()
            return
        }

        // If user already authenticated for this app in this session, skip
        if (manager.isAuthenticated(packageName)) {
            recentsCover?.hideCover()
            return
        }

        // App needs locking — keep cover visible while lock screen loads,
        // then launch the lock screen on top
        recentsCover?.showCover()
        launchLockScreen(packageName)
    }

    private fun launchLockScreen(targetPackage: String) {
        val intent = Intent(this, LockScreenActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(LockScreenActivity.EXTRA_LOCKED_PACKAGE, targetPackage)
        }
        startActivity(intent)
    }

    override fun onInterrupt() {
        // Required override
    }

    override fun onDestroy() {
        RecentsCoverBridge.unregister()
        recentsCover?.destroy()
        screenOffReceiver?.let {
            try {
                unregisterReceiver(it)
            } catch (_: IllegalArgumentException) {
                // Already unregistered
            }
        }
        super.onDestroy()
    }
}
