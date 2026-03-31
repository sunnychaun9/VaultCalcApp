/**
 * VaultCalc — Fake Crash Native Module
 *
 * React Native bridge that exposes the fake crash screen to JS.
 * Tracks consecutive wrong-PIN attempts and triggers automatically
 * when the threshold is reached.
 */

package com.vaultcalcapp.modules.fakecrash

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FakeCrashModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "FakeCrashModule"
        private const val DEFAULT_WRONG_PIN_THRESHOLD = 2
    }

    private var wrongPinCount = 0
    private var wrongPinThreshold = DEFAULT_WRONG_PIN_THRESHOLD

    override fun getName(): String = NAME

    /**
     * Show the fake crash screen immediately.
     * Callable from JS: NativeModules.FakeCrashModule.show()
     */
    @ReactMethod
    fun show(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity != null) {
                FakeCrashActivity.show(activity)
            } else {
                FakeCrashActivity.show(reactApplicationContext)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("FAKE_CRASH_ERROR", "Failed to show fake crash: ${e.message}", e)
        }
    }

    /**
     * Report a wrong PIN attempt. If the threshold is reached,
     * the fake crash screen is shown and the counter resets.
     *
     * @return true if the crash screen was triggered, false otherwise.
     */
    @ReactMethod
    fun reportWrongPin(promise: Promise) {
        wrongPinCount++
        if (wrongPinCount >= wrongPinThreshold) {
            wrongPinCount = 0
            try {
                val activity = reactApplicationContext.currentActivity
                if (activity != null) {
                    FakeCrashActivity.show(activity)
                } else {
                    FakeCrashActivity.show(reactApplicationContext)
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("FAKE_CRASH_ERROR", "Failed to show fake crash: ${e.message}", e)
            }
        } else {
            promise.resolve(false)
        }
    }

    /**
     * Reset the wrong-PIN counter (e.g. after successful auth).
     */
    @ReactMethod
    fun resetWrongPinCount(promise: Promise) {
        wrongPinCount = 0
        promise.resolve(true)
    }

    /**
     * Update the wrong-PIN threshold.
     * @param threshold Number of wrong attempts before triggering (min 1).
     */
    @ReactMethod
    fun setWrongPinThreshold(threshold: Int, promise: Promise) {
        wrongPinThreshold = threshold.coerceAtLeast(1)
        promise.resolve(true)
    }
}
