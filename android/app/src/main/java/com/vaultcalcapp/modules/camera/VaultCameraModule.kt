/**
 * VaultCalc - Vault Camera Native Module
 *
 * React Native bridge module for camera operations.
 * Works with VaultCameraView for preview, and provides
 * methods for photo capture, video recording, flash, and camera switch.
 *
 * @see Private Camera feature
 */

package com.vaultcalcapp.modules.camera

import com.facebook.react.bridge.*

class VaultCameraModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "VaultCameraModule"
        @Volatile
        var activeView: VaultCameraView? = null
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun capturePhoto(destPath: String, promise: Promise) {
        val view = activeView
        if (view == null) {
            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", false)
                putString("error", "Camera view not active")
            })
            return
        }
        view.capturePhoto(destPath, promise)
    }

    @ReactMethod
    fun startRecording(destPath: String, promise: Promise) {
        val view = activeView
        if (view == null) {
            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", false)
                putString("error", "Camera view not active")
            })
            return
        }
        view.startRecording(destPath, promise)
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        val view = activeView
        if (view == null) {
            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", false)
                putString("error", "Camera view not active")
            })
            return
        }
        view.stopRecording(promise)
    }

    @ReactMethod
    fun switchCamera(promise: Promise) {
        val view = activeView
        if (view == null) {
            promise.resolve(false)
            return
        }
        view.switchCamera(reactApplicationContext)
        promise.resolve(true)
    }

    @ReactMethod
    fun toggleFlash(promise: Promise) {
        val view = activeView
        if (view == null) {
            promise.resolve("off")
            return
        }
        view.toggleFlash()
        val mode = when (view.flashMode) {
            androidx.camera.core.ImageCapture.FLASH_MODE_ON -> "on"
            androidx.camera.core.ImageCapture.FLASH_MODE_AUTO -> "auto"
            else -> "off"
        }
        promise.resolve(mode)
    }

    @ReactMethod
    fun getVaultTempDir(promise: Promise) {
        val dir = reactApplicationContext.filesDir.absolutePath + "/vault/camera"
        val file = java.io.File(dir)
        if (!file.exists()) file.mkdirs()
        promise.resolve(dir)
    }
}
