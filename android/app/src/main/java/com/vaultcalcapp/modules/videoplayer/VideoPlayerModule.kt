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
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
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

    // ════════════════════════════════════════════════════════════
    // Audio Player — lightweight ExoPlayer for decrypted audio files
    // ════════════════════════════════════════════════════════════

    private var audioPlayer: ExoPlayer? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var audioProgressRunnable: Runnable? = null

    @ReactMethod
    fun audioLoad(filePath: String, promise: Promise) {
        mainHandler.post {
            try {
                val player = audioPlayer ?: ExoPlayer.Builder(reactApplicationContext).build().also {
                    it.addListener(object : Player.Listener {
                        override fun onPlaybackStateChanged(state: Int) {
                            if (state == Player.STATE_ENDED) {
                                emitAudioEvent("onAudioEnd", Arguments.createMap())
                                stopAudioProgress()
                            }
                        }

                        override fun onIsPlayingChanged(isPlaying: Boolean) {
                            val event = Arguments.createMap().apply {
                                putBoolean("isPlaying", isPlaying)
                            }
                            emitAudioEvent("onAudioPlaybackState", event)
                            if (isPlaying) startAudioProgress() else stopAudioProgress()
                        }
                    })
                    audioPlayer = it
                }
                player.setMediaItem(MediaItem.fromUri("file://$filePath"))
                player.prepare()

                val result = Arguments.createMap().apply {
                    putBoolean("success", true)
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("AUDIO_LOAD_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun audioPlay(promise: Promise) {
        mainHandler.post {
            audioPlayer?.play()
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun audioPause(promise: Promise) {
        mainHandler.post {
            audioPlayer?.pause()
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun audioSeekTo(positionMs: Double, promise: Promise) {
        mainHandler.post {
            audioPlayer?.seekTo(positionMs.toLong())
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun audioSetSpeed(speed: Double, promise: Promise) {
        mainHandler.post {
            audioPlayer?.setPlaybackSpeed(speed.toFloat())
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun audioGetPosition(promise: Promise) {
        mainHandler.post {
            val p = audioPlayer
            if (p != null) {
                val result = Arguments.createMap().apply {
                    putDouble("currentTime", p.currentPosition.toDouble())
                    putDouble("duration", p.duration.toDouble())
                    putBoolean("isPlaying", p.isPlaying)
                }
                promise.resolve(result)
            } else {
                promise.resolve(Arguments.createMap().apply {
                    putDouble("currentTime", 0.0)
                    putDouble("duration", 0.0)
                    putBoolean("isPlaying", false)
                })
            }
        }
    }

    @ReactMethod
    fun audioRelease(promise: Promise) {
        mainHandler.post {
            stopAudioProgress()
            audioPlayer?.stop()
            audioPlayer?.release()
            audioPlayer = null
            promise.resolve(true)
        }
    }

    private fun startAudioProgress() {
        stopAudioProgress()
        val runnable = object : Runnable {
            override fun run() {
                audioPlayer?.let { p ->
                    if (p.isPlaying) {
                        val event = Arguments.createMap().apply {
                            putDouble("currentTime", p.currentPosition.toDouble())
                            putDouble("duration", p.duration.toDouble())
                        }
                        emitAudioEvent("onAudioProgress", event)
                    }
                }
                mainHandler.postDelayed(this, 250)
            }
        }
        audioProgressRunnable = runnable
        mainHandler.post(runnable)
    }

    private fun stopAudioProgress() {
        audioProgressRunnable?.let { mainHandler.removeCallbacks(it) }
        audioProgressRunnable = null
    }

    private fun emitAudioEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @Deprecated("Deprecated in Java")
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        stopAudioProgress()
        audioPlayer?.release()
        audioPlayer = null
        scope.cancel()
    }
}
