/**
 * VaultCalc - BillingService Interface
 *
 * Abstract interface for billing operations. Implementations:
 * - MockBillingService: development testing with configurable scenarios
 * - ProductionBillingService: delegates to Google Play Billing (stub)
 *
 * @see FEATURE_INDEX.md PREMIUM-002
 */

import type {
  BillingResult,
  BillingProductInfo,
  BillingPurchaseInfo,
  BillingPurchaseResult,
  SubscriptionState,
} from './types';

export interface BillingService {
  /** Connect to the billing backend */
  initialize(): Promise<BillingResult<boolean>>;

  /** Load available product details */
  loadProducts(): Promise<BillingResult<BillingProductInfo[]>>;

  /** Launch a purchase flow for the given product */
  purchaseProduct(productId: string, offerToken?: string | null): Promise<BillingPurchaseResult>;

  /** Query existing purchases for restore flow */
  restorePurchases(): Promise<BillingResult<BillingPurchaseInfo[]>>;

  /** Find the active premium purchase from a list */
  getActivePremiumPurchase(purchases: BillingPurchaseInfo[]): BillingPurchaseInfo | null;

  /** Get the current subscription state */
  getSubscriptionState(): SubscriptionState;
}
