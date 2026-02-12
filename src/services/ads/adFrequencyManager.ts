/**
 * VaultCalc - Ad Frequency Manager
 *
 * Enforces session-level frequency caps and minimum gaps between
 * interstitial ads. Tracks vault unlock cycles for the optional
 * 3rd interstitial trigger.
 *
 * Session state is in-memory only — resets on cold start or lock timeout.
 * Persistent counters (totalInterstitialsShown, vaultUnlockCount) are
 * managed via settingsStore.
 *
 * @see FEATURE_INDEX.md ADS-001
 */

import { useSettingsStore } from '@store/settingsStore';
import {
  MAX_INTERSTITIALS_PER_SESSION,
  MAX_INTERSTITIALS_EXTENDED,
  UNLOCK_CYCLE_THRESHOLD,
  MIN_INTERSTITIAL_GAP_MS,
  SECURE_SCREENS,
  MIN_CARD_DELAY_AFTER_AD_MS,
} from './adConfig';
import { getInterstitialCapOverride } from './adFeatureFlags';
import type { InterstitialTrigger } from './types';

// ---------------------------------------------------------------------------
// Session state (in-memory only, resets each session)
// ---------------------------------------------------------------------------

let sessionInterstitialCount = 0;
let lastInterstitialTimestamp = 0;
let lastAdDismissedTimestamp = 0;
let softPremiumCardShownThisSession = false;

/**
 * Reset session-level counters.
 * Call on cold start or when a new auth session begins after lock timeout.
 */
export function resetSession(): void {
  sessionInterstitialCount = 0;
  lastInterstitialTimestamp = 0;
  lastAdDismissedTimestamp = 0;
  softPremiumCardShownThisSession = false;
}

// ---------------------------------------------------------------------------
// Frequency cap evaluation
// ---------------------------------------------------------------------------

/**
 * Determine the effective session cap.
 *
 * Priority:
 * 1. Remote feature flag override (interstitialCapOverride)
 * 2. Extended cap (3) if vault unlock count >= threshold
 * 3. Default cap (2)
 */
function getSessionCap(): number {
  // Remote override takes highest priority
  const remoteOverride = getInterstitialCapOverride();
  if (remoteOverride !== null) return remoteOverride;

  const { vaultUnlockCount } = useSettingsStore.getState();
  return vaultUnlockCount >= UNLOCK_CYCLE_THRESHOLD
    ? MAX_INTERSTITIALS_EXTENDED
    : MAX_INTERSTITIALS_PER_SESSION;
}

/**
 * Check if an interstitial can be shown right now.
 *
 * Rules:
 * 1. Must not be ad-free (caller checks this separately via isAdFree)
 * 2. Session count must be below the effective cap
 * 3. Minimum time gap since last interstitial
 * 4. Current screen must not be a secure screen
 *
 * @param currentScreen - The current navigation route name
 * @param trigger - Which trigger point is requesting the ad
 */
export function canShowInterstitial(
  currentScreen: string,
  _trigger: InterstitialTrigger,
): boolean {
  if (sessionInterstitialCount >= getSessionCap()) return false;
  if (Date.now() - lastInterstitialTimestamp < MIN_INTERSTITIAL_GAP_MS) return false;
  if (SECURE_SCREENS.has(currentScreen)) return false;
  return true;
}

/**
 * Record that an interstitial was shown.
 * Updates both session counter and persistent total.
 */
export function recordInterstitialShown(): void {
  sessionInterstitialCount++;
  const now = Date.now();
  lastInterstitialTimestamp = now;
  lastAdDismissedTimestamp = now;
  useSettingsStore.getState().incrementInterstitialsShown();
}

/**
 * Record that any ad was dismissed (interstitial or rewarded).
 * Used by soft premium card delay logic.
 */
export function recordAdDismissed(): void {
  lastAdDismissedTimestamp = Date.now();
}

// ---------------------------------------------------------------------------
// Vault unlock tracking
// ---------------------------------------------------------------------------

/**
 * Record a successful vault unlock.
 * Increments the persistent cumulative counter in settingsStore.
 */
export function recordVaultUnlock(): void {
  useSettingsStore.getState().incrementVaultUnlockCount();
}

// ---------------------------------------------------------------------------
// Soft premium card trigger
// ---------------------------------------------------------------------------

/**
 * Check if the soft premium suggestion card should be shown.
 *
 * Requirements:
 * 1. Total interstitials shown >= SOFT_PREMIUM_CARD_THRESHOLD (3)
 * 2. Not already shown this session
 * 3. At least MIN_CARD_DELAY_AFTER_AD_MS (30s) since the last ad dismissal
 *    — never immediately after an ad
 */
export function shouldShowSoftPremiumCard(): boolean {
  if (softPremiumCardShownThisSession) return false;

  const { totalInterstitialsShown } = useSettingsStore.getState();
  if (totalInterstitialsShown < 3) return false;

  // Delay: never show immediately after any ad
  if (lastAdDismissedTimestamp > 0 &&
      Date.now() - lastAdDismissedTimestamp < MIN_CARD_DELAY_AFTER_AD_MS) {
    return false;
  }

  return true;
}

/**
 * Mark the soft premium card as shown for this session.
 */
export function markSoftPremiumCardShown(): void {
  softPremiumCardShownThisSession = true;
}

// ---------------------------------------------------------------------------
// Getters for testing / debugging
// ---------------------------------------------------------------------------

export function getSessionInterstitialCount(): number {
  return sessionInterstitialCount;
}

export function getLastInterstitialTimestamp(): number {
  return lastInterstitialTimestamp;
}

export function getLastAdDismissedTimestamp(): number {
  return lastAdDismissedTimestamp;
}
