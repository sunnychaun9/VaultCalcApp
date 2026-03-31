/**
 * VaultCalc — Fake Crash Screen
 *
 * Full-screen translucent Activity that mimics the native Android
 * "App keeps stopping" system dialog (Material You / Android 12+ style).
 *
 * Button behaviour:
 *   • "App info"      → opens the real App Info settings page
 *   • "Close app"     → moves the task to back (minimises)
 *   • "Send feedback" → silently dismisses the dialog
 *
 * The Activity intercepts back press and touches outside the card
 * so the user cannot escape without using one of the three buttons.
 *
 * Supports Android 10 – 14 (API 29 – 34).
 */

package com.vaultcalcapp.modules.fakecrash

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.WindowManager
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import com.vaultcalcapp.R

class FakeCrashActivity : AppCompatActivity() {

    companion object {
        private const val EXTRA_APP_LABEL = "extra_app_label"

        /**
         * Launch the fake crash screen from any Context.
         * @param context  Activity or Application context
         * @param appLabel Display name shown in the crash message (defaults to "VaultCalc")
         */
        fun show(context: Context, appLabel: String = "VaultCalc") {
            val intent = Intent(context, FakeCrashActivity::class.java).apply {
                putExtra(EXTRA_APP_LABEL, appLabel)
                // Required when launching from non-Activity context
                if (context !is Activity) {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            }
            context.startActivity(intent)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Make status bar / nav bar transparent so overlay looks system-level
        window.setFlags(
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        )

        setContentView(R.layout.dialog_fake_crash)

        // Fade-in entrance animation
        overridePendingTransition(R.anim.fake_crash_fade_in, 0)

        // Resolve app label
        val appLabel = intent.getStringExtra(EXTRA_APP_LABEL) ?: getApplicationLabel()

        // Bind views
        val tvMessage = findViewById<TextView>(R.id.tvCrashMessage)
        val btnAppInfo = findViewById<TextView>(R.id.btnAppInfo)
        val btnCloseApp = findViewById<TextView>(R.id.btnCloseApp)
        val btnSendFeedback = findViewById<TextView>(R.id.btnSendFeedback)

        tvMessage.text = "$appLabel keeps stopping"

        // --- Button handlers ---

        btnAppInfo.setOnClickListener {
            openAppInfo()
            dismissWithAnimation()
        }

        btnCloseApp.setOnClickListener {
            // Minimise the app — moves the entire task to background
            dismissWithAnimation()
            moveTaskToBack(true)
        }

        btnSendFeedback.setOnClickListener {
            dismissWithAnimation()
        }

        // Block back button so user must use the dialog buttons
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Swallow — do nothing
            }
        })
    }

    /** Resolve the app's user-visible label from PackageManager. */
    private fun getApplicationLabel(): String {
        return try {
            val pm = packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (_: Exception) {
            "App"
        }
    }

    /** Open the real system "App info" settings screen. */
    private fun openAppInfo() {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
        } catch (_: Exception) {
            // Fallback: open general app settings
            startActivity(Intent(Settings.ACTION_APPLICATION_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        }
    }

    /** Finish with a matching fade-out animation. */
    private fun dismissWithAnimation() {
        finish()
        overridePendingTransition(0, R.anim.fake_crash_fade_out)
    }
}
