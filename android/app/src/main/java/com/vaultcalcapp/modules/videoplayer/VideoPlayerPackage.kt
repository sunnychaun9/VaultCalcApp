/**
 * VaultCalc - Video Player Package
 *
 * React Native package registration for the video player native view and module.
 *
 * @see FEATURE_INDEX.md VIDEO-010
 */

package com.vaultcalcapp.modules.videoplayer

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

@androidx.media3.common.util.UnstableApi
class VideoPlayerPackage : ReactPackage {

    @Suppress("DEPRECATION")
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(VideoPlayerModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(VaultVideoPlayerViewManager())
    }
}
