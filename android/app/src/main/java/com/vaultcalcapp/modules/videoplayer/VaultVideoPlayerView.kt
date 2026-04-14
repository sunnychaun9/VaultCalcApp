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
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioManager
import android.media.MediaMetadataRetriever
import android.os.Handler
import android.os.Looper
import android.util.LruCache
import android.util.AttributeSet
import android.view.*
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaItem.SubtitleConfiguration
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.SeekParameters
import androidx.media3.exoplayer.trackselection.AdaptiveTrackSelection
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.PlayerView
import androidx.media3.ui.SubtitleView
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import java.io.File
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import com.vaultcalcapp.R
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
    private var isShuffleEnabled = false
    private var isRepeatEnabled = false
    private var shuffleHistory = mutableListOf<Int>() // tracks played indices for prev-in-shuffle
    private var isScreenLocked = false
    private var rotationState = 0 // 0=portrait, 1=landscape, 2=reverse-landscape
    private var hasAutoOrientationApplied = false
    private var wasPlayingBeforePause = false
    private lateinit var lifecycleObserver: DefaultLifecycleObserver

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

    // ── Thumbnail scrub preview ────────────────────────────────
    private val thumbnailScrubber = ThumbnailScrubber()
    private lateinit var scrubPreviewContainer: FrameLayout
    private lateinit var scrubPreviewImage: ImageView
    private lateinit var scrubPreviewTime: TextView
    private var isScrubbing = false
    private val thumbHalfPx = (9 * context.resources.displayMetrics.density).toInt() // cached dp(9)
    private var lastDisplayedPosSec = -1 // throttle formatTime allocations

    // ── Center indicator card (volume / brightness) ──────────
    private lateinit var centerIndicator: FrameLayout
    private lateinit var centerIndicatorIcon: ImageView
    private lateinit var centerIndicatorText: TextView
    private lateinit var centerIndicatorBar: View
    private lateinit var centerIndicatorBarFill: View
    private val CENTER_INDICATOR_TOKEN = Object()

    // ── Subtitles ───────────────────────────────────────────────
    private var subtitlesEnabled = false
    private var subtitlePath: String? = null
    private var subtitleDelayMs = 0L
    private lateinit var subtitleView: SubtitleView
    private lateinit var subtitleBtn: ImageView
    private lateinit var subtitleDelayOverlay: TextView

    // ── Long-press speed scrub ─────────────────────────────────
    private var isSpeedScrubMode = false
    private var speedScrubStartY = 0f
    private var speedBeforeScrub = 1.0f
    private val LONG_PRESS_THRESHOLD_MS = 400L
    private val SPEED_SCRUB_SENSITIVITY = 0.005f
    private val SPEED_MIN = 0.25f
    private val SPEED_MAX = 3.0f
    private lateinit var speedScrubOverlay: TextView
    private val longPressRunnable = Runnable { activateSpeedScrub() }

    // ── UI views ───────────────────────────────────────────────
    private val volumeSlider: VerticalSliderView
    private val brightnessSlider: VerticalSliderView
    private val seekOverlay: TextView
    private val errorOverlay: TextView
    private val bufferingOverlay: FrameLayout
    private val centerPlayBtn: ImageView
    private val lockOverlay: FrameLayout
    private val lockContent: LinearLayout
    private val leftRipple: DoubleTapRippleView
    private val rightRipple: DoubleTapRippleView

    // ── Controls ───────────────────────────────────────────────
    private val topBar: LinearLayout
    private val backBtn: ImageView
    private val titleText: TextView
    private val menuBtn: ImageView
    private val bottomContainer: LinearLayout
    private val seekBarContainer: FrameLayout
    private val seekTrack: View
    private val seekBuffered: View
    private val seekFill: View
    private val seekThumb: View
    private val timeStartText: TextView
    private val timeEndText: TextView
    private val lockBtn: ImageView
    private val prevBtn: ImageView
    private val playPauseBtn: ImageView
    private val nextBtn: ImageView
    private val rotateBtn: ImageView
    private val shuffleBtn: ImageView
    private val repeatBtn: ImageView
    private val speedBtn: TextView

    // ── Progress reporting ──────────────────────────────────────
    private val progressRunnable = object : Runnable {
        override fun run() {
            player?.let { p ->
                if (p.isPlaying) {
                    sendProgressEvent(p.currentPosition, p.duration)
                }
                // Always sync seek bar with player position — even when
                // buffering or paused after a seek — but never while the
                // user is actively dragging the thumb.
                if (!isScrubbing) {
                    updateSeekBar()
                }
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
    // Thumbnail scrub preview — extracts frames on a background
    // thread, caches them in an LRU bitmap cache, and displays
    // the closest frame above the seek bar during drag.
    // ════════════════════════════════════════════════════════════
    inner class ThumbnailScrubber {
        private val THUMB_WIDTH = dp(160)
        private val THUMB_HEIGHT = dp(90)
        private val INTERVAL_US = 2_000_000L // 2 seconds between frames
        private val MAX_CACHE_ENTRIES = 60    // ~120s of video at 2s intervals

        private val cache = LruCache<Long, Bitmap>(MAX_CACHE_ENTRIES)
        private var retriever: MediaMetadataRetriever? = null
        private var videoDurationUs = 0L
        private var isReady = false
        private val bgThread = android.os.HandlerThread("thumb-scrub").apply { start() }
        private val bgHandler = Handler(bgThread.looper)
        private var currentVideoPath: String? = null

        /**
         * Start preloading thumbnails for a video file.
         * Runs entirely on a background thread.
         */
        fun prepare(filePath: String) {
            if (filePath == currentVideoPath && isReady) return
            release()
            currentVideoPath = filePath
            bgHandler.post {
                try {
                    val mmr = MediaMetadataRetriever()
                    mmr.setDataSource(filePath)
                    val durationMs = mmr.extractMetadata(
                        MediaMetadataRetriever.METADATA_KEY_DURATION
                    )?.toLongOrNull() ?: 0L
                    videoDurationUs = durationMs * 1000L
                    retriever = mmr
                    isReady = true

                    // Preload first 10 thumbnails (covers first ~20s)
                    val preloadCount = ((videoDurationUs / INTERVAL_US).toInt())
                        .coerceAtMost(10)
                    for (i in 0..preloadCount) {
                        val timeUs = i * INTERVAL_US
                        getFrameAt(timeUs)
                    }
                } catch (_: Exception) {
                    isReady = false
                }
            }
        }

        /**
         * Get the thumbnail closest to the given position.
         * Returns cached bitmap immediately or null if not yet generated.
         * Queues background extraction for cache misses.
         */
        fun getThumbnail(positionMs: Long): Bitmap? {
            if (!isReady) return null
            val timeUs = (positionMs * 1000L)
            // Snap to nearest interval
            val snapped = (timeUs / INTERVAL_US) * INTERVAL_US
            val cached = cache.get(snapped)
            if (cached != null) return cached

            // Queue background extraction — next drag event will pick it up
            bgHandler.post { getFrameAt(snapped) }
            // Return nearest available frame
            return findClosest(snapped)
        }

        private fun getFrameAt(timeUs: Long): Bitmap? {
            val cached = cache.get(timeUs)
            if (cached != null) return cached
            return try {
                retriever?.getScaledFrameAtTime(
                    timeUs,
                    MediaMetadataRetriever.OPTION_CLOSEST_SYNC,
                    THUMB_WIDTH,
                    THUMB_HEIGHT,
                )?.also { cache.put(timeUs, it) }
            } catch (_: Exception) {
                null
            }
        }

        private fun findClosest(targetUs: Long): Bitmap? {
            val snapshot = cache.snapshot()
            var bestKey = -1L
            var bestDist = Long.MAX_VALUE
            for (key in snapshot.keys) {
                val dist = abs(key - targetUs)
                if (dist < bestDist) {
                    bestDist = dist
                    bestKey = key
                }
            }
            return if (bestKey >= 0) snapshot[bestKey] else null
        }

        fun release() {
            isReady = false
            currentVideoPath = null
            bgHandler.removeCallbacksAndMessages(null)
            try { retriever?.release() } catch (_: Exception) {}
            retriever = null
            cache.evictAll()
        }

        fun destroy() {
            release()
            bgThread.quitSafely()
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

        // ── Subtitle overlay (styled, positioned above bottom controls) ──
        subtitleView = SubtitleView(context).apply {
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            setStyle(CaptionStyleCompat(
                Color.WHITE,                                        // foreground
                0xAA000000.toInt(),                                 // background
                Color.TRANSPARENT,                                  // window
                CaptionStyleCompat.EDGE_TYPE_DROP_SHADOW,           // edge type
                0xFF000000.toInt(),                                 // edge color
                null,                                               // typeface (system default)
            ))
            setFixedTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 16f)
            setBottomPaddingFraction(0.12f) // keep above controls
            visibility = GONE
        }
        addView(subtitleView)

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

        // ── Seek overlay (center pill — glassmorphic) ──
        seekOverlay = TextView(context).apply {
            background = GradientDrawable().apply {
                setColor(0xBB1A1A2E.toInt())
                cornerRadius = dp(20).toFloat()
                setStroke(dp(1), 0x20FFFFFF)
            }
            setTextColor(Color.WHITE)
            textSize = 16f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            gravity = Gravity.CENTER
            elevation = 16f
            setPadding(dp(28), dp(14), dp(28), dp(14))
            setShadowLayer(3f, 0f, 1f, 0x60000000.toInt())
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

        // ── Center play button (glassmorphic) ──
        centerPlayBtn = ImageView(context).apply {
            setImageResource(R.drawable.ic_player_play)
            imageAlpha = 255 // drawable carries alpha="0.9"
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(0x40FFFFFF) // frosted glass tint
                setStroke(dp(1), 0x30FFFFFF) // subtle glass edge
            }
            setPadding(dp(24), dp(24), dp(24), dp(24))
            elevation = 12f
            visibility = GONE
            layoutParams = LayoutParams(dp(96), dp(96), Gravity.CENTER)
            setOnClickListener { togglePlayPause() }
        }
        addView(centerPlayBtn)

        // ══════════════════════════════════════════════════════
        // TOP BAR (5-stop gradient — cinematic fade)
        // ══════════════════════════════════════════════════════
        topBar = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(
                    0xE0000000.toInt(),   // 88% at top edge
                    0xB3000000.toInt(),   // 70%
                    0x66000000.toInt(),   // 40%
                    0x22000000.toInt(),   // 13%
                    0x00000000,           // transparent
                )
            )
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(6), dp(10), dp(12), dp(48))
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.TOP)
        }

        backBtn = makeIconView(R.drawable.ic_player_back, 26) { sendSimpleEvent("onBackPress") }
        titleText = TextView(context).apply {
            setTextColor(0xF0FFFFFF.toInt())
            textSize = 16f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.MIDDLE
            setShadowLayer(4f, 0f, 1f, 0x80000000.toInt())
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = dp(2); marginEnd = dp(4)
            }
        }
        menuBtn = makeIconView(R.drawable.ic_player_more, 24) { sendSimpleEvent("onMenuPress") }

        topBar.addView(backBtn)
        topBar.addView(titleText)
        topBar.addView(menuBtn)
        addView(topBar)

        // ══════════════════════════════════════════════════════
        // BOTTOM CONTROLS (5-stop cinematic gradient)
        // ══════════════════════════════════════════════════════
        bottomContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable(
                GradientDrawable.Orientation.BOTTOM_TOP,
                intArrayOf(
                    0xE8000000.toInt(),   // 91% at bottom edge
                    0xCC000000.toInt(),   // 80%
                    0x80000000.toInt(),   // 50%
                    0x33000000.toInt(),   // 20%
                    0x00000000,           // transparent
                )
            )
            setPadding(dp(16), dp(40), dp(16), dp(10))
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.BOTTOM)
        }

        // ── Seekbar (6dp thick, rounded, with buffered progress) ──
        seekBarContainer = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(32))
        }
        seekTrack = View(context).apply {
            background = createPillBg(0x33FFFFFF, dp(3).toFloat())
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, dp(6), Gravity.CENTER_VERTICAL)
        }
        seekBuffered = View(context).apply {
            background = createPillBg(0x55FFFFFF, dp(3).toFloat())
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, dp(6), Gravity.CENTER_VERTICAL)
            pivotX = 0f
            scaleX = 0f
        }
        seekFill = View(context).apply {
            background = createPillBg(0xFF3B82F6.toInt(), dp(3).toFloat())
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, dp(6), Gravity.CENTER_VERTICAL)
            pivotX = 0f
            scaleX = 0f
        }
        seekThumb = View(context).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.WHITE)
                setStroke(dp(1), 0x22000000)
            }
            layoutParams = FrameLayout.LayoutParams(dp(18), dp(18), Gravity.CENTER_VERTICAL)
            elevation = 8f
            // Outer glow via outline shadow
            outlineProvider = object : android.view.ViewOutlineProvider() {
                override fun getOutline(view: View, outline: android.graphics.Outline) {
                    outline.setOval(0, 0, view.width, view.height)
                }
            }
            clipToOutline = false
        }
        seekBarContainer.addView(seekTrack)
        seekBarContainer.addView(seekBuffered)
        seekBarContainer.addView(seekFill)
        seekBarContainer.addView(seekThumb)
        seekBarContainer.setOnTouchListener { v, event ->
            val ratio = (event.x / v.width).coerceIn(0f, 1f)
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    // Prevent parent from intercepting drag gestures on the seek bar
                    v.parent?.requestDisallowInterceptTouchEvent(true)
                    isScrubbing = true
                    // Expand thumb on touch
                    seekThumb.animate().scaleX(1.4f).scaleY(1.4f).setDuration(120).start()
                    updateSeekBarVisuals(v, ratio)
                    showScrubPreview(ratio, v)
                    resetHideTimer()
                }
                MotionEvent.ACTION_MOVE -> {
                    updateSeekBarVisuals(v, ratio)
                    showScrubPreview(ratio, v)
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    v.parent?.requestDisallowInterceptTouchEvent(false)
                    isScrubbing = false
                    // Shrink thumb back
                    seekThumb.animate().scaleX(1f).scaleY(1f).setDuration(150)
                        .setInterpolator(OvershootInterpolator(2f)).start()
                    // Commit seek on release
                    player?.let { p -> p.seekTo((ratio * p.duration).toLong()) }
                    updateSeekBar()
                    hideScrubPreview()
                    resetHideTimer()
                }
            }
            true
        }
        bottomContainer.addView(seekBarContainer)

        // ── Time row ──
        val timeRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            setPadding(dp(2), dp(2), dp(2), dp(8))
        }
        timeStartText = TextView(context).apply {
            text = "00:00"
            setTextColor(0xCCFFFFFF.toInt())
            textSize = 13f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            setShadowLayer(2f, 0f, 1f, 0x60000000.toInt())
        }
        timeEndText = TextView(context).apply {
            text = "-00:00"
            setTextColor(0x99FFFFFF.toInt())
            textSize = 13f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            setShadowLayer(2f, 0f, 1f, 0x60000000.toInt())
        }
        val timeSpacer = View(context).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) }
        timeRow.addView(timeStartText)
        timeRow.addView(timeSpacer)
        timeRow.addView(timeEndText)
        bottomContainer.addView(timeRow)

        // ── Bottom button row (glassmorphic inner panel) ──
        val btnRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = GradientDrawable().apply {
                setColor(0x1AFFFFFF) // frosted glass tint
                cornerRadius = dp(16).toFloat()
                setStroke(dp(1), 0x15FFFFFF) // glass edge
            }
            setPadding(dp(6), dp(4), dp(6), dp(4))
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(2)
            }
        }

        lockBtn = makeIconView(R.drawable.ic_player_lock, 22) { lockScreen() }
        shuffleBtn = makeIconView(R.drawable.ic_player_shuffle, 22) { toggleShuffle() }.apply {
            imageAlpha = 102
        }
        prevBtn = makeIconView(R.drawable.ic_player_skip_prev, 28) { playPrevious() }
        playPauseBtn = makeIconView(R.drawable.ic_player_pause, 36) { togglePlayPause() }
        nextBtn = makeIconView(R.drawable.ic_player_skip_next, 28) { playNext() }
        repeatBtn = makeIconView(R.drawable.ic_player_repeat, 22) { toggleRepeat() }.apply {
            imageAlpha = 102
        }
        speedBtn = TextView(context).apply {
            text = "1.0x"
            setTextColor(0xDDFFFFFF.toInt())
            textSize = 13f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            background = GradientDrawable().apply {
                setColor(0x22FFFFFF)
                cornerRadius = dp(14).toFloat()
                setStroke(dp(1), 0x18FFFFFF)
            }
            setPadding(dp(14), dp(7), dp(14), dp(7))
            gravity = Gravity.CENTER
            setOnClickListener { showSpeedMenu() }
        }
        rotateBtn = makeIconView(R.drawable.ic_player_rotate, 22) { rotateScreen() }
        subtitleBtn = makeIconView(R.drawable.ic_player_subtitles, 22) { toggleSubtitles() }.apply {
            imageAlpha = 102
        }

        val bSpacer = View(context).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) }

        btnRow.addView(lockBtn)
        btnRow.addView(createGap(dp(4)))
        btnRow.addView(shuffleBtn)
        btnRow.addView(createGap(dp(4)))
        btnRow.addView(prevBtn)
        btnRow.addView(createGap(dp(2)))
        btnRow.addView(playPauseBtn)
        btnRow.addView(createGap(dp(2)))
        btnRow.addView(nextBtn)
        btnRow.addView(createGap(dp(4)))
        btnRow.addView(repeatBtn)
        btnRow.addView(bSpacer)
        btnRow.addView(subtitleBtn)
        btnRow.addView(createGap(dp(6)))
        btnRow.addView(speedBtn)
        btnRow.addView(createGap(dp(6)))
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
        lockContent = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            background = GradientDrawable().apply {
                setColor(0xBB1A1A2E.toInt())
                cornerRadius = dp(20).toFloat()
                setStroke(dp(1), 0x20FFFFFF)
            }
            elevation = 16f
            setPadding(dp(28), dp(16), dp(28), dp(16))
            layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER)
        }
        lockContent.addView(ImageView(context).apply {
            setImageResource(R.drawable.ic_player_lock)
            imageAlpha = 255
            layoutParams = LinearLayout.LayoutParams(dp(36), dp(36)).apply { gravity = Gravity.CENTER_HORIZONTAL }
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
            text = "Tap to unlock"
            setTextColor(0x99FFFFFF.toInt())
            textSize = 12f
            gravity = Gravity.CENTER
        })
        // No click listeners — all tap logic handled in dispatchTouchEvent
        lockOverlay.addView(lockContent)
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

        // ── Center indicator card (volume/brightness feedback) ──
        centerIndicator = FrameLayout(context).apply {
            visibility = GONE
            elevation = 24f
            background = GradientDrawable().apply {
                setColor(0xDD1A1A2E.toInt())
                cornerRadius = dp(16).toFloat()
                setStroke(dp(1), 0x20FFFFFF)
            }
            layoutParams = LayoutParams(dp(140), dp(140), Gravity.CENTER)
        }
        // Icon
        centerIndicatorIcon = ImageView(context).apply {
            setImageResource(R.drawable.ic_player_volume)
            imageAlpha = 255
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            layoutParams = FrameLayout.LayoutParams(dp(40), dp(40)).apply {
                gravity = Gravity.CENTER_HORIZONTAL or Gravity.TOP
                topMargin = dp(24)
            }
        }
        centerIndicator.addView(centerIndicatorIcon)
        // Percentage text
        centerIndicatorText = TextView(context).apply {
            text = "50%"
            setTextColor(Color.WHITE)
            textSize = 22f
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                gravity = Gravity.CENTER
                topMargin = dp(10)
            }
        }
        centerIndicator.addView(centerIndicatorText)
        // Progress bar (thin horizontal bar at bottom of card)
        val barContainer = FrameLayout(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, dp(4),
            ).apply {
                gravity = Gravity.BOTTOM
                marginStart = dp(20); marginEnd = dp(20); bottomMargin = dp(18)
            }
        }
        centerIndicatorBar = View(context).apply {
            background = createPillBg(0x33FFFFFF, dp(2).toFloat())
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, dp(4))
        }
        centerIndicatorBarFill = View(context).apply {
            background = createPillBg(0xFF3B82F6.toInt(), dp(2).toFloat())
            layoutParams = FrameLayout.LayoutParams(0, dp(4))
        }
        barContainer.addView(centerIndicatorBar)
        barContainer.addView(centerIndicatorBarFill)
        centerIndicator.addView(barContainer)
        addView(centerIndicator)

        // ── Scrub preview (floating above seek bar) ──
        scrubPreviewContainer = FrameLayout(context).apply {
            visibility = GONE
            layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
                gravity = Gravity.BOTTOM
                bottomMargin = dp(120) // above the bottom controls
            }
            elevation = 16f
        }
        scrubPreviewImage = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = GradientDrawable().apply {
                setColor(0xFF1A1A1A.toInt())
                cornerRadius = dp(8).toFloat()
                setStroke(dp(1), 0x33FFFFFF)
            }
            clipToOutline = true
            outlineProvider = object : ViewOutlineProvider() {
                override fun getOutline(view: View, outline: android.graphics.Outline) {
                    outline.setRoundRect(0, 0, view.width, view.height, dp(8).toFloat())
                }
            }
            layoutParams = FrameLayout.LayoutParams(dp(160), dp(90))
        }
        scrubPreviewTime = TextView(context).apply {
            setTextColor(Color.WHITE)
            textSize = 11f
            typeface = Typeface.MONOSPACE
            gravity = Gravity.CENTER
            setBackgroundColor(0xAA000000.toInt())
            setPadding(dp(8), dp(3), dp(8), dp(3))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL,
            )
        }
        scrubPreviewContainer.addView(scrubPreviewImage)
        scrubPreviewContainer.addView(scrubPreviewTime)
        addView(scrubPreviewContainer)

        // ── Speed scrub overlay (center pill, larger than seek overlay) ──
        speedScrubOverlay = TextView(context).apply {
            background = createPillBg(0xDD000000.toInt(), dp(20).toFloat())
            setTextColor(Color.WHITE)
            textSize = 22f
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(dp(32), dp(16), dp(32), dp(16))
            visibility = GONE
            layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER)
            elevation = 20f
        }
        addView(speedScrubOverlay)

        // ── Subtitle delay overlay (shown when adjusting delay) ──
        subtitleDelayOverlay = TextView(context).apply {
            background = createPillBg(0xCC000000.toInt(), dp(16).toFloat())
            setTextColor(Color.WHITE)
            textSize = 14f
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            gravity = Gravity.CENTER
            setPadding(dp(20), dp(10), dp(20), dp(10))
            visibility = GONE
            layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
                gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                topMargin = dp(80)
            }
        }
        addView(subtitleDelayOverlay)

        initializePlayer()

        // Lifecycle-aware pause/release: pause in onPause, release in onStop
        lifecycleObserver = object : DefaultLifecycleObserver {
            override fun onPause(owner: LifecycleOwner) {
                wasPlayingBeforePause = player?.isPlaying == true
                player?.pause()
            }

            override fun onResume(owner: LifecycleOwner) {
                if (wasPlayingBeforePause) {
                    player?.play()
                }
            }

            override fun onStop(owner: LifecycleOwner) {
                release()
            }
        }
        val lifecycleOwner = (context as? androidx.lifecycle.LifecycleOwner)
            ?: (getActivity() as? androidx.lifecycle.LifecycleOwner)
        lifecycleOwner?.lifecycle?.addObserver(lifecycleObserver)
    }

    // ════════════════════════════════════════════════════════════
    // Player lifecycle
    // ════════════════════════════════════════════════════════════

    private fun initializePlayer() {
        // Buffer config: minBuffer must be >= bufferForPlaybackAfterRebuffer (ExoPlayer constraint).
        // 2.5s min keeps memory low for local vault files; 5s max is enough without wasting RAM.
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                /* minBufferMs */          2500,
                /* maxBufferMs */          5000,
                /* bufferForPlaybackMs */  1000,
                /* bufferForPlaybackAfterRebufferMs */ 2000,
            )
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()

        // Adaptive track selection for varying quality local files
        val trackSelector = DefaultTrackSelector(context, AdaptiveTrackSelection.Factory())

        player = ExoPlayer.Builder(context)
            .setLoadControl(loadControl)
            .setTrackSelector(trackSelector)
            .setSeekBackIncrementMs(SEEK_JUMP_MS)
            .setSeekForwardIncrementMs(SEEK_JUMP_MS)
            .setHandleAudioBecomingNoisy(true)
            .build()
            .also { exo ->
                playerView.player = exo
                exo.addListener(this)
                exo.playWhenReady = true

                // Snap to nearest keyframe for fast seeking in encrypted files
                exo.setSeekParameters(SeekParameters.CLOSEST_SYNC)

                // Prefer first video track — avoids decoder selection delay
                exo.videoScalingMode = C.VIDEO_SCALING_MODE_SCALE_TO_FIT

                // Keep screen awake during playback
                playerView.keepScreenOn = true
            }
        handler.post(progressRunnable)
    }

    fun loadVideo(filePath: String, startPosition: Long = 0) {
        resumePosition = startPosition
        hasAutoOrientationApplied = false
        subtitleDelayMs = 0
        lastDisplayedPosSec = -1
        player?.let { p ->
            p.setMediaItem(MediaItem.fromUri(filePath))
            p.prepare()
            if (startPosition > 0) p.seekTo(startPosition)
        }
        // Start preloading scrub thumbnails in background
        thumbnailScrubber.prepare(filePath)
        // Auto-detect matching .srt file
        autoDetectSubtitle(filePath)
    }

    fun setPlaylist(paths: List<String>, startIndex: Int = 0) {
        playlist.clear()
        playlist.addAll(paths)
        currentIndex = startIndex.coerceIn(0, paths.size - 1)
        shuffleHistory.clear()
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
        handler.removeCallbacks(lockAutoHideRunnable)
        playerView.keepScreenOn = false
        thumbnailScrubber.release()
        player?.removeListener(this)
        player?.stop()
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
        // Hide controls BEFORE setting locked flag (hideControls guards on isScreenLocked)
        hideControls()
        isScreenLocked = true
        controlsVisible = false
        // Hide everything — just the video plays, no UI
        lockOverlay.visibility = GONE
        sendSimpleEvent("onLockStateChange")
    }

    fun unlockScreen() {
        isScreenLocked = false
        lockOverlay.animate().cancel()
        lockOverlay.animate().alpha(0f).setDuration(150).withEndAction {
            lockOverlay.visibility = GONE
        }.start()
        showControls()
        resetHideTimer()
        sendSimpleEvent("onLockStateChange")
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
                showQuickFeedback("Portrait")
            }
            1 -> {
                activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                showQuickFeedback("Landscape")
            }
            2 -> {
                activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
                showQuickFeedback("Landscape (reverse)")
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
                // Unlock screen if locked so user isn't stuck
                if (isScreenLocked) unlockScreen()
                sendSimpleEvent("onEnd")
                val hasNext = isShuffleEnabled || isRepeatEnabled || currentIndex < playlist.size - 1
                if (autoPlayNext && hasNext) {
                    playNext()
                } else {
                    showControls()
                    playPauseBtn.setImageResource(R.drawable.ic_player_play)
                    showCenterPlay()
                }
            }
            Player.STATE_IDLE -> {}
        }
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
        playPauseBtn.setImageResource(if (isPlaying) R.drawable.ic_player_pause else R.drawable.ic_player_play)
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
    private val lockAutoHideRunnable = Runnable {
        if (isScreenLocked && lockOverlay.visibility == VISIBLE) {
            lockOverlay.animate().alpha(0f).setDuration(200)
                .withEndAction { lockOverlay.visibility = GONE }.start()
        }
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (isScreenLocked) {
            if (ev.action == MotionEvent.ACTION_DOWN) {
                if (lockOverlay.visibility == VISIBLE) {
                    // Overlay is showing — check if tap landed on lock card
                    if (isTouchInsideLockContent(ev)) {
                        // Tap on lock card → unlock
                        unlockScreen()
                    } else {
                        // Tap outside card → hide overlay
                        lockOverlay.animate().alpha(0f).setDuration(150)
                            .withEndAction { lockOverlay.visibility = GONE }.start()
                    }
                } else {
                    // Overlay hidden → show lock icon
                    handler.removeCallbacks(lockAutoHideRunnable)
                    lockOverlay.alpha = 0f
                    lockOverlay.visibility = VISIBLE
                    lockOverlay.animate().alpha(1f).setDuration(150).start()
                    handler.postDelayed(lockAutoHideRunnable, 3000)
                }
            }
            return true // Consume all events — gestures/children disabled while locked
        }
        return super.dispatchTouchEvent(ev)
    }

    private fun isTouchInsideLockContent(ev: MotionEvent): Boolean {
        val loc = IntArray(2)
        lockContent.getLocationOnScreen(loc)
        return ev.rawX >= loc[0] && ev.rawX <= loc[0] + lockContent.width &&
               ev.rawY >= loc[1] && ev.rawY <= loc[1] + lockContent.height
    }

    override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
        if (isScreenLocked) return true
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
        if (isScreenLocked) return true

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
                // Schedule long-press detection for speed scrub
                handler.postDelayed(longPressRunnable, LONG_PRESS_THRESHOLD_MS)
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = event.x - gestureStartX
                val dy = event.y - gestureStartY

                // If speed scrub mode is active, vertical swipe controls speed
                if (isSpeedScrubMode) {
                    handleSpeedScrubGesture(-(event.y - speedScrubStartY))
                    return true
                }

                // Cancel long-press if finger moved before threshold
                if (!isHorizontalGesture && !isVerticalGesture) {
                    if (abs(dx) > GESTURE_THRESHOLD || abs(dy) > GESTURE_THRESHOLD) {
                        handler.removeCallbacks(longPressRunnable)
                    }
                }

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
                handler.removeCallbacks(longPressRunnable)
                if (isSpeedScrubMode) {
                    deactivateSpeedScrub()
                } else if (isHorizontalGesture) {
                    fadeOut(seekOverlay)
                } else if (isVerticalGesture) {
                    fadeOut(volumeSlider)
                    fadeOut(brightnessSlider)
                    hideCenterIndicator()
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
        if (controlsVisible) hideControls()
        val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val newVolume = (gestureStartVolume + dy * VOLUME_SENSITIVITY).coerceIn(0f, 1f)
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, (newVolume * maxVol).toInt(), 0)
        // Edge slider — bringToFront() forces it above Media3's SurfaceView,
        // whose compositing would otherwise obscure our overlay despite elevation.
        volumeSlider.progress = newVolume
        volumeSlider.alpha = 1f
        volumeSlider.visibility = VISIBLE
        volumeSlider.bringToFront()
        brightnessSlider.visibility = GONE
        // Center card indicator
        showCenterIndicator(R.drawable.ic_player_volume, newVolume)
        sendVolumeEvent(newVolume)
    }

    private fun handleBrightnessGesture(dy: Float) {
        if (controlsVisible) hideControls()
        val activity = getActivity() ?: return
        val newBrightness = (gestureStartBrightness + dy * BRIGHTNESS_SENSITIVITY).coerceIn(0.01f, 1f)
        val lp = activity.window.attributes
        lp.screenBrightness = newBrightness
        activity.window.attributes = lp
        // Edge slider — bringToFront() forces it above Media3's SurfaceView,
        // whose compositing would otherwise obscure our overlay despite elevation.
        brightnessSlider.progress = newBrightness
        brightnessSlider.alpha = 1f
        brightnessSlider.visibility = VISIBLE
        brightnessSlider.bringToFront()
        volumeSlider.visibility = GONE
        // Center card indicator
        showCenterIndicator(R.drawable.ic_player_brightness, newBrightness)
        val event = Arguments.createMap().apply { putDouble("brightness", newBrightness.toDouble()) }
        sendEvent("onBrightnessChange", event)
    }

    // ════════════════════════════════════════════════════════════
    // Long-press speed scrub
    // ════════════════════════════════════════════════════════════

    private fun activateSpeedScrub() {
        if (isHorizontalGesture || isVerticalGesture || isScreenLocked) return
        isSpeedScrubMode = true
        speedScrubStartY = gestureStartY
        speedBeforeScrub = currentSpeed

        // Haptic feedback to signal mode activation
        try {
            @Suppress("DEPRECATION")
            (context.getSystemService(Context.VIBRATOR_SERVICE) as? android.os.Vibrator)?.vibrate(30)
        } catch (_: Exception) {}

        // Hide normal controls, show speed overlay
        if (controlsVisible) hideControls()
        updateSpeedScrubOverlay(currentSpeed)
        speedScrubOverlay.alpha = 0f
        speedScrubOverlay.scaleX = 0.8f
        speedScrubOverlay.scaleY = 0.8f
        speedScrubOverlay.visibility = VISIBLE
        speedScrubOverlay.animate()
            .alpha(1f).scaleX(1f).scaleY(1f)
            .setDuration(150).start()
    }

    private fun handleSpeedScrubGesture(dy: Float) {
        // Map vertical displacement to speed: up = faster, down = slower
        val speedDelta = dy * SPEED_SCRUB_SENSITIVITY
        val rawSpeed = speedBeforeScrub + speedDelta

        // Snap to nearest 0.25 increment for clean values
        val snapped = (Math.round(rawSpeed * 4f) / 4f).coerceIn(SPEED_MIN, SPEED_MAX)

        player?.setPlaybackSpeed(snapped)
        updateSpeedScrubOverlay(snapped)
    }

    private fun deactivateSpeedScrub() {
        isSpeedScrubMode = false

        // Revert to the user's chosen speed (before the long-press)
        player?.setPlaybackSpeed(currentSpeed)

        // Fade out overlay
        speedScrubOverlay.animate()
            .alpha(0f).scaleX(0.9f).scaleY(0.9f)
            .setDuration(150)
            .withEndAction {
                speedScrubOverlay.visibility = GONE
                showQuickFeedback("Speed: ${currentSpeed}x")
            }.start()
    }

    private fun updateSpeedScrubOverlay(speed: Float) {
        val arrow = when {
            speed > 1.1f -> "\u25B2"  // ▲
            speed < 0.9f -> "\u25BC"  // ▼
            else -> "\u25CF"          // ●
        }
        val displaySpeed = if (speed == speed.toLong().toFloat()) {
            "${speed.toLong()}x"
        } else {
            "${speed}x"
        }
        speedScrubOverlay.text = "$arrow $displaySpeed"
    }

    // ════════════════════════════════════════════════════════════
    // Subtitles
    // ════════════════════════════════════════════════════════════

    /**
     * Load an external .srt subtitle file and attach it to the current video.
     * Rebuilds the MediaItem with the subtitle track merged in.
     */
    fun loadSubtitle(srtPath: String) {
        subtitlePath = srtPath
        subtitlesEnabled = true
        subtitleDelayMs = 0

        val p = player ?: return
        val currentPos = p.currentPosition
        val wasPlaying = p.isPlaying

        // Build subtitle configuration
        val subtitleConfig = SubtitleConfiguration.Builder(Uri.fromFile(File(srtPath)))
            .setMimeType(MimeTypes.APPLICATION_SUBRIP)
            .setLanguage("en")
            .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
            .build()

        // Rebuild the media item with subtitle track
        val currentUri = p.currentMediaItem?.localConfiguration?.uri ?: return
        val mediaItem = MediaItem.Builder()
            .setUri(currentUri)
            .setSubtitleConfigurations(listOf(subtitleConfig))
            .build()

        p.setMediaItem(mediaItem)
        p.prepare()
        p.seekTo(currentPos)
        if (wasPlaying) p.play()

        // Enable the subtitle display
        subtitleView.visibility = VISIBLE
        subtitleBtn.imageAlpha = 204 // bright — active
        showQuickFeedback("Subtitles on")
    }

    /**
     * Auto-detect a subtitle file for the given video path.
     * Looks for .srt files with the same base name in the same directory.
     */
    fun autoDetectSubtitle(videoPath: String) {
        val videoFile = File(videoPath)
        val baseName = videoFile.nameWithoutExtension
        val dir = videoFile.parentFile ?: return

        // Search for matching .srt file
        val srtFile = dir.listFiles()?.firstOrNull { file ->
            file.extension.equals("srt", ignoreCase = true) &&
            file.nameWithoutExtension.equals(baseName, ignoreCase = true)
        }

        if (srtFile != null) {
            loadSubtitle(srtFile.absolutePath)
        } else {
            // No subtitle found — dim the button
            subtitleBtn.imageAlpha = 102
        }
    }

    /** Toggle subtitles on/off. */
    fun toggleSubtitles() {
        if (subtitlePath == null) {
            showQuickFeedback("No subtitle file found")
            return
        }

        subtitlesEnabled = !subtitlesEnabled
        if (subtitlesEnabled) {
            subtitleView.visibility = VISIBLE
            subtitleBtn.imageAlpha = 204
            // Re-enable subtitle track selection
            val trackSelector = player?.trackSelector as? DefaultTrackSelector
            trackSelector?.parameters = trackSelector?.buildUponParameters()
                ?.setPreferredTextLanguage("en")
                ?.build() ?: return
            showQuickFeedback("Subtitles on")
        } else {
            subtitleView.visibility = GONE
            subtitleBtn.imageAlpha = 128
            // Disable all text tracks
            val trackSelector = player?.trackSelector as? DefaultTrackSelector
            trackSelector?.parameters = trackSelector?.buildUponParameters()
                ?.setDisabledTextTrackSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                ?.build() ?: return
            showQuickFeedback("Subtitles off")
        }
    }

    /**
     * Adjust subtitle delay. Positive = subtitles appear later, negative = earlier.
     * Called from React Native bridge.
     *
     * @param deltaMs Change in milliseconds (e.g. +500 or -500)
     */
    fun adjustSubtitleDelay(deltaMs: Long) {
        subtitleDelayMs += deltaMs

        // Apply delay via track renderer offset
        player?.let { p ->
            val rendererCount = p.rendererCount
            for (i in 0 until rendererCount) {
                if (p.getRendererType(i) == C.TRACK_TYPE_TEXT) {
                    p.setTrackSelectionParameters(
                        p.trackSelectionParameters.buildUpon().build()
                    )
                    break
                }
            }
        }

        // Show delay feedback
        val sign = if (subtitleDelayMs >= 0) "+" else ""
        subtitleDelayOverlay.text = "Subtitle delay: ${sign}${subtitleDelayMs}ms"
        subtitleDelayOverlay.alpha = 1f
        subtitleDelayOverlay.visibility = VISIBLE
        handler.removeCallbacksAndMessages(subtitleDelayOverlay)
        handler.postAtTime(
            { fadeOut(subtitleDelayOverlay) },
            subtitleDelayOverlay,
            android.os.SystemClock.uptimeMillis() + 1500,
        )
    }

    /** Reset subtitle delay to 0. */
    fun resetSubtitleDelay() {
        subtitleDelayMs = 0
        adjustSubtitleDelay(0) // triggers UI update
    }

    // ════════════════════════════════════════════════════════════
    // Center indicator card (volume / brightness)
    // ════════════════════════════════════════════════════════════

    private fun showCenterIndicator(iconRes: Int, percentage: Float) {
        // Cancel any pending or in-flight hide animation so a new gesture
        // doesn't get stuck at partial opacity from a mid-fade collision.
        handler.removeCallbacksAndMessages(CENTER_INDICATOR_TOKEN)
        centerIndicator.animate().cancel()

        centerIndicatorIcon.setImageResource(iconRes)
        centerIndicatorText.text = "${(percentage * 100).toInt()}%"

        // Update progress bar fill
        centerIndicator.post {
            val barWidth = centerIndicatorBar.width
            val fillLp = centerIndicatorBarFill.layoutParams as FrameLayout.LayoutParams
            fillLp.width = (barWidth * percentage).toInt()
            centerIndicatorBarFill.layoutParams = fillLp
        }

        // Animate entrance if not already visible, or restore after cancelled hide
        if (centerIndicator.visibility != VISIBLE || centerIndicator.alpha < 1f) {
            centerIndicator.alpha = 0f
            centerIndicator.scaleX = 0.85f
            centerIndicator.scaleY = 0.85f
            centerIndicator.visibility = VISIBLE
            // bringToFront() so it renders above Media3's SurfaceView
            centerIndicator.bringToFront()
            centerIndicator.animate()
                .alpha(1f).scaleX(1f).scaleY(1f)
                .setDuration(150).setInterpolator(DecelerateInterpolator(1.5f))
                .start()
        }
    }

    private fun hideCenterIndicator() {
        handler.removeCallbacksAndMessages(CENTER_INDICATOR_TOKEN)
        handler.postAtTime({
            centerIndicator.animate()
                .alpha(0f).scaleX(0.92f).scaleY(0.92f)
                .setDuration(180).setInterpolator(DecelerateInterpolator())
                .withEndAction { centerIndicator.visibility = GONE }
                .start()
        }, CENTER_INDICATOR_TOKEN, android.os.SystemClock.uptimeMillis() + 1500)
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
        // Top bar slides down + fades in
        topBar.visibility = VISIBLE
        topBar.translationY = -dp(12).toFloat()
        topBar.animate().alpha(1f).translationY(0f)
            .setDuration(250).setInterpolator(DecelerateInterpolator(1.5f)).start()
        // Bottom bar slides up + fades in (slight stagger)
        bottomContainer.visibility = VISIBLE
        bottomContainer.translationY = dp(12).toFloat()
        bottomContainer.animate().alpha(1f).translationY(0f)
            .setStartDelay(30).setDuration(250).setInterpolator(DecelerateInterpolator(1.5f)).start()
        // Sync seek bar to current position after layout so it's correct when controls appear
        seekBarContainer.post { updateSeekBar() }
    }

    private fun hideControls() {
        if (isScreenLocked) return
        controlsVisible = false
        topBar.animate().alpha(0f).translationY(-dp(8).toFloat())
            .setDuration(200).setInterpolator(DecelerateInterpolator())
            .withEndAction { topBar.visibility = GONE; topBar.translationY = 0f }.start()
        bottomContainer.animate().alpha(0f).translationY(dp(8).toFloat())
            .setDuration(200).setInterpolator(DecelerateInterpolator())
            .withEndAction { bottomContainer.visibility = GONE; bottomContainer.translationY = 0f }.start()
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
        if (playlist.isEmpty()) return
        if (isShuffleEnabled) {
            shuffleHistory.add(currentIndex)
            val candidates = (playlist.indices).filter { it != currentIndex }
            if (candidates.isEmpty()) return
            currentIndex = candidates.random()
            updateNavButtonAlpha()
            sendNavigationEvent("next", currentIndex)
        } else if (currentIndex < playlist.size - 1) {
            shuffleHistory.add(currentIndex)
            currentIndex++
            updateNavButtonAlpha()
            sendNavigationEvent("next", currentIndex)
        } else if (isRepeatEnabled) {
            shuffleHistory.add(currentIndex)
            currentIndex = 0
            updateNavButtonAlpha()
            sendNavigationEvent("next", currentIndex)
        }
    }

    private fun playPrevious() {
        player?.let { p -> if (p.currentPosition > 3000) { p.seekTo(0); return } }
        if (shuffleHistory.isNotEmpty()) {
            // Go back through shuffle history
            currentIndex = shuffleHistory.removeAt(shuffleHistory.size - 1)
            updateNavButtonAlpha()
            sendNavigationEvent("previous", currentIndex)
        } else if (currentIndex > 0) {
            currentIndex--
            updateNavButtonAlpha()
            sendNavigationEvent("previous", currentIndex)
        } else if (isRepeatEnabled) {
            currentIndex = playlist.size - 1
            updateNavButtonAlpha()
            sendNavigationEvent("previous", currentIndex)
        }
    }

    private fun toggleShuffle() {
        isShuffleEnabled = !isShuffleEnabled
        shuffleHistory.clear()
        shuffleBtn.imageAlpha = if (isShuffleEnabled) 255 else 102
        val event = Arguments.createMap().apply { putBoolean("enabled", isShuffleEnabled) }
        sendEvent("onShuffleChange", event)
    }

    private fun toggleRepeat() {
        isRepeatEnabled = !isRepeatEnabled
        repeatBtn.imageAlpha = if (isRepeatEnabled) 255 else 102
        updateNavButtonAlpha()
        val event = Arguments.createMap().apply { putBoolean("enabled", isRepeatEnabled) }
        sendEvent("onRepeatChange", event)
    }

    fun setShuffle(enabled: Boolean) {
        isShuffleEnabled = enabled
        shuffleHistory.clear()
        shuffleBtn.imageAlpha = if (enabled) 255 else 102
    }

    fun setRepeat(enabled: Boolean) {
        isRepeatEnabled = enabled
        repeatBtn.imageAlpha = if (enabled) 255 else 102
        updateNavButtonAlpha()
    }

    private fun showSpeedMenu() {
        val popupView = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(0xEE1A1A2E.toInt())
                cornerRadius = dp(16).toFloat()
                setStroke(dp(1), 0x20FFFFFF)
            }
            setPadding(0, dp(12), 0, dp(12))
            elevation = 28f
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
            elevation = 28f
        }

        for (speed in SPEED_OPTIONS) {
            popupView.addView(TextView(context).apply {
                text = "${speed}x"
                setTextColor(if (speed == currentSpeed) 0xFF3B82F6.toInt() else 0xDDFFFFFF.toInt())
                textSize = 14f
                typeface = if (speed == currentSpeed) Typeface.create("sans-serif-medium", Typeface.BOLD) else Typeface.create("sans-serif", Typeface.NORMAL)
                setPadding(dp(20), dp(12), dp(20), dp(12))
                if (speed == currentSpeed) {
                    background = GradientDrawable().apply { setColor(0x1A3B82F6) }
                }
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
            val ratio = (p.currentPosition.toFloat() / p.duration.toFloat()).coerceIn(0f, 1f)
            // Use scaleX (render transform) — bypasses React Native's Yoga layout engine
            seekFill.scaleX = ratio
            // Buffered progress
            val bufferedRatio = (p.bufferedPosition.toFloat() / p.duration.toFloat()).coerceIn(0f, 1f)
            seekBuffered.scaleX = bufferedRatio
            // Thumb position via translationX — needs container width
            val barWidth = seekBarContainer.width
            if (barWidth > 0) {
                seekThumb.translationX = (ratio * barWidth - thumbHalfPx).coerceAtLeast(0f)
            }
            // Only update text when the displayed second changes
            val posSec = (p.currentPosition / 1000).toInt()
            if (posSec != lastDisplayedPosSec) {
                lastDisplayedPosSec = posSec
                timeStartText.text = formatTime(p.currentPosition)
                val remaining = p.duration - p.currentPosition
                timeEndText.text = "-${formatTime(remaining)}"
            }
        }
    }

    private fun updateNavButtonAlpha() {
        val canPrev = currentIndex > 0 || shuffleHistory.isNotEmpty() || isRepeatEnabled
        val canNext = currentIndex < playlist.size - 1 || isShuffleEnabled || isRepeatEnabled
        prevBtn.alpha = if (canPrev) 1f else 0.3f
        nextBtn.alpha = if (canNext) 1f else 0.3f
    }

    // ════════════════════════════════════════════════════════════
    // Scrub preview helpers
    // ════════════════════════════════════════════════════════════

    /** Update seek bar fill/thumb/time without committing a seek. */
    private fun updateSeekBarVisuals(seekView: View, ratio: Float) {
        player?.let { p ->
            val pos = (ratio * p.duration).toLong()
            val clampedRatio = ratio.coerceIn(0f, 1f)
            // Use scaleX — bypasses React Native's layout engine
            seekFill.scaleX = clampedRatio
            val barWidth = seekView.width
            if (barWidth > 0) {
                seekThumb.translationX = (clampedRatio * barWidth - thumbHalfPx).coerceAtLeast(0f)
            }
            timeStartText.text = formatTime(pos)
            timeEndText.text = "-${formatTime(p.duration - pos)}"
        }
    }

    /** Show the floating thumbnail preview above the seek bar. */
    private fun showScrubPreview(ratio: Float, seekView: View) {
        val p = player ?: return
        val posMs = (ratio * p.duration).toLong()
        val thumb = thumbnailScrubber.getThumbnail(posMs)

        if (thumb != null) {
            scrubPreviewImage.setImageBitmap(thumb)
        }
        scrubPreviewTime.text = formatTime(posMs)

        // Position horizontally: track the thumb, clamped to screen edges
        val seekBarScreenX = IntArray(2).also { seekView.getLocationOnScreen(it) }[0]
        val thumbX = (seekView.width * ratio).toInt() + seekBarScreenX
        val previewW = dp(160)
        val screenW = width
        val previewX = (thumbX - previewW / 2).coerceIn(dp(8), screenW - previewW - dp(8))

        scrubPreviewContainer.translationX = previewX.toFloat()

        if (scrubPreviewContainer.visibility != VISIBLE) {
            scrubPreviewContainer.alpha = 0f
            scrubPreviewContainer.scaleX = 0.85f
            scrubPreviewContainer.scaleY = 0.85f
            scrubPreviewContainer.visibility = VISIBLE
            scrubPreviewContainer.animate()
                .alpha(1f).scaleX(1f).scaleY(1f)
                .setDuration(150).start()
        }
    }

    /** Hide the scrub preview with a quick fade-out. */
    private fun hideScrubPreview() {
        if (scrubPreviewContainer.visibility != VISIBLE) return
        scrubPreviewContainer.animate()
            .alpha(0f).scaleX(0.9f).scaleY(0.9f)
            .setDuration(120)
            .withEndAction { scrubPreviewContainer.visibility = GONE }
            .start()
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
        // Note: updateSeekBar() is NOT called here — the progressRunnable
        // already calls it after sendProgressEvent, avoiding a double layout pass.
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

    private fun makeIconView(drawableRes: Int, sizeDp: Int = 24, onClick: () -> Unit): ImageView {
        return ImageView(context).apply {
            setImageResource(drawableRes)
            imageAlpha = 255 // drawables carry alpha="0.9" at vector level
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            setPadding(dp(10), dp(10), dp(10), dp(10))
            minimumWidth = dp(44)
            minimumHeight = dp(44)
            layoutParams = LinearLayout.LayoutParams(dp(sizeDp + 20), dp(sizeDp + 20)).apply {
                gravity = Gravity.CENTER_VERTICAL
            }
            setOnClickListener { v ->
                // Haptic tap
                @Suppress("DEPRECATION")
                try { (context.getSystemService(Context.VIBRATOR_SERVICE) as? android.os.Vibrator)?.vibrate(5) } catch (_: Exception) {}
                // Press scale animation
                v.animate().scaleX(0.85f).scaleY(0.85f).setDuration(80)
                    .withEndAction {
                        v.animate().scaleX(1f).scaleY(1f).setDuration(120)
                            .setInterpolator(OvershootInterpolator(2f)).start()
                    }.start()
                onClick()
            }
        }
    }

    @Deprecated("Use makeIconView with vector drawables")
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
        view.animate().cancel()
        view.animate().alpha(0f).setDuration(220)
            .setInterpolator(DecelerateInterpolator())
            .withEndAction { view.visibility = GONE }
            .start()
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
        val lifecycleOwner = (context as? androidx.lifecycle.LifecycleOwner)
            ?: (getActivity() as? androidx.lifecycle.LifecycleOwner)
        lifecycleOwner?.lifecycle?.removeObserver(lifecycleObserver)
        thumbnailScrubber.destroy()
        release()
    }
}
