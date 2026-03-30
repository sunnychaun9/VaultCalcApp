package com.vaultcalcapp.modules.orientation

import android.content.pm.ActivityInfo
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class OrientationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OrientationModule"

    @ReactMethod
    fun lockPortrait() {
        val activity = reactApplicationContext.currentActivity ?: return
        activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    }

    @ReactMethod
    fun unlockAll() {
        val activity = reactApplicationContext.currentActivity ?: return
        activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_USER
    }
}
