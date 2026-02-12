/**
 * VaultCalc - Play Billing Native Module
 *
 * Provides Google Play Billing integration for subscriptions and
 * one-time in-app purchases.
 *
 * @see FEATURE_INDEX.md PREMIUM-002
 */

package com.vaultcalcapp.modules.billing

import android.app.Activity
import com.android.billingclient.api.*
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * React Native module providing Google Play Billing operations.
 *
 * Features:
 * - BillingClient connection management
 * - Product details querying (SUBS + INAPP)
 * - Purchase flow launching via Google Play UI
 * - Purchase acknowledgement
 * - Purchase restoration
 */
class BillingModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "BillingModule"
    }

    override fun getName(): String = NAME

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    @Volatile private var billingClient: BillingClient? = null
    @Volatile private var pendingPurchasePromise: Promise? = null
    private val promiseLock = Any()

    private val purchasesUpdatedListener = PurchasesUpdatedListener { billingResult, purchases ->
        val promise: Promise?
        synchronized(promiseLock) {
            promise = pendingPurchasePromise
            pendingPurchasePromise = null
        }

        if (promise == null) return@PurchasesUpdatedListener

        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            val purchase = purchases.firstOrNull()
            if (purchase != null) {
                val map = Arguments.createMap().apply {
                    putString("purchaseToken", purchase.purchaseToken)
                    putString("productId", purchase.products.firstOrNull() ?: "")
                    putInt("purchaseState", purchase.purchaseState)
                    putBoolean("isAcknowledged", purchase.isAcknowledged)
                }
                promise.resolve(map)
            } else {
                promise.reject("BILLING_FLOW_ERROR", "Purchase completed but no purchase data returned")
            }
        } else if (billingResult.responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
            val map = Arguments.createMap().apply {
                putBoolean("cancelled", true)
            }
            promise.resolve(map)
        } else {
            promise.reject("BILLING_FLOW_ERROR", "Purchase failed")
        }
    }

    /**
     * Connect BillingClient to Google Play Store.
     *
     * @param promise Resolves with true on success
     */
    @ReactMethod
    fun initialize(promise: Promise) {
        try {
            val client = BillingClient.newBuilder(reactApplicationContext)
                .setListener(purchasesUpdatedListener)
                .enablePendingPurchases()
                .build()

            client.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(billingResult: BillingResult) {
                    if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                        billingClient = client
                        promise.resolve(true)
                    } else {
                        promise.reject("BILLING_INIT_ERROR", "Billing setup failed")
                    }
                }

                override fun onBillingServiceDisconnected() {
                    // Will reconnect on next operation if needed
                }
            })
        } catch (e: Exception) {
            promise.reject("BILLING_INIT_ERROR", "Failed to initialize billing")
        }
    }

    /**
     * Query product details for the given product IDs.
     *
     * Queries both SUBS and INAPP product types and merges results.
     *
     * @param productIds ReadableArray of product ID strings
     * @param promise Resolves with array of product detail maps
     */
    @ReactMethod
    fun queryProducts(productIds: ReadableArray, promise: Promise) {
        val client = billingClient
        if (client == null || !client.isReady) {
            promise.reject("BILLING_NOT_CONNECTED", "Billing client is not connected. Call initialize() first.")
            return
        }

        scope.launch {
            try {
                val ids = mutableListOf<String>()
                for (i in 0 until productIds.size()) {
                    productIds.getString(i)?.let { ids.add(it) }
                }

                val allProducts = Arguments.createArray()

                // Query subscriptions
                val subsParams = QueryProductDetailsParams.newBuilder()
                    .setProductList(
                        ids.map { id ->
                            QueryProductDetailsParams.Product.newBuilder()
                                .setProductId(id)
                                .setProductType(BillingClient.ProductType.SUBS)
                                .build()
                        }
                    )
                    .build()

                val (subsBillingResult, subsDetailsList) = queryProductDetailsSuspend(client, subsParams)
                if (subsBillingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    subsDetailsList?.forEach { details ->
                        val offer = details.subscriptionOfferDetails?.firstOrNull()
                        val pricingPhase = offer?.pricingPhases?.pricingPhaseList?.firstOrNull()

                        val map = Arguments.createMap().apply {
                            putString("productId", details.productId)
                            putString("title", details.title)
                            putString("description", details.description)
                            putString("price", pricingPhase?.formattedPrice ?: "")
                            putDouble("priceMicros", (pricingPhase?.priceAmountMicros ?: 0L).toDouble())
                            putString("currencyCode", pricingPhase?.priceCurrencyCode ?: "")
                            putString("productType", "subs")
                            putString("offerToken", offer?.offerToken)
                        }
                        allProducts.pushMap(map)
                    }
                }

                // Query in-app purchases
                val inappParams = QueryProductDetailsParams.newBuilder()
                    .setProductList(
                        ids.map { id ->
                            QueryProductDetailsParams.Product.newBuilder()
                                .setProductId(id)
                                .setProductType(BillingClient.ProductType.INAPP)
                                .build()
                        }
                    )
                    .build()

                val (inappBillingResult, inappDetailsList) = queryProductDetailsSuspend(client, inappParams)
                if (inappBillingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    inappDetailsList?.forEach { details ->
                        val map = Arguments.createMap().apply {
                            putString("productId", details.productId)
                            putString("title", details.title)
                            putString("description", details.description)
                            putString("price", details.oneTimePurchaseOfferDetails?.formattedPrice ?: "")
                            putDouble("priceMicros", (details.oneTimePurchaseOfferDetails?.priceAmountMicros ?: 0L).toDouble())
                            putString("currencyCode", details.oneTimePurchaseOfferDetails?.priceCurrencyCode ?: "")
                            putString("productType", "inapp")
                            putNull("offerToken")
                        }
                        allProducts.pushMap(map)
                    }
                }

                withContext(Dispatchers.Main) { promise.resolve(allProducts) }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("BILLING_QUERY_ERROR", "Failed to query products")
                }
            }
        }
    }

    /**
     * Launch the Google Play purchase flow for a product.
     *
     * @param productId The product to purchase
     * @param offerToken Offer token for subscriptions (null for INAPP)
     * @param promise Resolves with purchase data or cancelled flag
     */
    @ReactMethod
    fun launchPurchaseFlow(productId: String, offerToken: String?, promise: Promise) {
        val client = billingClient
        if (client == null || !client.isReady) {
            promise.reject("BILLING_NOT_CONNECTED", "Billing client is not connected. Call initialize() first.")
            return
        }

        val activity: Activity? = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("BILLING_NO_ACTIVITY", "No activity available to launch purchase flow")
            return
        }

        synchronized(promiseLock) { pendingPurchasePromise = promise }

        scope.launch {
            try {
                // Determine product type based on offerToken presence
                val productType = if (offerToken != null) BillingClient.ProductType.SUBS else BillingClient.ProductType.INAPP

                val productDetailsParams = QueryProductDetailsParams.newBuilder()
                    .setProductList(
                        listOf(
                            QueryProductDetailsParams.Product.newBuilder()
                                .setProductId(productId)
                                .setProductType(productType)
                                .build()
                        )
                    )
                    .build()

                val (billingResult, detailsList) = queryProductDetailsSuspend(client, productDetailsParams)
                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    synchronized(promiseLock) { pendingPurchasePromise = null }
                    withContext(Dispatchers.Main) {
                        promise.reject("BILLING_FLOW_ERROR", "Failed to query product for purchase")
                    }
                    return@launch
                }

                val productDetails = detailsList?.firstOrNull()
                if (productDetails == null) {
                    synchronized(promiseLock) { pendingPurchasePromise = null }
                    withContext(Dispatchers.Main) {
                        promise.reject("BILLING_FLOW_ERROR", "Product not found")
                    }
                    return@launch
                }

                val productDetailsParamsList = listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetails)
                        .apply {
                            if (offerToken != null) {
                                setOfferToken(offerToken)
                            }
                        }
                        .build()
                )

                val billingFlowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(productDetailsParamsList)
                    .build()

                // launchBillingFlow must run on the main thread
                val flowResult = withContext(Dispatchers.Main) {
                    client.launchBillingFlow(activity, billingFlowParams)
                }
                if (flowResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    synchronized(promiseLock) { pendingPurchasePromise = null }
                    withContext(Dispatchers.Main) {
                        promise.reject("BILLING_FLOW_ERROR", "Failed to launch billing flow")
                    }
                }
                // If OK, result will come through purchasesUpdatedListener
            } catch (e: Exception) {
                synchronized(promiseLock) { pendingPurchasePromise = null }
                withContext(Dispatchers.Main) {
                    promise.reject("BILLING_FLOW_ERROR", "Failed to launch purchase flow")
                }
            }
        }
    }

    /**
     * Query active purchases (subscriptions + in-app).
     *
     * @param promise Resolves with array of purchase maps
     */
    @ReactMethod
    fun queryPurchases(promise: Promise) {
        val client = billingClient
        if (client == null || !client.isReady) {
            promise.reject("BILLING_NOT_CONNECTED", "Billing client is not connected. Call initialize() first.")
            return
        }

        scope.launch {
            try {
                val allPurchases = Arguments.createArray()

                // Query subscriptions
                val subsParams = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()
                val (subsBillingResult, subsPurchasesList) = queryPurchasesSuspend(client, subsParams)
                if (subsBillingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    subsPurchasesList.forEach { purchase ->
                        allPurchases.pushMap(purchaseToMap(purchase))
                    }
                }

                // Query in-app purchases
                val inappParams = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()
                val (inappBillingResult, inappPurchasesList) = queryPurchasesSuspend(client, inappParams)
                if (inappBillingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    inappPurchasesList.forEach { purchase ->
                        allPurchases.pushMap(purchaseToMap(purchase))
                    }
                }

                withContext(Dispatchers.Main) { promise.resolve(allPurchases) }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("BILLING_QUERY_ERROR", "Failed to query purchases")
                }
            }
        }
    }

    /**
     * Acknowledge a purchase. Required within 3 days of purchase.
     *
     * @param purchaseToken The token of the purchase to acknowledge
     * @param promise Resolves with true on success
     */
    @ReactMethod
    fun acknowledgePurchase(purchaseToken: String, promise: Promise) {
        val client = billingClient
        if (client == null || !client.isReady) {
            promise.reject("BILLING_NOT_CONNECTED", "Billing client is not connected. Call initialize() first.")
            return
        }

        scope.launch {
            try {
                val params = AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(purchaseToken)
                    .build()

                val result = acknowledgePurchaseSuspend(client, params)
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    withContext(Dispatchers.Main) { promise.resolve(true) }
                } else {
                    withContext(Dispatchers.Main) {
                        promise.reject("BILLING_ACKNOWLEDGE_ERROR", "Acknowledge failed")
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("BILLING_ACKNOWLEDGE_ERROR", "Failed to acknowledge purchase")
                }
            }
        }
    }

    // -- Suspend wrappers for callback-based Billing APIs (7.x) --

    private suspend fun queryProductDetailsSuspend(
        client: BillingClient,
        params: QueryProductDetailsParams
    ): Pair<BillingResult, List<ProductDetails>?> =
        suspendCancellableCoroutine { cont ->
            client.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
                cont.resume(Pair(billingResult, productDetailsList))
            }
        }

    private suspend fun queryPurchasesSuspend(
        client: BillingClient,
        params: QueryPurchasesParams
    ): Pair<BillingResult, List<Purchase>> =
        suspendCancellableCoroutine { cont ->
            client.queryPurchasesAsync(params) { billingResult, purchasesList ->
                cont.resume(Pair(billingResult, purchasesList))
            }
        }

    private suspend fun acknowledgePurchaseSuspend(
        client: BillingClient,
        params: AcknowledgePurchaseParams
    ): BillingResult =
        suspendCancellableCoroutine { cont ->
            client.acknowledgePurchase(params) { billingResult ->
                cont.resume(billingResult)
            }
        }

    private fun purchaseToMap(purchase: Purchase): WritableMap {
        return Arguments.createMap().apply {
            putString("purchaseToken", purchase.purchaseToken)
            putString("productId", purchase.products.firstOrNull() ?: "")
            putInt("purchaseState", purchase.purchaseState)
            putBoolean("isAcknowledged", purchase.isAcknowledged)
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        scope.cancel()
        synchronized(promiseLock) {
            pendingPurchasePromise?.reject("BILLING_MODULE_DESTROYED", "Billing module is being destroyed")
            pendingPurchasePromise = null
        }
        billingClient?.endConnection()
        billingClient = null
    }
}
