/**
 * VaultCalc - Intruder Notification Module
 *
 * Shows a local notification when an intruder is detected.
 *
 * @see Intruder Intelligence feature (SEC-005)
 */

package com.vaultcalcapp.modules.intruder

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.*

class IntruderNotificationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "IntruderNotificationModule"
        private const val CHANNEL_ID = "intruder_alerts"
        private const val CHANNEL_NAME = "Intruder Alerts"
        private const val NOTIFICATION_ID = 9001
    }

    override fun getName(): String = NAME

    /**
     * Show an intruder detection notification.
     */
    @ReactMethod
    fun showIntruderAlert(riskLevel: String, attempts: Int, promise: Promise) {
        try {
            val context = reactApplicationContext
            ensureChannel(context)

            // Intent to open the app when notification is tapped
            val launchIntent = context.packageManager
                .getLaunchIntentForPackage(context.packageName)
                ?.apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }

            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val title = when (riskLevel) {
                "HIGH" -> "High Risk Intrusion Detected"
                "MEDIUM" -> "Intrusion Attempt Detected"
                else -> "Failed Unlock Attempt"
            }

            val body = "Someone tried to unlock your vault ($attempts attempt${if (attempts != 1) "s" else ""}). Tap to view the report."

            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .build()

            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
            promise.resolve(true)
        } catch (e: Exception) {
            // Silently fail — notification is optional
            promise.resolve(false)
        }
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Alerts when someone tries to unlock VaultCalc"
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }
}
