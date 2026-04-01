/**
 * VaultCalc - Intruder Location Module
 *
 * Captures device location using FusedLocationProviderClient
 * and reverse-geocodes to city name using Android Geocoder.
 *
 * PLAY STORE COMPLIANCE:
 * - Location logging is a SEPARATE opt-in toggle ("Record Intruder Location")
 * - Only ACCESS_COARSE_LOCATION is requested (approximate, not precise)
 * - Uses last known location or a single one-shot fix — no continuous tracking
 * - No background location access (ACCESS_BACKGROUND_LOCATION is NOT declared)
 * - Feature is OFF by default; user sees explanation dialog before permission prompt
 *
 * @see Intruder Intelligence feature (SEC-005)
 */

package com.vaultcalcapp.modules.intruder

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.*
import kotlinx.coroutines.tasks.await
import java.util.Locale

class IntruderLocationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "IntruderLocationModule"
        /** Max time to wait for a location fix */
        private const val LOCATION_TIMEOUT_MS = 5000L
    }

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    override fun getName(): String = NAME

    /**
     * Check if location permission is granted (COARSE is sufficient).
     */
    @ReactMethod
    fun hasPermission(promise: Promise) {
        val hasCoarse = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        promise.resolve(hasCoarse)
    }

    /**
     * Get approximate device location with city name (one-shot, not continuous).
     *
     * Only called when the user has explicitly enabled "Record Intruder Location"
     * in Settings and granted ACCESS_COARSE_LOCATION permission.
     *
     * Returns: { latitude: double, longitude: double, cityName: string }
     * Falls back to { latitude: 0, longitude: 0, cityName: "Unknown" } on failure.
     */
    @ReactMethod
    fun getLocation(promise: Promise) {
        scope.launch {
            try {
                val result = fetchLocation()
                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.resolve(unknownLocation())
                }
            }
        }
    }

    private fun unknownLocation(): WritableMap = Arguments.createMap().apply {
        putDouble("latitude", 0.0)
        putDouble("longitude", 0.0)
        putString("cityName", "Unknown")
    }

    @Suppress("MissingPermission")
    private suspend fun fetchLocation(): WritableMap {
        val context = reactApplicationContext

        val hasCoarse = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasCoarse) {
            return unknownLocation()
        }

        val client = LocationServices.getFusedLocationProviderClient(context)

        // Prefer last known location (instant, no GPS fix needed, no continuous tracking)
        val lastLocation: Location? = try {
            client.lastLocation.await()
        } catch (_: Exception) {
            null
        }

        val location: Location? = if (lastLocation != null) {
            lastLocation
        } else {
            // Fall back to a single one-shot location fix (not continuous tracking)
            try {
                val cts = CancellationTokenSource()
                // Use BALANCED_POWER_ACCURACY (COARSE-level) — we only need approximate location
                val priority = Priority.PRIORITY_BALANCED_POWER_ACCURACY
                withTimeout(LOCATION_TIMEOUT_MS) {
                    client.getCurrentLocation(priority, cts.token).await()
                }
            } catch (_: Exception) {
                null
            }
        }

        if (location == null) {
            return unknownLocation()
        }

        val lat = location.latitude
        val lng = location.longitude
        val cityName = reverseGeocode(context, lat, lng)

        return Arguments.createMap().apply {
            putDouble("latitude", lat)
            putDouble("longitude", lng)
            putString("cityName", cityName)
        }
    }

    private fun reverseGeocode(context: Context, lat: Double, lng: Double): String {
        return try {
            if (!Geocoder.isPresent()) return "Unknown"
            val geocoder = Geocoder(context, Locale.getDefault())
            @Suppress("DEPRECATION")
            val addresses = geocoder.getFromLocation(lat, lng, 1)
            if (!addresses.isNullOrEmpty()) {
                val addr = addresses[0]
                addr.locality ?: addr.subAdminArea ?: addr.adminArea ?: "Unknown"
            } else {
                "Unknown"
            }
        } catch (_: Exception) {
            "Unknown"
        }
    }

    override fun onCatalystInstanceDestroy() {
        scope.cancel()
        super.onCatalystInstanceDestroy()
    }
}
