/**
 * VaultCalc - Media Native Module
 *
 * Generates compressed JPEG thumbnails from content URIs.
 * Uses two-pass bitmap decoding for memory-safe processing of large images.
 *
 * @see FEATURE_INDEX.md FILE-003
 */

package com.vaultcalcapp.modules.media

import android.content.ContentValues
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.MediaStore
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.security.SecureRandom

/**
 * React Native module providing media processing operations.
 *
 * Features:
 * - Two-pass bitmap decoding (memory-safe even for 48MP images)
 * - JPEG thumbnail generation with configurable max dimension
 * - Aspect-ratio-preserving scaling
 */
class MediaModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "MediaModule"
        private const val ERROR_THUMBNAIL = "MEDIA_THUMBNAIL_ERROR"
        private const val JPEG_QUALITY = 80
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun getName(): String = NAME

    /**
     * Generate a JPEG thumbnail from a content URI.
     *
     * @param sourceUri content:// URI of the source image
     * @param destPath Absolute path for the output thumbnail
     * @param maxDimension Maximum width or height in pixels
     * @param promise Resolves with { width, height, thumbnailPath }
     */
    @ReactMethod
    fun generateThumbnail(sourceUri: String, destPath: String, maxDimension: Int, promise: Promise) {
        scope.launch {
            try {
                val uri = Uri.parse(sourceUri)
                val resolver = reactApplicationContext.contentResolver

                // Pass 1: Read dimensions only (no pixel allocation)
                val options = BitmapFactory.Options().apply {
                    inJustDecodeBounds = true
                }
                val inputStream1 = resolver.openInputStream(uri)
                    ?: throw Exception("Cannot open source URI")
                inputStream1.use { stream ->
                    BitmapFactory.decodeStream(stream, null, options)
                }

                val origWidth = options.outWidth
                val origHeight = options.outHeight
                if (origWidth <= 0 || origHeight <= 0) {
                    throw Exception("Cannot read image dimensions")
                }

                // Compute subsampling factor
                val sampleSize = calculateInSampleSize(origWidth, origHeight, maxDimension)

                // Pass 2: Decode subsampled bitmap
                val decodeOptions = BitmapFactory.Options().apply {
                    inSampleSize = sampleSize
                }
                val inputStream2 = resolver.openInputStream(uri)
                    ?: throw Exception("Cannot reopen source URI")
                val sampledBitmap = inputStream2.use { stream ->
                    BitmapFactory.decodeStream(stream, null, decodeOptions)
                } ?: throw Exception("Cannot decode image")

                try {
                    // Scale to exact target dimensions (preserving aspect ratio)
                    val (targetWidth, targetHeight) = calculateTargetDimensions(
                        sampledBitmap.width, sampledBitmap.height, maxDimension
                    )

                    val scaledBitmap = if (
                        targetWidth == sampledBitmap.width && targetHeight == sampledBitmap.height
                    ) {
                        sampledBitmap
                    } else {
                        Bitmap.createScaledBitmap(sampledBitmap, targetWidth, targetHeight, true)
                    }

                    try {
                        // Ensure parent directory exists
                        File(destPath).parentFile?.mkdirs()

                        // Write JPEG to disk
                        FileOutputStream(destPath).use { out ->
                            scaledBitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
                        }

                        // Return result
                        val result = Arguments.createMap().apply {
                            putInt("width", scaledBitmap.width)
                            putInt("height", scaledBitmap.height)
                            putString("thumbnailPath", destPath)
                        }
                        withContext(Dispatchers.Main) { promise.resolve(result) }
                    } finally {
                        if (scaledBitmap !== sampledBitmap) {
                            scaledBitmap.recycle()
                        }
                    }
                } finally {
                    sampledBitmap.recycle()
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject(ERROR_THUMBNAIL, "Thumbnail generation failed")
                }
            }
        }
    }

    /**
     * Calculate power-of-2 inSampleSize so that the decoded bitmap
     * has dimensions >= maxDimension (allowing final scaling to exact size).
     */
    private fun calculateInSampleSize(width: Int, height: Int, maxDimension: Int): Int {
        var inSampleSize = 1
        val smaller = minOf(width, height)
        while (smaller / (inSampleSize * 2) >= maxDimension) {
            inSampleSize *= 2
        }
        return inSampleSize
    }

    /**
     * Calculate target width/height that fit within maxDimension
     * while preserving the original aspect ratio.
     */
    private fun calculateTargetDimensions(width: Int, height: Int, maxDimension: Int): Pair<Int, Int> {
        if (width <= maxDimension && height <= maxDimension) {
            return Pair(width, height)
        }
        return if (width >= height) {
            val targetWidth = maxDimension
            val targetHeight = (height.toFloat() / width * maxDimension).toInt().coerceAtLeast(1)
            Pair(targetWidth, targetHeight)
        } else {
            val targetHeight = maxDimension
            val targetWidth = (width.toFloat() / height * maxDimension).toInt().coerceAtLeast(1)
            Pair(targetWidth, targetHeight)
        }
    }

    /**
     * Generate a JPEG thumbnail from a video content URI (VIDEO-002).
     * Uses MediaMetadataRetriever to extract a frame near the start.
     * Also extracts video duration, width, and height.
     *
     * @param sourceUri content:// URI of the source video
     * @param destPath Absolute path for the output thumbnail
     * @param maxDimension Maximum width or height in pixels
     * @param promise Resolves with { width, height, thumbnailPath, durationMs, videoWidth, videoHeight }
     */
    @ReactMethod
    fun generateVideoThumbnail(sourceUri: String, destPath: String, maxDimension: Int, promise: Promise) {
        scope.launch {
            val retriever = MediaMetadataRetriever()
            try {
                val uri = Uri.parse(sourceUri)
                retriever.setDataSource(reactApplicationContext, uri)

                // Extract video metadata
                val durationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                val durationMs = durationStr?.toLongOrNull() ?: 0L

                val videoWidthStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                val videoHeightStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                val videoWidth = videoWidthStr?.toIntOrNull() ?: 0
                val videoHeight = videoHeightStr?.toIntOrNull() ?: 0

                // Extract frame at 1 second (or start if video is shorter)
                val timeUs = if (durationMs > 1000) 1_000_000L else 0L
                val frameBitmap = retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                    ?: throw Exception("Cannot extract video frame")

                try {
                    // Scale to target dimensions
                    val (targetWidth, targetHeight) = calculateTargetDimensions(
                        frameBitmap.width, frameBitmap.height, maxDimension
                    )

                    val scaledBitmap = if (
                        targetWidth == frameBitmap.width && targetHeight == frameBitmap.height
                    ) {
                        frameBitmap
                    } else {
                        Bitmap.createScaledBitmap(frameBitmap, targetWidth, targetHeight, true)
                    }

                    try {
                        // Ensure parent directory exists
                        File(destPath).parentFile?.mkdirs()

                        // Write JPEG to disk
                        FileOutputStream(destPath).use { out ->
                            scaledBitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
                        }

                        // Return result
                        val result = Arguments.createMap().apply {
                            putInt("width", scaledBitmap.width)
                            putInt("height", scaledBitmap.height)
                            putString("thumbnailPath", destPath)
                            putDouble("durationMs", durationMs.toDouble())
                            putInt("videoWidth", videoWidth)
                            putInt("videoHeight", videoHeight)
                        }
                        withContext(Dispatchers.Main) { promise.resolve(result) }
                    } finally {
                        if (scaledBitmap !== frameBitmap) {
                            scaledBitmap.recycle()
                        }
                    }
                } finally {
                    frameBitmap.recycle()
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject(ERROR_THUMBNAIL, "Video thumbnail generation failed")
                }
            } finally {
                retriever.release()
            }
        }
    }

    /**
     * Delete a file at the given absolute path.
     *
     * @param filePath Absolute path to the file to delete
     * @param promise Resolves with true (file deleted or didn't exist), false on error
     */
    @ReactMethod
    fun deleteFile(filePath: String, promise: Promise) {
        scope.launch {
            try {
                val file = File(filePath)
                if (file.exists()) { secureDelete(file) }
                withContext(Dispatchers.Main) { promise.resolve(true) }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { promise.resolve(false) }
            }
        }
    }

    /**
     * Securely delete a file by overwriting its contents with random data
     * before unlinking. Prevents forensic recovery of decrypted data.
     */
    private fun secureDelete(file: File) {
        try {
            val length = file.length()
            if (length > 0) {
                RandomAccessFile(file, "rw").use { raf ->
                    val random = SecureRandom()
                    val buf = ByteArray(minOf(length, 8192L).toInt())
                    raf.seek(0)
                    var remaining = length
                    while (remaining > 0) {
                        val chunk = minOf(remaining, buf.size.toLong()).toInt()
                        random.nextBytes(buf)
                        raf.write(buf, 0, chunk)
                        remaining -= chunk
                    }
                    raf.fd.sync()
                }
            }
        } catch (_: Exception) {
            // Best-effort overwrite — proceed to delete even if overwrite fails
        }
        file.delete()
    }

    /**
     * Securely delete all files within a directory.
     * Each file is overwritten with random data before unlinking.
     * The directory itself is preserved.
     *
     * @param dirPath Absolute path to the directory
     * @param promise Resolves with the number of files deleted
     */
    @ReactMethod
    fun secureDeleteDirectoryContents(dirPath: String, promise: Promise) {
        scope.launch {
            try {
                val dir = File(dirPath)
                var count = 0
                if (dir.isDirectory) {
                    dir.listFiles()?.forEach { file ->
                        if (file.isFile) {
                            secureDelete(file)
                            count++
                        }
                    }
                }
                withContext(Dispatchers.Main) { promise.resolve(count) }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { promise.resolve(0) }
            }
        }
    }

    /**
     * Delete a content URI document (e.g. a file picked via SAF).
     *
     * Strategy:
     * 1. Resolve the real filesystem path BEFORE deletion (needed for MediaStore cleanup).
     * 2. Delete via DocumentsContract (SAF URIs) or ContentResolver (MediaStore URIs).
     * 3. After deletion, notify MediaStore so gallery apps stop showing the entry.
     *
     * @param uri content:// URI to delete
     * @param promise Resolves with true if deleted, false otherwise
     */
    @ReactMethod
    fun deleteContentUri(uri: String, promise: Promise) {
        scope.launch {
            try {
                val contentUri = Uri.parse(uri)
                val resolver = reactApplicationContext.contentResolver

                // Resolve the real file path before deletion. After the file
                // is removed the URI can no longer be queried.
                val realPath = resolveFilePathFromUri(contentUri)

                var deleted = false

                // Attempt 1: DocumentsContract (works for SAF document URIs)
                if (!deleted) {
                    try {
                        if (DocumentsContract.isDocumentUri(reactApplicationContext, contentUri)) {
                            deleted = DocumentsContract.deleteDocument(resolver, contentUri)
                        }
                    } catch (_: Exception) {
                        // Fall through to next approach
                    }
                }

                // Attempt 2: ContentResolver.delete (works for MediaStore URIs
                // and some DocumentsProviders that also support this path)
                if (!deleted) {
                    try {
                        val rows = resolver.delete(contentUri, null, null)
                        deleted = rows > 0
                    } catch (_: Exception) {
                        // Fall through — on API 29+ this throws RecoverableSecurityException
                        // for files not owned by this app. Accepted as a known limitation.
                    }
                }

                // Post-deletion: tell MediaStore the file is gone so gallery apps update.
                // scanFile() with a path that no longer exists causes MediaStore to
                // remove its index entry for that path.
                if (deleted && realPath != null) {
                    MediaScannerConnection.scanFile(
                        reactApplicationContext,
                        arrayOf(realPath),
                        null,
                        null
                    )
                }

                withContext(Dispatchers.Main) { promise.resolve(deleted) }
            } catch (_: Exception) {
                withContext(Dispatchers.Main) { promise.resolve(false) }
            }
        }
    }

    /**
     * Try to resolve a real filesystem path from a content URI.
     *
     * Handles two common URI authorities:
     * - com.android.externalstorage.documents → decode document ID "primary:DCIM/photo.jpg"
     * - content://media/... (MediaStore) → query the _data column
     *
     * Returns null if the path cannot be determined (cloud providers, etc.).
     */
    private fun resolveFilePathFromUri(uri: Uri): String? {
        try {
            // SAF external storage documents: document ID encodes the relative path
            if (DocumentsContract.isDocumentUri(reactApplicationContext, uri)) {
                val authority = uri.authority
                if (authority == "com.android.externalstorage.documents") {
                    val docId = DocumentsContract.getDocumentId(uri)
                    val parts = docId.split(":", limit = 2)
                    if (parts.size == 2) {
                        val storageType = parts[0]
                        val relativePath = parts[1]
                        if (storageType.equals("primary", ignoreCase = true)) {
                            @Suppress("DEPRECATION")
                            return "${Environment.getExternalStorageDirectory()}/$relativePath"
                        }
                        // Secondary volumes (SD card): /storage/<volume>/<path>
                        return "/storage/$storageType/$relativePath"
                    }
                }
                // Downloads provider: try _data column
                if (authority == "com.android.providers.downloads.documents") {
                    return queryDataColumn(uri)
                }
            }

            // MediaStore URI: query the _data column directly
            if (uri.authority?.startsWith("com.android.providers.media") == true ||
                uri.authority == "media") {
                return queryDataColumn(uri)
            }
        } catch (_: Exception) {
            // Path resolution is best-effort
        }
        return null
    }

    /**
     * Query the deprecated but still functional _data column from a content URI.
     * Returns null if unavailable.
     */
    @Suppress("DEPRECATION")
    private fun queryDataColumn(uri: Uri): String? {
        try {
            val resolver = reactApplicationContext.contentResolver
            resolver.query(uri, arrayOf(MediaStore.MediaColumns.DATA), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val idx = cursor.getColumnIndex(MediaStore.MediaColumns.DATA)
                    if (idx >= 0) return cursor.getString(idx)
                }
            }
        } catch (_: Exception) {}
        return null
    }

    /**
     * Get the size in bytes of a file at the given absolute path.
     * Returns -1 if the file does not exist or cannot be read (CLOUD-003).
     *
     * @param filePath Absolute path to the file
     * @param promise Resolves with file size as Double, or -1.0
     */
    @ReactMethod
    fun getFileSize(filePath: String, promise: Promise) {
        scope.launch {
            try {
                val file = File(filePath)
                val size = if (file.exists()) file.length() else -1L
                withContext(Dispatchers.Main) {
                    promise.resolve(size.toDouble())
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { promise.resolve(-1.0) }
            }
        }
    }

    /**
     * Download a file from a URL to a local path, streaming to disk (CLOUD-004).
     * Used for restoring backup files from Google Drive without JS memory pressure.
     *
     * @param url The URL to download from (Drive media download URL)
     * @param authToken Bearer token for authorization
     * @param destPath Absolute path for the output file
     * @param promise Resolves with true on success, false on failure
     */
    @ReactMethod
    fun downloadFile(url: String, authToken: String, destPath: String, promise: Promise) {
        scope.launch {
            var connection: java.net.HttpURLConnection? = null
            try {
                connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                connection.setRequestProperty("Authorization", "Bearer $authToken")
                connection.connectTimeout = 30_000
                connection.readTimeout = 30_000
                connection.connect()
                if (connection.responseCode != 200) {
                    withContext(Dispatchers.Main) { promise.resolve(false) }
                    return@launch
                }
                File(destPath).parentFile?.mkdirs()
                connection.inputStream.use { input ->
                    FileOutputStream(destPath).use { output ->
                        input.copyTo(output)
                    }
                }
                withContext(Dispatchers.Main) { promise.resolve(true) }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { promise.resolve(false) }
            } finally {
                connection?.disconnect()
            }
        }
    }

    /**
     * Save a decrypted file to public storage (gallery) via MediaStore.
     * Works on API 29+ (scoped storage) via VOLUME_EXTERNAL_PRIMARY.
     *
     * @param sourcePath Absolute path to the decrypted temp file
     * @param fileName Desired display name in the gallery (e.g. "photo.jpg")
     * @param mimeType MIME type of the file (e.g. "image/jpeg")
     * @param promise Resolves with true on success, false on failure
     */
    @ReactMethod
    fun saveToPublicStorage(sourcePath: String, fileName: String, mimeType: String, promise: Promise) {
        scope.launch {
            try {
                val resolver = reactApplicationContext.contentResolver
                val isVideo = mimeType.startsWith("video/")

                val collection = if (isVideo) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                    } else {
                        MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                    }
                } else {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                    } else {
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                    }
                }

                val values = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val relativePath = if (isVideo) {
                            Environment.DIRECTORY_MOVIES + "/VaultCalc"
                        } else {
                            Environment.DIRECTORY_PICTURES + "/VaultCalc"
                        }
                        put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
                        put(MediaStore.MediaColumns.IS_PENDING, 1)
                    }
                }

                val insertUri = resolver.insert(collection, values)
                    ?: throw Exception("Failed to create MediaStore entry")

                try {
                    val outputStream = resolver.openOutputStream(insertUri)
                        ?: throw Exception("Failed to open output stream")

                    outputStream.use { output ->
                        FileInputStream(sourcePath).use { input ->
                            input.copyTo(output)
                        }
                    }

                    // Mark as no longer pending (API 29+)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val updateValues = ContentValues().apply {
                            put(MediaStore.MediaColumns.IS_PENDING, 0)
                        }
                        resolver.update(insertUri, updateValues, null, null)
                    }

                    // Notify media scanner for gallery visibility
                    val savedPath = queryDataColumn(insertUri)
                    if (savedPath != null) {
                        MediaScannerConnection.scanFile(
                            reactApplicationContext,
                            arrayOf(savedPath),
                            arrayOf(mimeType),
                            null
                        )
                    }

                    withContext(Dispatchers.Main) { promise.resolve(true) }
                } catch (e: Exception) {
                    // Clean up the partially-written MediaStore entry
                    try { resolver.delete(insertUri, null, null) } catch (_: Exception) {}
                    throw e
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("SAVE_TO_GALLERY_ERROR", "Failed to save to gallery")
                }
            }
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        scope.cancel()
    }
}
