/**
 * VaultCalc - Ad Feature Flags (ADS-003)
 *
 * Remote feature flag system for controlling ad behavior without
 * app updates. Flags have hardcoded defaults and can be overridden
 * via a remote JSON endpoint or manual MMKV writes.
 *
 * Architecture:
 * 1. Defaults defined in code (always available, zero latency)
 * 2. Overrides persisted in MMKV (survives restarts)
 * 3. Optional remote fetch from configurable endpoint
 *
 * Flags:
 * - adsEnabled: master kill-switch for all ads (default: true)
 * - interstitialCapOverride: override session cap (default: null = use adConfig)
 * - rewardEnabled: enable/disable rewarded ads (default: true)
 */

import { storage } from '@services/storage/mmkv';
import type { AdFeatureFlags } from './types';

const FLAGS_STORAGE_KEY = 'vaultcalc_ad_feature_flags';
const FLAGS_FETCH_TIMESTAMP_KEY = 'vaultcalc_ad_flags_fetched_at';

/** Minimum interval between remote fetches (6 hours) */
const MIN_FETCH_INTERVAL_MS = 6 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_FLAGS: AdFeatureFlags = {
  adsEnabled: true,
  interstitialCapOverride: null,
  rewardEnabled: true,
};

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

let cachedFlags: AdFeatureFlags | null = null;

// ---------------------------------------------------------------------------
// Read flags
// ---------------------------------------------------------------------------

/**
 * Get the current feature flags. Reads from memory cache first,
 * then MMKV, then falls back to defaults.
 *
 * Synchronous — suitable for hot-path ad decisions.
 */
export function getAdFeatureFlags(): AdFeatureFlags {
  if (cachedFlags !== null) return cachedFlags;

  try {
    const raw = storage.getString(FLAGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AdFeatureFlags>;
      cachedFlags = { ...DEFAULT_FLAGS, ...parsed };
      return cachedFlags;
    }
  } catch {
    // Corrupted data — fall back to defaults
  }

  cachedFlags = { ...DEFAULT_FLAGS };
  return cachedFlags;
}

/**
 * Whether ads are globally enabled via feature flag.
 */
export function areAdsEnabled(): boolean {
  return getAdFeatureFlags().adsEnabled;
}

/**
 * Get the interstitial cap override, or null if using default.
 */
export function getInterstitialCapOverride(): number | null {
  return getAdFeatureFlags().interstitialCapOverride;
}

/**
 * Whether rewarded ads are enabled via feature flag.
 */
export function isRewardEnabled(): boolean {
  return getAdFeatureFlags().rewardEnabled;
}

// ---------------------------------------------------------------------------
// Update flags
// ---------------------------------------------------------------------------

/**
 * Persist flag overrides to MMKV.
 * Merges with existing flags — only provided keys are updated.
 */
export function setAdFeatureFlags(overrides: Partial<AdFeatureFlags>): void {
  const current = getAdFeatureFlags();
  const updated = { ...current, ...overrides };
  cachedFlags = updated;
  storage.set(FLAGS_STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Reset all flags to defaults. Clears MMKV overrides.
 */
export function resetAdFeatureFlags(): void {
  cachedFlags = { ...DEFAULT_FLAGS };
  storage.remove(FLAGS_STORAGE_KEY);
  storage.remove(FLAGS_FETCH_TIMESTAMP_KEY);
}

// ---------------------------------------------------------------------------
// Remote fetch
// ---------------------------------------------------------------------------

/**
 * Fetch feature flags from a remote endpoint.
 *
 * @param endpoint - URL returning JSON matching AdFeatureFlags shape
 * @returns Whether the fetch was successful and flags were updated
 *
 * Respects MIN_FETCH_INTERVAL_MS to avoid hammering the server.
 * Silently no-ops if called too frequently or if fetch fails.
 */
export async function fetchRemoteFlags(endpoint: string): Promise<boolean> {
  // Rate limit
  const lastFetch = getLastFetchTimestamp();
  if (lastFetch > 0 && Date.now() - lastFetch < MIN_FETCH_INTERVAL_MS) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) return false;

    const data = await response.json();

    // Validate shape — only accept known keys with correct types
    const validated: Partial<AdFeatureFlags> = {};

    if (typeof data.adsEnabled === 'boolean') {
      validated.adsEnabled = data.adsEnabled;
    }
    if (data.interstitialCapOverride === null ||
        (typeof data.interstitialCapOverride === 'number' && data.interstitialCapOverride > 0)) {
      validated.interstitialCapOverride = data.interstitialCapOverride;
    }
    if (typeof data.rewardEnabled === 'boolean') {
      validated.rewardEnabled = data.rewardEnabled;
    }

    if (Object.keys(validated).length > 0) {
      setAdFeatureFlags(validated);
      storage.set(FLAGS_FETCH_TIMESTAMP_KEY, Date.now().toString());
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLastFetchTimestamp(): number {
  try {
    const raw = storage.getString(FLAGS_FETCH_TIMESTAMP_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}
