/**
 * VaultCalc - Stealth Mode Native Module
 *
 * Hides/shows the app launcher icon by disabling/enabling all
 * activity-alias components. When stealth is disabled, it restores
 * whichever disguised alias the user had selected via AppIconModule.
 *
 * A persistent notification is shown as the re-entry mechanism
 * (SECRET_CODE broadcasts are not delivered on Android 11+).
 *
 * @see STEALTH-001 in FEATURE_INDEX.md
 */

package com.vaultcalcapp.modules.stealth

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.vaultcalcapp.MainActivity
import com.vaultcalcapp.modules.appicon.AppIconModule

class StealthModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "StealthModule"
        private const val PREFS_NAME = "vaultcalc_stealth"
        private const val KEY_STEALTH_ENABLED = "stealth_enabled"
        private const val NOTIFICATION_CHANNEL_ID = "stealth_reentry"
        private const val NOTIFICATION_ID = 9876
    }

    override fun getName(): String = NAME

    private fun getPrefs() =
        reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
                as NotificationManager
            if (nm.getNotificationChannel(NOTIFICATION_CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    NOTIFICATION_CHANNEL_ID,
                    "Calculator",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Quick access"
                    setShowBadge(false)
                }
                nm.createNotificationChannel(channel)
            }
        }
    }

    private fun showReentryNotification() {
        ensureNotificationChannel()

        val launchIntent = Intent(reactApplicationContext, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            reactApplicationContext,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(reactApplicationContext, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle("Calculator")
            .setContentText("Tap to open")
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build()

        val nm = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
            as NotificationManager
        nm.notify(NOTIFICATION_ID, notification)
    }

    private fun cancelReentryNotification() {
        val nm = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
            as NotificationManager
        nm.cancel(NOTIFICATION_ID)
    }

    /**
     * Enable stealth mode — hides ALL launcher aliases.
     * A persistent notification is shown as the re-entry mechanism.
     */
    @ReactMethod
    fun enableStealth(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val appId = reactApplicationContext.packageName

            // Disable every alias so no icon is visible
            for ((key, _) in AppIconModule.ALIASES) {
                val component = AppIconModule.componentFor(appId, key)
                pm.setComponentEnabledSetting(
                    component,
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP
                )
            }

            showReentryNotification()

            getPrefs().edit().putBoolean(KEY_STEALTH_ENABLED, true).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STEALTH_ERROR", "Failed to enable stealth mode: ${e.message}", e)
        }
    }

    /**
     * Disable stealth mode — restores the user's selected disguise alias.
     */
    @ReactMethod
    fun disableStealth(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val appId = reactApplicationContext.packageName

            // Re-enable the alias the user had selected
            val selectedAlias = AppIconModule.getPersistedAlias(reactApplicationContext)
            val component = AppIconModule.componentFor(appId, selectedAlias)
            pm.setComponentEnabledSetting(
                component,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP
            )

            cancelReentryNotification()

            getPrefs().edit().putBoolean(KEY_STEALTH_ENABLED, false).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STEALTH_ERROR", "Failed to disable stealth mode: ${e.message}", e)
        }
    }

    /**
     * Check whether stealth mode is currently enabled.
     */
    @ReactMethod
    fun isStealthEnabled(promise: Promise) {
        try {
            val enabled = getPrefs().getBoolean(KEY_STEALTH_ENABLED, false)
            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.reject("STEALTH_ERROR", "Failed to check stealth state: ${e.message}", e)
        }
    }
}
