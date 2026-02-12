/**
 * VaultCalc - Media Package
 *
 * React Native package registration for the MediaModule.
 *
 * @see FEATURE_INDEX.md FILE-003
 */

package com.vaultcalcapp.modules.media

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Package that registers the MediaModule with React Native.
 */
class MediaPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(MediaModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
