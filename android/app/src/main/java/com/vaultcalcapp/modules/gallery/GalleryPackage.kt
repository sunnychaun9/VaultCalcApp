/**
 * VaultCalc - Gallery Package
 *
 * React Native package registration for the GalleryModule.
 *
 * @see FEATURE_INDEX.md GALLERY-001
 */

package com.vaultcalcapp.modules.gallery

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Package that registers the GalleryModule with React Native.
 */
class GalleryPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(GalleryModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
