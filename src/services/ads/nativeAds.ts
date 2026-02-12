/**
 * VaultCalc - Native Ads Module Interface
 *
 * TypeScript proxy to the native AdMobModule. Uses the same lazy
 * Proxy pattern as nativeBilling.ts — the native module is only
 * resolved on first method access, not at import time.
 *
 * @see FEATURE_INDEX.md ADS-001
 */

import { NativeModules, Platform } from 'react-native';
import type { RewardedAdResult, ConsentStatus } from './types';

interface AdMobModuleInterface {
  /** Initialize the Google Mobile Ads SDK (lazy — never on cold start) */
  initialize(): Promise<boolean>;

  /** Preload an interstitial ad */
  loadInterstitial(adUnitId: string): Promise<boolean>;

  /** Show a preloaded interstitial ad. Resolves when dismissed. */
  showInterstitial(): Promise<boolean>;

  /** Preload a rewarded ad */
  loadRewarded(adUnitId: string): Promise<boolean>;

  /** Show a preloaded rewarded ad. Resolves with reward data. */
  showRewarded(): Promise<RewardedAdResult>;

  /** Check if an interstitial is preloaded and ready */
  isInterstitialReady(): Promise<boolean>;

  /** Check if a rewarded ad is preloaded and ready */
  isRewardedReady(): Promise<boolean>;

  /** Get monotonic elapsed time since boot (ms). Clock-manipulation resistant. */
  getElapsedRealtime(): Promise<number>;

  /** Get device boot count (increments on each reboot). For reboot-safe drift. */
  getBootCount(): Promise<number>;

  /** Request UMP consent info update from Google. Returns consent status string. */
  requestConsentUpdate(): Promise<ConsentStatus>;

  /** Show consent form if required. Returns resulting consent status. */
  showConsentForm(): Promise<ConsentStatus>;

  /** Get current consent status without triggering UI. */
  getConsentStatus(): Promise<ConsentStatus>;

  /** Whether ads can be requested based on current consent state. */
  canRequestAds(): Promise<boolean>;
}

let cachedModule: AdMobModuleInterface | null = null;

function getAdMobModule(): AdMobModuleInterface {
  if (cachedModule) {
    return cachedModule;
  }

  if (Platform.OS !== 'android') {
    throw new Error('AdMobModule is only available on Android');
  }

  const { AdMobModule } = NativeModules;

  if (!AdMobModule) {
    throw new Error(
      'AdMobModule is not available. Make sure the native module is properly linked.',
    );
  }

  cachedModule = AdMobModule as AdMobModuleInterface;
  return cachedModule;
}

/**
 * Native ad module proxy — lazily resolves on first method call.
 */
export const NativeAds: AdMobModuleInterface = new Proxy(
  {} as AdMobModuleInterface,
  {
    get(_target, prop: string) {
      const module = getAdMobModule();
      return module[prop as keyof AdMobModuleInterface];
    },
  },
);
