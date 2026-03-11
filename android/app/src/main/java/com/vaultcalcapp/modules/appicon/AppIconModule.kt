/**
 * VaultCalc - App Icon (Disguised Icons) Native Module
 *
 * Switches the launcher icon and label by enabling/disabling
 * activity-alias entries declared in AndroidManifest.xml.
 * Only one alias is enabled at a time.
 *
 * Persists the selected alias in SharedPreferences so it
 * survives reboots and process restarts.
 *
 * @see STEALTH-001 / Disguised App Icons in FEATURE_INDEX.md
 */

package com.vaultcalcapp.modules.appicon

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AppIconModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AppIconModule"
        const val PREFS_NAME = "vaultcalc_appicon"
        const val KEY_SELECTED_ALIAS = "selected_alias"
        const val DEFAULT_ALIAS = "default"

        // Manifest namespace — class names are resolved against this,
        // NOT the applicationId (which may have flavor suffixes like ".dev").
        private const val NAMESPACE = "com.vaultcalcapp"

        /**
         * Map of alias key → manifest class name suffix.
         * Public so StealthModule can access the alias list.
         */
        val ALIASES = mapOf(
            "default" to ".alias.DefaultAlias",
            "calculator" to ".alias.CalculatorAlias",
            "weather" to ".alias.WeatherAlias",
            "notes" to ".alias.NotesAlias",
        )

        /**
         * Build a ComponentName for the given alias key.
         * @param appId the applicationId (e.g. com.vaultcalcapp.dev)
         * @param aliasKey one of "default", "calculator", "weather", "notes"
         */
        fun componentFor(appId: String, aliasKey: String): ComponentName {
            val suffix = ALIASES[aliasKey]
                ?: throw IllegalArgumentException("Unknown alias: $aliasKey")
            return ComponentName(appId, "$NAMESPACE$suffix")
        }

        /** Read persisted alias from SharedPreferences. */
        fun getPersistedAlias(context: Context): String {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getString(KEY_SELECTED_ALIAS, DEFAULT_ALIAS) ?: DEFAULT_ALIAS
        }
    }

    override fun getName(): String = NAME

    private fun getPrefs() =
        reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * Switch the launcher icon/label to the given alias.
     * Disables all other aliases first, then enables the selected one.
     */
    @ReactMethod
    fun setIcon(aliasName: String, promise: Promise) {
        try {
            if (!ALIASES.containsKey(aliasName)) {
                promise.reject("INVALID_ALIAS", "Unknown icon alias: $aliasName")
                return
            }

            val current = getPrefs().getString(KEY_SELECTED_ALIAS, DEFAULT_ALIAS) ?: DEFAULT_ALIAS
            if (current == aliasName) {
                // Already set — no-op
                promise.resolve(true)
                return
            }

            val pm = reactApplicationContext.packageManager
            val appId = reactApplicationContext.packageName

            // Disable all aliases
            for ((key, _) in ALIASES) {
                val component = componentFor(appId, key)
                pm.setComponentEnabledSetting(
                    component,
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP
                )
            }

            // Enable the selected alias
            val selected = componentFor(appId, aliasName)
            pm.setComponentEnabledSetting(
                selected,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP
            )

            // Persist selection
            getPrefs().edit().putString(KEY_SELECTED_ALIAS, aliasName).apply()

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ICON_ERROR", "Failed to change app icon: ${e.message}", e)
        }
    }

    /**
     * Get the currently selected icon alias name.
     */
    @ReactMethod
    fun getCurrentIcon(promise: Promise) {
        try {
            val alias = getPrefs().getString(KEY_SELECTED_ALIAS, DEFAULT_ALIAS) ?: DEFAULT_ALIAS
            promise.resolve(alias)
        } catch (e: Exception) {
            promise.reject("ICON_ERROR", "Failed to get current icon: ${e.message}", e)
        }
    }
}
