/**
 * VaultCalc - Intruder Camera Package
 *
 * Registers IntruderCameraModule with React Native.
 *
 * @see FEATURE_INDEX.md SEC-001
 */

package com.vaultcalcapp.modules.intruder

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class IntruderCameraPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(IntruderCameraModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
