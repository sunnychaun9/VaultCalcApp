/**
 * VaultCalc - Native ExoPlayer Video Player View
 *
 * Premium video playback with Media3 ExoPlayer.
 * Gesture controls: horizontal seek, vertical volume/brightness, double-tap.
 * Immersive fullscreen, FLAG_SECURE, playback speed, prev/next support.
 *
 * @see FEATURE_INDEX.md VIDEO-010
 */

package com.vaultcalcapp.modules.videoplayer

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.graphics.Color
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.AttributeSet
import android.view.*
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

@SuppressLint("ViewConstructor")
@androidx.media3.common.util.UnstableApi
class VaultVideoPlayerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : FrameLayout(context, attrs, defStyleAttr), Player.Listener {

    // ── ExoPlayer ──────────────────────────────────────────────
    private var player: ExoPlayer? = null
    private val playerView: PlayerView
    private val handler = Handler(Looper.getMainLooper())
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    // ── Playlist ───────────────────────────────────────────────
    private var playlist = mutableListOf<String>()
    private var currentIndex = 0

    // ── State ──────────────────────────────────────────────────
    private var isMuted = false
    private var savedVolume = 1f
    private var currentSpeed = 1.0f
    private var resumePosition = 0L
    private var autoPlayNext = true

    // ── Gesture tracking ───────────────────────────────────────
    private var gestureStartX = 0f
    private var gestureStartY = 0f
    private var isHorizontalGesture = false
    private var isVerticalGesture = false
    private var gestureStartVolume = 0f
    private var gestureStartBrightness = 0f
    private var gestureSeekStartPosition = 0L
    private val GESTURE_THRESHOLD = 30f
    private val SEEK_SENSITIVITY = 100L // ms per pixel
    private val VOLUME_SENSITIVITY = 0.004f
    private val BRIGHTNESS_SENSITIVITY = 0.004f

    // ── Double-tap ─────────────────────────────────────────────
    private var lastTapTime = 0L
    private var lastTapX = 0f
    private val DOUBLE_TAP_TIMEOUT = 300L
    private val SEEK_JUMP_MS = 10_000L

    // ── Controls auto-hide ─────────────────────────────────────
    private var controlsVisible = true
    private val CONTROLS_HIDE_DELAY = 4000L
    private val hideControlsRunnable = Runnable { hideControls() }

    // ── Overlay views ──────────────────────────────────────────
    private val gestureOverlay: TextView
    private val seekOverlay: TextView
    private val errorOverlay: TextView
    private val bufferingOverlay: View

    // ── Custom controls ────────────────────────────────────────
    private val bottomControlsContainer: LinearLayout
    private val rightControlsContainer: LinearLayout
    private val seekBar: View
    private val seekFill: View
    private val timeText: TextView
    private val playPauseBtn: TextView
    private val prevBtn: TextView
    private val rewindBtn: TextView
    private val forwardBtn: TextView
    private val nextBtn: TextView
    private val volumeBtn: TextView
    private val speedBtn: TextView
    private val topBar: LinearLayout
    private val backBtn: TextView
    private val titleText: TextView
    private val menuBtn: TextView

    // ── Progress reporting ──────────────────────────────────────
    private val progressRunnable = object : Runnable {
        override fun run() {
            player?.let { p ->
                if (p.isPlaying) {
                    sendProgressEvent(p.currentPosition, p.duration)
                }
            }
            handler.postDelayed(this, 250)
        }
    }

    // ── Speed options ──────────────────────────────────────────
    private val SPEED_OPTIONS = floatArrayOf(0.25f, 0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f, 3.0f)

    init {
        setBackgroundColor(Color.BLACK)

        // Player view
        playerView = PlayerView(context).apply {
            useController = false
            setBackgroundColor(Color.BLACK)
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
        }
        addView(playerView)

        // Buffering overlay
        bufferingOverlay = View(context).apply {
            setBackgroundColor(Color.TRANSPARENT)
            visibility = View.GONE
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        }
        addView(bufferingOverlay)

        // Gesture overlay (volume/brightness)
        gestureOverlay = TextView(context).apply {
            setBackgroundColor(0xCC000000.toInt())
            setTextColor(Color.WHITE)
            textSize = 16f
            gravity = Gravity.CENTER
            setPadding(32, 16, 32, 16)
            visibility = View.GONE
            layoutParams = LayoutParams(
                LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER
            )
        }
        addView(gestureOverlay)

        // Seek overlay
        seekOverlay = TextView(context).apply {
            setBackgroundColor(0xCC000000.toInt())
            setTextColor(Color.WHITE)
            textSize = 18f
            gravity = Gravity.CENTER
            setPadding(40, 20, 40, 20)
            visibility = View.GONE
            layoutParams = LayoutParams(
                LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER
            )
        }
        addView(seekOverlay)

        // Error overlay
        errorOverlay = TextView(context).apply {
            setBackgroundColor(0xE0000000.toInt())
            setTextColor(Color.WHITE)
            textSize = 16f
            gravity = Gravity.CENTER
            setPadding(48, 32, 48, 32)
            visibility = View.GONE
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        }
        addView(errorOverlay)

        // ── Top bar ──
        topBar = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(0x80000000.toInt())
            gravity = Gravity.CENTER_VERTICAL
            setPadding(8, 8, 8, 8)
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.TOP)
        }

        backBtn = createIconButton("\u2190", 28f) { sendSimpleEvent("onBackPress") }
        titleText = TextView(context).apply {
            setTextColor(Color.WHITE)
            textSize = 16f
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.MIDDLE
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = 8; marginEnd = 8
            }
        }
        menuBtn = createIconButton("\u22EE", 24f) { sendSimpleEvent("onMenuPress") }

        topBar.addView(backBtn)
        topBar.addView(titleText)
        topBar.addView(menuBtn)
        addView(topBar)

        // ── Bottom controls ──
        bottomControlsContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0x99000000.toInt())
            setPadding(16, 8, 16, 16)
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.BOTTOM)
        }

        // Seek bar row
        val seekBarContainer = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(28))
        }
        seekBar = View(context).apply {
            setBackgroundColor(0x4DFFFFFF)
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, dp(4), Gravity.CENTER_VERTICAL)
        }
        seekFill = View(context).apply {
            setBackgroundColor(0xFF3B82F6.toInt())
            layoutParams = FrameLayout.LayoutParams(0, dp(4), Gravity.CENTER_VERTICAL)
        }
        seekBarContainer.addView(seekBar)
        seekBarContainer.addView(seekFill)
        seekBarContainer.setOnTouchListener { v, event ->
            if (event.action == MotionEvent.ACTION_DOWN || event.action == MotionEvent.ACTION_MOVE) {
                val ratio = (event.x / v.width).coerceIn(0f, 1f)
                player?.let { p ->
                    val seekPos = (ratio * p.duration).toLong()
                    p.seekTo(seekPos)
                    updateSeekBar()
                }
                resetHideTimer()
            }
            true
        }
        bottomControlsContainer.addView(seekBarContainer)

        // Time text
        timeText = TextView(context).apply {
            setTextColor(Color.WHITE)
            textSize = 12f
            setPadding(0, 4, 0, 8)
        }
        bottomControlsContainer.addView(timeText)

        // Controls row
        val controlsRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }

        prevBtn = createIconButton("\u23EE", 22f) { playPrevious() }
        rewindBtn = createIconButton("\u23EA", 20f) { seekRelative(-SEEK_JUMP_MS) }
        playPauseBtn = createIconButton("\u25B6", 28f) { togglePlayPause() }
        forwardBtn = createIconButton("\u23E9", 20f) { seekRelative(SEEK_JUMP_MS) }
        nextBtn = createIconButton("\u23ED", 22f) { playNext() }

        val spacer1 = View(context).apply {
            layoutParams = LinearLayout.LayoutParams(0, 1, 1f)
        }
        val spacer2 = View(context).apply {
            layoutParams = LinearLayout.LayoutParams(0, 1, 1f)
        }

        controlsRow.addView(prevBtn)
        controlsRow.addView(rewindBtn)
        controlsRow.addView(spacer1)
        controlsRow.addView(playPauseBtn)
        controlsRow.addView(spacer2)
        controlsRow.addView(forwardBtn)
        controlsRow.addView(nextBtn)

        bottomControlsContainer.addView(controlsRow)
        addView(bottomControlsContainer)

        // ── Right controls (volume, speed) ──
        rightControlsContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(8, 0, 16, 0)
            layoutParams = LayoutParams(
                LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT,
                Gravity.END or Gravity.CENTER_VERTICAL
            )
        }

        volumeBtn = createIconButton("\uD83D\uDD0A", 20f) { toggleMute() }
        speedBtn = TextView(context).apply {
            text = "1.0x"
            setTextColor(Color.WHITE)
            textSize = 13f
            setBackgroundColor(0x40FFFFFF)
            setPadding(16, 8, 16, 8)
            gravity = Gravity.CENTER
            setOnClickListener { showSpeedMenu() }
        }

        rightControlsContainer.addView(volumeBtn)
        rightControlsContainer.addView(speedBtn)
        addView(rightControlsContainer)

        initializePlayer()
    }

    // ═══════════════════════════════════════════════════════════
    // Player lifecycle
    // ═══════════════════════════════════════════════════════════

    private fun initializePlayer() {
        player = ExoPlayer.Builder(context)
            .build()
            .also { exo ->
                playerView.player = exo
                exo.addListener(this)
                exo.playWhenReady = true
            }
        handler.post(progressRunnable)
    }

    fun loadVideo(filePath: String, startPosition: Long = 0) {
        resumePosition = startPosition
        player?.let { p ->
            val mediaItem = MediaItem.fromUri(filePath)
            p.setMediaItem(mediaItem)
            p.prepare()
            if (startPosition > 0) {
                p.seekTo(startPosition)
            }
        }
    }

    fun setPlaylist(paths: List<String>, startIndex: Int = 0) {
        playlist.clear()
        playlist.addAll(paths)
        currentIndex = startIndex.coerceIn(0, paths.size - 1)
        updateNavButtonVisibility()
    }

    fun play() { player?.play() }
    fun pause() { player?.pause() }

    fun seekTo(positionMs: Long) {
        player?.seekTo(positionMs)
        updateSeekBar()
    }

    fun setSpeed(speed: Float) {
        currentSpeed = speed
        player?.setPlaybackSpeed(speed)
        speedBtn.text = "${speed}x"
    }

    fun mute() {
        if (!isMuted) {
            savedVolume = player?.volume ?: 1f
            player?.volume = 0f
            isMuted = true
            volumeBtn.text = "\uD83D\uDD07"
            sendVolumeEvent(0f)
        }
    }

    fun unmute() {
        if (isMuted) {
            player?.volume = savedVolume
            isMuted = false
            volumeBtn.text = "\uD83D\uDD0A"
            sendVolumeEvent(savedVolume)
        }
    }

    fun setTitle(title: String) {
        titleText.text = title
    }

    fun release() {
        handler.removeCallbacks(progressRunnable)
        handler.removeCallbacks(hideControlsRunnable)
        player?.removeListener(this)
        player?.release()
        player = null
    }

    // ═══════════════════════════════════════════════════════════
    // Player.Listener
    // ═══════════════════════════════════════════════════════════

    override fun onPlaybackStateChanged(playbackState: Int) {
        when (playbackState) {
            Player.STATE_BUFFERING -> {
                bufferingOverlay.visibility = View.VISIBLE
                sendSimpleEvent("onBuffering")
            }
            Player.STATE_READY -> {
                bufferingOverlay.visibility = View.GONE
                player?.let { p ->
                    val event = Arguments.createMap().apply {
                        putDouble("duration", p.duration.toDouble())
                        putInt("width", p.videoSize.width)
                        putInt("height", p.videoSize.height)
                    }
                    sendEvent("onLoad", event)
                }
                updateSeekBar()
                resetHideTimer()
            }
            Player.STATE_ENDED -> {
                sendSimpleEvent("onEnd")
                if (autoPlayNext && currentIndex < playlist.size - 1) {
                    playNext()
                } else {
                    showControls()
                    playPauseBtn.text = "\u25B6"
                }
            }
            Player.STATE_IDLE -> {}
        }
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
        playPauseBtn.text = if (isPlaying) "\u23F8" else "\u25B6"
        val event = Arguments.createMap().apply {
            putBoolean("isPlaying", isPlaying)
        }
        sendEvent("onPlaybackStateChange", event)
        if (isPlaying) resetHideTimer() else showControls()
    }

    override fun onPlayerError(error: PlaybackException) {
        val msg = when (error.errorCode) {
            PlaybackException.ERROR_CODE_DECODER_INIT_FAILED,
            PlaybackException.ERROR_CODE_DECODING_FAILED -> "Unsupported video codec"
            PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND -> "Video file not found"
            PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED,
            PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED -> "Corrupted video file"
            else -> "Unable to play this video"
        }
        errorOverlay.text = "\u26A0\uFE0F\n\n$msg"
        errorOverlay.visibility = View.VISIBLE

        val event = Arguments.createMap().apply {
            putString("error", msg)
            putInt("errorCode", error.errorCode)
        }
        sendEvent("onError", event)
    }

    // ═══════════════════════════════════════════════════════════
    // Touch / Gesture handling
    // ═══════════════════════════════════════════════════════════

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                gestureStartX = event.x
                gestureStartY = event.y
                isHorizontalGesture = false
                isVerticalGesture = false
                gestureStartVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC).toFloat() /
                        audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC).toFloat()
                gestureStartBrightness = getActivity()?.window?.attributes?.screenBrightness ?: 0.5f
                if (gestureStartBrightness < 0) gestureStartBrightness = 0.5f
                gestureSeekStartPosition = player?.currentPosition ?: 0L
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = event.x - gestureStartX
                val dy = event.y - gestureStartY

                if (!isHorizontalGesture && !isVerticalGesture) {
                    if (abs(dx) > GESTURE_THRESHOLD && abs(dx) > abs(dy) * 1.5f) {
                        isHorizontalGesture = true
                    } else if (abs(dy) > GESTURE_THRESHOLD && abs(dy) > abs(dx) * 1.5f) {
                        isVerticalGesture = true
                    }
                }

                if (isHorizontalGesture) {
                    handleHorizontalGesture(dx)
                } else if (isVerticalGesture) {
                    val isLeftSide = gestureStartX < width / 2f
                    if (isLeftSide) {
                        handleBrightnessGesture(-dy)
                    } else {
                        handleVolumeGesture(-dy)
                    }
                }
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (isHorizontalGesture) {
                    // Commit seek
                    seekOverlay.visibility = View.GONE
                } else if (isVerticalGesture) {
                    gestureOverlay.visibility = View.GONE
                } else {
                    // Tap
                    handleTap(event.x, event.y)
                }
                isHorizontalGesture = false
                isVerticalGesture = false
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    private fun handleHorizontalGesture(dx: Float) {
        player?.let { p ->
            val seekDelta = (dx * SEEK_SENSITIVITY).toLong()
            val newPos = (gestureSeekStartPosition + seekDelta).coerceIn(0, p.duration)
            p.seekTo(newPos)
            updateSeekBar()

            val diffSec = (newPos - gestureSeekStartPosition) / 1000
            val sign = if (diffSec >= 0) "+" else ""
            seekOverlay.text = if (diffSec >= 0) "\u23E9 ${sign}${diffSec}s" else "\u23EA ${diffSec}s"
            seekOverlay.visibility = View.VISIBLE
        }
    }

    private fun handleVolumeGesture(dy: Float) {
        val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val newVolume = (gestureStartVolume + dy * VOLUME_SENSITIVITY).coerceIn(0f, 1f)
        audioManager.setStreamVolume(
            AudioManager.STREAM_MUSIC,
            (newVolume * maxVol).toInt(),
            0
        )
        val pct = (newVolume * 100).toInt()
        gestureOverlay.text = "\uD83D\uDD0A Volume $pct%"
        gestureOverlay.visibility = View.VISIBLE
        sendVolumeEvent(newVolume)
    }

    private fun handleBrightnessGesture(dy: Float) {
        val activity = getActivity() ?: return
        val newBrightness = (gestureStartBrightness + dy * BRIGHTNESS_SENSITIVITY).coerceIn(0.01f, 1f)
        val lp = activity.window.attributes
        lp.screenBrightness = newBrightness
        activity.window.attributes = lp

        val pct = (newBrightness * 100).toInt()
        gestureOverlay.text = "\uD83D\uDD06 Brightness $pct%"
        gestureOverlay.visibility = View.VISIBLE

        val event = Arguments.createMap().apply {
            putDouble("brightness", newBrightness.toDouble())
        }
        sendEvent("onBrightnessChange", event)
    }

    private fun handleTap(x: Float, y: Float) {
        val now = System.currentTimeMillis()
        if (now - lastTapTime < DOUBLE_TAP_TIMEOUT && abs(x - lastTapX) < width * 0.3f) {
            // Double tap
            val isLeftSide = x < width / 2f
            if (isLeftSide) {
                seekRelative(-SEEK_JUMP_MS)
                showSeekFeedback("\u23EA -10s")
            } else {
                seekRelative(SEEK_JUMP_MS)
                showSeekFeedback("\u23E9 +10s")
            }
            lastTapTime = 0
        } else {
            lastTapTime = now
            lastTapX = x
            // Single tap — toggle controls after delay
            handler.postDelayed({
                if (System.currentTimeMillis() - lastTapTime >= DOUBLE_TAP_TIMEOUT - 50) {
                    toggleControlsVisibility()
                }
            }, DOUBLE_TAP_TIMEOUT)
        }
    }

    private fun showSeekFeedback(text: String) {
        seekOverlay.text = text
        seekOverlay.visibility = View.VISIBLE
        handler.postDelayed({ seekOverlay.visibility = View.GONE }, 600)
        showControls()
        resetHideTimer()
    }

    // ═══════════════════════════════════════════════════════════
    // Controls visibility
    // ═══════════════════════════════════════════════════════════

    private fun showControls() {
        controlsVisible = true
        topBar.animate().alpha(1f).setDuration(200).start()
        bottomControlsContainer.animate().alpha(1f).setDuration(200).start()
        rightControlsContainer.animate().alpha(1f).setDuration(200).start()
        topBar.visibility = View.VISIBLE
        bottomControlsContainer.visibility = View.VISIBLE
        rightControlsContainer.visibility = View.VISIBLE
    }

    private fun hideControls() {
        controlsVisible = false
        topBar.animate().alpha(0f).setDuration(200).withEndAction { topBar.visibility = View.GONE }.start()
        bottomControlsContainer.animate().alpha(0f).setDuration(200).withEndAction { bottomControlsContainer.visibility = View.GONE }.start()
        rightControlsContainer.animate().alpha(0f).setDuration(200).withEndAction { rightControlsContainer.visibility = View.GONE }.start()
    }

    private fun toggleControlsVisibility() {
        if (controlsVisible) {
            hideControls()
        } else {
            showControls()
            resetHideTimer()
        }
    }

    private fun resetHideTimer() {
        handler.removeCallbacks(hideControlsRunnable)
        if (player?.isPlaying == true) {
            handler.postDelayed(hideControlsRunnable, CONTROLS_HIDE_DELAY)
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Playback helpers
    // ═══════════════════════════════════════════════════════════

    private fun togglePlayPause() {
        player?.let { p ->
            if (p.isPlaying) p.pause() else p.play()
        }
        resetHideTimer()
    }

    private fun seekRelative(deltaMs: Long) {
        player?.let { p ->
            val newPos = (p.currentPosition + deltaMs).coerceIn(0, p.duration)
            p.seekTo(newPos)
            updateSeekBar()
            resetHideTimer()
        }
    }

    private fun playNext() {
        if (currentIndex < playlist.size - 1) {
            currentIndex++
            sendNavigationEvent("next", currentIndex)
        }
    }

    private fun playPrevious() {
        player?.let { p ->
            // If more than 3s in, restart current video
            if (p.currentPosition > 3000) {
                p.seekTo(0)
                return
            }
        }
        if (currentIndex > 0) {
            currentIndex--
            sendNavigationEvent("previous", currentIndex)
        }
    }

    private fun toggleMute() {
        if (isMuted) unmute() else mute()
    }

    private fun showSpeedMenu() {
        val activity = getActivity() ?: return
        val popupView = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xF0141414.toInt())
            setPadding(0, 16, 0, 16)
        }

        val titleTv = TextView(context).apply {
            text = "Playback Speed"
            setTextColor(0x80FFFFFF.toInt())
            textSize = 13f
            setPadding(24, 8, 24, 12)
        }
        popupView.addView(titleTv)

        val popup = PopupWindow(popupView, dp(160), LayoutParams.WRAP_CONTENT, true).apply {
            setBackgroundDrawable(android.graphics.drawable.ColorDrawable(Color.TRANSPARENT))
            elevation = 16f
        }

        for (speed in SPEED_OPTIONS) {
            val item = TextView(context).apply {
                text = "${speed}x"
                setTextColor(if (speed == currentSpeed) 0xFF3B82F6.toInt() else Color.WHITE)
                textSize = 15f
                setPadding(24, 14, 24, 14)
                if (speed == currentSpeed) {
                    setBackgroundColor(0x333B82F6)
                    setTypeface(null, android.graphics.Typeface.BOLD)
                }
                setOnClickListener {
                    setSpeed(speed)
                    popup.dismiss()
                    val event = Arguments.createMap().apply {
                        putDouble("speed", speed.toDouble())
                    }
                    sendEvent("onSpeedChange", event)
                }
            }
            popupView.addView(item)
        }

        popup.showAsDropDown(speedBtn, -dp(120), -popupView.measuredHeight - speedBtn.height)
    }

    private fun updateSeekBar() {
        player?.let { p ->
            if (p.duration > 0) {
                val ratio = p.currentPosition.toFloat() / p.duration.toFloat()
                seekFill.layoutParams = (seekFill.layoutParams as FrameLayout.LayoutParams).apply {
                    width = (seekBar.width * ratio).toInt()
                }
                seekFill.requestLayout()
                timeText.text = "${formatTime(p.currentPosition)} / ${formatTime(p.duration)}"
            }
        }
    }

    private fun updateNavButtonVisibility() {
        prevBtn.alpha = if (currentIndex > 0) 1f else 0.3f
        nextBtn.alpha = if (currentIndex < playlist.size - 1) 1f else 0.3f
    }

    // ═══════════════════════════════════════════════════════════
    // Fullscreen / Security
    // ═══════════════════════════════════════════════════════════

    fun enterFullscreen() {
        val activity = getActivity() ?: return
        val window = activity.window

        // FLAG_SECURE — prevent screenshots and recording
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        // Keep screen on
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Immersive sticky mode
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    fun exitFullscreen() {
        val activity = getActivity() ?: return
        val window = activity.window
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        WindowInsetsControllerCompat(window, window.decorView).show(WindowInsetsCompat.Type.systemBars())
    }

    // ═══════════════════════════════════════════════════════════
    // Event sending
    // ═══════════════════════════════════════════════════════════

    private fun sendProgressEvent(position: Long, duration: Long) {
        val event = Arguments.createMap().apply {
            putDouble("currentTime", position.toDouble() / 1000.0)
            putDouble("duration", duration.toDouble() / 1000.0)
            putDouble("progress", if (duration > 0) position.toDouble() / duration.toDouble() else 0.0)
        }
        sendEvent("onProgress", event)
        updateSeekBar()
    }

    private fun sendVolumeEvent(volume: Float) {
        val event = Arguments.createMap().apply {
            putDouble("volume", volume.toDouble())
            putBoolean("isMuted", isMuted)
        }
        sendEvent("onVolumeChange", event)
    }

    private fun sendNavigationEvent(direction: String, index: Int) {
        val event = Arguments.createMap().apply {
            putString("direction", direction)
            putInt("index", index)
        }
        sendEvent("onNavigate", event)
    }

    private fun sendSimpleEvent(eventName: String) {
        sendEvent(eventName, Arguments.createMap())
    }

    private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        try {
            val reactContext = context as? ReactContext ?: return
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(id, eventName, params)
        } catch (_: Exception) {}
    }

    // ═══════════════════════════════════════════════════════════
    // Utilities
    // ═══════════════════════════════════════════════════════════

    private fun getActivity(): Activity? {
        val ctx = context
        if (ctx is Activity) return ctx
        if (ctx is ReactContext) return ctx.currentActivity
        return null
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun formatTime(ms: Long): String {
        val totalSeconds = ms / 1000
        val h = totalSeconds / 3600
        val m = (totalSeconds % 3600) / 60
        val s = totalSeconds % 60
        return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%d:%02d", m, s)
    }

    private fun createIconButton(icon: String, size: Float, onClick: () -> Unit): TextView {
        return TextView(context).apply {
            text = icon
            textSize = size
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(16, 12, 16, 12)
            minimumWidth = dp(48)
            minimumHeight = dp(48)
            setOnClickListener { onClick() }
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        release()
    }
}
