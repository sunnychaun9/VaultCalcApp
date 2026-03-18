/**
 * VaultCalc - Recents Cover Manager
 *
 * Manages a full-screen black overlay that hides locked app content
 * in the Android recents/task switcher.
 *
 * When a locked app goes to background, this overlay covers the screen
 * so the recents thumbnail captures a black screen instead of the app's content.
 * The overlay is removed when the user switches to another app.
 *
 * Uses TYPE_ACCESSIBILITY_OVERLAY which is available to accessibility services
 * without any additional permissions.
 *
 * @see App Lock feature
 */

package com.vaultcalcapp.modules.applock

import android.accessibilityservice.AccessibilityService
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

class RecentsCoverManager(private val service: AccessibilityService) {

    private var overlayView: View? = null
    private val handler = Handler(Looper.getMainLooper())

    /**
     * Show the black cover overlay.
     * Called when a locked app goes to background.
     */
    fun showCover() {
        if (overlayView != null) return // Already showing

        handler.post {
            try {
                val wm = service.getSystemService(AccessibilityService.WINDOW_SERVICE) as WindowManager

                val layout = LinearLayout(service).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER
                    setBackgroundColor(Color.BLACK)
                }

                // Lock icon
                val icon = TextView(service).apply {
                    text = "\uD83D\uDD12"
                    textSize = 48f
                    gravity = Gravity.CENTER
                }
                layout.addView(icon)

                // "App Locked" text
                val label = TextView(service).apply {
                    text = "App Locked"
                    textSize = 18f
                    setTextColor(0xFFAAAAAA.toInt())
                    gravity = Gravity.CENTER
                    setPadding(0, 24, 0, 0)
                }
                layout.addView(label)

                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.OPAQUE
                )

                wm.addView(layout, params)
                overlayView = layout
            } catch (_: Exception) {
                // WindowManager may throw if the service is not in the right state
            }
        }
    }

    /**
     * Remove the cover overlay.
     * Called when the user switches to another app or unlocks.
     */
    fun hideCover() {
        handler.post {
            try {
                val view = overlayView ?: return@post
                val wm = service.getSystemService(AccessibilityService.WINDOW_SERVICE) as WindowManager
                wm.removeView(view)
                overlayView = null
            } catch (_: Exception) {
                overlayView = null
            }
        }
    }

    /**
     * Whether the cover is currently showing.
     */
    val isShowing: Boolean
        get() = overlayView != null

    /**
     * Clean up resources.
     */
    fun destroy() {
        hideCover()
        handler.removeCallbacksAndMessages(null)
    }
}
