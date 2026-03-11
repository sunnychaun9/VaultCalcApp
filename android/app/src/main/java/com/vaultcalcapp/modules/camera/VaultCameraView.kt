/**
 * VaultCalc - Vault Camera View
 *
 * Native Android view containing a CameraX PreviewView.
 * Manages camera lifecycle, photo capture, and video recording.
 * Controlled by VaultCameraModule via singleton reference.
 *
 * @see Private Camera feature
 */

package com.vaultcalcapp.modules.camera

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import android.widget.FrameLayout
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.*
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactContext
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class VaultCameraView(context: Context) : FrameLayout(context) {

    companion object {
        private const val TAG = "VaultCameraView"
    }

    val previewView: PreviewView = PreviewView(context).apply {
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    }

    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var cameraProvider: ProcessCameraProvider? = null
    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var activeRecording: Recording? = null
    private var camera: Camera? = null

    var lensFacing: Int = CameraSelector.LENS_FACING_BACK
        private set
    var flashMode: Int = ImageCapture.FLASH_MODE_OFF
        private set
    var isRecording: Boolean = false
        private set

    init {
        addView(previewView)
    }

    fun startCamera(reactContext: ReactContext) {
        val activity = (reactContext as? ReactContext)?.currentActivity ?: return
        val ctx = reactContext.applicationContext

        val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
        cameraProviderFuture.addListener({
            try {
                cameraProvider = cameraProviderFuture.get()
                bindCamera(activity)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get camera provider", e)
            }
        }, ContextCompat.getMainExecutor(ctx))
    }

    private fun bindCamera(activity: android.app.Activity) {
        val provider = cameraProvider ?: return
        val lifecycleOwner = activity as? LifecycleOwner ?: return

        provider.unbindAll()

        val cameraSelector = CameraSelector.Builder()
            .requireLensFacing(lensFacing)
            .build()

        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(previewView.surfaceProvider)
        }

        imageCapture = ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
            .setFlashMode(flashMode)
            .build()

        val recorder = Recorder.Builder()
            .setQualitySelector(QualitySelector.from(Quality.HD))
            .build()
        videoCapture = VideoCapture.withOutput(recorder)

        try {
            camera = provider.bindToLifecycle(
                lifecycleOwner,
                cameraSelector,
                preview,
                imageCapture,
                videoCapture
            )
        } catch (e: Exception) {
            // Some devices don't support video+photo simultaneously; fall back to photo only
            Log.w(TAG, "Failed to bind video, falling back to photo only", e)
            try {
                camera = provider.bindToLifecycle(
                    lifecycleOwner,
                    cameraSelector,
                    preview,
                    imageCapture
                )
                videoCapture = null
            } catch (e2: Exception) {
                Log.e(TAG, "Failed to bind camera at all", e2)
            }
        }
    }

    fun switchCamera(reactContext: ReactContext) {
        lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
            CameraSelector.LENS_FACING_FRONT
        } else {
            CameraSelector.LENS_FACING_BACK
        }
        val activity = (reactContext as? ReactContext)?.currentActivity ?: return
        bindCamera(activity)
    }

    fun toggleFlash() {
        flashMode = when (flashMode) {
            ImageCapture.FLASH_MODE_OFF -> ImageCapture.FLASH_MODE_ON
            ImageCapture.FLASH_MODE_ON -> ImageCapture.FLASH_MODE_AUTO
            else -> ImageCapture.FLASH_MODE_OFF
        }
        imageCapture?.flashMode = flashMode
    }

    fun capturePhoto(destPath: String, promise: Promise) {
        val capture = imageCapture
        if (capture == null) {
            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", false)
                putString("error", "Camera not ready")
            })
            return
        }

        val destFile = File(destPath)
        destFile.parentFile?.mkdirs()

        val outputOptions = ImageCapture.OutputFileOptions.Builder(destFile).build()
        capture.takePicture(
            outputOptions,
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("path", destPath)
                    })
                }

                override fun onError(exception: ImageCaptureException) {
                    Log.e(TAG, "Photo capture failed", exception)
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", false)
                        putString("error", exception.message ?: "Capture failed")
                    })
                }
            }
        )
    }

    @SuppressLint("MissingPermission")
    fun startRecording(destPath: String, promise: Promise) {
        val vc = videoCapture
        if (vc == null) {
            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", false)
                putString("error", "Video capture not available on this device")
            })
            return
        }

        if (isRecording) {
            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", false)
                putString("error", "Already recording")
            })
            return
        }

        val destFile = File(destPath)
        destFile.parentFile?.mkdirs()

        val outputOptions = FileOutputOptions.Builder(destFile).build()

        activeRecording = vc.output
            .prepareRecording(previewView.context, outputOptions)
            .apply {
                val ctx = previewView.context
                if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO)
                    == PackageManager.PERMISSION_GRANTED) {
                    withAudioEnabled()
                }
            }
            .start(cameraExecutor) { event ->
                when (event) {
                    is VideoRecordEvent.Finalize -> {
                        isRecording = false
                        if (event.hasError()) {
                            Log.e(TAG, "Video recording error: ${event.error}")
                        }
                    }
                }
            }

        isRecording = true
        promise.resolve(Arguments.createMap().apply {
            putBoolean("success", true)
            putString("path", destPath)
        })
    }

    fun stopRecording(promise: Promise) {
        if (!isRecording || activeRecording == null) {
            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", false)
                putString("error", "Not recording")
            })
            return
        }

        activeRecording?.stop()
        activeRecording = null
        isRecording = false
        promise.resolve(Arguments.createMap().apply {
            putBoolean("success", true)
        })
    }

    fun release() {
        activeRecording?.stop()
        activeRecording = null
        isRecording = false
        cameraProvider?.unbindAll()
        cameraProvider = null
        cameraExecutor.shutdown()
    }
}
