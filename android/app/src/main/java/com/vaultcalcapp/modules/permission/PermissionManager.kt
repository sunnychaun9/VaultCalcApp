/**
 * VaultCalc - Centralized Permission Manager
 *
 * Single source of truth for runtime permission checks, rationale display,
 * and requests. Uses the Activity Result API (ActivityResultLauncher) instead
 * of the deprecated onRequestPermissionsResult flow.
 *
 * Design:
 * - One launcher per permission group, registered once at Activity creation
 * - Rationale dialog shown BEFORE the system prompt when shouldShowRationale is true
 * - Permanent denial ("Don't ask again") detected and routed to app settings
 * - Promise-based API for React Native bridge callers
 *
 * PLAY STORE COMPLIANCE:
 * - Permissions requested only at point of use, never at launch
 * - User always sees a plain-language explanation before the system dialog
 * - Denial is handled gracefully — features degrade, nothing crashes
 */

package com.vaultcalcapp.modules.permission

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Result of a permission request flow.
 */
enum class PermissionResult {
    /** User granted the permission in this session or it was already granted. */
    GRANTED,
    /** User denied the permission (can ask again next time). */
    DENIED,
    /** User denied and checked "Don't ask again", or policy prevents asking. */
    PERMANENTLY_DENIED,
}

/**
 * Rationale metadata for each permission the app uses.
 * Provides user-facing explanation shown before the system prompt.
 */
data class PermissionRationale(
    val title: String,
    val message: String,
    val positiveButton: String = "Continue",
    val negativeButton: String = "Not now",
)

/**
 * Centralized permission manager.
 *
 * Must be initialized from [ComponentActivity.onCreate] BEFORE the activity
 * reaches STARTED state, because ActivityResultLauncher registration is only
 * allowed during initialization.
 *
 * Usage from an Activity:
 * ```
 * class MainActivity : ReactActivity() {
 *     val permissionManager = PermissionManager()
 *
 *     override fun onCreate(savedInstanceState: Bundle?) {
 *         permissionManager.register(this)
 *         super.onCreate(savedInstanceState)
 *     }
 * }
 * ```
 *
 * Usage from a native module:
 * ```
 * val pm = (currentActivity as? MainActivity)?.permissionManager
 * pm?.request(activity, Manifest.permission.CAMERA) { result -> ... }
 * ```
 */
class PermissionManager {

    // ── Launcher state ──────────────────────────────────────────────
    private var launcher: ActivityResultLauncher<String>? = null
    private var multiLauncher: ActivityResultLauncher<Array<String>>? = null
    private var pendingCallback: ((PermissionResult) -> Unit)? = null
    private var pendingPermission: String? = null
    private var pendingMultiCallback: ((Map<String, PermissionResult>) -> Unit)? = null
    private var pendingMultiPermissions: Array<String>? = null

    // ── Rationale registry ──────────────────────────────────────────
    private val rationales = mutableMapOf<String, PermissionRationale>(
        Manifest.permission.CAMERA to PermissionRationale(
            title = "Camera Access",
            message = "VaultCalc uses the front camera to photograph unauthorized unlock attempts. " +
                "Photos are encrypted and stored only on your device.",
        ),
        Manifest.permission.ACCESS_COARSE_LOCATION to PermissionRationale(
            title = "Approximate Location",
            message = "VaultCalc can record the approximate location of failed unlock attempts " +
                "to help you identify where unauthorized access occurred. " +
                "No continuous tracking or background access is used.",
        ),
    ).apply {
        // Storage permissions vary by API level
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            put(Manifest.permission.READ_MEDIA_IMAGES, PermissionRationale(
                title = "Photo Access",
                message = "VaultCalc needs access to your photos to import them into your encrypted vault.",
            ))
            put(Manifest.permission.READ_MEDIA_VIDEO, PermissionRationale(
                title = "Video Access",
                message = "VaultCalc needs access to your videos to import them into your encrypted vault.",
            ))
            put(Manifest.permission.POST_NOTIFICATIONS, PermissionRationale(
                title = "Notifications",
                message = "VaultCalc uses notifications for stealth mode re-entry and backup progress.",
            ))
        } else {
            @Suppress("DEPRECATION")
            put(Manifest.permission.READ_EXTERNAL_STORAGE, PermissionRationale(
                title = "Storage Access",
                message = "VaultCalc needs access to your files to import media into your encrypted vault.",
            ))
        }
    }

    // ── Public API ──────────────────────────────────────────────────

    /**
     * Register the Activity Result launchers. MUST be called from
     * [ComponentActivity.onCreate] before super.onCreate().
     */
    fun register(activity: ComponentActivity) {
        launcher = activity.registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { granted ->
            val permission = pendingPermission
            val callback = pendingCallback
            pendingPermission = null
            pendingCallback = null

            if (callback == null) return@registerForActivityResult

            if (granted) {
                callback(PermissionResult.GRANTED)
            } else if (permission != null && !ActivityCompat.shouldShowRequestPermissionRationale(activity, permission)) {
                // System won't show the dialog again → permanently denied
                callback(PermissionResult.PERMANENTLY_DENIED)
            } else {
                callback(PermissionResult.DENIED)
            }
        }

        multiLauncher = activity.registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions()
        ) { results ->
            val permissions = pendingMultiPermissions
            val callback = pendingMultiCallback
            pendingMultiPermissions = null
            pendingMultiCallback = null

            if (callback == null || permissions == null) return@registerForActivityResult

            val mapped = results.mapValues { (permission, granted) ->
                when {
                    granted -> PermissionResult.GRANTED
                    !ActivityCompat.shouldShowRequestPermissionRationale(activity, permission) ->
                        PermissionResult.PERMANENTLY_DENIED
                    else -> PermissionResult.DENIED
                }
            }
            callback(mapped)
        }
    }

    /**
     * Check if a single permission is currently granted.
     */
    fun isGranted(activity: Activity, permission: String): Boolean {
        return ContextCompat.checkSelfPermission(
            activity, permission
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Request a single permission with the full flow:
     * 1. If already granted → callback immediately
     * 2. If rationale should be shown → show explanation dialog → then system prompt
     * 3. Otherwise → system prompt directly
     * 4. On permanent denial → offer to open app settings
     *
     * @param activity       The current ComponentActivity
     * @param permission     The Manifest.permission constant
     * @param onResult       Callback with the result
     */
    fun request(
        activity: Activity,
        permission: String,
        onResult: (PermissionResult) -> Unit,
    ) {
        // Already granted — fast path
        if (isGranted(activity, permission)) {
            onResult(PermissionResult.GRANTED)
            return
        }

        val launch = launcher ?: run {
            onResult(PermissionResult.DENIED)
            return
        }

        val needsRationale = ActivityCompat.shouldShowRequestPermissionRationale(activity, permission)

        if (needsRationale) {
            // Show our custom explanation BEFORE the system dialog
            showRationaleDialog(activity, permission) { accepted ->
                if (accepted) {
                    pendingPermission = permission
                    pendingCallback = wrapWithSettingsRedirect(activity, permission, onResult)
                    launch.launch(permission)
                } else {
                    onResult(PermissionResult.DENIED)
                }
            }
        } else {
            // First time asking, or already denied-without-rationale — go straight to system
            pendingPermission = permission
            pendingCallback = wrapWithSettingsRedirect(activity, permission, onResult)
            launch.launch(permission)
        }
    }

    /**
     * Request multiple permissions at once.
     * Shows rationale for the first ungranted permission that needs it,
     * then requests all ungranted permissions together.
     */
    fun requestMultiple(
        activity: Activity,
        permissions: Array<String>,
        onResult: (Map<String, PermissionResult>) -> Unit,
    ) {
        // Filter out already-granted permissions
        val ungranted = permissions.filter { !isGranted(activity, it) }

        if (ungranted.isEmpty()) {
            onResult(permissions.associateWith { PermissionResult.GRANTED })
            return
        }

        val multi = multiLauncher ?: run {
            onResult(permissions.associateWith { PermissionResult.DENIED })
            return
        }

        // Show rationale for the first permission that needs it
        val needsRationale = ungranted.firstOrNull {
            ActivityCompat.shouldShowRequestPermissionRationale(activity, it)
        }

        val doLaunch = {
            val ungrantedArray = ungranted.toTypedArray()
            pendingMultiPermissions = ungrantedArray
            pendingMultiCallback = { results ->
                // Merge: already-granted + launcher results
                val merged = permissions.associateWith { p ->
                    results[p] ?: PermissionResult.GRANTED
                }
                onResult(merged)
            }
            multi.launch(ungrantedArray)
        }

        if (needsRationale != null) {
            showRationaleDialog(activity, needsRationale) { accepted ->
                if (accepted) {
                    doLaunch()
                } else {
                    onResult(permissions.associateWith {
                        if (isGranted(activity, it)) PermissionResult.GRANTED else PermissionResult.DENIED
                    })
                }
            }
        } else {
            doLaunch()
        }
    }

    // ── Internal helpers ────────────────────────────────────────────

    /**
     * Wrap a callback to automatically offer Settings redirect on permanent denial.
     */
    private fun wrapWithSettingsRedirect(
        activity: Activity,
        permission: String,
        original: (PermissionResult) -> Unit,
    ): (PermissionResult) -> Unit = { result ->
        if (result == PermissionResult.PERMANENTLY_DENIED) {
            showSettingsRedirectDialog(activity, permission)
        }
        original(result)
    }

    /**
     * Show a user-friendly explanation dialog before the system permission prompt.
     */
    private fun showRationaleDialog(
        activity: Activity,
        permission: String,
        onDecision: (accepted: Boolean) -> Unit,
    ) {
        val rationale = rationales[permission] ?: PermissionRationale(
            title = "Permission Required",
            message = "This feature requires additional permissions to work.",
        )

        activity.runOnUiThread {
            AlertDialog.Builder(activity)
                .setTitle(rationale.title)
                .setMessage(rationale.message)
                .setPositiveButton(rationale.positiveButton) { dialog, _ ->
                    dialog.dismiss()
                    onDecision(true)
                }
                .setNegativeButton(rationale.negativeButton) { dialog, _ ->
                    dialog.dismiss()
                    onDecision(false)
                }
                .setCancelable(false)
                .show()
        }
    }

    /**
     * When the user has permanently denied a permission, show a dialog
     * explaining they need to grant it manually in Settings.
     */
    private fun showSettingsRedirectDialog(activity: Activity, permission: String) {
        val rationale = rationales[permission]
        val featureName = rationale?.title ?: "This feature"

        activity.runOnUiThread {
            AlertDialog.Builder(activity)
                .setTitle("Permission Required")
                .setMessage(
                    "$featureName is disabled because the permission was denied.\n\n" +
                        "To enable it, open Settings and allow the permission manually."
                )
                .setPositiveButton("Open Settings") { dialog, _ ->
                    dialog.dismiss()
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", activity.packageName, null)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    activity.startActivity(intent)
                }
                .setNegativeButton("Cancel") { dialog, _ ->
                    dialog.dismiss()
                }
                .setCancelable(true)
                .show()
        }
    }
}
