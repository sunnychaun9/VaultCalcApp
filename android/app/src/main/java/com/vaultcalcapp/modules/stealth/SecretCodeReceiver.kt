/**
 * VaultCalc - Secret Code BroadcastReceiver
 *
 * Listens for the Android secret dialer code (*#9876#) and
 * launches MainActivity when triggered. This is the only way
 * to open VaultCalc when stealth mode is active and the
 * launcher icon is hidden.
 *
 * Works on Android 10–14. On Android 12+ the receiver must
 * be exported and declared in the manifest with the correct
 * intent-filter.
 *
 * @see STEALTH-001 in FEATURE_INDEX.md
 */

package com.vaultcalcapp.modules.stealth

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.vaultcalcapp.MainActivity

class SecretCodeReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        // Launch MainActivity directly — it handles React Native bootstrap
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        context.startActivity(launchIntent)
    }
}
