/**
 * VaultCalc - Install Referrer Native Module
 *
 * Reads the Google Play Install Referrer on first launch so we can attribute
 * new installs back to the user who shared the referral link.
 *
 * The referrer string is a URL query string set when the Play Store opens a
 * listing URL like:
 *     https://play.google.com/store/apps/details?id=com.vaultcalcapp
 *         &referrer=utm_source%3Dvaultcalc%26utm_content%3D<REF_CODE>
 *
 * Play makes this available once per install via InstallReferrerClient.
 * After we read it, the JS side records which referral code installed this
 * device (if any) so we can (a) grant the new user a 7-day premium reward
 * and (b) never ask again on subsequent launches.
 *
 * This module ONLY reads — it does not write, and it holds no state beyond
 * the short-lived InstallReferrerClient connection.
 */

package com.vaultcalcapp.modules.referral

import android.util.Log
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.android.installreferrer.api.ReferrerDetails
import com.facebook.react.bridge.*

class InstallReferrerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "InstallReferrerModule"
        private const val TAG = "InstallReferrer"
    }

    override fun getName(): String = NAME

    /**
     * Reads the install referrer exactly once (Play's API is single-shot per
     * connection; we open → read → close).
     *
     * Resolves to an object shaped like:
     *   {
     *     referrer: string | null,   // raw referrer URL (may be empty)
     *     installBeginSeconds: number,
     *     referrerClickSeconds: number,
     *   }
     *
     * Never throws to JS — resolves with `{ referrer: null }` on any failure
     * (old OS, Play not installed, service unavailable) so the JS call site
     * stays simple.
     */
    @ReactMethod
    fun getInstallReferrer(promise: Promise) {
        val client = try {
            InstallReferrerClient.newBuilder(reactApplicationContext).build()
        } catch (t: Throwable) {
            Log.w(TAG, "client build failed", t)
            promise.resolve(emptyResult())
            return
        }

        var resolved = false
        fun resolveOnce(value: WritableMap) {
            if (!resolved) {
                resolved = true
                try { client.endConnection() } catch (_: Throwable) {}
                promise.resolve(value)
            }
        }

        try {
            client.startConnection(object : InstallReferrerStateListener {
                override fun onInstallReferrerSetupFinished(responseCode: Int) {
                    when (responseCode) {
                        InstallReferrerClient.InstallReferrerResponse.OK -> {
                            try {
                                val details: ReferrerDetails = client.installReferrer
                                val result = Arguments.createMap().apply {
                                    putString("referrer", details.installReferrer)
                                    putDouble("installBeginSeconds", details.installBeginTimestampSeconds.toDouble())
                                    putDouble("referrerClickSeconds", details.referrerClickTimestampSeconds.toDouble())
                                }
                                resolveOnce(result)
                            } catch (t: Throwable) {
                                Log.w(TAG, "read failed", t)
                                resolveOnce(emptyResult())
                            }
                        }
                        else -> {
                            // FEATURE_NOT_SUPPORTED / SERVICE_UNAVAILABLE / etc.
                            resolveOnce(emptyResult())
                        }
                    }
                }

                override fun onInstallReferrerServiceDisconnected() {
                    // Don't retry — we only need a single read per install.
                    resolveOnce(emptyResult())
                }
            })
        } catch (t: Throwable) {
            Log.w(TAG, "startConnection failed", t)
            resolveOnce(emptyResult())
        }
    }

    private fun emptyResult(): WritableMap = Arguments.createMap().apply {
        putString("referrer", null)
        putDouble("installBeginSeconds", 0.0)
        putDouble("referrerClickSeconds", 0.0)
    }
}
