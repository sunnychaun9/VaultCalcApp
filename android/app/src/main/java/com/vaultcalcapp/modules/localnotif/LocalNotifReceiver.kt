/**
 * VaultCalc - Local Notification Receiver
 *
 * BroadcastReceiver that fires when an AlarmManager alarm triggers.
 * Shows the notification using the data passed via Intent extras.
 *
 * Smart suppression:
 * - Skips if user opened the app within the last 24 hours
 * - Enforces max 1 notification per day to avoid spam
 */

package com.vaultcalcapp.modules.localnotif

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.vaultcalcapp.MainActivity
import com.vaultcalcapp.R

class LocalNotifReceiver : BroadcastReceiver() {

    companion object {
        const val ACTIVITY_PREFS = "localnotif_activity"
        const val KEY_LAST_APP_OPEN = "last_app_open"
        const val KEY_LAST_NOTIF_SHOWN = "last_notif_shown"
        private const val ONE_DAY_MS = 24 * 60 * 60 * 1000L
    }

    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra("notif_id", 0)
        val title = intent.getStringExtra("notif_title") ?: "VaultCalc"
        val body = intent.getStringExtra("notif_body") ?: ""

        val prefs = context.getSharedPreferences(ACTIVITY_PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()

        // Suppress if user opened the app within the last 24 hours
        val lastAppOpen = prefs.getLong(KEY_LAST_APP_OPEN, 0)
        if (lastAppOpen > 0 && (now - lastAppOpen) < ONE_DAY_MS) {
            return
        }

        // Enforce max 1 notification per day
        val lastNotifShown = prefs.getLong(KEY_LAST_NOTIF_SHOWN, 0)
        if (lastNotifShown > 0 && (now - lastNotifShown) < ONE_DAY_MS) {
            return
        }

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            context, id, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, LocalNotifModule.CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(id, notification)

        // Record that we showed a notification
        prefs.edit().putLong(KEY_LAST_NOTIF_SHOWN, now).apply()
    }
}
