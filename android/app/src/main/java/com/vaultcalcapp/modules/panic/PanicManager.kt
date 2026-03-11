/**
 * VaultCalc - Panic Manager
 *
 * Coordinates panic mode triggers:
 * - Volume Down triple press (tracked via key events forwarded from MainActivity)
 * - Power button triple press (tracked via screen on/off broadcast)
 *
 * Emits "onPanicTriggered" event to React Native when any trigger fires.
 * Shake detection is handled separately by ShakeDetectorModule.
 *
 * @see Panic Mode feature
 */

package com.vaultcalcapp.modules.panic

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.view.KeyEvent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.atomic.AtomicBoolean

class PanicManager(private val reactContext: ReactApplicationContext) {

    companion object {
        private const val EVENT_NAME = "onPanicTriggered"
        private const val REQUIRED_PRESSES = 3
        private const val WINDOW_MS = 2000L
        private const val COOLDOWN_MS = 3000L
    }

    // Trigger enable flags
    var volumeTriggerEnabled = false
    var powerTriggerEnabled = false

    private val isActive = AtomicBoolean(false)

    // Volume key tracking
    private val volumeTimestamps = mutableListOf<Long>()
    private var lastVolumePanic = 0L

    // Power button tracking
    private val powerTimestamps = mutableListOf<Long>()
    private var lastPowerPanic = 0L

    private var powerReceiver: BroadcastReceiver? = null

    /**
     * Start listening for enabled triggers.
     */
    fun start() {
        if (isActive.getAndSet(true)) return
        if (powerTriggerEnabled) {
            registerPowerReceiver()
        }
    }

    /**
     * Stop all listeners.
     */
    fun stop() {
        if (!isActive.getAndSet(false)) return
        unregisterPowerReceiver()
        synchronized(volumeTimestamps) { volumeTimestamps.clear() }
        synchronized(powerTimestamps) { powerTimestamps.clear() }
    }

    /**
     * Called by MainActivity.dispatchKeyEvent when volume down is pressed.
     * Returns true if the event was consumed (panic triggered).
     */
    fun onVolumeDownPressed(): Boolean {
        if (!isActive.get() || !volumeTriggerEnabled) return false

        val now = System.currentTimeMillis()

        synchronized(volumeTimestamps) {
            // Remove timestamps outside the window
            volumeTimestamps.removeAll { now - it > WINDOW_MS }
            volumeTimestamps.add(now)

            if (volumeTimestamps.size >= REQUIRED_PRESSES && now - lastVolumePanic > COOLDOWN_MS) {
                lastVolumePanic = now
                volumeTimestamps.clear()
                emitPanic()
                return true
            }
        }
        return false
    }

    private fun registerPowerReceiver() {
        if (powerReceiver != null) return

        powerReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action == Intent.ACTION_SCREEN_OFF || intent.action == Intent.ACTION_SCREEN_ON) {
                    onPowerEvent()
                }
            }
        }

        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(powerReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            reactContext.registerReceiver(powerReceiver, filter)
        }
    }

    private fun unregisterPowerReceiver() {
        powerReceiver?.let {
            try {
                reactContext.unregisterReceiver(it)
            } catch (_: IllegalArgumentException) {
                // Already unregistered
            }
            powerReceiver = null
        }
    }

    private fun onPowerEvent() {
        if (!isActive.get() || !powerTriggerEnabled) return

        val now = System.currentTimeMillis()

        synchronized(powerTimestamps) {
            powerTimestamps.removeAll { now - it > WINDOW_MS }
            powerTimestamps.add(now)

            if (powerTimestamps.size >= REQUIRED_PRESSES && now - lastPowerPanic > COOLDOWN_MS) {
                lastPowerPanic = now
                powerTimestamps.clear()
                emitPanic()
            }
        }
    }

    private fun emitPanic() {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_NAME, null)
        } catch (_: Exception) {
            // JS bridge may not be ready
        }
    }
}
