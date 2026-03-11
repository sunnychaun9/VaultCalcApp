/**
 * VaultCalc - Notification Privacy Package
 *
 * Registers NotificationPrivacyModule with React Native.
 *
 * @see Notification Privacy feature
 */

package com.vaultcalcapp.modules.notificationprivacy

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class NotificationPrivacyPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(NotificationPrivacyModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
