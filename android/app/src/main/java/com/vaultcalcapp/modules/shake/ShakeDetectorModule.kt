/**
 * VaultCalc - Shake Detector Module
 *
 * Native module that detects phone shakes via the accelerometer
 * and emits events to React Native for the panic button feature.
 *
 * @see FEATURE_INDEX.md ENH-005
 */

package com.vaultcalcapp.modules.shake

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.sqrt

/**
 * Detects device shakes using the accelerometer sensor.
 *
 * Algorithm:
 * - Reads accelerometer data at SENSOR_DELAY_UI rate
 * - Computes acceleration magnitude minus gravity
 * - If delta exceeds threshold, emits "onShakeDetected" event
 * - 1.5-second cooldown prevents rapid re-triggers
 */
class ShakeDetectorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), SensorEventListener {

    companion object {
        private const val MODULE_NAME = "ShakeDetectorModule"
        private const val EVENT_NAME = "onShakeDetected"
        private const val SHAKE_THRESHOLD = 20.0
        private const val COOLDOWN_MS = 3000L
    }

    private val sensorManager: SensorManager =
        reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val accelerometer: Sensor? =
        sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

    private val lastShakeTime = AtomicLong(0)
    private var isListening = false

    override fun getName(): String = MODULE_NAME

    @ReactMethod
    fun startListening() {
        if (isListening || accelerometer == null) return
        sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI)
        isListening = true
    }

    @ReactMethod
    fun stopListening() {
        if (!isListening) return
        sensorManager.unregisterListener(this)
        isListening = false
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_ACCELEROMETER) return

        val x = event.values[0].toDouble()
        val y = event.values[1].toDouble()
        val z = event.values[2].toDouble()

        val acceleration = sqrt(x * x + y * y + z * z) - SensorManager.GRAVITY_EARTH

        if (acceleration > SHAKE_THRESHOLD) {
            val now = System.currentTimeMillis()
            val last = lastShakeTime.get()
            if (now - last > COOLDOWN_MS && lastShakeTime.compareAndSet(last, now)) {
                emitShakeEvent()
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // Not needed for shake detection
    }

    override fun onCatalystInstanceDestroy() {
        stopListening()
        super.onCatalystInstanceDestroy()
    }

    private fun emitShakeEvent() {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_NAME, null)
    }
}
