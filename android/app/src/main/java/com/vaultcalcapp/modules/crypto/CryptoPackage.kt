/**
 * VaultCalc - Crypto Package
 *
 * React Native package registration for the CryptoModule.
 *
 * @see FEATURE_INDEX.md CRYPTO-001
 */

package com.vaultcalcapp.modules.crypto

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Package that registers the CryptoModule with React Native.
 */
class CryptoPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(CryptoModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
