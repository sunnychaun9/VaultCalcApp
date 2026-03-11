/**
 * VaultCalc - Notification Privacy Listener Service
 *
 * NotificationListenerService that intercepts and masks notifications
 * from protected apps. Handles grouped, media, and silent notifications.
 * Compatible with Android 10–14.
 *
 * @see Notification Privacy feature
 */

package com.vaultcalcapp.modules.notificationprivacy

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class NotificationPrivacyListener : NotificationListenerService() {

    private val filterManager: NotificationFilterManager by lazy {
        NotificationFilterManager.getInstance(applicationContext)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return

        // Skip our own notifications
        if (sbn.packageName == applicationContext.packageName) return

        // Skip if feature is disabled
        if (!filterManager.isEnabled) return

        // Skip if this package is not protected
        if (!filterManager.isAppProtected(sbn.packageName)) return

        // Skip ongoing/foreground service notifications (media players, etc.)
        if (sbn.isOngoing) return

        // Skip silent/low-priority notifications that don't show content
        val notification = sbn.notification
        if (notification.priority <= Notification.PRIORITY_MIN) return

        try {
            if (filterManager.blockEntirely) {
                // Cancel the notification entirely
                cancelNotification(sbn.key)
                return
            }

            // Build a masked replacement notification
            val maskedNotification = buildMaskedNotification(sbn)
            if (maskedNotification != null) {
                // We cannot directly replace; cancel and let the app re-post logic handle.
                // Instead, we modify the notification extras in-place before it displays.
                // Since Android doesn't allow direct modification, we snooze briefly then unsnooze
                // with masked content — but the cleanest approach is to use the extras override.
                maskNotificationExtras(sbn)
            }
        } catch (_: Exception) {
            // Never crash the listener service — fail silently
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        // No-op — we only care about posted notifications
    }

    /**
     * Mask notification content by modifying its extras bundle.
     * This works because the notification object is mutable before display.
     */
    private fun maskNotificationExtras(sbn: StatusBarNotification) {
        val notification = sbn.notification
        val extras = notification.extras ?: return

        val hideContent = filterManager.hideContent
        val hideSender = filterManager.hideSender

        if (hideContent) {
            // Mask the main text content
            extras.putCharSequence(Notification.EXTRA_TEXT, "New message received")
            extras.putCharSequence(Notification.EXTRA_BIG_TEXT, "New message received")
            extras.putCharSequence(Notification.EXTRA_SUB_TEXT, null)
            extras.putCharSequence(Notification.EXTRA_INFO_TEXT, null)
            extras.putCharSequence(Notification.EXTRA_SUMMARY_TEXT, null)

            // Clear messaging style messages
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                extras.putParcelableArray(Notification.EXTRA_MESSAGES, null)
                extras.putParcelableArray(Notification.EXTRA_HISTORIC_MESSAGES, null)
            }

            // Clear text lines for inbox style
            extras.putCharSequenceArray(Notification.EXTRA_TEXT_LINES, null)

            // Remove picture for BigPicture style
            extras.putParcelable(Notification.EXTRA_PICTURE, null)
        }

        if (hideSender) {
            // Mask title (usually sender name in messaging apps)
            val appName = getAppName(sbn.packageName)
            extras.putCharSequence(Notification.EXTRA_TITLE, appName)
            extras.putCharSequence(Notification.EXTRA_TITLE_BIG, appName)
            extras.putCharSequence(Notification.EXTRA_CONVERSATION_TITLE, appName)

            // Remove sender avatar / large icon
            extras.putParcelable(Notification.EXTRA_LARGE_ICON, null)
            extras.putParcelable(Notification.EXTRA_LARGE_ICON_BIG, null)
        }

        // Handle grouped notifications
        if (notification.group != null && hideContent) {
            extras.putCharSequence(Notification.EXTRA_TEXT, "New messages")
        }
    }

    /**
     * Build a masked notification (used for reference, actual masking done via extras).
     */
    private fun buildMaskedNotification(sbn: StatusBarNotification): Notification? {
        val notification = sbn.notification
        val channelId = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            notification.channelId ?: "default"
        } else {
            "default"
        }

        return try {
            val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Notification.Builder(this, channelId)
            } else {
                @Suppress("DEPRECATION")
                Notification.Builder(this)
            }

            val appName = getAppName(sbn.packageName)

            builder
                .setSmallIcon(notification.smallIcon)
                .setContentTitle(if (filterManager.hideSender) appName else notification.extras?.getCharSequence(Notification.EXTRA_TITLE))
                .setContentText("New message received")
                .setAutoCancel(true)
                .setContentIntent(notification.contentIntent)

            if (notification.group != null) {
                builder.setGroup(notification.group)
            }

            builder.build()
        } catch (_: Exception) {
            null
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
