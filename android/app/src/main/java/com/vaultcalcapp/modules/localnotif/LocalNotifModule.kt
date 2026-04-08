/**
 * VaultCalc - Local Notification Module
 *
 * Schedules re-engagement notifications via AlarmManager.
 * Notifications are local-only (no server, no FCM).
 * Uses inexact alarms for battery efficiency.
 */

package com.vaultcalcapp.modules.localnotif

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*

class LocalNotifModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "LocalNotifModule"
        const val CHANNEL_ID = "vaultcalc_reengagement"
        const val PREFS_KEY = "localnotif_scheduled"
    }

    override fun getName(): String = NAME

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
                as NotificationManager
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Reminders",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Vault reminders"
                    setShowBadge(true)
                }
                nm.createNotificationChannel(channel)
            }
        }
    }

    /**
     * Schedule a local notification at a specific delay from now.
     *
     * @param id Unique notification ID
     * @param title Notification title
     * @param body Notification body text
     * @param delayMs Delay in milliseconds from now
     */
    @ReactMethod
    fun schedule(id: Int, title: String, body: String, delayMs: Double, promise: Promise) {
        try {
            ensureChannel()

            val intent = Intent(reactApplicationContext, LocalNotifReceiver::class.java).apply {
                putExtra("notif_id", id)
                putExtra("notif_title", title)
                putExtra("notif_body", body)
            }

            val pendingIntent = PendingIntent.getBroadcast(
                reactApplicationContext,
                id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val alarmManager = reactApplicationContext.getSystemService(Context.ALARM_SERVICE)
                as AlarmManager
            val triggerAt = System.currentTimeMillis() + delayMs.toLong()

            // Use inexact alarm for battery efficiency — timing doesn't need to be precise
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)

            // Record that we scheduled this ID
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_KEY, Context.MODE_PRIVATE)
            prefs.edit().putBoolean("scheduled_$id", true).apply()

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_ERROR", e.message)
        }
    }

    /**
     * Cancel a previously scheduled notification.
     */
    @ReactMethod
    fun cancel(id: Int, promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, LocalNotifReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                reactApplicationContext,
                id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val alarmManager = reactApplicationContext.getSystemService(Context.ALARM_SERVICE)
                as AlarmManager
            alarmManager.cancel(pendingIntent)

            val prefs = reactApplicationContext.getSharedPreferences(PREFS_KEY, Context.MODE_PRIVATE)
            prefs.edit().remove("scheduled_$id").apply()

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message)
        }
    }

    /**
     * Cancel all scheduled notifications.
     */
    @ReactMethod
    fun cancelAll(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_KEY, Context.MODE_PRIVATE)
            val editor = prefs.edit()
            for ((key, _) in prefs.all) {
                if (key.startsWith("scheduled_")) {
                    val id = key.removePrefix("scheduled_").toIntOrNull() ?: continue
                    cancel(id, PromiseImpl({}, {}))
                    editor.remove(key)
                }
            }
            editor.apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ALL_ERROR", e.message)
        }
    }
}
