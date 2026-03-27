/**
 * VaultCalc - Zoomable Image Package
 *
 * Registers the native ZoomableImageView with React Native.
 *
 * @see VAULT-005
 */

package com.vaultcalcapp.modules.zoomimage

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ZoomableImagePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return emptyList()
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(ZoomableImageViewManager())
    }
}
