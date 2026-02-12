/**
 * VaultCalc - App Security Native Module
 *
 * Provides methods to control app visibility in the Android
 * recents screen — critical for a vault/disguise app.
 *
 * @see AUTH-010 in FEATURE_INDEX.md
 */

package com.vaultcalcapp.modules.security

import android.app.ActivityManager
import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.*

class AppSecurityModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AppSecurityModule"
    }

    override fun getName(): String = NAME

    /**
     * Remove the app from the Android recents/task-switcher immediately.
     *
     * After calling this the app disappears from the recent apps list.
     * The Activity is finished and removed from the task stack.
     * The process continues running briefly for cleanup, then Android
     * reclaims it naturally — no forced kill needed.
     *
     * Call this on lock when the user wants the app to "vanish".
     */
    @ReactMethod
    fun removeFromRecents(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity != null) {
                activity.finishAndRemoveTask()
                promise.resolve(true)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Set the FLAG_EXCLUDE_FROM_RECENTS on the current task.
     *
     * Unlike removeFromRecents(), this does NOT finish the Activity.
     * The app keeps running but is hidden from the recents screen.
     * When the user re-opens the app (via launcher), it resumes
     * where it left off — showing the calculator since we already locked.
     *
     * This is the softer alternative: the app stays alive (no restart
     * penalty) but is invisible in recents.
     */
    @ReactMethod
    fun excludeFromRecents(exclude: Boolean, promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity ?: run {
                promise.resolve(false)
                return
            }
            val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            // appTasks[0] is the current task
            val tasks = am.appTasks
            if (tasks.isNotEmpty()) {
                if (exclude) {
                    tasks[0].setExcludeFromRecents(true)
                } else {
                    tasks[0].setExcludeFromRecents(false)
                }
                promise.resolve(true)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}
