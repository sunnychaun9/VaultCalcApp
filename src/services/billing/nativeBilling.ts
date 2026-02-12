/**
 * VaultCalc - Native Billing Module Interface
 *
 * TypeScript interface for the native BillingModule.
 * Provides type-safe access to Google Play Billing operations.
 *
 * @see FEATURE_INDEX.md PREMIUM-002
 */

import { NativeModules, Platform } from 'react-native';

/**
 * Billing error codes from the native module
 */
export type BillingErrorCode =
  | 'BILLING_INIT_ERROR'
  | 'BILLING_NOT_CONNECTED'
  | 'BILLING_QUERY_ERROR'
  | 'BILLING_FLOW_ERROR'
  | 'BILLING_ACKNOWLEDGE_ERROR'
  | 'BILLING_NO_ACTIVITY';

/**
 * Product information from Google Play
 */
export interface ProductInfo {
  productId: string;
  title: string;
  description: string;
  /** Formatted price string from Play Store (e.g. "$4.99") */
  price: string;
  /** Price in micros for calculations */
  priceMicros: number;
  currencyCode: string;
  productType: 'subs' | 'inapp';
  offerToken: string | null;
}

/**
 * Purchase information from Google Play
 */
export interface PurchaseInfo {
  purchaseToken: string;
  productId: string;
  /** 0=UNSPECIFIED, 1=PURCHASED, 2=PENDING */
  purchaseState: number;
  isAcknowledged: boolean;
}

/**
 * Result of a purchase flow — either purchase data or cancellation
 */
export interface PurchaseFlowResult {
  purchaseToken?: string;
  productId?: string;
  purchaseState?: number;
  isAcknowledged?: boolean;
  cancelled?: boolean;
}

/**
 * Native BillingModule interface
 */
interface BillingModuleInterface {
  /** Connect BillingClient to Google Play Store */
  initialize(): Promise<boolean>;

  /** Query product details for given product IDs */
  queryProducts(productIds: string[]): Promise<ProductInfo[]>;

  /** Launch Google Play purchase flow */
  launchPurchaseFlow(productId: string, offerToken: string | null): Promise<PurchaseFlowResult>;

  /** Query active purchases (subscriptions + in-app) */
  queryPurchases(): Promise<PurchaseInfo[]>;

  /** Acknowledge a purchase (required within 3 days) */
  acknowledgePurchase(purchaseToken: string): Promise<boolean>;
}

/**
 * Get the native BillingModule (lazy — resolved on first access)
 */
let cachedModule: BillingModuleInterface | null = null;

function getBillingModule(): BillingModuleInterface {
  if (cachedModule) {
    return cachedModule;
  }

  if (Platform.OS !== 'android') {
    throw new Error('BillingModule is only available on Android');
  }

  const { BillingModule } = NativeModules;

  if (!BillingModule) {
    throw new Error(
      'BillingModule is not available. Make sure the native module is properly linked.',
    );
  }

  cachedModule = BillingModule as BillingModuleInterface;
  return cachedModule;
}

/**
 * Native billing module proxy — lazily resolves the native module on first method call.
 */
export const NativeBilling: BillingModuleInterface = new Proxy(
  {} as BillingModuleInterface,
  {
    get(_target, prop: string) {
      const module = getBillingModule();
      return module[prop as keyof BillingModuleInterface];
    },
  },
);
