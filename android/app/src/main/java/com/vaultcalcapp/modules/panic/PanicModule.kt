/**
 * VaultCalc - Panic Mode Native Module
 *
 * React Native bridge for panic mode. Exposes methods to
 * enable/disable panic detection and configure triggers.
 *
 * Emits "onPanicTriggered" event when any configured trigger fires.
 *
 * @see Panic Mode feature
 */

package com.vaultcalcapp.modules.panic

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class PanicModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "PanicModule"
        // Singleton so MainActivity can forward key events
        @Volatile
        var instance: PanicManager? = null
            private set
    }

    private val manager = PanicManager(reactContext).also {
        instance = it
    }

    override fun getName(): String = NAME

    /**
     * Enable panic mode with the given trigger options.
     * @param options { volumeDown: boolean, powerButton: boolean }
     */
    @ReactMethod
    fun enablePanicMode(options: ReadableMap, promise: Promise) {
        try {
            manager.volumeTriggerEnabled = options.hasKey("volumeDown") && options.getBoolean("volumeDown")
            manager.powerTriggerEnabled = options.hasKey("powerButton") && options.getBoolean("powerButton")
            manager.start()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PANIC_ERROR", "Failed to enable panic mode: ${e.message}", e)
        }
    }

    /**
     * Disable panic mode — stops all listeners.
     */
    @ReactMethod
    fun disablePanicMode(promise: Promise) {
        try {
            manager.stop()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PANIC_ERROR", "Failed to disable panic mode: ${e.message}", e)
        }
    }

    /**
     * Update trigger options without restarting.
     */
    @ReactMethod
    fun setTriggerOptions(options: ReadableMap, promise: Promise) {
        try {
            manager.volumeTriggerEnabled = options.hasKey("volumeDown") && options.getBoolean("volumeDown")
            manager.powerTriggerEnabled = options.hasKey("powerButton") && options.getBoolean("powerButton")

            // Restart if active to pick up power receiver changes
            if (manager.volumeTriggerEnabled || manager.powerTriggerEnabled) {
                manager.stop()
                manager.start()
            } else {
                manager.stop()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PANIC_ERROR", "Failed to update trigger options: ${e.message}", e)
        }
    }

    override fun onCatalystInstanceDestroy() {
        manager.stop()
        instance = null
        super.onCatalystInstanceDestroy()
    }
}
