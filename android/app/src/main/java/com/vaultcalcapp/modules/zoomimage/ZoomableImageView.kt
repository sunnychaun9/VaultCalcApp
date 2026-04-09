/**
 * VaultCalc - Native Zoomable Image View
 *
 * High-performance pinch-to-zoom image viewer using Android's native
 * ScaleGestureDetector + GestureDetector for buttery smooth 60fps.
 *
 * Features:
 * - Pinch to zoom (1x → 5x) with real multi-touch
 * - Double tap to zoom toggle (1x ↔ 2.5x)
 * - Pan/drag when zoomed in
 * - Smooth spring-like bounce back to bounds
 * - Focal point zoom (zooms into the pinch center)
 *
 * @see VAULT-005
 */

package com.vaultcalcapp.modules.zoomimage

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Matrix
import android.graphics.PointF
import android.graphics.drawable.Drawable
import android.net.Uri
import android.util.AttributeSet
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import java.io.File
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

@SuppressLint("ViewConstructor")
class ZoomableImageView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : FrameLayout(context, attrs, defStyleAttr) {

    private val imageView: ImageView
    private val imageMatrix = Matrix()
    private val matrixValues = FloatArray(9)

    // Gesture detectors
    private val scaleDetector: ScaleGestureDetector
    private val gestureDetector: GestureDetector

    // State
    private var currentScale = 1f
    private var minScale = 1f
    private var maxScale = 5f
    private val doubleTapScale = 2.5f

    // Translation bounds
    private var imageWidth = 0f
    private var imageHeight = 0f
    private var viewWidth = 0f
    private var viewHeight = 0f

    // Pan tracking
    private var lastTouchX = 0f
    private var lastTouchY = 0f
    private var activePointerId = -1
    private var isScaling = false

    // Fling tracking
    private var currentAnimator: ValueAnimator? = null

    init {
        imageView = ImageView(context).apply {
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            scaleType = ImageView.ScaleType.MATRIX
        }
        addView(imageView)

        scaleDetector = ScaleGestureDetector(context, ScaleListener())
        gestureDetector = GestureDetector(context, GestureListener())

        // Disable long press to avoid interfering with gestures
        gestureDetector.setIsLongpressEnabled(false)
    }

    fun setImageUri(uri: String?) {
        if (uri == null) return
        try {
            if (uri.startsWith("file://") || uri.startsWith("/")) {
                val filePath = uri.removePrefix("file://")
                val file = File(filePath)
                if (file.exists()) {
                    imageView.setImageURI(Uri.fromFile(file))
                }
            } else {
                imageView.setImageURI(Uri.parse(uri))
            }
            // Reset zoom on new image
            post { resetToFit() }
        } catch (_: Exception) {}
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        viewWidth = w.toFloat()
        viewHeight = h.toFloat()
        resetToFit()
    }

    private fun resetToFit() {
        val drawable = imageView.drawable ?: return
        imageWidth = drawable.intrinsicWidth.toFloat()
        imageHeight = drawable.intrinsicHeight.toFloat()
        if (imageWidth == 0f || imageHeight == 0f || viewWidth == 0f || viewHeight == 0f) return

        // Calculate scale to fit image in view
        val scaleX = viewWidth / imageWidth
        val scaleY = viewHeight / imageHeight
        val fitScale = min(scaleX, scaleY)

        minScale = fitScale
        currentScale = fitScale

        // Center the image
        val dx = (viewWidth - imageWidth * fitScale) / 2f
        val dy = (viewHeight - imageHeight * fitScale) / 2f

        imageMatrix.reset()
        imageMatrix.postScale(fitScale, fitScale)
        imageMatrix.postTranslate(dx, dy)
        imageView.imageMatrix = imageMatrix
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleDetector.onTouchEvent(event)
        gestureDetector.onTouchEvent(event)

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                cancelAnimation()
                activePointerId = event.getPointerId(0)
                lastTouchX = event.x
                lastTouchY = event.y
                // Only steal touches from parent pager when zoomed in;
                // at min scale, let parent handle horizontal swipe navigation
                val isZoomed = currentScale > minScale * 1.01f
                parent?.requestDisallowInterceptTouchEvent(isZoomed)
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                // When second finger goes down, update tracking to avoid jumps
                if (event.pointerCount >= 2) {
                    val idx = event.actionIndex
                    activePointerId = event.getPointerId(idx)
                    lastTouchX = event.getX(idx)
                    lastTouchY = event.getY(idx)
                }
            }
            MotionEvent.ACTION_MOVE -> {
                if (!isScaling && currentScale > minScale * 1.01f) {
                    val pointerIndex = event.findPointerIndex(activePointerId)
                    if (pointerIndex >= 0) {
                        val x = event.getX(pointerIndex)
                        val y = event.getY(pointerIndex)
                        val dx = x - lastTouchX
                        val dy = y - lastTouchY

                        // Check if the image has hit a horizontal edge;
                        // if so, let the parent pager handle the swipe
                        val bounds = getScaledImageBounds()
                        val transX = bounds[0]
                        val scaledW = bounds[2]
                        val atLeftEdge = transX >= -0.5f
                        val atRightEdge = transX + scaledW <= viewWidth + 0.5f

                        if ((atLeftEdge && dx > 0) || (atRightEdge && dx < 0)) {
                            parent?.requestDisallowInterceptTouchEvent(false)
                        } else {
                            parent?.requestDisallowInterceptTouchEvent(true)
                        }

                        translateImage(dx, dy)

                        lastTouchX = x
                        lastTouchY = y
                    }
                }
            }
            MotionEvent.ACTION_POINTER_UP -> {
                val pointerIndex = event.actionIndex
                val pointerId = event.getPointerId(pointerIndex)
                if (pointerId == activePointerId) {
                    // Active pointer went up, switch to another pointer
                    val newIndex = if (pointerIndex == 0) 1 else 0
                    if (newIndex < event.pointerCount) {
                        activePointerId = event.getPointerId(newIndex)
                        lastTouchX = event.getX(newIndex)
                        lastTouchY = event.getY(newIndex)
                    }
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                activePointerId = -1
                isScaling = false
                snapToBounds()
                // Allow parent to intercept if at min scale
                if (currentScale <= minScale * 1.01f) {
                    parent?.requestDisallowInterceptTouchEvent(false)
                }
            }
        }
        return true
    }

    private fun translateImage(dx: Float, dy: Float) {
        imageMatrix.postTranslate(dx, dy)
        imageView.imageMatrix = imageMatrix
    }

    private fun getScaledImageBounds(): FloatArray {
        imageMatrix.getValues(matrixValues)
        val transX = matrixValues[Matrix.MTRANS_X]
        val transY = matrixValues[Matrix.MTRANS_Y]
        val scaleX = matrixValues[Matrix.MSCALE_X]
        val scaleY = matrixValues[Matrix.MSCALE_Y]
        val scaledW = imageWidth * scaleX
        val scaledH = imageHeight * scaleY
        return floatArrayOf(transX, transY, scaledW, scaledH)
    }

    private fun snapToBounds() {
        // If below min scale, animate back
        if (currentScale < minScale) {
            animateToScale(minScale, viewWidth / 2f, viewHeight / 2f)
            return
        }
        if (currentScale > maxScale) {
            animateToScale(maxScale, viewWidth / 2f, viewHeight / 2f)
            return
        }

        val bounds = getScaledImageBounds()
        val transX = bounds[0]
        val transY = bounds[1]
        val scaledW = bounds[2]
        val scaledH = bounds[3]

        var fixX = 0f
        var fixY = 0f

        // Horizontal bounds
        if (scaledW <= viewWidth) {
            // Center horizontally
            fixX = (viewWidth - scaledW) / 2f - transX
        } else {
            if (transX > 0) fixX = -transX
            else if (transX + scaledW < viewWidth) fixX = viewWidth - (transX + scaledW)
        }

        // Vertical bounds
        if (scaledH <= viewHeight) {
            // Center vertically
            fixY = (viewHeight - scaledH) / 2f - transY
        } else {
            if (transY > 0) fixY = -transY
            else if (transY + scaledH < viewHeight) fixY = viewHeight - (transY + scaledH)
        }

        if (abs(fixX) > 0.5f || abs(fixY) > 0.5f) {
            animateTranslation(fixX, fixY)
        }
    }

    private fun animateTranslation(dx: Float, dy: Float) {
        cancelAnimation()
        currentAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 250
            interpolator = DecelerateInterpolator(2f)
            var lastFraction = 0f
            addUpdateListener { anim ->
                val fraction = anim.animatedValue as Float
                val stepDx = dx * (fraction - lastFraction)
                val stepDy = dy * (fraction - lastFraction)
                lastFraction = fraction
                imageMatrix.postTranslate(stepDx, stepDy)
                imageView.imageMatrix = imageMatrix
            }
            start()
        }
    }

    private fun animateToScale(targetScale: Float, focusX: Float, focusY: Float) {
        cancelAnimation()
        val startScale = currentScale
        currentAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 300
            interpolator = DecelerateInterpolator(2f)
            var lastAnimScale = startScale
            addUpdateListener { anim ->
                val fraction = anim.animatedValue as Float
                val newScale = startScale + (targetScale - startScale) * fraction
                val scaleFactor = newScale / lastAnimScale
                lastAnimScale = newScale
                currentScale = newScale
                imageMatrix.postScale(scaleFactor, scaleFactor, focusX, focusY)
                imageView.imageMatrix = imageMatrix
            }
            addListener(object : android.animation.AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: android.animation.Animator) {
                    snapToBounds()
                }
            })
            start()
        }
    }

    private fun cancelAnimation() {
        currentAnimator?.cancel()
        currentAnimator = null
    }

    // ── Scale gesture listener ──

    inner class ScaleListener : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScaleBegin(detector: ScaleGestureDetector): Boolean {
            isScaling = true
            parent?.requestDisallowInterceptTouchEvent(true)
            return true
        }

        override fun onScale(detector: ScaleGestureDetector): Boolean {
            val scaleFactor = detector.scaleFactor
            val newScale = currentScale * scaleFactor

            // Allow slight over-zoom for rubber-band feel, clamp later
            if (newScale in (minScale * 0.5f)..(maxScale * 1.3f)) {
                currentScale = newScale
                imageMatrix.postScale(
                    scaleFactor, scaleFactor,
                    detector.focusX, detector.focusY
                )
                imageView.imageMatrix = imageMatrix
            }
            return true
        }

        override fun onScaleEnd(detector: ScaleGestureDetector) {
            isScaling = false
        }
    }

    // ── Gesture listener (double-tap) ──

    private fun sendEvent(eventName: String) {
        val reactContext = context as? ReactContext ?: return
        reactContext.getJSModule(RCTEventEmitter::class.java)
            .receiveEvent(id, eventName, Arguments.createMap())
    }

    inner class GestureListener : GestureDetector.SimpleOnGestureListener() {
        override fun onDoubleTap(e: MotionEvent): Boolean {
            cancelAnimation()
            val targetScale = if (currentScale > minScale * 1.5f) {
                minScale // Zoom out to fit
            } else {
                minScale * doubleTapScale // Zoom in
            }
            animateToScale(targetScale, e.x, e.y)
            return true
        }

        override fun onSingleTapConfirmed(e: MotionEvent): Boolean {
            sendEvent("onSingleTap")
            return true
        }

        override fun onDown(e: MotionEvent): Boolean = true
    }
}
