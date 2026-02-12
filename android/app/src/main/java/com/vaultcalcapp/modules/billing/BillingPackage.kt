/**
 * VaultCalc - Billing Package
 *
 * React Native package registration for the BillingModule.
 *
 * @see FEATURE_INDEX.md PREMIUM-002
 */

package com.vaultcalcapp.modules.billing

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Package that registers the BillingModule with React Native.
 */
class BillingPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(BillingModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
