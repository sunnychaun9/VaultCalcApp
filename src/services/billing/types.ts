/**
 * VaultCalc - Billing Abstraction Types
 *
 * Foundation types shared across the billing abstraction layer.
 *
 * @see FEATURE_INDEX.md PREMIUM-002
 */

/** Subscription lifecycle states */
export enum SubscriptionState {
  FREE = 'FREE',
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  GRACE_PERIOD = 'GRACE_PERIOD',
}

/** Features gated behind premium */
export type PremiumFeature = 'removeAds';

/** Product information (mirrors existing ProductInfo shape) */
export interface BillingProductInfo {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceMicros: number;
  currencyCode: string;
  productType: 'subs' | 'inapp';
  offerToken: string | null;
}

/** Purchase information (mirrors existing PurchaseInfo shape) */
export interface BillingPurchaseInfo {
  purchaseToken: string;
  productId: string;
  /** 0=UNSPECIFIED, 1=PURCHASED, 2=PENDING */
  purchaseState: number;
  isAcknowledged: boolean;
}

/** Generic result envelope for billing operations */
export interface BillingResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Result of a purchase operation */
export interface BillingPurchaseResult {
  success: boolean;
  purchase?: BillingPurchaseInfo;
  cancelled?: boolean;
  error?: string;
}

/** Runtime billing mode */
export type BillingMode = 'mock' | 'production';
