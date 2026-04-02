package com.vaultcalcapp

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.FrameLayout
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.vaultcalcapp.modules.panic.PanicModule
import com.vaultcalcapp.modules.permission.PermissionManager

class MainActivity : ReactActivity() {

  /** Centralized permission manager — registered before super.onCreate(). */
  val permissionManager = PermissionManager()

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "VaultCalcApp"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    // Register Activity Result launchers BEFORE super.onCreate()
    // (ActivityResultLauncher must be registered during initialization)
    permissionManager.register(this)

    // Must be called BEFORE super.onCreate() — configures the splash screen
    // and transitions to postSplashScreenTheme (AppTheme) on first draw.
    val splashScreen = installSplashScreen()

    // Premium exit animation: scale + light sweep + particle glow + haptic
    splashScreen.setOnExitAnimationListener { splashScreenView ->
      val iconView = splashScreenView.iconView
      val container = splashScreenView.view

      // ── 1. Haptic tick — single subtle confirmation ──
      triggerSplashHaptic()

      // ── 2. Light reflection sweep over the icon ──
      if (iconView != null && container is FrameLayout) {
        val sweep = LightSweepView(this@MainActivity)
        val iconLp = iconView.layoutParams as? FrameLayout.LayoutParams
        if (iconLp != null) {
          sweep.layoutParams = FrameLayout.LayoutParams(iconLp.width, iconLp.height).apply {
            gravity = iconLp.gravity
            topMargin = iconLp.topMargin
            bottomMargin = iconLp.bottomMargin
            marginStart = iconLp.marginStart
            marginEnd = iconLp.marginEnd
          }
        } else {
          sweep.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
          )
        }
        container.addView(sweep)
        sweep.startSweep(500)

        // ── 3. Subtle particle glow dots ──
        val glow = ParticleGlowView(this@MainActivity)
        glow.layoutParams = FrameLayout.LayoutParams(
          FrameLayout.LayoutParams.MATCH_PARENT,
          FrameLayout.LayoutParams.MATCH_PARENT
        )
        container.addView(glow)
        glow.startGlow(600)
      }

      // ── 4. Icon scale up ──
      if (iconView != null) {
        ObjectAnimator.ofFloat(iconView, "scaleX", 1f, 1.08f).apply {
          duration = 400
          interpolator = AccelerateDecelerateInterpolator()
          start()
        }
        ObjectAnimator.ofFloat(iconView, "scaleY", 1f, 1.08f).apply {
          duration = 400
          interpolator = AccelerateDecelerateInterpolator()
          start()
        }
      }

      // ── 5. Full view fade out ──
      ObjectAnimator.ofFloat(container, "alpha", 1f, 0f).apply {
        duration = 350
        startDelay = 250
        interpolator = AccelerateDecelerateInterpolator()
        addListener(object : android.animation.AnimatorListenerAdapter() {
          override fun onAnimationEnd(animation: android.animation.Animator) {
            splashScreenView.remove()
          }
        })
        start()
      }
    }

    super.onCreate(savedInstanceState)

    // FLAG_SECURE prevents screenshots, recents thumbnails, screen recording.
    // Controlled via BuildConfig.ENABLE_FLAG_SECURE so test builds allow screenshots.
    // Production Play Store builds should set this to true.
    if (BuildConfig.ENABLE_FLAG_SECURE) {
      window.setFlags(
        WindowManager.LayoutParams.FLAG_SECURE,
        WindowManager.LayoutParams.FLAG_SECURE
      )
    }
  }

  /**
   * Intercept key events to detect volume-down triple press for panic mode.
   * Only ACTION_DOWN events are tracked. If PanicManager doesn't consume
   * the event, it passes through to the default handler (volume change).
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (event.keyCode == KeyEvent.KEYCODE_VOLUME_DOWN && event.action == KeyEvent.ACTION_DOWN) {
      val consumed = PanicModule.instance?.onVolumeDownPressed() ?: false
      if (consumed) return true
    }
    return super.dispatchKeyEvent(event)
  }

  /** Single subtle haptic tick on splash exit. */
  @Suppress("DEPRECATION")
  private fun triggerSplashHaptic() {
    try {
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
        val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vm?.defaultVibrator?.vibrate(VibrationEffect.createOneShot(15, VibrationEffect.DEFAULT_AMPLITUDE))
      } else {
        val v = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
          v?.vibrate(VibrationEffect.createOneShot(15, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
          v?.vibrate(15)
        }
      }
    } catch (_: Exception) {}
  }

  // ════════════════════════════════════════════════════════════
  // Light sweep overlay — diagonal white gradient slides across
  // the icon area from left to right once.
  // ════════════════════════════════════════════════════════════
  private class LightSweepView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var sweepProgress = -0.3f // starts off-screen left

    init {
      setLayerType(LAYER_TYPE_HARDWARE, null) // GPU-accelerated
    }

    fun startSweep(durationMs: Long) {
      ValueAnimator.ofFloat(-0.3f, 1.3f).apply {
        duration = durationMs
        interpolator = AccelerateDecelerateInterpolator()
        addUpdateListener {
          sweepProgress = it.animatedValue as Float
          invalidate()
        }
        addListener(object : android.animation.AnimatorListenerAdapter() {
          override fun onAnimationEnd(animation: android.animation.Animator) {
            visibility = GONE
          }
        })
        start()
      }
    }

    override fun onDraw(canvas: Canvas) {
      super.onDraw(canvas)
      val w = width.toFloat()
      val h = height.toFloat()
      if (w <= 0 || h <= 0) return

      val center = w * sweepProgress
      val bandWidth = w * 0.25f

      paint.shader = LinearGradient(
        center - bandWidth, 0f, center + bandWidth, 0f,
        intArrayOf(
          Color.TRANSPARENT,
          Color.argb(18, 255, 255, 255),  // 7% white
          Color.argb(35, 255, 255, 255),  // 14% white peak
          Color.argb(18, 255, 255, 255),
          Color.TRANSPARENT,
        ),
        floatArrayOf(0f, 0.3f, 0.5f, 0.7f, 1f),
        Shader.TileMode.CLAMP,
      )
      canvas.drawRect(0f, 0f, w, h, paint)
    }
  }

  // ════════════════════════════════════════════════════════════
  // Particle glow — 5 tiny dots that fade in and drift outward
  // from the center. Very minimal, not flashy.
  // ════════════════════════════════════════════════════════════
  private class ParticleGlowView(context: Context) : View(context) {
    private data class Particle(
      val offsetX: Float,  // -1..1 relative to center
      val offsetY: Float,
      val radius: Float,
      val alpha: Float,
    )

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val particles = listOf(
      Particle(-0.12f, -0.15f, 3f, 0.5f),
      Particle(0.18f, -0.10f, 2.5f, 0.4f),
      Particle(-0.08f, 0.20f, 2f, 0.35f),
      Particle(0.15f, 0.14f, 3f, 0.45f),
      Particle(-0.20f, 0.05f, 2f, 0.3f),
    )
    private var progress = 0f

    fun startGlow(durationMs: Long) {
      ValueAnimator.ofFloat(0f, 1f).apply {
        duration = durationMs
        interpolator = AccelerateDecelerateInterpolator()
        addUpdateListener {
          progress = it.animatedValue as Float
          invalidate()
        }
        addListener(object : android.animation.AnimatorListenerAdapter() {
          override fun onAnimationEnd(animation: android.animation.Animator) {
            visibility = GONE
          }
        })
        start()
      }
    }

    override fun onDraw(canvas: Canvas) {
      super.onDraw(canvas)
      val cx = width / 2f
      val cy = height / 2f
      if (cx <= 0) return

      // Fade in during 0-0.4, fade out during 0.6-1.0
      val alphaMultiplier = when {
        progress < 0.4f -> progress / 0.4f
        progress > 0.6f -> 1f - (progress - 0.6f) / 0.4f
        else -> 1f
      }

      // Particles drift outward slightly (1.0 → 1.15 scale)
      val drift = 1f + progress * 0.15f

      for (p in particles) {
        val px = cx + p.offsetX * width * drift
        val py = cy + p.offsetY * height * drift
        val r = p.radius * resources.displayMetrics.density

        paint.color = Color.argb(
          (p.alpha * alphaMultiplier * 255).toInt().coerceIn(0, 255),
          200, 220, 255,  // cool white-blue tint
        )
        // Outer glow
        paint.alpha = (p.alpha * alphaMultiplier * 80).toInt().coerceIn(0, 255)
        canvas.drawCircle(px, py, r * 3f, paint)
        // Core dot
        paint.alpha = (p.alpha * alphaMultiplier * 255).toInt().coerceIn(0, 255)
        canvas.drawCircle(px, py, r, paint)
      }
    }
  }
}
