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

        // Command IDs
        private const val CMD_LOAD_VIDEO = 1
        private const val CMD_PLAY = 2
        private const val CMD_PAUSE = 3
        private const val CMD_SEEK_TO = 4
        private const val CMD_SET_SPEED = 5
        private const val CMD_MUTE = 6
        private const val CMD_UNMUTE = 7
        private const val CMD_ENTER_FULLSCREEN = 8
        private const val CMD_EXIT_FULLSCREEN = 9
        private const val CMD_SET_PLAYLIST = 10
        private const val CMD_RELEASE = 11
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
            .put("loadVideo", CMD_LOAD_VIDEO)
            .put("play", CMD_PLAY)
            .put("pause", CMD_PAUSE)
            .put("seekTo", CMD_SEEK_TO)
            .put("setSpeed", CMD_SET_SPEED)
            .put("mute", CMD_MUTE)
            .put("unmute", CMD_UNMUTE)
            .put("enterFullscreen", CMD_ENTER_FULLSCREEN)
            .put("exitFullscreen", CMD_EXIT_FULLSCREEN)
            .put("setPlaylist", CMD_SET_PLAYLIST)
            .put("release", CMD_RELEASE)
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
            .build()
    }

    override fun onDropViewInstance(view: VaultVideoPlayerView) {
        view.release()
        super.onDropViewInstance(view)
    }
}
