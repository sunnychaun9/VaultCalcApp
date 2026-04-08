package com.vaultcalcapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.vaultcalcapp.modules.admob.AdMobPackage
import com.vaultcalcapp.modules.billing.BillingPackage
import com.vaultcalcapp.modules.biometric.BiometricPackage
import com.vaultcalcapp.modules.crypto.CryptoPackage
import com.vaultcalcapp.modules.gallery.GalleryPackage
import com.vaultcalcapp.modules.intruder.IntruderCameraPackage
import com.vaultcalcapp.modules.media.MediaPackage
import com.vaultcalcapp.modules.pdf.PdfPackage
import com.vaultcalcapp.modules.security.AppSecurityPackage
import com.vaultcalcapp.modules.shake.ShakeDetectorPackage
import com.vaultcalcapp.modules.share.SharePackage
import com.vaultcalcapp.modules.appicon.AppIconPackage
import com.vaultcalcapp.modules.applock.AppLockPackage
import com.vaultcalcapp.modules.panic.PanicPackage
import com.vaultcalcapp.modules.stealth.StealthPackage
import com.vaultcalcapp.modules.notificationprivacy.NotificationPrivacyPackage
import com.vaultcalcapp.modules.videoplayer.VideoPlayerPackage
import com.vaultcalcapp.modules.orientation.OrientationPackage
import com.vaultcalcapp.modules.uninstallprotect.UninstallProtectPackage
import com.vaultcalcapp.modules.zoomimage.ZoomableImagePackage
import com.vaultcalcapp.modules.fakecrash.FakeCrashPackage
import com.vaultcalcapp.modules.review.InAppReviewPackage
import com.vaultcalcapp.modules.localnotif.LocalNotifPackage
import com.vaultcalcapp.modules.permission.PermissionPackage
import expo.modules.ApplicationLifecycleDispatcher

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Custom native modules
          add(AdMobPackage())
          add(BillingPackage())
          add(BiometricPackage())
          add(CryptoPackage())
          add(GalleryPackage())
          add(IntruderCameraPackage())
          add(MediaPackage())
          add(PdfPackage())
          add(AppSecurityPackage())
          add(ShakeDetectorPackage())
          add(SharePackage())
          add(AppIconPackage())
          add(AppLockPackage())
          add(PanicPackage())
          add(StealthPackage())
          add(NotificationPrivacyPackage())
          add(VideoPlayerPackage())
          add(OrientationPackage())
          add(UninstallProtectPackage())
          add(ZoomableImagePackage())
          add(FakeCrashPackage())
          add(InAppReviewPackage())
          add(LocalNotifPackage())
          add(PermissionPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
    loadReactNative(this)
  }
}
