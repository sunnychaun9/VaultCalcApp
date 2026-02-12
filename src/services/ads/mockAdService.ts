/**
 * VaultCalc - Mock Ad Service
 *
 * Development-only stubs for ad operations. Mirrors the adService API
 * but never touches the native AdMob SDK. Logs operations to console.
 *
 * @see FEATURE_INDEX.md ADS-001
 */

import type { AdResult, InterstitialTrigger, RewardedAdResult } from './types';

/** Configurable mock behavior */
export const mockAdConfig = {
  /** Whether mock interstitials "show" successfully */
  interstitialSuccess: true,
  /** Whether mock rewarded ads grant the reward */
  rewardedSuccess: true,
  /** Simulated latency in ms */
  latencyMs: 500,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function tryShowInterstitial(
  currentScreen: string,
  trigger: InterstitialTrigger,
): Promise<AdResult<boolean>> {
  console.log(`[MockAds] tryShowInterstitial: screen=${currentScreen}, trigger=${trigger}`);
  await delay(mockAdConfig.latencyMs);

  if (mockAdConfig.interstitialSuccess) {
    console.log('[MockAds] Interstitial shown (mock)');
    return { success: true, data: true };
  }
  return { success: true, data: false };
}

export async function showRewardedAd(): Promise<AdResult<RewardedAdResult>> {
  console.log('[MockAds] showRewardedAd');
  await delay(mockAdConfig.latencyMs);

  if (mockAdConfig.rewardedSuccess) {
    console.log('[MockAds] Rewarded ad completed (mock)');
    return {
      success: true,
      data: { rewarded: true, type: 'ad_free', amount: 1 },
    };
  }
  return {
    success: true,
    data: { rewarded: false },
  };
}

export async function initializeAdsLazily(): Promise<void> {
  console.log('[MockAds] initializeAdsLazily (no-op in dev)');
}

export function resetAdSession(): void {
  console.log('[MockAds] resetAdSession');
}

export function isAdFree(): boolean {
  return false;
}

export function isAdSdkInitialized(): boolean {
  return true;
}

export function preloadInterstitial(): void {
  console.log('[MockAds] preloadInterstitial (mock)');
}

export function preloadRewarded(): void {
  console.log('[MockAds] preloadRewarded (mock)');
}
