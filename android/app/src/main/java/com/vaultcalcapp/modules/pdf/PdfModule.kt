/**
 * VaultCalc - PDF Native Module
 *
 * Renders PDF pages to JPEG bitmaps using Android's built-in PdfRenderer.
 * Provides page count and per-page rendering for the in-app PDF viewer.
 *
 * @see FEATURE_INDEX.md DOC-003
 */

package com.vaultcalcapp.modules.pdf

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import java.io.File
import java.io.FileOutputStream

/**
 * React Native module providing PDF rendering operations.
 *
 * Features:
 * - Page count retrieval
 * - Per-page JPEG rendering with configurable width
 * - Aspect-ratio-preserving scaling
 */
class PdfModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "PdfModule"
        private const val ERROR_PDF = "PDF_RENDER_ERROR"
        private const val JPEG_QUALITY = 90
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun getName(): String = NAME

    /**
     * Get the number of pages in a PDF file.
     *
     * @param filePath Absolute path to the PDF file
     * @param promise Resolves with the page count (Int)
     */
    @ReactMethod
    fun getPageCount(filePath: String, promise: Promise) {
        scope.launch {
            try {
                val file = File(filePath)
                if (!file.exists()) {
                    throw Exception("PDF file not found")
                }

                val fd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                val renderer = PdfRenderer(fd)
                val count = renderer.pageCount
                renderer.close()
                fd.close()

                promise.resolve(count)
            } catch (e: Exception) {
                promise.reject(ERROR_PDF, "Failed to get page count")
            }
        }
    }

    /**
     * Render a single PDF page to a JPEG file.
     *
     * @param filePath Absolute path to the PDF file
     * @param pageIndex Zero-based page index
     * @param outputPath Absolute path for the output JPEG
     * @param renderWidth Desired width in pixels (height is computed from aspect ratio)
     * @param promise Resolves with { width, height, path }
     */
    @ReactMethod
    fun renderPage(filePath: String, pageIndex: Int, outputPath: String, renderWidth: Int, promise: Promise) {
        scope.launch {
            try {
                val file = File(filePath)
                if (!file.exists()) {
                    throw Exception("PDF file not found")
                }

                val fd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                val renderer = PdfRenderer(fd)

                if (pageIndex < 0 || pageIndex >= renderer.pageCount) {
                    renderer.close()
                    fd.close()
                    throw Exception("Page index out of range")
                }

                var page: PdfRenderer.Page? = null
                try {
                    page = renderer.openPage(pageIndex)

                    // Compute render dimensions preserving aspect ratio
                    val aspectRatio = page.height.toFloat() / page.width.toFloat()
                    val width = renderWidth
                    val height = (width * aspectRatio).toInt().coerceAtLeast(1)

                    // Create bitmap with white background
                    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                    bitmap.eraseColor(Color.WHITE)

                    // Render page to bitmap
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)

                    try {
                        // Ensure parent directory exists
                        File(outputPath).parentFile?.mkdirs()

                        // Write JPEG to disk
                        FileOutputStream(outputPath).use { out ->
                            bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
                        }

                        val result = Arguments.createMap().apply {
                            putInt("width", width)
                            putInt("height", height)
                            putString("path", outputPath)
                        }
                        promise.resolve(result)
                    } finally {
                        bitmap.recycle()
                    }
                } finally {
                    page?.close()
                    renderer.close()
                    fd.close()
                }
            } catch (e: Exception) {
                promise.reject(ERROR_PDF, "Failed to render page")
            }
        }
    }

    /**
     * Generate a JPEG thumbnail from the first page of a PDF content URI (DOC-004).
     * Used during import when we have a content:// URI (not a file path).
     *
     * @param sourceUri content:// URI of the PDF file
     * @param destPath Absolute path for the output thumbnail JPEG
     * @param maxDimension Maximum width or height in pixels
     * @param promise Resolves with { width, height, thumbnailPath }
     */
    @ReactMethod
    fun generatePdfThumbnail(sourceUri: String, destPath: String, maxDimension: Int, promise: Promise) {
        scope.launch {
            try {
                val uri = Uri.parse(sourceUri)
                val resolver = reactApplicationContext.contentResolver

                val fd = resolver.openFileDescriptor(uri, "r")
                    ?: throw Exception("Cannot open PDF content URI")

                val renderer = PdfRenderer(fd)
                if (renderer.pageCount == 0) {
                    renderer.close()
                    fd.close()
                    throw Exception("PDF has no pages")
                }

                var page: PdfRenderer.Page? = null
                try {
                    page = renderer.openPage(0)

                    // Compute target dimensions preserving aspect ratio
                    val aspectRatio = page.height.toFloat() / page.width.toFloat()
                    val targetWidth: Int
                    val targetHeight: Int
                    if (page.width >= page.height) {
                        targetWidth = maxDimension
                        targetHeight = (maxDimension * aspectRatio).toInt().coerceAtLeast(1)
                    } else {
                        targetHeight = maxDimension
                        targetWidth = (maxDimension / aspectRatio).toInt().coerceAtLeast(1)
                    }

                    val bitmap = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888)
                    bitmap.eraseColor(Color.WHITE)

                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)

                    try {
                        File(destPath).parentFile?.mkdirs()

                        FileOutputStream(destPath).use { out ->
                            bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
                        }

                        val result = Arguments.createMap().apply {
                            putInt("width", targetWidth)
                            putInt("height", targetHeight)
                            putString("thumbnailPath", destPath)
                        }
                        promise.resolve(result)
                    } finally {
                        bitmap.recycle()
                    }
                } finally {
                    page?.close()
                    renderer.close()
                    fd.close()
                }
            } catch (e: Exception) {
                promise.reject(ERROR_PDF, "PDF thumbnail generation failed")
            }
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        scope.cancel()
    }
}
