/**
 * VaultCalc - Shake Detector Package
 *
 * React Native package registration for the ShakeDetectorModule.
 *
 * @see FEATURE_INDEX.md ENH-005
 */

package com.vaultcalcapp.modules.shake

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Package that registers the ShakeDetectorModule with React Native.
 */
class ShakeDetectorPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(ShakeDetectorModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
