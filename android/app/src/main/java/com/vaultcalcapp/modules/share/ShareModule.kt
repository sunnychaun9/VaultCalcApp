/**
 * VaultCalc - Share Native Module
 *
 * Shares files and text via Android's native share sheet (Intent.ACTION_SEND).
 * Uses FileProvider to grant temporary read access to decrypted files.
 *
 * @see FEATURE_INDEX.md ENH-001
 */

package com.vaultcalcapp.modules.share

import android.content.Intent
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import java.io.File

/**
 * React Native module for sharing files and text via Android's share sheet.
 */
class ShareModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "VaultShareModule"
        private const val ERROR_SHARE = "SHARE_ERROR"
    }

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    /** The app-private files directory — all share operations must stay within this boundary. */
    private val appFilesDir: String by lazy {
        reactApplicationContext.filesDir.canonicalPath
    }

    /**
     * Validate that a file path resolves within the app's private files directory.
     * Prevents sharing files outside the vault (e.g. SharedPreferences, Tink keysets).
     *
     * @throws SecurityException if the path escapes the allowed directory
     */
    private fun validatePath(path: String) {
        val canonical = java.io.File(path).canonicalPath
        if (!canonical.startsWith(appFilesDir)) {
            throw SecurityException("Path not allowed: file is outside app directory")
        }
    }

    override fun getName(): String = NAME

    /**
     * Share a single file via ACTION_SEND.
     *
     * @param filePath Absolute path to the file to share
     * @param mimeType MIME type of the file (e.g. "image/jpeg")
     * @param title Title for the share chooser
     * @param promise Resolves when the share sheet is launched
     */
    @ReactMethod
    fun shareFile(filePath: String, mimeType: String, title: String, promise: Promise) {
        scope.launch {
            try {
                validatePath(filePath)

                val file = File(filePath)
                if (!file.exists()) {
                    promise.reject(ERROR_SHARE, "File does not exist")
                    return@launch
                }

                val authority = "${reactApplicationContext.packageName}.fileprovider"
                val uri = FileProvider.getUriForFile(reactApplicationContext, authority, file)

                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = mimeType
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }

                val chooser = Intent.createChooser(intent, title)
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(chooser)
                promise.resolve(true)
            } catch (e: SecurityException) {
                promise.reject(ERROR_SHARE, "Share path not allowed")
            } catch (e: Exception) {
                promise.reject(ERROR_SHARE, "Failed to share file")
            }
        }
    }

    /**
     * Share multiple files via ACTION_SEND_MULTIPLE.
     *
     * @param filePaths Array of absolute file paths
     * @param mimeTypes Array of MIME types (parallel to filePaths)
     * @param title Title for the share chooser
     * @param promise Resolves when the share sheet is launched
     */
    @ReactMethod
    fun shareFiles(filePaths: ReadableArray, mimeTypes: ReadableArray, title: String, promise: Promise) {
        scope.launch {
            try {
                val authority = "${reactApplicationContext.packageName}.fileprovider"
                val uris = ArrayList<android.net.Uri>()
                val types = mutableSetOf<String>()

                for (i in 0 until filePaths.size()) {
                    val path = filePaths.getString(i) ?: continue
                    validatePath(path)

                    val file = File(path)
                    if (!file.exists()) {
                        promise.reject(ERROR_SHARE, "File does not exist")
                        return@launch
                    }
                    uris.add(FileProvider.getUriForFile(reactApplicationContext, authority, file))
                    types.add(mimeTypes.getString(i) ?: "*/*")
                }

                val mimeType = if (types.size == 1) types.first() else "*/*"

                val intent = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
                    type = mimeType
                    putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }

                val chooser = Intent.createChooser(intent, title)
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(chooser)
                promise.resolve(true)
            } catch (e: SecurityException) {
                promise.reject(ERROR_SHARE, "Share path not allowed")
            } catch (e: Exception) {
                promise.reject(ERROR_SHARE, "Failed to share files")
            }
        }
    }

    /**
     * Share text content via ACTION_SEND (for notes).
     *
     * @param text The text content to share
     * @param title Title for the share chooser
     * @param promise Resolves when the share sheet is launched
     */
    @ReactMethod
    fun shareText(text: String, title: String, promise: Promise) {
        scope.launch {
            try {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                    putExtra(Intent.EXTRA_SUBJECT, title)
                }

                val chooser = Intent.createChooser(intent, title)
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(chooser)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject(ERROR_SHARE, "Failed to share text")
            }
        }
    }
}
