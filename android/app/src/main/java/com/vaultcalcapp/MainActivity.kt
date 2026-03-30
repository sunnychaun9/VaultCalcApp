package com.vaultcalcapp

import android.os.Bundle
import android.view.KeyEvent
import android.view.WindowManager
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.vaultcalcapp.modules.panic.PanicModule

class MainActivity : ReactActivity() {

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
    // Must be called BEFORE super.onCreate() — configures the splash screen
    // and transitions to postSplashScreenTheme (AppTheme) on first draw.
    installSplashScreen()

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
}
