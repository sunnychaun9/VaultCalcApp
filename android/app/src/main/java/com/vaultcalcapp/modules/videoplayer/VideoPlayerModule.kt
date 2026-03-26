/**
 * VaultCalc - Video Player Native Module
 *
 * Provides imperative video player control methods to React Native.
 * Exposes: playVideo, pause, seekTo, setSpeed, mute, unmute.
 * Handles encrypted file decryption pipeline for secure playback.
 *
 * @see FEATURE_INDEX.md VIDEO-010
 */

package com.vaultcalcapp.modules.videoplayer

import android.media.MediaMetadataRetriever
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import java.io.File

class VideoPlayerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "VideoPlayerModule"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun getName(): String = NAME

    /**
     * Get video metadata (duration, resolution, size) for detail screen.
     */
    @ReactMethod
    fun getVideoDetails(filePath: String, promise: Promise) {
        scope.launch(Dispatchers.IO) {
            try {
                val file = File(filePath)
                if (!file.exists()) {
                    withContext(Dispatchers.Main) {
                        promise.reject("FILE_NOT_FOUND", "Video file not found")
                    }
                    return@launch
                }

                val retriever = MediaMetadataRetriever()
                try {
                    retriever.setDataSource(filePath)

                    val duration = retriever.extractMetadata(
                        MediaMetadataRetriever.METADATA_KEY_DURATION
                    )?.toLongOrNull() ?: 0L

                    val width = retriever.extractMetadata(
                        MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH
                    )?.toIntOrNull() ?: 0

                    val height = retriever.extractMetadata(
                        MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT
                    )?.toIntOrNull() ?: 0

                    val bitrate = retriever.extractMetadata(
                        MediaMetadataRetriever.METADATA_KEY_BITRATE
                    )?.toIntOrNull() ?: 0

                    val date = retriever.extractMetadata(
                        MediaMetadataRetriever.METADATA_KEY_DATE
                    ) ?: ""

                    val result = Arguments.createMap().apply {
                        putDouble("duration", duration.toDouble())
                        putInt("width", width)
                        putInt("height", height)
                        putDouble("size", file.length().toDouble())
                        putInt("bitrate", bitrate)
                        putString("date", date)
                        putString("fileName", file.name)
                        putString("resolution", "${width}x${height}")
                    }

                    withContext(Dispatchers.Main) {
                        promise.resolve(result)
                    }
                } finally {
                    retriever.release()
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("METADATA_ERROR", e.message)
                }
            }
        }
    }

    /**
     * Delete temp file securely (overwrite + unlink).
     */
    @ReactMethod
    fun deleteTempFile(filePath: String, promise: Promise) {
        scope.launch(Dispatchers.IO) {
            try {
                val file = File(filePath)
                if (file.exists()) {
                    // Overwrite with random data before deletion
                    val raf = java.io.RandomAccessFile(file, "rw")
                    val random = java.security.SecureRandom()
                    val buffer = ByteArray(4096)
                    var remaining = file.length()
                    while (remaining > 0) {
                        random.nextBytes(buffer)
                        val toWrite = minOf(remaining, buffer.size.toLong()).toInt()
                        raf.write(buffer, 0, toWrite)
                        remaining -= toWrite
                    }
                    raf.fd.sync()
                    raf.close()
                    file.delete()
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("DELETE_ERROR", e.message)
                }
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        scope.cancel()
    }
}
