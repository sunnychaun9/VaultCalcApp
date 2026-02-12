/**
 * VaultCalc - AdMob Native Module
 *
 * Provides Google AdMob integration for interstitial and rewarded ads.
 * Initialization is lazy — SDK is only loaded when explicitly called,
 * never on cold start. Premium users should never call initialize().
 *
 * Also exposes SystemClock.elapsedRealtime() for monotonic drift
 * detection used by the rewarded ad-free anti-tamper logic.
 *
 * Includes Google UMP (User Messaging Platform) consent methods
 * for GDPR compliance, and boot count for reboot-safe drift detection.
 *
 * @see FEATURE_INDEX.md ADS-001, ADS-002
 */

package com.vaultcalcapp.modules.admob

import android.os.SystemClock
import android.provider.Settings
import com.google.android.gms.ads.*
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import com.facebook.react.bridge.*
import kotlinx.coroutines.*

class AdMobModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AdMobModule"
    }

    override fun getName(): String = NAME

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    @Volatile private var initialized = false
    @Volatile private var interstitialAd: InterstitialAd? = null
    @Volatile private var rewardedAd: RewardedAd? = null
    private var consentInformation: ConsentInformation? = null

    /**
     * Initialize the Google Mobile Ads SDK.
     * Must be called before any ad load/show operations.
     * Call lazily — never on cold start.
     */
    @ReactMethod
    fun initialize(promise: Promise) {
        if (initialized) {
            promise.resolve(true)
            return
        }

        try {
            scope.launch {
                withContext(Dispatchers.Main) {
                    MobileAds.initialize(reactApplicationContext) {
                        initialized = true
                        promise.resolve(true)
                    }
                }
            }
        } catch (e: Exception) {
            promise.reject("AD_INIT_ERROR", "Failed to initialize AdMob SDK", e)
        }
    }

    /**
     * Preload an interstitial ad for the given ad unit ID.
     * Non-blocking — resolves true when loaded, rejects on failure.
     */
    @ReactMethod
    fun loadInterstitial(adUnitId: String, promise: Promise) {
        if (!initialized) {
            promise.reject("AD_NOT_INITIALIZED", "AdMob SDK not initialized")
            return
        }

        val request = AdRequest.Builder().build()
        scope.launch {
            withContext(Dispatchers.Main) {
                InterstitialAd.load(
                    reactApplicationContext,
                    adUnitId,
                    request,
                    object : InterstitialAdLoadCallback() {
                        override fun onAdLoaded(ad: InterstitialAd) {
                            interstitialAd = ad
                            promise.resolve(true)
                        }

                        override fun onAdFailedToLoad(error: LoadAdError) {
                            interstitialAd = null
                            promise.reject("AD_LOAD_ERROR", error.message)
                        }
                    }
                )
            }
        }
    }

    /**
     * Show a preloaded interstitial ad.
     * Resolves true when the ad is dismissed by the user.
     * Rejects if no ad is loaded or show fails.
     */
    @ReactMethod
    fun showInterstitial(promise: Promise) {
        val ad = interstitialAd
        val activity = reactApplicationContext.currentActivity

        if (ad == null) {
            promise.reject("AD_NOT_LOADED", "No interstitial ad loaded")
            return
        }
        if (activity == null) {
            promise.reject("AD_NO_ACTIVITY", "No activity available")
            return
        }

        scope.launch {
            withContext(Dispatchers.Main) {
                ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                    override fun onAdDismissedFullScreenContent() {
                        interstitialAd = null
                        promise.resolve(true)
                    }

                    override fun onAdFailedToShowFullScreenContent(error: AdError) {
                        interstitialAd = null
                        promise.reject("AD_SHOW_ERROR", error.message)
                    }
                }
                ad.show(activity)
            }
        }
    }

    /**
     * Preload a rewarded ad for the given ad unit ID.
     */
    @ReactMethod
    fun loadRewarded(adUnitId: String, promise: Promise) {
        if (!initialized) {
            promise.reject("AD_NOT_INITIALIZED", "AdMob SDK not initialized")
            return
        }

        val request = AdRequest.Builder().build()
        scope.launch {
            withContext(Dispatchers.Main) {
                RewardedAd.load(
                    reactApplicationContext,
                    adUnitId,
                    request,
                    object : RewardedAdLoadCallback() {
                        override fun onAdLoaded(ad: RewardedAd) {
                            rewardedAd = ad
                            promise.resolve(true)
                        }

                        override fun onAdFailedToLoad(error: LoadAdError) {
                            rewardedAd = null
                            promise.reject("AD_LOAD_ERROR", error.message)
                        }
                    }
                )
            }
        }
    }

    /**
     * Show a preloaded rewarded ad.
     * Resolves with { rewarded: true, type, amount } if user earns reward.
     * Resolves with { rewarded: false } if user dismisses without earning.
     * Rejects if no ad loaded or show fails.
     */
    @ReactMethod
    fun showRewarded(promise: Promise) {
        val ad = rewardedAd
        val activity = reactApplicationContext.currentActivity

        if (ad == null) {
            promise.reject("AD_NOT_LOADED", "No rewarded ad loaded")
            return
        }
        if (activity == null) {
            promise.reject("AD_NO_ACTIVITY", "No activity available")
            return
        }

        scope.launch {
            withContext(Dispatchers.Main) {
                var rewarded = false

                ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                    override fun onAdDismissedFullScreenContent() {
                        rewardedAd = null
                        if (!rewarded) {
                            val map = Arguments.createMap().apply {
                                putBoolean("rewarded", false)
                            }
                            promise.resolve(map)
                        }
                    }

                    override fun onAdFailedToShowFullScreenContent(error: AdError) {
                        rewardedAd = null
                        promise.reject("AD_SHOW_ERROR", error.message)
                    }
                }

                ad.show(activity) { rewardItem ->
                    rewarded = true
                    val map = Arguments.createMap().apply {
                        putBoolean("rewarded", true)
                        putString("type", rewardItem.type)
                        putInt("amount", rewardItem.amount)
                    }
                    promise.resolve(map)
                }
            }
        }
    }

    /** Check if an interstitial ad is preloaded and ready to show */
    @ReactMethod
    fun isInterstitialReady(promise: Promise) {
        promise.resolve(interstitialAd != null)
    }

    /** Check if a rewarded ad is preloaded and ready to show */
    @ReactMethod
    fun isRewardedReady(promise: Promise) {
        promise.resolve(rewardedAd != null)
    }

    /**
     * Returns SystemClock.elapsedRealtime() in milliseconds.
     * Monotonic clock counting from device boot — unaffected by
     * wall-clock changes. Used for drift detection in the rewarded
     * ad-free anti-tamper system.
     */
    @ReactMethod
    fun getElapsedRealtime(promise: Promise) {
        promise.resolve(SystemClock.elapsedRealtime().toDouble())
    }

    /**
     * Returns Settings.Global.BOOT_COUNT — increments on each device reboot.
     * Used to detect reboots for reboot-safe drift detection.
     * Available on API 17+ (our min is 24).
     */
    @ReactMethod
    fun getBootCount(promise: Promise) {
        try {
            val bootCount = Settings.Global.getInt(
                reactApplicationContext.contentResolver,
                Settings.Global.BOOT_COUNT,
                -1
            )
            promise.resolve(bootCount)
        } catch (e: Exception) {
            promise.resolve(-1)
        }
    }

    // -- UMP Consent Methods (ADS-002) --

    /**
     * Request an update to the user's consent information.
     * Must be called before showing consent form or loading ads.
     *
     * Resolves with the consent status string:
     * "REQUIRED", "NOT_REQUIRED", "OBTAINED", "UNKNOWN"
     */
    @ReactMethod
    fun requestConsentUpdate(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("AD_NO_ACTIVITY", "No activity available")
            return
        }

        val params = ConsentRequestParameters.Builder().build()

        scope.launch {
            withContext(Dispatchers.Main) {
                val info = UserMessagingPlatform.getConsentInformation(activity)
                consentInformation = info

                info.requestConsentInfoUpdate(
                    activity,
                    params,
                    {
                        promise.resolve(consentStatusToString(info.consentStatus))
                    },
                    { error ->
                        promise.reject("CONSENT_UPDATE_ERROR", error.message)
                    }
                )
            }
        }
    }

    /**
     * Load and show the consent form if required.
     * Resolves with the resulting consent status string.
     * If no form is needed (already obtained or not required), resolves immediately.
     */
    @ReactMethod
    fun showConsentForm(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("AD_NO_ACTIVITY", "No activity available")
            return
        }

        val info = consentInformation
        if (info == null) {
            promise.reject("CONSENT_NOT_INITIALIZED", "Call requestConsentUpdate first")
            return
        }

        scope.launch {
            withContext(Dispatchers.Main) {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(
                    activity
                ) { formError ->
                    if (formError != null) {
                        promise.reject("CONSENT_FORM_ERROR", formError.message)
                    } else {
                        promise.resolve(consentStatusToString(info.consentStatus))
                    }
                }
            }
        }
    }

    /**
     * Get the current consent status without triggering any UI.
     * Returns: "REQUIRED", "NOT_REQUIRED", "OBTAINED", "UNKNOWN"
     */
    @ReactMethod
    fun getConsentStatus(promise: Promise) {
        val info = consentInformation
        if (info == null) {
            promise.resolve("UNKNOWN")
            return
        }
        promise.resolve(consentStatusToString(info.consentStatus))
    }

    /**
     * Whether ads can be requested based on current consent state.
     * Returns true if consent is obtained or not required.
     */
    @ReactMethod
    fun canRequestAds(promise: Promise) {
        val info = consentInformation
        if (info == null) {
            // Before consent check, default to false (safe default)
            promise.resolve(false)
            return
        }
        promise.resolve(info.canRequestAds())
    }

    private fun consentStatusToString(status: Int): String {
        return when (status) {
            ConsentInformation.ConsentStatus.REQUIRED -> "REQUIRED"
            ConsentInformation.ConsentStatus.NOT_REQUIRED -> "NOT_REQUIRED"
            ConsentInformation.ConsentStatus.OBTAINED -> "OBTAINED"
            else -> "UNKNOWN"
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        scope.cancel()
        interstitialAd = null
        rewardedAd = null
    }
}
