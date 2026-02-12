/**
 * VaultCalc - PDF Package
 *
 * React Native package registration for the PdfModule.
 *
 * @see FEATURE_INDEX.md DOC-003
 */

package com.vaultcalcapp.modules.pdf

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Package that registers the PdfModule with React Native.
 */
class PdfPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(PdfModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
