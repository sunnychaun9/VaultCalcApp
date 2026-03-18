/**
 * VaultCalc - Intruder Location Module
 *
 * Captures device location using FusedLocationProviderClient
 * and reverse-geocodes to city name using Android Geocoder.
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
     * Check if location permission is granted.
     */
    @ReactMethod
    fun hasPermission(promise: Promise) {
        val hasFine = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val hasCoarse = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        promise.resolve(hasFine || hasCoarse)
    }

    /**
     * Get current device location with city name.
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

        val hasFine = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val hasCoarse = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasFine && !hasCoarse) {
            return unknownLocation()
        }

        val client = LocationServices.getFusedLocationProviderClient(context)

        // Try last known location first (instant, no GPS fix needed)
        val lastLocation: Location? = try {
            client.lastLocation.await()
        } catch (_: Exception) {
            null
        }

        val location: Location? = if (lastLocation != null) {
            lastLocation
        } else {
            // Fall back to a fresh location request
            try {
                val cts = CancellationTokenSource()
                val priority = if (hasFine) Priority.PRIORITY_HIGH_ACCURACY
                    else Priority.PRIORITY_BALANCED_POWER_ACCURACY
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
