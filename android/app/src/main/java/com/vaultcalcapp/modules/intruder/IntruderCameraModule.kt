/**
 * VaultCalc - Intruder Camera Native Module
 *
 * Silently captures a photo from the front camera using CameraX.
 * Used for intruder detection on failed PIN attempts.
 *
 * @see FEATURE_INDEX.md SEC-001
 */

package com.vaultcalcapp.modules.intruder

import android.Manifest
import android.content.pm.PackageManager
import android.util.Log
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.*
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * React Native module for silent front camera capture.
 *
 * Features:
 * - Silent capture (no preview, no shutter sound control)
 * - Front camera only (for intruder face capture)
 * - JPEG output to specified path
 * - Permission check before capture
 */
class IntruderCameraModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "IntruderCameraModule"
        private const val TAG = "IntruderCamera"
    }

    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    override fun getName(): String = NAME

    override fun onCatalystInstanceDestroy() {
        cameraExecutor.shutdown()
    }

    /**
     * Check if the app has camera permission.
     *
     * @param promise Resolves with boolean
     */
    @ReactMethod
    fun hasPermission(promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
        promise.resolve(granted)
    }

    /**
     * Silently capture a photo from the front camera.
     *
     * Binds CameraX with only an ImageCapture use case (no preview),
     * takes a single photo, saves to destPath, then unbinds immediately.
     *
     * @param destPath Absolute path where the JPEG should be written
     * @param promise Resolves with { success: true, path } or { success: false, error }
     */
    @ReactMethod
    fun capturePhoto(destPath: String, promise: Promise) {
        // Check permission first
        val hasPermission = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) {
            val result = Arguments.createMap().apply {
                putBoolean("success", false)
                putString("error", "Camera permission not granted")
            }
            promise.resolve(result)
            return
        }

        val activity = getCurrentActivity()
        if (activity == null) {
            val result = Arguments.createMap().apply {
                putBoolean("success", false)
                putString("error", "No activity available")
            }
            promise.resolve(result)
            return
        }

        val context = reactApplicationContext
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

        val resolved = AtomicBoolean(false)
        fun resolveOnce(result: WritableMap) {
            if (resolved.compareAndSet(false, true)) {
                promise.resolve(result)
            }
        }

        cameraProviderFuture.addListener({
            try {
                // Re-check permission (may have been revoked since initial check)
                if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
                    != PackageManager.PERMISSION_GRANTED) {
                    resolveOnce(Arguments.createMap().apply {
                        putBoolean("success", false)
                        putString("error", "Camera permission was revoked")
                    })
                    return@addListener
                }

                val cameraProvider = cameraProviderFuture.get()

                // Build ImageCapture use case (no preview needed for silent capture)
                val imageCapture = ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                    .build()

                // Select front camera
                val cameraSelector = CameraSelector.Builder()
                    .requireLensFacing(CameraSelector.LENS_FACING_FRONT)
                    .build()

                // Ensure parent directory exists
                val destFile = File(destPath)
                destFile.parentFile?.mkdirs()

                // Bind camera on main thread (requires LifecycleOwner)
                activity.runOnUiThread {
                    try {
                        cameraProvider.unbindAll()

                        val lifecycleOwner = activity as? LifecycleOwner
                        if (lifecycleOwner == null) {
                            cameraProvider.unbindAll()
                            resolveOnce(Arguments.createMap().apply {
                                putBoolean("success", false)
                                putString("error", "Activity is not a LifecycleOwner")
                            })
                            return@runOnUiThread
                        }

                        cameraProvider.bindToLifecycle(
                            lifecycleOwner,
                            cameraSelector,
                            imageCapture
                        )

                        // Take the photo
                        val outputOptions = ImageCapture.OutputFileOptions.Builder(destFile).build()

                        imageCapture.takePicture(
                            outputOptions,
                            cameraExecutor,
                            object : ImageCapture.OnImageSavedCallback {
                                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                                    // Unbind immediately after capture
                                    activity.runOnUiThread {
                                        cameraProvider.unbindAll()
                                    }
                                    resolveOnce(Arguments.createMap().apply {
                                        putBoolean("success", true)
                                        putString("path", destPath)
                                    })
                                }

                                override fun onError(exception: ImageCaptureException) {
                                    Log.e(TAG, "Photo capture failed", exception)
                                    activity.runOnUiThread {
                                        cameraProvider.unbindAll()
                                    }
                                    resolveOnce(Arguments.createMap().apply {
                                        putBoolean("success", false)
                                        putString("error", exception.message ?: "Capture failed")
                                    })
                                }
                            }
                        )
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to bind camera", e)
                        cameraProvider.unbindAll()
                        resolveOnce(Arguments.createMap().apply {
                            putBoolean("success", false)
                            putString("error", e.message ?: "Camera binding failed")
                        })
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get camera provider", e)
                resolveOnce(Arguments.createMap().apply {
                    putBoolean("success", false)
                    putString("error", e.message ?: "Camera provider failed")
                })
            }
        }, ContextCompat.getMainExecutor(context))
    }
}
