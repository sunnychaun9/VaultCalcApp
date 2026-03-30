package com.vaultcalcapp.modules.uninstallprotect

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.*

class UninstallProtectModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "UninstallProtectModule"

    private fun getAdminComponent(): ComponentName {
        return ComponentName(reactApplicationContext, VaultDeviceAdminReceiver::class.java)
    }

    private fun getDpm(): DevicePolicyManager {
        return reactApplicationContext.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    }

    /**
     * Check if device admin is currently active (uninstall protection ON).
     */
    @ReactMethod
    fun isEnabled(promise: Promise) {
        try {
            val active = getDpm().isAdminActive(getAdminComponent())
            promise.resolve(active)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Request device admin activation. Opens the system dialog.
     */
    @ReactMethod
    fun requestEnable(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "No activity available")
                return
            }
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, getAdminComponent())
                putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "Enable to prevent accidental uninstallation. " +
                    "Your hidden files will be lost if VaultCalc is uninstalled."
                )
            }
            activity.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("REQUEST_ERROR", e.message, e)
        }
    }

    /**
     * Deactivate device admin (allows uninstall again).
     */
    @ReactMethod
    fun disable(promise: Promise) {
        try {
            val dpm = getDpm()
            val admin = getAdminComponent()
            if (dpm.isAdminActive(admin)) {
                dpm.removeActiveAdmin(admin)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DISABLE_ERROR", e.message, e)
        }
    }
}
