/**
 * VaultCalc - Share Package
 *
 * React Native package registration for the ShareModule.
 *
 * @see FEATURE_INDEX.md ENH-001
 */

package com.vaultcalcapp.modules.share

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Package that registers the ShareModule with React Native.
 */
class SharePackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(ShareModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
