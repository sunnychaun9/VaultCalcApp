/**
 * VaultCalc - Vault Camera View Manager
 *
 * React Native ViewManager that creates and manages VaultCameraView instances.
 * The native PreviewView is rendered inline in the React Native layout.
 */

package com.vaultcalcapp.modules.camera

import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

class VaultCameraViewManager : SimpleViewManager<VaultCameraView>() {

    companion object {
        const val REACT_CLASS = "VaultCameraPreview"
    }

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): VaultCameraView {
        val view = VaultCameraView(reactContext)
        // Register the view so VaultCameraModule can reference it
        VaultCameraModule.activeView = view
        view.startCamera(reactContext)
        return view
    }

    override fun onDropViewInstance(view: VaultCameraView) {
        if (VaultCameraModule.activeView === view) {
            VaultCameraModule.activeView = null
        }
        view.release()
        super.onDropViewInstance(view)
    }
}
