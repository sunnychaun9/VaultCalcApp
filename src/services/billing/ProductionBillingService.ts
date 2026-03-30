/**
 * VaultCalc - Production Billing Service
 *
 * Delegates to billingService.ts which wraps the native BillingModule
 * (Google Play Billing v7.1.1).
 *
 * @see FEATURE_INDEX.md PREMIUM-002
 */

import type { BillingService } from './billingServiceInterface';
import {
  SubscriptionState,
  type BillingResult,
  type BillingProductInfo,
  type BillingPurchaseInfo,
  type BillingPurchaseResult,
} from './types';
import {
  initializeBilling,
  loadProducts as loadBillingProducts,
  purchaseProduct as purchaseBillingProduct,
  restorePurchases as restoreBillingPurchases,
} from './billingService';
import { useSettingsStore } from '@store/settingsStore';

export class ProductionBillingService implements BillingService {
  private initialized = false;

  async initialize(): Promise<BillingResult<boolean>> {
    const result = await initializeBilling();
    this.initialized = result.success;
    return { success: result.success, data: result.success };
  }

  async loadProducts(): Promise<BillingResult<BillingProductInfo[]>> {
    if (!this.initialized) {
      const init = await this.initialize();
      if (!init.success) return { success: false, error: 'Billing not available' };
    }

    const result = await loadBillingProducts();
    if (!result.success || !result.products) {
      return { success: false, error: 'Failed to load products' };
    }

    const mapped: BillingProductInfo[] = result.products.map(p => ({
      productId: p.productId,
      title: p.title,
      description: p.description,
      price: p.price,
      priceMicros: p.priceMicros,
      currencyCode: p.currencyCode,
      productType: p.productType as 'subs' | 'inapp',
      offerToken: p.offerToken ?? null,
    }));

    return { success: true, data: mapped };
  }

  async purchaseProduct(
    productId: string,
    offerToken?: string | null,
  ): Promise<BillingPurchaseResult> {
    if (!this.initialized) {
      const init = await this.initialize();
      if (!init.success) return { success: false, error: 'Billing not available' };
    }

    const result = await purchaseBillingProduct(productId, offerToken);

    if (result.cancelled) {
      return { success: false, cancelled: true };
    }

    if (result.success && result.purchase) {
      return {
        success: true,
        purchase: {
          purchaseToken: result.purchase.purchaseToken,
          productId: result.purchase.productId,
          purchaseState: result.purchase.purchaseState,
          isAcknowledged: result.purchase.isAcknowledged,
        },
      };
    }

    return { success: false, error: result.error };
  }

  async restorePurchases(): Promise<BillingResult<BillingPurchaseInfo[]>> {
    if (!this.initialized) {
      const init = await this.initialize();
      if (!init.success) return { success: false, error: 'Billing not available' };
    }

    const result = await restoreBillingPurchases();
    if (!result.success || !result.purchases) {
      return { success: false, error: 'Failed to restore purchases' };
    }

    const mapped: BillingPurchaseInfo[] = result.purchases.map(p => ({
      purchaseToken: p.purchaseToken,
      productId: p.productId,
      purchaseState: p.purchaseState,
      isAcknowledged: p.isAcknowledged,
    }));

    return { success: true, data: mapped };
  }

  getActivePremiumPurchase(purchases: BillingPurchaseInfo[]): BillingPurchaseInfo | null {
    return purchases.find(p => p.purchaseState === 1) ?? null;
  }

  getSubscriptionState(): SubscriptionState {
    const { premiumStatus } = useSettingsStore.getState();
    switch (premiumStatus) {
      case 'premium': return SubscriptionState.ACTIVE;
      case 'trial': return SubscriptionState.TRIAL;
      default: return SubscriptionState.FREE;
    }
  }
}
