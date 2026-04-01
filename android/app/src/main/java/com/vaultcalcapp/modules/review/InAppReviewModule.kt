/**
 * VaultCalc - In-App Review Native Module
 *
 * Wraps the Google Play In-App Review API (Play Core).
 * Provides a single method to request and launch the review flow.
 *
 * Google's API handles all rate-limiting internally — the app
 * cannot control when the dialog actually appears. The API may
 * silently no-op if the user has already reviewed or if the
 * quota has been exceeded.
 */

package com.vaultcalcapp.modules.review

import com.google.android.play.core.review.ReviewManagerFactory
import com.facebook.react.bridge.*
import kotlinx.coroutines.*

class InAppReviewModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "InAppReviewModule"
    }

    override fun getName(): String = NAME

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    /**
     * Request and launch the Google Play In-App Review flow.
     *
     * The review dialog is shown by Google — the app has no control
     * over whether it actually appears. Google may silently skip it
     * if the user has already reviewed or quota is exceeded.
     *
     * Resolves true if the flow was launched (not necessarily shown).
     * Rejects if the request or launch fails.
     */
    @ReactMethod
    fun launchReviewFlow(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("REVIEW_NO_ACTIVITY", "No activity available")
            return
        }

        scope.launch {
            try {
                val manager = ReviewManagerFactory.create(reactApplicationContext)
                val reviewInfo = manager.requestReviewFlow()

                withContext(Dispatchers.Main) {
                    reviewInfo.addOnCompleteListener { task ->
                        if (task.isSuccessful) {
                            val flow = manager.launchReviewFlow(activity, task.result)
                            flow.addOnCompleteListener {
                                // Flow completed — user may or may not have reviewed.
                                // Google does not tell us the outcome.
                                promise.resolve(true)
                            }
                        } else {
                            promise.reject(
                                "REVIEW_REQUEST_FAILED",
                                task.exception?.message ?: "Failed to request review flow"
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                promise.reject("REVIEW_ERROR", e.message, e)
            }
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        scope.cancel()
    }
}
