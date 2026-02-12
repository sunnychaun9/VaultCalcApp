/**
 * VaultCalc - Billing Service Barrel
 *
 * @see FEATURE_INDEX.md PREMIUM-002
 */

// Existing exports (unchanged)
export {
  initializeBilling,
  loadProducts,
  purchaseProduct,
  restorePurchases,
  getActivePremiumPurchase,
} from './billingService';

export { checkPremiumStatus } from './premiumStatusService';

export type {
  ProductInfo,
  PurchaseInfo,
  PurchaseResult,
  BillingErrorCode,
  PurchaseFlowResult,
} from './billingService';

// Abstraction layer types
export {
  SubscriptionState,
  type PremiumFeature,
  type BillingProductInfo,
  type BillingPurchaseInfo,
  type BillingResult,
  type BillingPurchaseResult,
  type BillingMode,
} from './types';

// Interface
export type { BillingService } from './billingServiceInterface';

// Factory + config
export { BILLING_MODE, getBillingService } from './billingConfig';

// Feature gate
export { useFeatureGate, hasFeatureAccess, type FeatureGateResult } from './featureGate';

// Mock config
export { mockBillingConfig, type MockScenario } from './MockBillingService';
