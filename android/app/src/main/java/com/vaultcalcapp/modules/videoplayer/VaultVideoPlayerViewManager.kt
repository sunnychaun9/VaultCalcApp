/**
 * VaultCalc - Video Player View Manager
 *
 * React Native ViewManager that bridges VaultVideoPlayerView to JS.
 * Handles props and direct commands from React Native.
 *
 * @see FEATURE_INDEX.md VIDEO-010
 */

package com.vaultcalcapp.modules.videoplayer

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

@androidx.media3.common.util.UnstableApi
class VaultVideoPlayerViewManager : SimpleViewManager<VaultVideoPlayerView>() {

    companion object {
        const val REACT_CLASS = "VaultVideoPlayerView"
    }

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): VaultVideoPlayerView {
        return VaultVideoPlayerView(reactContext)
    }

    // ── Props ──────────────────────────────────────────────────

    @ReactProp(name = "title")
    fun setTitle(view: VaultVideoPlayerView, title: String?) {
        view.setTitle(title ?: "")
    }

    @ReactProp(name = "autoPlay", defaultBoolean = true)
    fun setAutoPlay(view: VaultVideoPlayerView, autoPlay: Boolean) {
        // Auto-play is handled by loadVideo
    }

    // ── Commands ───────────────────────────────────────────────

    override fun getCommandsMap(): Map<String, Int> {
        return MapBuilder.builder<String, Int>()
            .put("loadVideo", 1)
            .put("play", 2)
            .put("pause", 3)
            .put("seekTo", 4)
            .put("setSpeed", 5)
            .put("mute", 6)
            .put("unmute", 7)
            .put("enterFullscreen", 8)
            .put("exitFullscreen", 9)
            .put("setPlaylist", 10)
            .put("release", 11)
            .put("lockScreen", 12)
            .put("unlockScreen", 13)
            .put("rotateScreen", 14)
            .put("setAutoRotate", 15)
            .put("loadSubtitle", 16)
            .put("toggleSubtitles", 17)
            .put("adjustSubtitleDelay", 18)
            .put("resetSubtitleDelay", 19)
            .build()
    }

    override fun receiveCommand(root: VaultVideoPlayerView, commandId: String?, args: ReadableArray?) {
        when (commandId) {
            "loadVideo" -> {
                val filePath = args?.getString(0) ?: return
                val startPosition = if (args.size() > 1) args.getDouble(1).toLong() else 0L
                root.loadVideo(filePath, startPosition)
            }
            "play" -> root.play()
            "pause" -> root.pause()
            "seekTo" -> {
                val positionMs = args?.getDouble(0)?.toLong() ?: return
                root.seekTo(positionMs)
            }
            "setSpeed" -> {
                val speed = args?.getDouble(0)?.toFloat() ?: return
                root.setSpeed(speed)
            }
            "mute" -> root.mute()
            "unmute" -> root.unmute()
            "enterFullscreen" -> root.enterFullscreen()
            "exitFullscreen" -> root.exitFullscreen()
            "setPlaylist" -> {
                val pathsArray = args?.getArray(0) ?: return
                val startIndex = if (args.size() > 1) args.getInt(1) else 0
                val paths = mutableListOf<String>()
                for (i in 0 until pathsArray.size()) {
                    pathsArray.getString(i)?.let { paths.add(it) }
                }
                root.setPlaylist(paths, startIndex)
            }
            "release" -> root.release()
            "lockScreen" -> root.lockScreen()
            "unlockScreen" -> root.unlockScreen()
            "rotateScreen" -> root.rotateScreen()
            "setAutoRotate" -> {
                val enabled = args?.getBoolean(0) ?: return
                root.setAutoRotate(enabled)
            }
            "loadSubtitle" -> {
                val srtPath = args?.getString(0) ?: return
                root.loadSubtitle(srtPath)
            }
            "toggleSubtitles" -> root.toggleSubtitles()
            "adjustSubtitleDelay" -> {
                val deltaMs = args?.getDouble(0)?.toLong() ?: return
                root.adjustSubtitleDelay(deltaMs)
            }
            "resetSubtitleDelay" -> root.resetSubtitleDelay()
        }
    }

    // ── Events ─────────────────────────────────────────────────

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return MapBuilder.builder<String, Any>()
            .put("onLoad", MapBuilder.of("registrationName", "onLoad"))
            .put("onProgress", MapBuilder.of("registrationName", "onProgress"))
            .put("onEnd", MapBuilder.of("registrationName", "onEnd"))
            .put("onError", MapBuilder.of("registrationName", "onError"))
            .put("onBuffering", MapBuilder.of("registrationName", "onBuffering"))
            .put("onPlaybackStateChange", MapBuilder.of("registrationName", "onPlaybackStateChange"))
            .put("onVolumeChange", MapBuilder.of("registrationName", "onVolumeChange"))
            .put("onBrightnessChange", MapBuilder.of("registrationName", "onBrightnessChange"))
            .put("onSpeedChange", MapBuilder.of("registrationName", "onSpeedChange"))
            .put("onNavigate", MapBuilder.of("registrationName", "onNavigate"))
            .put("onBackPress", MapBuilder.of("registrationName", "onBackPress"))
            .put("onMenuPress", MapBuilder.of("registrationName", "onMenuPress"))
            .put("onLockStateChange", MapBuilder.of("registrationName", "onLockStateChange"))
            .put("onSubtitleStateChange", MapBuilder.of("registrationName", "onSubtitleStateChange"))
            .build()
    }

    override fun onDropViewInstance(view: VaultVideoPlayerView) {
        view.release()
        super.onDropViewInstance(view)
    }
}
