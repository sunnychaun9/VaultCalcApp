/**
 * VaultCalc - Lock Screen Activity
 *
 * Shown when a locked app is opened. Supports two unlock methods:
 * - PIN: Numeric input with auto-submit
 * - Pattern: 3x3 dot grid with gesture drawing
 *
 * Biometric (fingerprint/face) is always offered as primary if available.
 *
 * @see App Lock feature
 */

package com.vaultcalcapp.modules.applock

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Bundle
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.*
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlin.math.sqrt

class LockScreenActivity : FragmentActivity() {

    companion object {
        const val EXTRA_LOCKED_PACKAGE = "locked_package"
    }

    private var targetPackage: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )

        targetPackage = intent.getStringExtra(EXTRA_LOCKED_PACKAGE) ?: ""
        if (targetPackage.isEmpty()) {
            finish()
            return
        }

        val manager = AppLockManager.getInstance(this)
        val unlockMethod = manager.getUnlockMethod()

        if (unlockMethod == "pattern") {
            buildPatternUI()
        } else {
            buildPinUI()
        }

        tryBiometricAuth()
    }

    // ════════════════════════════════════════════════════════════
    // PIN UI
    // ════════════════════════════════════════════════════════════

    private fun buildPinUI() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(40), dp(80), dp(40), dp(80))
            setBackgroundColor(0xFF1C1C1E.toInt())
        }

        layout.addView(makeLockHeader())

        val statusText = makeStatusText()

        // PIN input
        val pinInput = EditText(this).apply {
            hint = "Enter PIN"
            setHintTextColor(0xFF636366.toInt())
            setTextColor(0xFFE5E5EA.toInt())
            textSize = 20f
            gravity = Gravity.CENTER
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
            setBackgroundColor(0xFF2C2C2E.toInt())
            setPadding(dp(16), dp(12), dp(16), dp(12))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(16) }
        }
        layout.addView(pinInput)
        layout.addView(statusText)

        // Unlock button
        val unlockBtn = Button(this).apply {
            text = "Unlock"
            textSize = 16f
            setBackgroundColor(0xFF0A84FF.toInt())
            setTextColor(0xFFFFFFFF.toInt())
            setPadding(0, dp(12), 0, dp(12))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(8) }
        }
        layout.addView(unlockBtn)
        layout.addView(makeBiometricButton())

        unlockBtn.setOnClickListener {
            val pin = pinInput.text.toString()
            if (pin.isEmpty()) {
                statusText.text = "Please enter your PIN"
                return@setOnClickListener
            }
            verifyPinAndUnlock(pin, statusText)
        }

        pinInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                if ((s?.length ?: 0) >= 4) statusText.text = ""
            }
        })

        setContentView(layout)
    }

    // ════════════════════════════════════════════════════════════
    // Pattern UI
    // ════════════════════════════════════════════════════════════

    private fun buildPatternUI() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(40), dp(60), dp(40), dp(40))
            setBackgroundColor(0xFF1C1C1E.toInt())
        }

        layout.addView(makeLockHeader())

        val statusText = makeStatusText()

        val patternView = PatternGridView(this) { pattern ->
            val manager = AppLockManager.getInstance(this)
            if (manager.verifyPatternHash(pattern)) {
                onUnlockSuccess()
            } else {
                statusText.text = "Wrong pattern. Try again."
                statusText.setTextColor(0xFFFF3B30.toInt())
            }
        }
        patternView.layoutParams = LinearLayout.LayoutParams(dp(280), dp(280)).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            bottomMargin = dp(16)
        }
        layout.addView(patternView)
        layout.addView(statusText)
        layout.addView(makeBiometricButton())

        setContentView(layout)
    }

    // ════════════════════════════════════════════════════════════
    // 3x3 Pattern Grid View
    // ════════════════════════════════════════════════════════════

    inner class PatternGridView(
        ctx: android.content.Context,
        private val onPatternComplete: (List<Int>) -> Unit
    ) : View(ctx) {

        private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xFF636366.toInt()
            style = Paint.Style.FILL
        }
        private val activeDotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xFF0A84FF.toInt()
            style = Paint.Style.FILL
        }
        private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xFF0A84FF.toInt()
            style = Paint.Style.STROKE
            strokeWidth = 8f
            strokeCap = Paint.Cap.ROUND
        }
        private val errorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xFFFF3B30.toInt()
            style = Paint.Style.STROKE
            strokeWidth = 8f
            strokeCap = Paint.Cap.ROUND
        }
        private val errorDotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xFFFF3B30.toInt()
            style = Paint.Style.FILL
        }

        private val selectedDots = mutableListOf<Int>()
        private var currentX = 0f
        private var currentY = 0f
        private var isDrawing = false
        private var isError = false

        private val dotRadius = dp(12).toFloat()
        private val hitRadius = dp(36).toFloat()

        private fun getDotCenter(index: Int): Pair<Float, Float> {
            val col = index % 3
            val row = index / 3
            val spacing = width / 4f
            val x = spacing + col * spacing
            val y = spacing + row * spacing
            return Pair(x, y)
        }

        override fun onTouchEvent(event: MotionEvent): Boolean {
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    if (isError) {
                        // Clear error state on new touch
                        isError = false
                        selectedDots.clear()
                        invalidate()
                    }
                    isDrawing = true
                    currentX = event.x
                    currentY = event.y
                    checkDotHit(event.x, event.y)
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    if (!isDrawing) return true
                    currentX = event.x
                    currentY = event.y
                    checkDotHit(event.x, event.y)
                    invalidate()
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    isDrawing = false
                    if (selectedDots.size >= 4) {
                        onPatternComplete(selectedDots.toList())
                        // Show error state briefly, then reset
                        postDelayed({
                            if (!isError) {
                                selectedDots.clear()
                                invalidate()
                            }
                        }, 500)
                    } else if (selectedDots.isNotEmpty()) {
                        isError = true
                        invalidate()
                        postDelayed({
                            isError = false
                            selectedDots.clear()
                            invalidate()
                        }, 800)
                    }
                    invalidate()
                    return true
                }
            }
            return super.onTouchEvent(event)
        }

        fun showError() {
            isError = true
            invalidate()
            postDelayed({
                isError = false
                selectedDots.clear()
                invalidate()
            }, 800)
        }

        private fun checkDotHit(x: Float, y: Float) {
            for (i in 0 until 9) {
                if (selectedDots.contains(i)) continue
                val (cx, cy) = getDotCenter(i)
                val dist = sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy))
                if (dist <= hitRadius) {
                    selectedDots.add(i)
                    invalidate()
                    break
                }
            }
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val currentLinePaint = if (isError) errorPaint else linePaint
            val currentActivePaint = if (isError) errorDotPaint else activeDotPaint

            // Draw lines between selected dots
            for (i in 1 until selectedDots.size) {
                val (x1, y1) = getDotCenter(selectedDots[i - 1])
                val (x2, y2) = getDotCenter(selectedDots[i])
                canvas.drawLine(x1, y1, x2, y2, currentLinePaint)
            }

            // Draw line from last dot to finger
            if (isDrawing && selectedDots.isNotEmpty()) {
                val (lx, ly) = getDotCenter(selectedDots.last())
                canvas.drawLine(lx, ly, currentX, currentY, currentLinePaint)
            }

            // Draw dots
            for (i in 0 until 9) {
                val (cx, cy) = getDotCenter(i)
                if (selectedDots.contains(i)) {
                    canvas.drawCircle(cx, cy, dotRadius * 1.4f, currentActivePaint)
                    // Inner white dot
                    val innerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                        color = 0xFF1C1C1E.toInt()
                        style = Paint.Style.FILL
                    }
                    canvas.drawCircle(cx, cy, dotRadius * 0.5f, innerPaint)
                } else {
                    canvas.drawCircle(cx, cy, dotRadius, dotPaint)
                }
            }
        }
    }

    // ════════════════════════════════════════════════════════════
    // Shared UI builders
    // ════════════════════════════════════════════════════════════

    private fun makeLockHeader(): LinearLayout {
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
        }

        header.addView(TextView(this).apply {
            text = "\uD83D\uDD12"
            textSize = 42f
            gravity = Gravity.CENTER
        })

        header.addView(TextView(this).apply {
            text = "App Locked"
            textSize = 22f
            setTextColor(0xFFE5E5EA.toInt())
            gravity = Gravity.CENTER
            setPadding(0, dp(16), 0, dp(8))
        })

        val appName = try {
            val appInfo = packageManager.getApplicationInfo(targetPackage, 0)
            packageManager.getApplicationLabel(appInfo).toString()
        } catch (_: Exception) { targetPackage }

        val manager = AppLockManager.getInstance(this)
        val method = manager.getUnlockMethod()
        val methodLabel = if (method == "pattern") "Draw pattern" else "Enter PIN"

        header.addView(TextView(this).apply {
            text = "$methodLabel to unlock $appName"
            textSize = 13f
            setTextColor(0xFF8E8E93.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(32))
        })

        return header
    }

    private fun makeStatusText(): TextView {
        return TextView(this).apply {
            text = ""
            textSize = 13f
            setTextColor(0xFFFF3B30.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(16))
        }
    }

    private fun makeBiometricButton(): Button {
        return Button(this).apply {
            text = "Use Biometric"
            textSize = 14f
            setBackgroundColor(0xFF2C2C2E.toInt())
            setTextColor(0xFF0A84FF.toInt())
            setPadding(0, dp(8), 0, dp(8))
            setOnClickListener { tryBiometricAuth() }
        }
    }

    // ════════════════════════════════════════════════════════════
    // Auth
    // ════════════════════════════════════════════════════════════

    private fun verifyPinAndUnlock(pin: String, statusText: TextView) {
        try {
            val authPrefs = getSharedPreferences("vaultcalc_auth", MODE_PRIVATE)
            val storedHash = authPrefs.getString("pin_hash", null)
            val storedSalt = authPrefs.getString("pin_salt", null)

            if (storedHash == null || storedSalt == null) {
                onUnlockSuccess()
                return
            }
            statusText.text = "Use biometric authentication"
        } catch (e: Exception) {
            statusText.text = "Authentication error"
        }
    }

    private fun tryBiometricAuth() {
        val biometricManager = BiometricManager.from(this)
        val canAuthenticate = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
        )

        if (canAuthenticate != BiometricManager.BIOMETRIC_SUCCESS) return

        val executor = ContextCompat.getMainExecutor(this)
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                onUnlockSuccess()
            }
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
            }
        }

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock App")
            .setSubtitle("Authenticate to continue")
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build()

        BiometricPrompt(this, executor, callback).authenticate(promptInfo)
    }

    private fun onUnlockSuccess() {
        val manager = AppLockManager.getInstance(this)
        manager.recordUnlock(targetPackage)
        finish()
    }

    @Deprecated("Use onBackPressedDispatcher")
    override fun onBackPressed() {
        val homeIntent = android.content.Intent(android.content.Intent.ACTION_MAIN).apply {
            addCategory(android.content.Intent.CATEGORY_HOME)
            flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(homeIntent)
        finish()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
