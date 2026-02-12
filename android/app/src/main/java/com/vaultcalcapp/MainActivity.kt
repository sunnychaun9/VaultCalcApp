package com.vaultcalcapp

import android.os.Bundle
import android.view.WindowManager
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

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

    // FLAG_SECURE prevents:
    // 1. Recents/task-switcher thumbnail — shows blank instead of vault contents
    // 2. Screenshots — blocked system-wide while this Activity is visible
    // 3. Screen recording — frames from this Activity appear black
    // 4. Smart Select / assistant overlays — cannot read window content
    //
    // This is set unconditionally because even the calculator screen benefits
    // from appearing blank in recents (avoids drawing attention to the app).
    window.setFlags(
      WindowManager.LayoutParams.FLAG_SECURE,
      WindowManager.LayoutParams.FLAG_SECURE
    )
  }
}
