/**
 * VaultCalc - Ad Service Barrel Export
 *
 * @see FEATURE_INDEX.md ADS-001, ADS-002, ADS-003
 */

// Ad service (main orchestrator)
export {
  isAdFree,
  ensureAdSdkReady,
  tryShowInterstitial,
  showRewardedAd,
  resetAdSession,
  initializeAdsLazily,
  isAdSdkInitialized,
  preloadInterstitial,
  preloadRewarded,
} from './adService';

// Frequency manager
export {
  canShowInterstitial,
  recordInterstitialShown,
  recordAdDismissed,
  recordVaultUnlock,
  resetSession,
  shouldShowSoftPremiumCard,
  markSoftPremiumCardShown,
} from './adFrequencyManager';

// Rewarded ad-free mode
export {
  grantAdFreeMode,
  isAdFreeActive,
  validateAdFreeMode,
} from './rewardedAdFreeService';

// Consent service (ADS-002)
export {
  requestConsentUpdate,
  showConsentFormIfNeeded,
  runConsentFlow,
  canLoadAds,
  isConsentChecked,
  getCachedConsentStatus,
  refreshConsentStatus,
} from './consentService';

// Feature flags (ADS-003)
export {
  getAdFeatureFlags,
  areAdsEnabled,
  getInterstitialCapOverride,
  isRewardEnabled,
  setAdFeatureFlags,
  resetAdFeatureFlags,
  fetchRemoteFlags,
} from './adFeatureFlags';

// Config
export {
  AD_UNIT_IDS,
  SECURE_SCREENS,
  SOFT_PREMIUM_CARD_THRESHOLD,
  MIN_CARD_DELAY_AFTER_AD_MS,
  REWARDED_AD_FREE_DURATION_MS,
} from './adConfig';

// Types
export type {
  AdErrorCode,
  RewardedAdResult,
  AdResult,
  InterstitialTrigger,
  SecureScreen,
  AdEligibleScreen,
  ConsentStatus,
  AdFeatureFlags,
} from './types';

// Mock service (dev only)
export { mockAdConfig } from './mockAdService';
