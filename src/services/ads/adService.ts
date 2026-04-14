/**
 * VaultCalc - Ad Service
 *
 * High-level orchestrator for all ad operations. Handles:
 * - Lazy SDK initialization (never on cold start)
 * - Consent gating (UMP must clear before any ad loads)
 * - Feature flag checks (remote kill-switch)
 * - Screen-aware preloading (never preload on secure screens)
 * - Interstitial preloading after first eligible interaction
 * - Never-block pattern: if ad not loaded, skip silently
 * - Premium user bypass: never loads SDK for premium users
 * - Ad-free mode check (premium OR rewarded 24hr)
 *
 * @see FEATURE_INDEX.md ADS-001
 */

import { useSettingsStore } from '@store/settingsStore';
import { useAuthStore } from '@store/authStore';
import { NativeAds } from './nativeAds';
import { AD_UNIT_IDS, SECURE_SCREENS } from './adConfig';
import {
  canShowInterstitial,
  recordInterstitialShown,
  recordAdDismissed,
  resetSession as resetFrequencySession,
} from './adFrequencyManager';
import { canLoadAds, runConsentFlow, resetConsentSession } from './consentService';
import { areAdsEnabled, isRewardEnabled } from './adFeatureFlags';
import { isAdFreeActive } from './rewardedAdFreeService';
import type { AdResult, InterstitialTrigger, RewardedAdResult } from './types';
import { trackEvent } from '@services/analytics';

// ---------------------------------------------------------------------------
// SDK state
// ---------------------------------------------------------------------------

let sdkInitialized = false;
let sdkInitializing = false;
let interstitialPreloading = false;
let rewardedPreloading = false;
let appOpenPreloading = false;
let appOpenShownThisSession = false;

/**
 * Suppress the vault's auto-lock-on-background while a full-screen ad is
 * presenting. Without this, the ad's foreign Activity trips `AppState`
 * into 'background' → grace period elapses during the ad → lockVault()
 * fires on dismiss and the user is yanked to the Calculator.
 */
function withAutoLockSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  const { setSuppressAutoLock } = useAuthStore.getState();
  setSuppressAutoLock(true);
  return fn().finally(() => {
    // Delay clearing the flag: on Android, the ad's onDismissFullScreenContent
    // callback fires BEFORE AppState transitions back to 'active'. If we clear
    // immediately, the background-lock handler in useAuthSession reads
    // suppressAutoLock=false and locks the vault. The 2s delay ensures the
    // AppState handler fires first (typically within 100-500ms).
    setTimeout(() => {
      useAuthStore.getState().setSuppressAutoLock(false);
    }, 2000);
  });
}

// ---------------------------------------------------------------------------
// Core: is the user ad-free?
// ---------------------------------------------------------------------------

/**
 * Central ad-free check. Returns true if user should see no ads.
 * - Premium or trial subscription
 * - Active rewarded 24hr ad-free mode
 */
export function isAdFree(): boolean {
  const { premiumStatus } = useSettingsStore.getState();
  if (premiumStatus === 'premium' || premiumStatus === 'trial') return true;
  return isAdFreeActive();
}

// ---------------------------------------------------------------------------
// Pre-flight checks
// ---------------------------------------------------------------------------

/**
 * Check all preconditions for ad operations:
 * feature flags, consent, and ad-free status.
 */
function canServeAds(): boolean {
  if (!areAdsEnabled()) return false;
  if (isAdFree()) return false;
  if (!canLoadAds()) return false;
  return true;
}

// ---------------------------------------------------------------------------
// SDK initialization (lazy)
// ---------------------------------------------------------------------------

/**
 * Initialize the AdMob SDK lazily. No-op for premium users.
 * Call this after the first eligible screen interaction, not on cold start.
 *
 * Runs consent flow before SDK init — consent must clear first.
 */
export async function ensureAdSdkReady(): Promise<boolean> {
  if (sdkInitialized) return true;
  if (sdkInitializing) return false;
  if (isAdFree()) return false;
  if (!areAdsEnabled()) return false;

  sdkInitializing = true;
  try {
    // Run consent flow first — must clear before loading any ads
    await runConsentFlow();
    if (!canLoadAds()) return false;

    await NativeAds.initialize();
    sdkInitialized = true;
    return true;
  } catch {
    return false;
  } finally {
    sdkInitializing = false;
  }
}

// ---------------------------------------------------------------------------
// Screen-aware preloading
// ---------------------------------------------------------------------------

/**
 * Preload an interstitial ad in the background.
 * Fire-and-forget — never blocks the caller.
 *
 * @param currentScreen - Current route name. Preload is skipped on secure screens.
 */
export function preloadInterstitial(currentScreen?: string): void {
  if (interstitialPreloading || !sdkInitialized) return;
  if (!canServeAds()) return;

  // Never preload on secure screens
  if (currentScreen && SECURE_SCREENS.has(currentScreen)) return;

  interstitialPreloading = true;
  NativeAds.loadInterstitial(AD_UNIT_IDS.interstitial)
    .catch(() => {
      // Non-fatal — ad simply won't be available
    })
    .finally(() => {
      interstitialPreloading = false;
    });
}

/**
 * Preload a rewarded ad in the background.
 * Fire-and-forget — never blocks the caller.
 *
 * @param currentScreen - Current route name. Preload is skipped on secure screens.
 */
export function preloadRewarded(currentScreen?: string): void {
  if (rewardedPreloading || !sdkInitialized) return;
  if (!isRewardEnabled()) return;

  // Never preload on secure screens
  if (currentScreen && SECURE_SCREENS.has(currentScreen)) return;

  rewardedPreloading = true;
  NativeAds.loadRewarded(AD_UNIT_IDS.rewarded)
    .catch(() => {
      // Non-fatal
    })
    .finally(() => {
      rewardedPreloading = false;
    });
}

// ---------------------------------------------------------------------------
// Interstitial: try to show
// ---------------------------------------------------------------------------

/**
 * Attempt to show an interstitial ad at a trigger point.
 *
 * Never blocks the user:
 * - If ads disabled (flag/consent/premium/ad-free) → skip
 * - If frequency cap hit → skip
 * - If ad not preloaded → skip
 * - Only shows if everything is ready
 *
 * After showing, automatically preloads the next interstitial.
 *
 * @param currentScreen - Current navigation route name
 * @param trigger - Which trigger point is firing
 * @returns Whether an ad was actually shown
 */
export async function tryShowInterstitial(
  currentScreen: string,
  trigger: InterstitialTrigger,
): Promise<AdResult<boolean>> {
  if (!canServeAds()) {
    return { success: true, data: false };
  }

  if (!sdkInitialized) {
    return { success: true, data: false };
  }

  if (!canShowInterstitial(currentScreen, trigger)) {
    return { success: true, data: false };
  }

  try {
    const ready = await NativeAds.isInterstitialReady();
    if (!ready) {
      // Not loaded yet — skip, don't block the user
      return { success: true, data: false };
    }

    await withAutoLockSuppressed(() => NativeAds.showInterstitial());
    recordInterstitialShown();
    trackEvent('ad_shown', { format: 'interstitial', trigger });

    // Preload next interstitial (not on a secure screen since we just left one)
    preloadInterstitial();

    return { success: true, data: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// App Open: preload + show
// ---------------------------------------------------------------------------

/**
 * Preload an app open ad in the background.
 * Fire-and-forget — never blocks the caller.
 */
export function preloadAppOpen(): void {
  if (appOpenPreloading || !sdkInitialized) return;
  if (!canServeAds()) return;

  appOpenPreloading = true;
  NativeAds.loadAppOpen(AD_UNIT_IDS.appOpen)
    .catch(() => {
      // Non-fatal — ad simply won't be available
    })
    .finally(() => {
      appOpenPreloading = false;
    });
}

/**
 * Attempt to show an app open ad when the app comes to foreground.
 *
 * Guards:
 * - Ad-free/premium/consent → skip
 * - Already shown this session → skip (once per session)
 * - First launch (onboarding) → skip
 * - Ad not preloaded → skip
 *
 * @returns Whether an ad was actually shown
 */
export async function tryShowAppOpen(): Promise<AdResult<boolean>> {
  if (!canServeAds()) {
    return { success: true, data: false };
  }

  if (!sdkInitialized) {
    return { success: true, data: false };
  }

  // Once per session
  if (appOpenShownThisSession) {
    return { success: true, data: false };
  }

  // Never on first launch
  if (useSettingsStore.getState().isFirstLaunch) {
    return { success: true, data: false };
  }

  try {
    const ready = await NativeAds.isAppOpenReady();
    if (!ready) {
      return { success: true, data: false };
    }

    await withAutoLockSuppressed(() => NativeAds.showAppOpen());
    appOpenShownThisSession = true;
    trackEvent('ad_shown', { format: 'app_open', trigger: 'foreground' });

    // Preload next (for subsequent sessions if app stays alive)
    preloadAppOpen();

    return { success: true, data: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Rewarded: show
// ---------------------------------------------------------------------------

/**
 * Show a rewarded ad (user-initiated, e.g. "Watch ad for 24hr ad-free").
 * Unlike interstitials, this IS blocking — user expects to watch the ad.
 *
 * @returns Result with rewarded=true if user completed the ad
 */
export async function showRewardedAd(): Promise<AdResult<RewardedAdResult>> {
  if (!isRewardEnabled()) {
    return { success: false, error: 'Rewarded ads are disabled' };
  }

  if (!sdkInitialized) {
    const initialized = await ensureAdSdkReady();
    if (!initialized) {
      return { success: false, error: 'Ad SDK not available' };
    }
  }

  try {
    const ready = await NativeAds.isRewardedReady();
    if (!ready) {
      // Try loading on-demand for rewarded (user-initiated, can wait briefly)
      await NativeAds.loadRewarded(AD_UNIT_IDS.rewarded);
    }

    const result = await withAutoLockSuppressed(() => NativeAds.showRewarded());

    trackEvent('ad_shown', { format: 'rewarded', trigger: 'user_initiated' });
    if (result.rewarded) {
      trackEvent('rewarded_ad_completed', { trigger: 'watch_ad' });
    }

    // Record ad dismissal for premium card delay logic
    recordAdDismissed();

    // Preload next rewarded ad
    preloadRewarded();

    return { success: true, data: result };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

/**
 * Reset ad session state. Call on cold start or new auth session.
 */
export function resetAdSession(): void {
  resetFrequencySession();
  resetConsentSession();
  appOpenShownThisSession = false;
}

/**
 * Initialize ads for the session. Called after first eligible screen
 * interaction (not on cold start).
 *
 * 1. Checks feature flags
 * 2. Runs consent flow
 * 3. Initializes SDK (lazy)
 * 4. Preloads first interstitial + rewarded
 *
 * @param currentScreen - Current route name for screen-aware preloading
 */
export async function initializeAdsLazily(currentScreen?: string): Promise<void> {
  if (!areAdsEnabled()) return;

  const ready = await ensureAdSdkReady();
  if (!ready) return;

  preloadInterstitial(currentScreen);
  preloadRewarded(currentScreen);
  preloadAppOpen();
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Whether the ad SDK has been initialized this session */
export function isAdSdkInitialized(): boolean {
  return sdkInitialized;
}
