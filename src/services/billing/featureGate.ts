/**
 * VaultCalc - Feature Gate
 *
 * Centralized premium feature access checks.
 * Reads premiumStatus from settingsStore and maps to SubscriptionState.
 *
 * @see FEATURE_INDEX.md PREMIUM-004
 */

import { useSettingsStore } from '@store/settingsStore';
import { SubscriptionState, type PremiumFeature } from './types';

/** States that grant access to premium features */
const ACCESS_GRANTING_STATES = new Set([
  SubscriptionState.ACTIVE,
  SubscriptionState.TRIAL,
  SubscriptionState.GRACE_PERIOD,
]);

export interface FeatureGateResult {
  /** Whether the user has access to the requested feature */
  hasAccess: boolean;
  /** Whether the user is in any premium state (active, trial, or grace period) */
  isPremium: boolean;
  /** Current subscription state */
  subscriptionState: SubscriptionState;
}

/** Map settingsStore premiumStatus to SubscriptionState */
export function toSubscriptionState(
  premiumStatus: 'free' | 'trial' | 'premium',
): SubscriptionState {
  switch (premiumStatus) {
    case 'premium':
      return SubscriptionState.ACTIVE;
    case 'trial':
      return SubscriptionState.TRIAL;
    case 'free':
    default:
      return SubscriptionState.FREE;
  }
}

/** Pure function: check if a subscription state grants feature access */
export function hasFeatureAccess(state: SubscriptionState): boolean {
  return ACCESS_GRANTING_STATES.has(state);
}

/**
 * React hook for checking premium feature access.
 *
 * @param _feature - The feature to check (reserved for per-feature gating)
 */
export function useFeatureGate(_feature: PremiumFeature): FeatureGateResult {
  const premiumStatus = useSettingsStore((s) => s.premiumStatus);
  const subscriptionState = toSubscriptionState(premiumStatus);
  const access = hasFeatureAccess(subscriptionState);

  return {
    hasAccess: access,
    isPremium: access,
    subscriptionState,
  };
}
