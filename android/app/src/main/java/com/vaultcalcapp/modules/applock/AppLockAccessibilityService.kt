/**
 * VaultCalc - App Lock Accessibility Service
 *
 * Monitors foreground app changes and launches LockScreenActivity
 * when a locked app is detected.
 *
 * Also manages a black overlay that hides locked app content
 * in the Android recents/task switcher.
 *
 * Detection strategy:
 * - TYPE_WINDOW_STATE_CHANGED: fires on new activity / window focus changes
 * - TYPE_WINDOWS_CHANGED: fires on window list changes (app resume from bg)
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

    /** The package that is currently in the foreground. */
    private var currentForegroundPackage: String? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        lockManager = AppLockManager.getInstance(this)
        recentsCover = RecentsCoverManager(this)

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
                    lockManager?.clearAllCooldowns()
                    currentForegroundPackage = null
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

        // Skip if same package as before (no transition happened)
        if (packageName == currentForegroundPackage) return
        val previousPackage = currentForegroundPackage
        currentForegroundPackage = packageName

        // ── Recents cover logic ──────────────────────────────────────
        // If the user just left a locked app, show the black cover
        // so the recents thumbnail captures the black screen.
        if (previousPackage != null && manager.isAppLocked(previousPackage)) {
            manager.onNavigatedAway()
            recentsCover?.showCover()
        }

        // If the user is switching to any real app (not systemui/recents),
        // remove the cover so they can see the app normally.
        // Keep cover up while in systemui (recents view) or launcher.
        val isSystemTransition = packageName == "com.android.systemui" ||
            packageName.contains("launcher")

        if (!isSystemTransition) {
            recentsCover?.hideCover()
        }
        // ─────────────────────────────────────────────────────────────

        // Skip our own app and system UI for lock detection
        if (packageName == applicationContext.packageName) return
        if (packageName == "com.android.systemui") return
        if (packageName == "com.android.launcher") return
        if (packageName.contains("launcher")) return

        // Check if this app is locked
        if (!manager.isAppLocked(packageName)) return

        // Check one-shot skip (consumes it — only skips once after unlock)
        if (manager.isInCooldown(packageName)) return

        // Remove cover before showing lock screen
        recentsCover?.hideCover()

        // Launch lock screen
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
