/**
 * VaultCalc - Gallery Native Module
 *
 * Queries local media via Android MediaStore for the in-app gallery picker.
 * Only returns on-device files (no cloud-backed content).
 * Also handles batch delete via system dialog (API 30+).
 *
 * @see FEATURE_INDEX.md GALLERY-001
 */

package com.vaultcalcapp.modules.gallery

import android.app.Activity
import android.content.ContentUris
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.facebook.react.bridge.*
import kotlinx.coroutines.*

/**
 * React Native module providing MediaStore-based gallery access.
 *
 * Methods:
 * - queryAlbums: Get album list (buckets) with counts and cover URIs
 * - queryMediaInAlbum: Get media items within an album bucket
 * - requestDeletePermission: Batch delete via system dialog (API 30+) or direct (API <30)
 */
class GalleryModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "GalleryModule"
        private const val ERROR_QUERY = "GALLERY_QUERY_ERROR"
        private const val ERROR_DELETE = "GALLERY_DELETE_ERROR"
        private const val DELETE_REQUEST_CODE = 9501
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    /** Pending promise for delete permission request (API 30+) */
    private var pendingDeletePromise: Promise? = null

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: android.content.Intent?) {
            if (requestCode == DELETE_REQUEST_CODE) {
                val promise = pendingDeletePromise
                pendingDeletePromise = null
                if (promise != null) {
                    val deleted = resultCode == Activity.RESULT_OK
                    promise.resolve(deleted)
                }
            }
        }
    }

    init {
        reactContext.addActivityEventListener(activityEventListener)
    }

    override fun getName(): String = NAME

    /**
     * Get the base content URI for a given media type.
     */
    private fun getContentUri(mediaType: String): Uri {
        return if (mediaType == "video") {
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        } else {
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        }
    }

    /**
     * Query album (bucket) list from MediaStore.
     *
     * @param mediaType "image" or "video"
     * @param promise Resolves with array of { bucketId, bucketName, itemCount, coverUri }
     */
    @ReactMethod
    fun queryAlbums(mediaType: String, promise: Promise) {
        scope.launch {
            try {
                val resolver = reactApplicationContext.contentResolver
                val contentUri = getContentUri(mediaType)

                val projection = arrayOf(
                    MediaStore.MediaColumns.BUCKET_ID,
                    MediaStore.MediaColumns.BUCKET_DISPLAY_NAME,
                    MediaStore.MediaColumns._ID,
                    MediaStore.MediaColumns.DATE_ADDED,
                )

                val sortOrder = "${MediaStore.MediaColumns.DATE_ADDED} DESC"

                val cursor = resolver.query(contentUri, projection, null, null, sortOrder)

                if (cursor == null) {
                    withContext(Dispatchers.Main) { promise.resolve(Arguments.createArray()) }
                    return@launch
                }

                // Group by bucket — track count, most recent item ID for cover
                data class BucketInfo(
                    val bucketName: String,
                    var itemCount: Int,
                    var coverId: Long, // ID of the most recent item (first encountered due to DESC sort)
                )

                val buckets = LinkedHashMap<String, BucketInfo>()
                var totalCount = 0

                // First cover item ID for the "All" synthetic album
                var allCoverId: Long = -1

                cursor.use { c ->
                    val idxBucketId = c.getColumnIndexOrThrow(MediaStore.MediaColumns.BUCKET_ID)
                    val idxBucketName = c.getColumnIndexOrThrow(MediaStore.MediaColumns.BUCKET_DISPLAY_NAME)
                    val idxId = c.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)

                    while (c.moveToNext()) {
                        val bucketId = c.getString(idxBucketId) ?: "unknown"
                        val bucketName = c.getString(idxBucketName) ?: "Unknown"
                        val itemId = c.getLong(idxId)

                        totalCount++
                        if (allCoverId == -1L) allCoverId = itemId

                        val existing = buckets[bucketId]
                        if (existing != null) {
                            existing.itemCount++
                        } else {
                            buckets[bucketId] = BucketInfo(bucketName, 1, itemId)
                        }
                    }
                }

                val result = Arguments.createArray()

                // Prepend synthetic "All" album
                if (totalCount > 0) {
                    val allAlbum = Arguments.createMap().apply {
                        putString("bucketId", "ALL")
                        putString("bucketName", if (mediaType == "video") "All Videos" else "All Photos")
                        putInt("itemCount", totalCount)
                        putString("coverUri", ContentUris.withAppendedId(contentUri, allCoverId).toString())
                    }
                    result.pushMap(allAlbum)
                }

                // Add real buckets
                for ((bucketId, info) in buckets) {
                    val album = Arguments.createMap().apply {
                        putString("bucketId", bucketId)
                        putString("bucketName", info.bucketName)
                        putInt("itemCount", info.itemCount)
                        putString("coverUri", ContentUris.withAppendedId(contentUri, info.coverId).toString())
                    }
                    result.pushMap(album)
                }

                withContext(Dispatchers.Main) { promise.resolve(result) }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject(ERROR_QUERY, "Failed to query albums")
                }
            }
        }
    }

    /**
     * Query media items within an album bucket.
     *
     * @param bucketId Bucket ID to filter, or "ALL" for all items
     * @param mediaType "image" or "video"
     * @param promise Resolves with array of media item objects
     */
    @ReactMethod
    fun queryMediaInAlbum(bucketId: String, mediaType: String, promise: Promise) {
        scope.launch {
            try {
                val resolver = reactApplicationContext.contentResolver
                val contentUri = getContentUri(mediaType)

                val projection = arrayOf(
                    MediaStore.MediaColumns._ID,
                    MediaStore.MediaColumns.DISPLAY_NAME,
                    MediaStore.MediaColumns.SIZE,
                    MediaStore.MediaColumns.MIME_TYPE,
                    MediaStore.MediaColumns.DATE_ADDED,
                    MediaStore.MediaColumns.WIDTH,
                    MediaStore.MediaColumns.HEIGHT,
                ) + if (mediaType == "video") {
                    arrayOf(MediaStore.Video.VideoColumns.DURATION)
                } else {
                    emptyArray()
                }

                val selection = if (bucketId != "ALL") {
                    "${MediaStore.MediaColumns.BUCKET_ID} = ?"
                } else {
                    null
                }
                val selectionArgs = if (bucketId != "ALL") {
                    arrayOf(bucketId)
                } else {
                    null
                }

                val sortOrder = "${MediaStore.MediaColumns.DATE_ADDED} DESC"

                val cursor = resolver.query(contentUri, projection, selection, selectionArgs, sortOrder)

                if (cursor == null) {
                    withContext(Dispatchers.Main) { promise.resolve(Arguments.createArray()) }
                    return@launch
                }

                val result = Arguments.createArray()

                cursor.use { c ->
                    val idxId = c.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
                    val idxName = c.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
                    val idxSize = c.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE)
                    val idxMime = c.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE)
                    val idxDate = c.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
                    val idxWidth = c.getColumnIndexOrThrow(MediaStore.MediaColumns.WIDTH)
                    val idxHeight = c.getColumnIndexOrThrow(MediaStore.MediaColumns.HEIGHT)
                    val idxDuration = if (mediaType == "video") {
                        c.getColumnIndex(MediaStore.Video.VideoColumns.DURATION)
                    } else {
                        -1
                    }

                    while (c.moveToNext()) {
                        val id = c.getLong(idxId)
                        val uri = ContentUris.withAppendedId(contentUri, id)

                        val item = Arguments.createMap().apply {
                            putString("id", id.toString())
                            putString("uri", uri.toString())
                            putString("name", c.getString(idxName) ?: "")
                            putString("mimeType", c.getString(idxMime) ?: "")
                            putDouble("size", c.getLong(idxSize).toDouble())
                            putInt("width", c.getInt(idxWidth))
                            putInt("height", c.getInt(idxHeight))
                            putDouble("dateAdded", c.getLong(idxDate).toDouble())
                            if (idxDuration >= 0) {
                                putDouble("durationMs", c.getLong(idxDuration).toDouble())
                            }
                        }
                        result.pushMap(item)
                    }
                }

                withContext(Dispatchers.Main) { promise.resolve(result) }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject(ERROR_QUERY, "Failed to query media")
                }
            }
        }
    }

    /**
     * Request deletion of media items via system dialog (API 30+) or direct delete (API <30).
     *
     * @param uris ReadableArray of content:// URI strings
     * @param promise Resolves with true if deleted, false if user cancelled or error
     */
    @ReactMethod
    fun requestDeletePermission(uris: ReadableArray, promise: Promise) {
        scope.launch {
            try {
                val resolver = reactApplicationContext.contentResolver
                val uriList = mutableListOf<Uri>()

                for (i in 0 until uris.size()) {
                    uriList.add(Uri.parse(uris.getString(i)))
                }

                if (uriList.isEmpty()) {
                    withContext(Dispatchers.Main) { promise.resolve(true) }
                    return@launch
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    // API 30+: Use system delete dialog
                    val deleteRequest = MediaStore.createDeleteRequest(resolver, uriList)

                    withContext(Dispatchers.Main) {
                        val activity = reactApplicationContext.currentActivity
                        if (activity == null) {
                            promise.reject(ERROR_DELETE, "No activity available")
                            return@withContext
                        }
                        pendingDeletePromise = promise
                        activity.startIntentSenderForResult(
                            deleteRequest.intentSender,
                            DELETE_REQUEST_CODE,
                            null, 0, 0, 0
                        )
                    }
                } else {
                    // API <30: Delete directly
                    var allDeleted = true
                    for (uri in uriList) {
                        try {
                            val rows = resolver.delete(uri, null, null)
                            if (rows == 0) allDeleted = false
                        } catch (_: Exception) {
                            allDeleted = false
                        }
                    }
                    withContext(Dispatchers.Main) { promise.resolve(allDeleted) }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject(ERROR_DELETE, "Delete request failed")
                }
            }
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        scope.cancel()
        reactApplicationContext.removeActivityEventListener(activityEventListener)
        pendingDeletePromise = null
    }
}
