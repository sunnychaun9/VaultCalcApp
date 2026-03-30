/**
 * VaultCalc - Native ExoPlayer Video Player View
 *
 * MX Player-style video playback with Media3 ExoPlayer.
 * Features: vertical side sliders for volume/brightness, auto orientation detection,
 * double-tap seek with ripple, screen lock, manual rotation, speed control.
 *
 * @see FEATURE_INDEX.md VIDEO-010
 */

package com.vaultcalcapp.modules.videoplayer

import android.animation.AnimatorSet
import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.pm.ActivityInfo
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.util.AttributeSet
import android.view.*
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import kotlin.math.abs

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
    private var isScreenLocked = false
    private var rotationState = 0 // 0=portrait, 1=landscape, 2=reverse-landscape
    private var hasAutoOrientationApplied = false

    // ── Gesture tracking ───────────────────────────────────────
    private var gestureStartX = 0f
    private var gestureStartY = 0f
    private var isHorizontalGesture = false
    private var isVerticalGesture = false
    private var gestureStartVolume = 0f
    private var gestureStartBrightness = 0f
    private var gestureSeekStartPosition = 0L
    private val GESTURE_THRESHOLD = 30f
    private val SEEK_SENSITIVITY = 100L
    private val VOLUME_SENSITIVITY = 0.004f
    private val BRIGHTNESS_SENSITIVITY = 0.004f

    // ── Double-tap ─────────────────────────────────────────────
    private var lastTapTime = 0L
    private var lastTapX = 0f
    private val DOUBLE_TAP_TIMEOUT = 300L
    private val SEEK_JUMP_MS = 10_000L

    // ── Controls auto-hide ─────────────────────────────────────
    private var controlsVisible = true
    private val CONTROLS_HIDE_DELAY = 3000L
    private val SEEK_OVERLAY_TOKEN = Object()
    private val hideControlsRunnable = Runnable { hideControls() }

    // ── UI views ───────────────────────────────────────────────
    private val volumeSlider: VerticalSliderView
    private val brightnessSlider: VerticalSliderView
    private val seekOverlay: TextView
    private val errorOverlay: TextView
    private val bufferingOverlay: FrameLayout
    private val centerPlayBtn: TextView
    private val lockOverlay: FrameLayout
    private val leftRipple: DoubleTapRippleView
    private val rightRipple: DoubleTapRippleView

    // ── Controls ───────────────────────────────────────────────
    private val topBar: LinearLayout
    private val backBtn: TextView
    private val titleText: TextView
    private val menuBtn: TextView
    private val bottomContainer: LinearLayout
    private val seekBarContainer: FrameLayout
    private val seekTrack: View
    private val seekFill: View
    private val seekThumb: View
    private val timeStartText: TextView
    private val timeEndText: TextView
    private val lockBtn: TextView
    private val prevBtn: TextView
    private val playPauseBtn: TextView
    private val nextBtn: TextView
    private val rotateBtn: TextView
    private val speedBtn: TextView

    // ── Progress reporting ──────────────────────────────────────
    private val progressRunnable = object : Runnable {
        override fun run() {
            player?.let { p ->
                if (p.isPlaying) sendProgressEvent(p.currentPosition, p.duration)
            }
            handler.postDelayed(this, 250)
        }
    }

    private val SPEED_OPTIONS = floatArrayOf(0.25f, 0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f, 3.0f)

    // ════════════════════════════════════════════════════════════
    // MX-style vertical slider (volume/brightness)
    // ════════════════════════════════════════════════════════════
    inner class VerticalSliderView(
        ctx: Context,
        private val sliderIcon: String,
        private val accentColor: Int = 0xFF3B82F6.toInt()
    ) : View(ctx) {

        init {
            setWillNotDraw(false) // Required for custom onDraw in ViewGroup children
        }

        private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xAA222222.toInt()
            style = Paint.Style.FILL
        }
        private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0x55FFFFFF
            style = Paint.Style.FILL
        }
        private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = accentColor
            style = Paint.Style.FILL
        }
        private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = dp(13).toFloat()
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
        }
        private val iconPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = dp(18).toFloat()
            textAlign = Paint.Align.CENTER
        }

        var progress = 0f // 0..1
            set(value) { field = value.coerceIn(0f, 1f); invalidate() }

        private val cornerRadius = dp(28).toFloat()
        private val bgRect = RectF()
        private val trackRect = RectF()
        private val fillRect = RectF()
        private val clipPath = Path()

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val w = width.toFloat()
            val h = height.toFloat()
            val padding = dp(8).toFloat()

            // Background capsule
            bgRect.set(0f, 0f, w, h)
            canvas.drawRoundRect(bgRect, cornerRadius, cornerRadius, bgPaint)

            // Track area
            val trackLeft = padding + dp(4)
            val trackRight = w - padding - dp(4)
            val trackTop = dp(36).toFloat()
            val trackBottom = h - dp(36).toFloat()
            val trackW = trackRight - trackLeft
            val trackH = trackBottom - trackTop
            val trackRadius = trackW / 2f

            trackRect.set(trackLeft, trackTop, trackRight, trackBottom)
            canvas.drawRoundRect(trackRect, trackRadius, trackRadius, trackPaint)

            // Fill (from bottom up)
            val fillTop = trackBottom - (trackH * progress)
            fillRect.set(trackLeft, fillTop, trackRight, trackBottom)
            // Clip to track shape
            canvas.save()
            clipPath.reset()
            clipPath.addRoundRect(trackRect, trackRadius, trackRadius, Path.Direction.CW)
            canvas.clipPath(clipPath)
            canvas.drawRect(fillRect, fillPaint)
            canvas.restore()

            // Percentage text at top
            val pctText = "${(progress * 100).toInt()}%"
            canvas.drawText(pctText, w / 2f, dp(24).toFloat(), textPaint)

            // Icon at bottom
            canvas.drawText(sliderIcon, w / 2f, h - dp(12).toFloat(), iconPaint)
        }
    }

    // ════════════════════════════════════════════════════════════
    // Double-tap ripple (YouTube/MX style semicircle)
    // ════════════════════════════════════════════════════════════
    inner class DoubleTapRippleView(ctx: Context, private val isLeft: Boolean) : View(ctx) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0x30FFFFFF
            style = Paint.Style.FILL
        }
        private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = dp(13).toFloat()
            textAlign = Paint.Align.CENTER
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        }
        private val iconPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = dp(28).toFloat()
            textAlign = Paint.Align.CENTER
        }
        private var rippleAlpha = 0
        private var displayText = ""

        fun show(text: String) {
            displayText = text
            visibility = VISIBLE
            val alphaIn = ValueAnimator.ofInt(0, 80).apply {
                duration = 150
                addUpdateListener { rippleAlpha = it.animatedValue as Int; invalidate() }
            }
            val alphaOut = ValueAnimator.ofInt(80, 0).apply {
                startDelay = 300
                duration = 300
                addUpdateListener {
                    rippleAlpha = it.animatedValue as Int
                    invalidate()
                    if (rippleAlpha == 0) visibility = GONE
                }
            }
            AnimatorSet().apply { playSequentially(alphaIn, alphaOut); start() }
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            if (rippleAlpha <= 0) return
            paint.alpha = rippleAlpha
            val cx = if (isLeft) width.toFloat() else 0f
            canvas.drawCircle(cx, height / 2f, width.toFloat(), paint)

            // Draw seek icon + text
            textPaint.alpha = (rippleAlpha * 3).coerceAtMost(255)
            iconPaint.alpha = (rippleAlpha * 3).coerceAtMost(255)
            val textX = width / 2f
            val icon = if (isLeft) "\u23EA" else "\u23E9"
            canvas.drawText(icon, textX, height / 2f - dp(4), iconPaint)
            canvas.drawText(displayText, textX, height / 2f + dp(24), textPaint)
        }
    }

    // ════════════════════════════════════════════════════════════
    // Init
    // ════════════════════════════════════════════════════════════
    init {
        setBackgroundColor(Color.BLACK)

        // ── PlayerView ──
        playerView = PlayerView(context).apply {
            useController = false
            setBackgroundColor(Color.BLACK)
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
            // Disable touch on PlayerView — gestures handled by parent
            setOnTouchListener { _, _ -> false }
        }
        addView(playerView)

        // ── Double-tap ripple views ──
        leftRipple = DoubleTapRippleView(context, true).apply {
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            visibility = GONE
        }
        addView(leftRipple)

        rightRipple = DoubleTapRippleView(context, false).apply {
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            visibility = GONE
        }
        addView(rightRipple)

        // ── Buffering spinner ──
        bufferingOverlay = FrameLayout(context).apply {
            visibility = GONE
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        }
        bufferingOverlay.addView(ProgressBar(context).apply {
            isIndeterminate = true
            layoutParams = LayoutParams(dp(48), dp(48), Gravity.CENTER)
        })
        addView(bufferingOverlay)

        // Volume/brightness sliders added later (after controls) for z-order

        // ── Seek overlay (center pill) ──
        seekOverlay = TextView(context).apply {
            background = createPillBg(0xCC000000.toInt(), dp(24).toFloat())
            setTextColor(Color.WHITE)
            textSize = 16f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(12), dp(24), dp(12))
            visibility = GONE
            layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER)
        }
        addView(seekOverlay)

        // ── Error overlay ──
        errorOverlay = TextView(context).apply {
            setBackgroundColor(0xE0000000.toInt())
            setTextColor(Color.WHITE)
            textSize = 16f
            gravity = Gravity.CENTER
            setPadding(48, 32, 48, 32)
            visibility = GONE
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        }
        addView(errorOverlay)

        // ── Center play button ──
        centerPlayBtn = TextView(context).apply {
            text = "\u25B6"
            textSize = 52f
            setTextColor(0xDDFFFFFF.toInt())
            gravity = Gravity.CENTER
            background = createPillBg(0x55000000, dp(40).toFloat())
            setPadding(dp(26), dp(14), dp(18), dp(18))
            visibility = GONE
            layoutParams = LayoutParams(dp(88), dp(88), Gravity.CENTER)
            setOnClickListener { togglePlayPause() }
        }
        addView(centerPlayBtn)

        // ══════════════════════════════════════════════════════
        // TOP BAR (gradient)
        // ══════════════════════════════════════════════════════
        topBar = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(0xBB000000.toInt(), 0x00000000)
            )
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8), dp(8), dp(8), dp(32))
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.TOP)
        }

        backBtn = makeIcon("\u2190", 22f) { sendSimpleEvent("onBackPress") }
        titleText = TextView(context).apply {
            setTextColor(Color.WHITE)
            textSize = 15f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.MIDDLE
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = dp(4); marginEnd = dp(4)
            }
        }
        menuBtn = makeIcon("\u22EE", 22f) { sendSimpleEvent("onMenuPress") }

        topBar.addView(backBtn)
        topBar.addView(titleText)
        topBar.addView(menuBtn)
        addView(topBar)

        // ══════════════════════════════════════════════════════
        // BOTTOM CONTROLS (gradient, MX Player style)
        // ══════════════════════════════════════════════════════
        bottomContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable(
                GradientDrawable.Orientation.BOTTOM_TOP,
                intArrayOf(0xBB000000.toInt(), 0x00000000)
            )
            setPadding(dp(12), dp(24), dp(12), dp(8))
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.BOTTOM)
        }

        // ── Seekbar ──
        seekBarContainer = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(28))
        }
        seekTrack = View(context).apply {
            setBackgroundColor(0x55FFFFFF)
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, dp(3), Gravity.CENTER_VERTICAL)
        }
        seekFill = View(context).apply {
            background = createPillBg(0xFF3B82F6.toInt(), dp(2).toFloat())
            layoutParams = FrameLayout.LayoutParams(0, dp(3), Gravity.CENTER_VERTICAL)
        }
        seekThumb = View(context).apply {
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(0xFF3B82F6.toInt()) }
            layoutParams = FrameLayout.LayoutParams(dp(14), dp(14), Gravity.CENTER_VERTICAL)
            elevation = 4f
        }
        seekBarContainer.addView(seekTrack)
        seekBarContainer.addView(seekFill)
        seekBarContainer.addView(seekThumb)
        seekBarContainer.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE, MotionEvent.ACTION_UP -> {
                    val ratio = (event.x / v.width).coerceIn(0f, 1f)
                    player?.let { p ->
                        val pos = (ratio * p.duration).toLong()
                        p.seekTo(pos)
                        // Update fill/thumb immediately using the ratio directly
                        val barWidth = v.width
                        val fillW = (barWidth * ratio).toInt()
                        val fillLp = seekFill.layoutParams as FrameLayout.LayoutParams
                        fillLp.width = fillW
                        seekFill.layoutParams = fillLp
                        val thumbLp = seekThumb.layoutParams as FrameLayout.LayoutParams
                        thumbLp.marginStart = (fillW - dp(7)).coerceAtLeast(0)
                        seekThumb.layoutParams = thumbLp
                        timeStartText.text = formatTime(pos)
                        val remaining = p.duration - pos
                        timeEndText.text = "-${formatTime(remaining)}"
                    }
                    resetHideTimer()
                }
            }
            true
        }
        bottomContainer.addView(seekBarContainer)

        // ── Time row: start time ─────── end time ──
        val timeRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            setPadding(0, dp(2), 0, dp(6))
        }
        timeStartText = TextView(context).apply {
            text = "00:00"
            setTextColor(0xB3FFFFFF.toInt())
            textSize = 12f
            typeface = Typeface.MONOSPACE
        }
        timeEndText = TextView(context).apply {
            text = "-00:00"
            setTextColor(0xB3FFFFFF.toInt())
            textSize = 12f
            typeface = Typeface.MONOSPACE
        }
        val timeSpacer = View(context).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) }
        timeRow.addView(timeStartText)
        timeRow.addView(timeSpacer)
        timeRow.addView(timeEndText)
        bottomContainer.addView(timeRow)

        // ── Bottom button row: Lock | Prev | Play | Next | (spacer) | Speed | Rotate ──
        val btnRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }

        lockBtn = makeIcon("\uD83D\uDD12", 20f) { lockScreen() }
        prevBtn = makeIcon("\u23EE", 22f) { playPrevious() }
        playPauseBtn = makeIcon("\u23F8", 30f) { togglePlayPause() }
        nextBtn = makeIcon("\u23ED", 22f) { playNext() }
        speedBtn = TextView(context).apply {
            text = "1.0x"
            setTextColor(0xCCFFFFFF.toInt())
            textSize = 13f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            background = createPillBg(0x33FFFFFF, dp(14).toFloat())
            setPadding(dp(14), dp(6), dp(14), dp(6))
            gravity = Gravity.CENTER
            setOnClickListener { showSpeedMenu() }
        }
        rotateBtn = makeIcon("\uD83D\uDD04", 20f) { rotateScreen() }

        val bSpacer = View(context).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) }

        btnRow.addView(lockBtn)
        btnRow.addView(createGap(dp(12)))
        btnRow.addView(prevBtn)
        btnRow.addView(createGap(dp(8)))
        btnRow.addView(playPauseBtn)
        btnRow.addView(createGap(dp(8)))
        btnRow.addView(nextBtn)
        btnRow.addView(bSpacer)
        btnRow.addView(speedBtn)
        btnRow.addView(createGap(dp(8)))
        btnRow.addView(rotateBtn)

        bottomContainer.addView(btnRow)
        addView(bottomContainer)

        // ══════════════════════════════════════════════════════
        // LOCK OVERLAY
        // ══════════════════════════════════════════════════════
        lockOverlay = FrameLayout(context).apply {
            visibility = GONE
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        }
        val lockContent = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            background = createPillBg(0xAA000000.toInt(), dp(20).toFloat())
            setPadding(dp(28), dp(16), dp(28), dp(16))
            layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER)
        }
        lockContent.addView(TextView(context).apply {
            text = "\uD83D\uDD12"
            textSize = 32f
            gravity = Gravity.CENTER
        })
        lockContent.addView(TextView(context).apply {
            text = "Screen Locked"
            setTextColor(0xDDFFFFFF.toInt())
            textSize = 14f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            gravity = Gravity.CENTER
            setPadding(0, dp(4), 0, dp(2))
        })
        lockContent.addView(TextView(context).apply {
            text = "Double-tap to unlock"
            setTextColor(0x99FFFFFF.toInt())
            textSize = 12f
            gravity = Gravity.CENTER
        })
        lockOverlay.addView(lockContent)
        lockOverlay.setOnClickListener { handleLockOverlayTap() }
        addView(lockOverlay)

        // ── MX-style Volume slider (RIGHT side) — added last for top z-order ──
        volumeSlider = VerticalSliderView(context, "\uD83D\uDD0A", 0xFF3B82F6.toInt()).apply {
            visibility = GONE
            elevation = 20f
            layoutParams = LayoutParams(dp(52), dp(220)).apply {
                gravity = Gravity.CENTER_VERTICAL or Gravity.END
                marginEnd = dp(16)
            }
        }
        addView(volumeSlider)

        // ── MX-style Brightness slider (LEFT side) — added last for top z-order ──
        brightnessSlider = VerticalSliderView(context, "\u2600", 0xFF3B82F6.toInt()).apply {
            visibility = GONE
            elevation = 20f
            layoutParams = LayoutParams(dp(52), dp(220)).apply {
                gravity = Gravity.CENTER_VERTICAL or Gravity.START
                marginStart = dp(16)
            }
        }
        addView(brightnessSlider)

        initializePlayer()
    }

    // ════════════════════════════════════════════════════════════
    // Player lifecycle
    // ════════════════════════════════════════════════════════════

    private fun initializePlayer() {
        player = ExoPlayer.Builder(context).build().also { exo ->
            playerView.player = exo
            exo.addListener(this)
            exo.playWhenReady = true
        }
        handler.post(progressRunnable)
    }

    fun loadVideo(filePath: String, startPosition: Long = 0) {
        resumePosition = startPosition
        hasAutoOrientationApplied = false
        player?.let { p ->
            p.setMediaItem(MediaItem.fromUri(filePath))
            p.prepare()
            if (startPosition > 0) p.seekTo(startPosition)
        }
    }

    fun setPlaylist(paths: List<String>, startIndex: Int = 0) {
        playlist.clear()
        playlist.addAll(paths)
        currentIndex = startIndex.coerceIn(0, paths.size - 1)
        updateNavButtonAlpha()
    }

    fun play() { player?.play() }
    fun pause() { player?.pause() }
    fun seekTo(positionMs: Long) { player?.seekTo(positionMs); updateSeekBar() }

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
            sendVolumeEvent(0f)
        }
    }

    fun unmute() {
        if (isMuted) {
            player?.volume = savedVolume
            isMuted = false
            sendVolumeEvent(savedVolume)
        }
    }

    fun setTitle(title: String) { titleText.text = title }

    fun release() {
        handler.removeCallbacks(progressRunnable)
        handler.removeCallbacks(hideControlsRunnable)
        player?.removeListener(this)
        player?.release()
        player = null
    }

    // ════════════════════════════════════════════════════════════
    // Auto-orientation based on video dimensions
    // ════════════════════════════════════════════════════════════

    private fun applyAutoOrientation(videoWidth: Int, videoHeight: Int) {
        if (hasAutoOrientationApplied) return
        hasAutoOrientationApplied = true
        val activity = getActivity() ?: return
        if (videoWidth > videoHeight) {
            // Landscape video → force landscape
            activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            rotationState = 1
        } else {
            // Portrait video → stay portrait
            activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            rotationState = 0
        }
    }

    // ════════════════════════════════════════════════════════════
    // Lock / Unlock
    // ════════════════════════════════════════════════════════════

    fun lockScreen() {
        isScreenLocked = true
        hideControls()
        lockOverlay.alpha = 0f
        lockOverlay.visibility = VISIBLE
        lockOverlay.animate().alpha(1f).setDuration(200).start()
        handler.postDelayed({
            if (isScreenLocked) lockOverlay.animate().alpha(0.4f).setDuration(400).start()
        }, 2000)
        sendSimpleEvent("onLockStateChange")
    }

    fun unlockScreen() {
        isScreenLocked = false
        lockOverlay.animate().alpha(0f).setDuration(200).withEndAction {
            lockOverlay.visibility = GONE
        }.start()
        showControls()
        resetHideTimer()
        sendSimpleEvent("onLockStateChange")
    }

    private var lockTapTime = 0L
    private fun handleLockOverlayTap() {
        if (!isScreenLocked) return
        val now = System.currentTimeMillis()
        lockOverlay.animate().cancel()
        lockOverlay.animate().alpha(1f).setDuration(100).start()
        if (now - lockTapTime < 500) {
            // Double tap detected — unlock
            lockTapTime = 0
            unlockScreen()
        } else {
            // First tap — show hint and fade back
            lockTapTime = now
            handler.postDelayed({
                if (isScreenLocked) {
                    lockOverlay.animate().alpha(0.4f).setDuration(400).start()
                }
            }, 1500)
        }
    }

    // ════════════════════════════════════════════════════════════
    // Rotation
    // ════════════════════════════════════════════════════════════

    fun rotateScreen() {
        val activity = getActivity() ?: return
        rotationState = (rotationState + 1) % 3
        when (rotationState) {
            0 -> {
                activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                showQuickFeedback("\uD83D\uDD04 Portrait")
            }
            1 -> {
                activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                showQuickFeedback("\uD83D\uDD04 Landscape")
            }
            2 -> {
                activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
                showQuickFeedback("\uD83D\uDD04 Landscape (R)")
            }
        }
    }

    fun setAutoRotate(enabled: Boolean) {
        val activity = getActivity() ?: return
        activity.requestedOrientation = if (enabled) ActivityInfo.SCREEN_ORIENTATION_SENSOR else ActivityInfo.SCREEN_ORIENTATION_LOCKED
    }

    // ════════════════════════════════════════════════════════════
    // Player.Listener
    // ════════════════════════════════════════════════════════════

    override fun onPlaybackStateChanged(playbackState: Int) {
        when (playbackState) {
            Player.STATE_BUFFERING -> {
                bufferingOverlay.visibility = VISIBLE
                sendSimpleEvent("onBuffering")
            }
            Player.STATE_READY -> {
                bufferingOverlay.visibility = GONE
                player?.let { p ->
                    // Auto-orient based on video dimensions
                    val vw = p.videoSize.width
                    val vh = p.videoSize.height
                    if (vw > 0 && vh > 0) applyAutoOrientation(vw, vh)

                    val event = Arguments.createMap().apply {
                        putDouble("duration", p.duration.toDouble())
                        putInt("width", vw)
                        putInt("height", vh)
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
                    showCenterPlay()
                }
            }
            Player.STATE_IDLE -> {}
        }
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
        playPauseBtn.text = if (isPlaying) "\u23F8" else "\u25B6"
        val event = Arguments.createMap().apply { putBoolean("isPlaying", isPlaying) }
        sendEvent("onPlaybackStateChange", event)
        if (isPlaying) { hideCenterPlay(); resetHideTimer() } else { showControls(); showCenterPlay() }
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
        errorOverlay.visibility = VISIBLE
        val event = Arguments.createMap().apply { putString("error", msg); putInt("errorCode", error.errorCode) }
        sendEvent("onError", event)
    }

    // ════════════════════════════════════════════════════════════
    // Touch / Gesture handling
    // ════════════════════════════════════════════════════════════

    /**
     * Only intercept touches that land on the video area (not on controls).
     * This allows seekbar drags and button taps to work normally while
     * still capturing swipe gestures on the video surface.
     */
    override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
        if (isScreenLocked) return false
        // Don't intercept if touch is on controls or active sliders
        if (controlsVisible) {
            if (isTouchInsideView(ev, bottomContainer)) return false
            if (isTouchInsideView(ev, topBar)) return false
        }
        if (isTouchInsideView(ev, volumeSlider)) return false
        if (isTouchInsideView(ev, brightnessSlider)) return false
        return true // Intercept all other touches for gesture handling
    }

    private fun isTouchInsideView(ev: MotionEvent, view: View): Boolean {
        if (view.visibility != VISIBLE) return false
        val loc = IntArray(2)
        view.getLocationOnScreen(loc)
        val x = ev.rawX
        val y = ev.rawY
        return x >= loc[0] && x <= loc[0] + view.width &&
               y >= loc[1] && y <= loc[1] + view.height
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (isScreenLocked) return false

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
                    handleSeekGesture(dx)
                } else if (isVerticalGesture) {
                    if (gestureStartX < width / 2f) handleBrightnessGesture(-dy)
                    else handleVolumeGesture(-dy)
                }
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (isHorizontalGesture) {
                    fadeOut(seekOverlay)
                } else if (isVerticalGesture) {
                    fadeOut(volumeSlider)
                    fadeOut(brightnessSlider)
                } else {
                    handleTap(event.x, event.y)
                }
                isHorizontalGesture = false
                isVerticalGesture = false
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    private fun handleSeekGesture(dx: Float) {
        player?.let { p ->
            val seekDelta = (dx * SEEK_SENSITIVITY).toLong()
            val newPos = (gestureSeekStartPosition + seekDelta).coerceIn(0, p.duration)
            p.seekTo(newPos)
            updateSeekBar()
            val icon = if (seekDelta >= 0) "\u23E9" else "\u23EA"
            seekOverlay.text = "$icon ${formatTime(gestureSeekStartPosition)} \u2192 ${formatTime(newPos)}"
            seekOverlay.visibility = VISIBLE
        }
    }

    private fun handleVolumeGesture(dy: Float) {
        // Hide controls so slider is clearly visible
        if (controlsVisible) hideControls()
        val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val newVolume = (gestureStartVolume + dy * VOLUME_SENSITIVITY).coerceIn(0f, 1f)
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, (newVolume * maxVol).toInt(), 0)
        volumeSlider.progress = newVolume
        volumeSlider.alpha = 1f
        volumeSlider.visibility = VISIBLE
        // Hide the other slider if visible
        brightnessSlider.visibility = GONE
        sendVolumeEvent(newVolume)
    }

    private fun handleBrightnessGesture(dy: Float) {
        // Hide controls so slider is clearly visible
        if (controlsVisible) hideControls()
        val activity = getActivity() ?: return
        val newBrightness = (gestureStartBrightness + dy * BRIGHTNESS_SENSITIVITY).coerceIn(0.01f, 1f)
        val lp = activity.window.attributes
        lp.screenBrightness = newBrightness
        activity.window.attributes = lp
        brightnessSlider.progress = newBrightness
        brightnessSlider.alpha = 1f
        brightnessSlider.visibility = VISIBLE
        // Hide the other slider if visible
        volumeSlider.visibility = GONE
        val event = Arguments.createMap().apply { putDouble("brightness", newBrightness.toDouble()) }
        sendEvent("onBrightnessChange", event)
    }

    private fun handleTap(x: Float, y: Float) {
        val now = System.currentTimeMillis()
        if (now - lastTapTime < DOUBLE_TAP_TIMEOUT && abs(x - lastTapX) < width * 0.3f) {
            val isLeft = x < width / 2f
            player?.let { p ->
                val oldPos = p.currentPosition
                if (isLeft) {
                    seekRelative(-SEEK_JUMP_MS)
                    leftRipple.show("-10s")
                } else {
                    seekRelative(SEEK_JUMP_MS)
                    rightRipple.show("+10s")
                }
                // Show seek overlay pill with from → to time
                val newPos = p.currentPosition
                val icon = if (isLeft) "\u23EA" else "\u23E9"
                seekOverlay.text = "$icon ${formatTime(oldPos)} \u2192 ${formatTime(newPos)}"
                seekOverlay.alpha = 1f
                seekOverlay.visibility = VISIBLE
                handler.removeCallbacksAndMessages(SEEK_OVERLAY_TOKEN)
                handler.postAtTime({ fadeOut(seekOverlay) }, SEEK_OVERLAY_TOKEN, android.os.SystemClock.uptimeMillis() + 800)
            }
            lastTapTime = 0
        } else {
            lastTapTime = now
            lastTapX = x
            handler.postDelayed({
                if (System.currentTimeMillis() - lastTapTime >= DOUBLE_TAP_TIMEOUT - 50) {
                    toggleControlsVisibility()
                }
            }, DOUBLE_TAP_TIMEOUT)
        }
    }

    // ════════════════════════════════════════════════════════════
    // Center play button
    // ════════════════════════════════════════════════════════════

    private fun showCenterPlay() {
        centerPlayBtn.alpha = 0f
        centerPlayBtn.scaleX = 0.7f
        centerPlayBtn.scaleY = 0.7f
        centerPlayBtn.visibility = VISIBLE
        centerPlayBtn.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(200)
            .setInterpolator(OvershootInterpolator(1.5f)).start()
    }

    private fun hideCenterPlay() {
        centerPlayBtn.animate().alpha(0f).scaleX(0.7f).scaleY(0.7f).setDuration(150)
            .withEndAction { centerPlayBtn.visibility = GONE }.start()
    }

    // ════════════════════════════════════════════════════════════
    // Controls visibility
    // ════════════════════════════════════════════════════════════

    private fun showControls() {
        if (isScreenLocked) return
        controlsVisible = true
        topBar.visibility = VISIBLE
        bottomContainer.visibility = VISIBLE
        topBar.animate().alpha(1f).setDuration(200).start()
        bottomContainer.animate().alpha(1f).setDuration(200).start()
    }

    private fun hideControls() {
        if (isScreenLocked) return
        controlsVisible = false
        topBar.animate().alpha(0f).setDuration(200).withEndAction { topBar.visibility = GONE }.start()
        bottomContainer.animate().alpha(0f).setDuration(200).withEndAction { bottomContainer.visibility = GONE }.start()
    }

    private fun toggleControlsVisibility() {
        if (controlsVisible) hideControls() else { showControls(); resetHideTimer() }
    }

    private fun resetHideTimer() {
        handler.removeCallbacks(hideControlsRunnable)
        if (player?.isPlaying == true) handler.postDelayed(hideControlsRunnable, CONTROLS_HIDE_DELAY)
    }

    // ════════════════════════════════════════════════════════════
    // Playback helpers
    // ════════════════════════════════════════════════════════════

    private fun togglePlayPause() {
        player?.let { p -> if (p.isPlaying) p.pause() else p.play() }
        resetHideTimer()
    }

    private fun seekRelative(deltaMs: Long) {
        player?.let { p ->
            p.seekTo((p.currentPosition + deltaMs).coerceIn(0, p.duration))
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
        player?.let { p -> if (p.currentPosition > 3000) { p.seekTo(0); return } }
        if (currentIndex > 0) { currentIndex--; sendNavigationEvent("previous", currentIndex) }
    }

    private fun showSpeedMenu() {
        val popupView = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = createPillBg(0xF0181818.toInt(), dp(16).toFloat())
            setPadding(0, dp(12), 0, dp(12))
            elevation = 24f
        }
        popupView.addView(TextView(context).apply {
            text = "Playback Speed"
            setTextColor(0x80FFFFFF.toInt())
            textSize = 12f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            setPadding(dp(20), dp(6), dp(20), dp(10))
        })

        val popup = PopupWindow(popupView, dp(160), LayoutParams.WRAP_CONTENT, true).apply {
            setBackgroundDrawable(android.graphics.drawable.ColorDrawable(Color.TRANSPARENT))
            elevation = 24f
        }

        for (speed in SPEED_OPTIONS) {
            popupView.addView(TextView(context).apply {
                text = "${speed}x"
                setTextColor(if (speed == currentSpeed) 0xFF3B82F6.toInt() else 0xDDFFFFFF.toInt())
                textSize = 14f
                typeface = if (speed == currentSpeed) Typeface.create("sans-serif", Typeface.BOLD) else Typeface.DEFAULT
                setPadding(dp(20), dp(12), dp(20), dp(12))
                if (speed == currentSpeed) setBackgroundColor(0x1A3B82F6)
                setOnClickListener {
                    setSpeed(speed)
                    popup.dismiss()
                    val event = Arguments.createMap().apply { putDouble("speed", speed.toDouble()) }
                    sendEvent("onSpeedChange", event)
                }
            })
        }
        popup.showAsDropDown(speedBtn, -dp(60), -dp(320))
    }

    private fun updateSeekBar() {
        player?.let { p ->
            if (p.duration <= 0) return
            val ratio = p.currentPosition.toFloat() / p.duration.toFloat()
            // Use seekBarContainer width (the touch target) as reference since seekTrack
            // may not have been laid out yet after a layoutParams change
            val barWidth = seekBarContainer.width
            if (barWidth <= 0) {
                // View not laid out yet — schedule update after layout pass
                seekBarContainer.post { updateSeekBar() }
                return
            }
            val fillW = (barWidth * ratio).toInt()
            val fillLp = seekFill.layoutParams as FrameLayout.LayoutParams
            if (fillLp.width != fillW) {
                fillLp.width = fillW
                seekFill.layoutParams = fillLp
            }
            val thumbLp = seekThumb.layoutParams as FrameLayout.LayoutParams
            val newMargin = (fillW - dp(7)).coerceAtLeast(0)
            if (thumbLp.marginStart != newMargin) {
                thumbLp.marginStart = newMargin
                seekThumb.layoutParams = thumbLp
            }
            timeStartText.text = formatTime(p.currentPosition)
            val remaining = p.duration - p.currentPosition
            timeEndText.text = "-${formatTime(remaining)}"
        }
    }

    private fun updateNavButtonAlpha() {
        prevBtn.alpha = if (currentIndex > 0) 1f else 0.3f
        nextBtn.alpha = if (currentIndex < playlist.size - 1) 1f else 0.3f
    }

    // ════════════════════════════════════════════════════════════
    // Fullscreen / Security
    // ════════════════════════════════════════════════════════════

    fun enterFullscreen() {
        val activity = getActivity() ?: return
        val window = activity.window
        if (com.vaultcalcapp.BuildConfig.ENABLE_FLAG_SECURE) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).let { c ->
            c.hide(WindowInsetsCompat.Type.systemBars())
            c.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    fun exitFullscreen() {
        val activity = getActivity() ?: return
        val window = activity.window
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        WindowInsetsControllerCompat(window, window.decorView).show(WindowInsetsCompat.Type.systemBars())
        activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
    }

    // ════════════════════════════════════════════════════════════
    // Event sending
    // ════════════════════════════════════════════════════════════

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
            reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(id, eventName, params)
        } catch (_: Exception) {}
    }

    // ════════════════════════════════════════════════════════════
    // Utilities
    // ════════════════════════════════════════════════════════════

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
        return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%02d:%02d", m, s)
    }

    private fun makeIcon(icon: String, size: Float, onClick: () -> Unit): TextView {
        return TextView(context).apply {
            text = icon
            textSize = size
            setTextColor(0xDDFFFFFF.toInt())
            gravity = Gravity.CENTER
            setPadding(dp(12), dp(10), dp(12), dp(10))
            minimumWidth = dp(44)
            minimumHeight = dp(44)
            setOnClickListener { onClick() }
        }
    }

    private fun createGap(widthPx: Int): View {
        return View(context).apply { layoutParams = LinearLayout.LayoutParams(widthPx, 1) }
    }

    private fun createPillBg(color: Int, radius: Float): GradientDrawable {
        return GradientDrawable().apply { setColor(color); cornerRadius = radius }
    }

    private fun fadeOut(view: View) {
        // Cancel any running animation on this view first to avoid conflicts
        view.animate().cancel()
        view.animate().alpha(0f).setDuration(250).withEndAction {
            view.visibility = GONE
        }.start()
    }

    private fun showQuickFeedback(text: String) {
        seekOverlay.text = text
        seekOverlay.alpha = 0f
        seekOverlay.visibility = VISIBLE
        seekOverlay.animate().alpha(1f).setDuration(100).start()
        handler.postDelayed({ fadeOut(seekOverlay) }, 800)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        release()
    }
}
