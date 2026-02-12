/**
 * VaultCalc - Biometric Package
 *
 * React Native package registration for the BiometricModule.
 *
 * @see FEATURE_INDEX.md BIO-001
 */

package com.vaultcalcapp.modules.biometric

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Package that registers the BiometricModule with React Native.
 */
class BiometricPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(BiometricModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
