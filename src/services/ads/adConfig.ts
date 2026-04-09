/**
 * VaultCalc - Ad Configuration
 *
 * Constants for ad unit IDs, frequency caps, secure screen list,
 * and timing parameters. All tunables live here.
 *
 * @see FEATURE_INDEX.md ADS-001
 */

import type { SecureScreen } from './types';

// ---------------------------------------------------------------------------
// Ad Unit IDs — test IDs in dev, production IDs in release
// ---------------------------------------------------------------------------

export const AD_UNIT_IDS = {
  interstitial: __DEV__
    ? 'ca-app-pub-3940256099942544/1033173712' // Google test interstitial
    : 'ca-app-pub-2002876774760881/6968449824',
  rewarded: __DEV__
    ? 'ca-app-pub-3940256099942544/5224354917'  // Google test rewarded
    : 'ca-app-pub-2002876774760881/5958620487',
  appOpen: __DEV__
    ? 'ca-app-pub-3940256099942544/9257395921'  // Google test app open
    : 'ca-app-pub-2002876774760881/3332457147',
} as const;

// ---------------------------------------------------------------------------
// Frequency Caps
// ---------------------------------------------------------------------------

/** Default max interstitials per session */
export const MAX_INTERSTITIALS_PER_SESSION = 2;

/** Extended cap after user has unlocked vault >= UNLOCK_THRESHOLD times */
export const MAX_INTERSTITIALS_EXTENDED = 3;

/** Cumulative vault unlock count required to enable the 3rd interstitial */
export const UNLOCK_CYCLE_THRESHOLD = 5;

/** Minimum gap between interstitial ads (2 minutes) */
export const MIN_INTERSTITIAL_GAP_MS = 120_000;

/** Total interstitials shown before displaying the soft premium card */
export const SOFT_PREMIUM_CARD_THRESHOLD = 3;

/** Minimum delay after an ad before showing the soft premium card (30 seconds) */
export const MIN_CARD_DELAY_AFTER_AD_MS = 30_000;

// ---------------------------------------------------------------------------
// Rewarded Ad-Free Mode
// ---------------------------------------------------------------------------

/** Duration of rewarded ad-free mode (24 hours) */
export const REWARDED_AD_FREE_DURATION_MS = 24 * 60 * 60 * 1000;

/** AAD context for ad-free proof encryption (mirrors premium proof pattern) */
export const AD_FREE_PROOF_AAD = 'ad_free_proof_v1';

/** Tolerance for clock drift detection (5 minutes) */
export const CLOCK_DRIFT_TOLERANCE_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Secure Screens (ads forbidden)
// ---------------------------------------------------------------------------

export const SECURE_SCREENS: ReadonlySet<string> = new Set<SecureScreen>([
  'Calculator',
  'MediaViewer',
  'AlbumView',
  'NoteEditor',
  'ChangePin',
  'DecoyPinSetup',
  'IntruderLogs',
  'Onboarding',
  'PinSetup',
]);
