/**
 * VaultCalc - Permission Native Module (React Native Bridge)
 *
 * Exposes [PermissionManager] to JavaScript via React Native's bridge.
 * Provides check, request, and requestMultiple methods that return
 * promise-based results to the JS layer.
 *
 * This replaces scattered PermissionsAndroid.request() calls on the JS side
 * with a centralized native flow that uses the Activity Result API and
 * shows rationale dialogs before the system prompt.
 */

package com.vaultcalcapp.modules.permission

import android.Manifest
import android.os.Build
import com.facebook.react.bridge.*
import com.vaultcalcapp.MainActivity

class PermissionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "PermissionModule"

        /**
         * Map JS-friendly permission keys to Android Manifest constants.
         * This decouples the JS layer from Android version-specific constants.
         */
        fun resolvePermission(key: String): String? = when (key) {
            "camera" -> Manifest.permission.CAMERA
            "location" -> Manifest.permission.ACCESS_COARSE_LOCATION
            "photos" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                Manifest.permission.READ_MEDIA_IMAGES
            } else {
                @Suppress("DEPRECATION")
                Manifest.permission.READ_EXTERNAL_STORAGE
            }
            "videos" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                Manifest.permission.READ_MEDIA_VIDEO
            } else {
                @Suppress("DEPRECATION")
                Manifest.permission.READ_EXTERNAL_STORAGE
            }
            "notifications" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                Manifest.permission.POST_NOTIFICATIONS
            } else {
                null // Not needed pre-13
            }
            else -> null
        }

        private fun resultToString(result: PermissionResult): String = when (result) {
            PermissionResult.GRANTED -> "granted"
            PermissionResult.DENIED -> "denied"
            PermissionResult.PERMANENTLY_DENIED -> "permanently_denied"
        }
    }

    override fun getName(): String = NAME

    private fun getManager(): PermissionManager? {
        return (reactApplicationContext.currentActivity as? MainActivity)?.permissionManager
    }

    /**
     * Check if a permission is currently granted without prompting.
     *
     * @param key  JS permission key ("camera", "location", "photos", "videos", "notifications")
     * @param promise  Resolves with boolean
     */
    @ReactMethod
    fun check(key: String, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available")
            return
        }

        val permission = resolvePermission(key)
        if (permission == null) {
            // Permission not applicable on this API level (e.g. notifications pre-13)
            promise.resolve(true)
            return
        }

        val manager = getManager()
        if (manager == null) {
            promise.reject("NOT_INITIALIZED", "PermissionManager not registered")
            return
        }

        promise.resolve(manager.isGranted(activity, permission))
    }

    /**
     * Request a single permission with rationale dialog and denial handling.
     *
     * @param key      JS permission key
     * @param promise  Resolves with "granted" | "denied" | "permanently_denied"
     */
    @ReactMethod
    fun request(key: String, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available")
            return
        }

        val permission = resolvePermission(key)
        if (permission == null) {
            promise.resolve("granted")
            return
        }

        val manager = getManager()
        if (manager == null) {
            promise.reject("NOT_INITIALIZED", "PermissionManager not registered")
            return
        }

        manager.request(activity, permission) { result ->
            activity.runOnUiThread {
                promise.resolve(resultToString(result))
            }
        }
    }

    /**
     * Request multiple permissions at once.
     *
     * @param keys     ReadableArray of JS permission keys
     * @param promise  Resolves with a map of { key: "granted"|"denied"|"permanently_denied" }
     */
    @ReactMethod
    fun requestMultiple(keys: ReadableArray, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available")
            return
        }

        val manager = getManager()
        if (manager == null) {
            promise.reject("NOT_INITIALIZED", "PermissionManager not registered")
            return
        }

        val keyList = mutableListOf<String>()
        val permissionList = mutableListOf<String>()
        val keyToPermission = mutableMapOf<String, String>()

        for (i in 0 until keys.size()) {
            val key = keys.getString(i) ?: continue
            val permission = resolvePermission(key)
            if (permission != null) {
                keyList.add(key)
                permissionList.add(permission)
                keyToPermission[permission] = key
            }
        }

        if (permissionList.isEmpty()) {
            val result = Arguments.createMap()
            for (i in 0 until keys.size()) {
                val key = keys.getString(i) ?: continue
                result.putString(key, "granted")
            }
            promise.resolve(result)
            return
        }

        manager.requestMultiple(activity, permissionList.toTypedArray()) { results ->
            activity.runOnUiThread {
                val jsResult = Arguments.createMap()
                for ((permission, permResult) in results) {
                    val key = keyToPermission[permission] ?: continue
                    jsResult.putString(key, resultToString(permResult))
                }
                for (i in 0 until keys.size()) {
                    val key = keys.getString(i) ?: continue
                    if (!jsResult.hasKey(key)) {
                        jsResult.putString(key, "granted")
                    }
                }
                promise.resolve(jsResult)
            }
        }
    }
}
