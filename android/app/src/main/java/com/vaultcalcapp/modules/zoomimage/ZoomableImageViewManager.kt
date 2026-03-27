/**
 * VaultCalc - Zoomable Image View Manager
 *
 * React Native ViewManager for the native ZoomableImageView.
 *
 * @see VAULT-005
 */

package com.vaultcalcapp.modules.zoomimage

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class ZoomableImageViewManager : SimpleViewManager<ZoomableImageView>() {

    companion object {
        const val REACT_CLASS = "ZoomableImageView"
    }

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): ZoomableImageView {
        return ZoomableImageView(reactContext)
    }

    @ReactProp(name = "uri")
    fun setUri(view: ZoomableImageView, uri: String?) {
        view.setImageUri(uri)
    }
}
