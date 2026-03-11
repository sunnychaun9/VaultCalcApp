/**
 * VaultCalc - App Lock Accessibility Service
 *
 * Monitors foreground app changes via TYPE_WINDOW_STATE_CHANGED events.
 * When a locked app is detected, launches LockScreenActivity.
 *
 * Only reacts to window state changes — no polling, minimal CPU usage.
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
    private var screenOffReceiver: BroadcastReceiver? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        lockManager = AppLockManager.getInstance(this)

        // Configure to receive only window state changes
        serviceInfo = serviceInfo.apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
            notificationTimeout = 100
        }

        // Register for screen off to clear cooldowns
        screenOffReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action == Intent.ACTION_SCREEN_OFF) {
                    lockManager?.clearAllCooldowns()
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
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val manager = lockManager ?: return
        if (!manager.isEnabled) return

        val packageName = event.packageName?.toString() ?: return

        // Skip our own app and system UI
        if (packageName == applicationContext.packageName) return
        if (packageName == "com.android.systemui") return
        if (packageName == "com.android.launcher") return
        if (packageName.contains("launcher")) return

        // Check if this app is locked
        if (!manager.isAppLocked(packageName)) return

        // Check cooldown — don't re-lock if recently unlocked
        if (manager.isInCooldown(packageName)) return

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
