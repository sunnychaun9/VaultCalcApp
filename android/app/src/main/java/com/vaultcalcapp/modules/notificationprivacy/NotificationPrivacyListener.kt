/**
 * VaultCalc - Notification Privacy Listener Service
 *
 * NotificationListenerService that intercepts notifications from
 * protected apps and either blocks them or replaces them with
 * masked versions posted from VaultCalc's own context.
 *
 * Approach:
 * - Block entirely: cancelNotification()
 * - Mask content/sender: cancel original → post a replacement
 *   notification from our own app with masked content
 *
 * @see Notification Privacy feature
 */

package com.vaultcalcapp.modules.notificationprivacy

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class NotificationPrivacyListener : NotificationListenerService() {

    companion object {
        private const val MASKED_CHANNEL_ID = "vaultcalc_masked"
        private const val MASKED_CHANNEL_NAME = "Privacy Protected"
    }

    private val filterManager: NotificationFilterManager by lazy {
        NotificationFilterManager.getInstance(applicationContext)
    }

    private val notificationManager: NotificationManager by lazy {
        getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        ensureChannel()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return

        // Skip our own notifications (prevent infinite loop)
        if (sbn.packageName == applicationContext.packageName) return

        // Skip if feature is disabled
        if (!filterManager.isEnabled) return

        // Skip if this package is not protected
        if (!filterManager.isAppProtected(sbn.packageName)) return

        // Skip ongoing/foreground service notifications (media players, etc.)
        if (sbn.isOngoing) return

        // Skip silent/low-priority notifications
        val notification = sbn.notification
        if (notification.priority <= Notification.PRIORITY_MIN) return

        try {
            // Cancel the original notification first
            cancelNotification(sbn.key)

            // If "block entirely" is on, we're done
            if (filterManager.blockEntirely) return

            // Post a masked replacement from our own context
            postMaskedNotification(sbn)
        } catch (_: Exception) {
            // Never crash the listener service
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        // No-op
    }

    /**
     * Post a replacement notification with masked content from VaultCalc's context.
     */
    private fun postMaskedNotification(sbn: StatusBarNotification) {
        val original = sbn.notification
        val extras = original.extras
        val appName = getAppName(sbn.packageName)

        val hideContent = filterManager.hideContent
        val hideSender = filterManager.hideSender

        // Determine title
        val title: CharSequence = if (hideSender) {
            appName
        } else {
            extras?.getCharSequence(Notification.EXTRA_TITLE) ?: appName
        }

        // Determine text
        val text: CharSequence = if (hideContent) {
            "New message received"
        } else {
            extras?.getCharSequence(Notification.EXTRA_TEXT) ?: ""
        }

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, MASKED_CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        builder
            .setSmallIcon(original.smallIcon ?: android.R.drawable.ic_dialog_info.let {
                android.graphics.drawable.Icon.createWithResource(this, it)
            })
            .setContentTitle(title)
            .setContentText(text)
            .setAutoCancel(true)
            .setWhen(original.`when`)
            .setShowWhen(true)

        // Preserve the tap action so user can still open the app
        if (original.contentIntent != null) {
            builder.setContentIntent(original.contentIntent)
        }

        // Preserve group if present
        if (original.group != null) {
            builder.setGroup(original.group)
            if (hideContent) {
                builder.setContentText("New messages")
            }
        }

        // Use a stable notification ID derived from the original key
        // so repeated notifications from the same source get updated
        val notifId = sbn.key.hashCode()
        notificationManager.notify(notifId, builder.build())
    }

    /**
     * Ensure the masked notification channel exists (Android O+).
     */
    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val existing = notificationManager.getNotificationChannel(MASKED_CHANNEL_ID)
            if (existing == null) {
                val channel = NotificationChannel(
                    MASKED_CHANNEL_ID,
                    MASKED_CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Notifications with privacy-protected content"
                }
                notificationManager.createNotificationChannel(channel)
            }
        }
    }

    /**
     * Get app display name from package name.
     */
    private fun getAppName(packageName: String): String {
        return try {
            val pm = applicationContext.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (_: Exception) {
            "App"
        }
    }
}
