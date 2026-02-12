/**
 * VaultCalc - Production Billing Service (Stub)
 *
 * Placeholder implementation that returns not-configured errors.
 * When Play Console is ready, this will delegate to the existing
 * billingService.ts functions.
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

const NOT_CONFIGURED: BillingResult<never> = {
  success: false,
  error: 'Production billing not yet configured',
};

export class ProductionBillingService implements BillingService {
  async initialize(): Promise<BillingResult<boolean>> {
    return NOT_CONFIGURED;
  }

  async loadProducts(): Promise<BillingResult<BillingProductInfo[]>> {
    return NOT_CONFIGURED;
  }

  async purchaseProduct(): Promise<BillingPurchaseResult> {
    return NOT_CONFIGURED;
  }

  async restorePurchases(): Promise<BillingResult<BillingPurchaseInfo[]>> {
    return NOT_CONFIGURED;
  }

  getActivePremiumPurchase(): BillingPurchaseInfo | null {
    return null;
  }

  getSubscriptionState(): SubscriptionState {
    return SubscriptionState.FREE;
  }
}
