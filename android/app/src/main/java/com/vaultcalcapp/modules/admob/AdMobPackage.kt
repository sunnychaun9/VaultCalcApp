/**
 * VaultCalc - AdMob Package
 *
 * React Native package registration for the AdMobModule.
 *
 * @see FEATURE_INDEX.md ADS-001
 */

package com.vaultcalcapp.modules.admob

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AdMobPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(AdMobModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
