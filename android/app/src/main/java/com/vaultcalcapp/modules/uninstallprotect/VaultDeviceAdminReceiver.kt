package com.vaultcalcapp.modules.uninstallprotect

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast

/**
 * Device Admin receiver for uninstall protection.
 * When activated, Android prevents uninstalling the app until
 * the user deactivates device admin in system settings.
 *
 * onDisableRequested shows a warning message before deactivation.
 */
class VaultDeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        return "Disabling uninstall protection will allow anyone to uninstall this app. " +
                "Your hidden files will NOT be recoverable after uninstallation."
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
    }
}
