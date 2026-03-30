/**
 * VaultCalc - Billing Service
 *
 * High-level API for Google Play Billing operations.
 * Wraps the native BillingModule with error handling.
 * Never throws — returns result objects.
 *
 * @see FEATURE_INDEX.md PREMIUM-002
 */

import { NativeBilling, type ProductInfo, type PurchaseInfo } from './nativeBilling';

export type { ProductInfo, PurchaseInfo, BillingErrorCode, PurchaseFlowResult } from './nativeBilling';

/** All VaultCalc product IDs */
const PRODUCT_IDS = [
  'vaultcalc_premium_monthly',
  'vaultcalc_premium_yearly',
  'vaultcalc_premium_lifetime',
  'vaultcalc_remove_ads',
];

export interface PurchaseResult {
  success: boolean;
  purchase?: PurchaseInfo;
  cancelled?: boolean;
  error?: string;
}

/**
 * Connect to Google Play Billing service.
 *
 * Never throws — returns a safe fallback on error.
 */
export async function initializeBilling(): Promise<{ success: boolean }> {
  try {
    await NativeBilling.initialize();
    return { success: true };
  } catch {
    return { success: false };
  }
}

/**
 * Query all VaultCalc product details from Google Play.
 *
 * Never throws — returns empty array on error.
 */
export async function loadProducts(): Promise<{ success: boolean; products?: ProductInfo[] }> {
  try {
    const products = await NativeBilling.queryProducts(PRODUCT_IDS);
    return { success: true, products };
  } catch {
    return { success: false };
  }
}

/**
 * Launch purchase flow and auto-acknowledge on success.
 *
 * Never throws — returns result object.
 */
export async function purchaseProduct(
  productId: string,
  offerToken?: string | null,
): Promise<PurchaseResult> {
  try {
    const result = await NativeBilling.launchPurchaseFlow(productId, offerToken ?? null);

    if (result.cancelled) {
      return { success: false, cancelled: true };
    }

    if (result.purchaseToken && result.productId) {
      const purchase: PurchaseInfo = {
        purchaseToken: result.purchaseToken,
        productId: result.productId,
        purchaseState: result.purchaseState ?? 0,
        isAcknowledged: result.isAcknowledged ?? false,
      };

      // Auto-acknowledge if not already acknowledged
      if (!purchase.isAcknowledged && purchase.purchaseState === 1) {
        try {
          await NativeBilling.acknowledgePurchase(purchase.purchaseToken);
          purchase.isAcknowledged = true;
        } catch {
          // Non-fatal — purchase succeeded, acknowledge can retry later
        }
      }

      return { success: true, purchase };
    }

    return { success: false, error: 'Unexpected purchase result' };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Purchase failed';
    return { success: false, error: message };
  }
}

/**
 * Query existing purchases for restore flow.
 *
 * Never throws — returns empty array on error.
 */
export async function restorePurchases(): Promise<{ success: boolean; purchases?: PurchaseInfo[] }> {
  try {
    const purchases = await NativeBilling.queryPurchases();
    return { success: true, purchases };
  } catch {
    return { success: false };
  }
}

/**
 * Find the active premium purchase from a list of purchases.
 *
 * Returns the first purchase with purchaseState === 1 (PURCHASED)
 * that matches one of our product IDs.
 */
export function getActivePremiumPurchase(purchases: PurchaseInfo[]): PurchaseInfo | null {
  return purchases.find(
    (p) => p.purchaseState === 1 && PRODUCT_IDS.includes(p.productId),
  ) ?? null;
}
