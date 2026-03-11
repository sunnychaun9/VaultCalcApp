/**
 * VaultCalc - Installed Apps Scanner
 *
 * Queries PackageManager for user-installed apps, filtering out
 * system packages, launchers, and VaultCalc itself.
 *
 * @see App Lock feature
 */

package com.vaultcalcapp.modules.applock

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.util.Base64
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import java.io.ByteArrayOutputStream

class InstalledAppsScanner(private val reactContext: ReactApplicationContext) {

    /**
     * Get all user-installed apps with launcher intent.
     * Filters out system apps, launchers, and VaultCalc itself.
     * Returns list of { packageName, appName, icon (base64 PNG) }.
     */
    suspend fun getInstalledApps(): WritableArray = withContext(Dispatchers.IO) {
        val pm = reactContext.packageManager
        val ownPackage = reactContext.packageName

        // Get packages with launcher intent
        val launchIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        val resolveInfos = pm.queryIntentActivities(launchIntent, 0)

        // Get default launcher package
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
        }
        val launcherPackages = pm.queryIntentActivities(homeIntent, 0)
            .map { it.activityInfo.packageName }
            .toSet()

        val result = Arguments.createArray()

        for (ri in resolveInfos) {
            val pkg = ri.activityInfo.packageName

            // Skip own app, launchers, and system UI
            if (pkg == ownPackage) continue
            if (launcherPackages.contains(pkg)) continue
            if (pkg == "com.android.systemui") continue
            if (pkg == "com.android.settings") continue

            try {
                val appInfo = pm.getApplicationInfo(pkg, 0)
                val appName = pm.getApplicationLabel(appInfo).toString()

                val map = Arguments.createMap().apply {
                    putString("packageName", pkg)
                    putString("appName", appName)
                    putString("icon", getAppIconBase64(pm, appInfo))
                }
                result.pushMap(map)
            } catch (_: PackageManager.NameNotFoundException) {
                // App was uninstalled between query and info fetch
            }
        }

        result
    }

    private fun getAppIconBase64(pm: PackageManager, appInfo: ApplicationInfo): String {
        return try {
            val drawable = pm.getApplicationIcon(appInfo)
            val bitmap = if (drawable is BitmapDrawable) {
                drawable.bitmap
            } else {
                val bmp = Bitmap.createBitmap(48, 48, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bmp)
                drawable.setBounds(0, 0, 48, 48)
                drawable.draw(canvas)
                bmp
            }

            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 80, stream)
            Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        } catch (_: Exception) {
            ""
        }
    }
}
