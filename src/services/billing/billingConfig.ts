/**
 * VaultCalc - Billing Configuration
 *
 * Runtime billing mode flag and singleton factory.
 * Switches between MockBillingService (dev) and ProductionBillingService (prod).
 *
 * @see FEATURE_INDEX.md PREMIUM-002
 */

import type { BillingMode } from './types';
import type { BillingService } from './billingServiceInterface';
import { MockBillingService } from './MockBillingService';
import { ProductionBillingService } from './ProductionBillingService';

/** Billing mode — mock in dev builds, production in release */
export const BILLING_MODE: BillingMode = __DEV__ ? 'mock' : 'production';

let instance: BillingService | null = null;

/** Get the singleton BillingService for the current mode */
export function getBillingService(): BillingService {
  if (instance === null) {
    instance = BILLING_MODE === 'mock'
      ? new MockBillingService()
      : new ProductionBillingService();
  }
  return instance;
}

/** Reset singleton — test utility only */
export function _resetBillingService(): void {
  instance = null;
}
