/**
 * VaultCalc - Mock Billing Service
 *
 * Development-only billing implementation with configurable scenarios.
 * Simulates success, failure, expiry, cancellation, and grace period flows.
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

/** Mock scenario for simulating different billing outcomes */
export type MockScenario = 'success' | 'failure' | 'expired' | 'cancelled' | 'grace_period';

/** Mutable config for controlling mock behavior at runtime */
export const mockBillingConfig = {
  scenario: 'success' as MockScenario,
  latencyMs: 800,
};

/** All VaultCalc product IDs (matches billingService.ts) */
const PRODUCT_IDS = [
  'vaultcalc_premium_monthly',
  'vaultcalc_premium_yearly',
  'vaultcalc_premium_lifetime',
  'vaultcalc_remove_ads',
];

/** Synthetic product data for mock mode */
const MOCK_PRODUCTS: BillingProductInfo[] = [
  {
    productId: 'vaultcalc_premium_monthly',
    title: 'VaultCalc Premium (Monthly)',
    description: 'Monthly premium subscription',
    price: '$4.99',
    priceMicros: 4_990_000,
    currencyCode: 'USD',
    productType: 'subs',
    offerToken: 'mock-offer-monthly',
  },
  {
    productId: 'vaultcalc_premium_yearly',
    title: 'VaultCalc Premium (Yearly)',
    description: 'Yearly premium subscription — save 50%',
    price: '$29.99',
    priceMicros: 29_990_000,
    currencyCode: 'USD',
    productType: 'subs',
    offerToken: 'mock-offer-yearly',
  },
  {
    productId: 'vaultcalc_premium_lifetime',
    title: 'VaultCalc Premium (Lifetime)',
    description: 'One-time lifetime purchase',
    price: '$79.99',
    priceMicros: 79_990_000,
    currencyCode: 'USD',
    productType: 'inapp',
    offerToken: null,
  },
  {
    productId: 'vaultcalc_remove_ads',
    title: 'Remove Ads',
    description: 'One-time purchase to remove all ads permanently',
    price: '$2.99',
    priceMicros: 2_990_000,
    currencyCode: 'USD',
    productType: 'inapp',
    offerToken: null,
  },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockBillingService implements BillingService {
  private state: SubscriptionState = SubscriptionState.FREE;
  private mockPurchase: BillingPurchaseInfo | null = null;

  async initialize(): Promise<BillingResult<boolean>> {
    await delay(mockBillingConfig.latencyMs);
    return { success: true, data: true };
  }

  async loadProducts(): Promise<BillingResult<BillingProductInfo[]>> {
    await delay(mockBillingConfig.latencyMs);
    return { success: true, data: MOCK_PRODUCTS };
  }

  async purchaseProduct(productId: string): Promise<BillingPurchaseResult> {
    await delay(mockBillingConfig.latencyMs);

    switch (mockBillingConfig.scenario) {
      case 'success': {
        this.mockPurchase = {
          purchaseToken: `mock-token-${Date.now()}`,
          productId,
          purchaseState: 1,
          isAcknowledged: true,
        };
        this.state = SubscriptionState.ACTIVE;
        return { success: true, purchase: this.mockPurchase };
      }
      case 'failure':
        return { success: false, error: 'Mock billing failure — simulated error' };
      case 'cancelled':
        this.state = SubscriptionState.CANCELLED;
        return { success: false, cancelled: true };
      case 'expired':
        this.state = SubscriptionState.EXPIRED;
        this.mockPurchase = null;
        return { success: false, error: 'Subscription has expired' };
      case 'grace_period': {
        this.mockPurchase = {
          purchaseToken: `mock-token-grace-${Date.now()}`,
          productId,
          purchaseState: 1,
          isAcknowledged: true,
        };
        this.state = SubscriptionState.GRACE_PERIOD;
        return { success: true, purchase: this.mockPurchase };
      }
    }
  }

  async restorePurchases(): Promise<BillingResult<BillingPurchaseInfo[]>> {
    await delay(mockBillingConfig.latencyMs);

    switch (mockBillingConfig.scenario) {
      case 'success':
      case 'grace_period':
        if (this.mockPurchase) {
          return { success: true, data: [this.mockPurchase] };
        }
        return { success: true, data: [] };
      case 'expired':
      case 'cancelled':
        return { success: true, data: [] };
      case 'failure':
        return { success: false, error: 'Mock restore failure' };
    }
  }

  getActivePremiumPurchase(purchases: BillingPurchaseInfo[]): BillingPurchaseInfo | null {
    return purchases.find(
      (p) => p.purchaseState === 1 && PRODUCT_IDS.includes(p.productId),
    ) ?? null;
  }

  getSubscriptionState(): SubscriptionState {
    return this.state;
  }
}
