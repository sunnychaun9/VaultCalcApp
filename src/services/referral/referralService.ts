/**
 * VaultCalc - Referral Service (GROWTH-001)
 *
 * Zero-backend referral system using the Google Play Install Referrer API.
 *
 * How it works:
 *   1. Every install gets a stable `referralCode` (random base36).
 *   2. When the user shares the app, we build a Play Store URL with the
 *      referrer's code embedded as a UTM param:
 *         &referrer=utm_source%3Dvaultcalc%26utm_content%3D<CODE>
 *   3. When a new user installs via that link, the Play Install Referrer
 *      API returns that query string on first launch. We parse out the
 *      code and credit the new install with a 7-day ad-free reward.
 *   4. The referrer themselves gets rewarded at share-count milestones
 *      (3, 5, 10) instead of requiring a backend to notify them when
 *      someone installs.
 *
 * Reward model (MVP — no backend required):
 *   - Incoming install: 7 days ad-free
 *   - Share milestone 3:  7 days ad-free
 *   - Share milestone 5:  14 days ad-free
 *   - Share milestone 10: 30 days ad-free
 *
 * Ad-free is delivered by extending `adFreeUntil` in settingsStore.
 * Real "premium features" (intruder alerts, backup, etc.) remain purchase-only.
 */

import { NativeModules } from 'react-native';
import { useSettingsStore } from '@store/settingsStore';

const { InstallReferrerModule } = NativeModules as {
  InstallReferrerModule?: {
    getInstallReferrer: () => Promise<{
      referrer: string | null;
      installBeginSeconds: number;
      referrerClickSeconds: number;
    }>;
  };
};

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.vaultcalcapp';
const UTM_SOURCE = 'vaultcalc';
const DAY_MS = 86_400_000;

// Ranges guarded so we never collide with a real word (short = safer for sharing).
const CODE_LENGTH = 8;

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Return the existing referral code or generate and persist a new one.
 * The code is stable across sessions — once generated, it never changes.
 */
export function getOrCreateReferralCode(): string {
  const existing = useSettingsStore.getState().referralCode;
  if (existing) return existing;
  const code = generateReferralCode();
  useSettingsStore.getState().setReferralCode(code);
  return code;
}

/**
 * Build the shareable Play Store URL containing the user's referral code.
 */
export function getReferralLink(): string {
  const code = getOrCreateReferralCode();
  // Play Store wants the `referrer` param URL-encoded. We build the inner
  // query string first, then encode it exactly once.
  const innerQuery = `utm_source=${UTM_SOURCE}&utm_content=${code}`;
  return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(innerQuery)}`;
}

/**
 * One-shot check of the Play Install Referrer. Fires exactly once per
 * install (guarded by `referralCheckCompleted` in settingsStore).
 *
 * If a valid referral code is found AND it isn't our own code, grants
 * the new user 7 days of ad-free mode and records the inviter.
 *
 * Never throws — call freely on startup.
 *
 * @returns true if an incoming referral was detected + rewarded
 */
export async function checkIncomingReferral(): Promise<boolean> {
  const state = useSettingsStore.getState();
  if (state.referralCheckCompleted) return false;
  if (!InstallReferrerModule) {
    // Module missing (old OS, dev mode on iOS, etc.) — mark complete so we
    // don't keep retrying on every launch.
    state.markReferralCheckCompleted();
    return false;
  }

  try {
    const result = await InstallReferrerModule.getInstallReferrer();
    state.markReferralCheckCompleted();

    if (!result.referrer) return false;

    const code = extractCodeFromReferrer(result.referrer);
    if (!code) return false;

    // Self-referral guard — a user can't reward themselves by clicking
    // their own link on the same device.
    if (code === state.referralCode) return false;

    state.setReferredBy(code);
    extendAdFreeBy(7);
    return true;
  } catch {
    // Never loop on failure — mark complete so we move on
    useSettingsStore.getState().markReferralCheckCompleted();
    return false;
  }
}

/**
 * Milestone reward tiers. Keeping this as data so the UI can render
 * the same progress ladder.
 */
export const SHARE_REWARD_TIERS: ReadonlyArray<{
  shares: 3 | 5 | 10;
  adFreeDays: number;
  label: string;
}> = [
  { shares: 3, adFreeDays: 7, label: '7 days ad-free' },
  { shares: 5, adFreeDays: 14, label: '14 days ad-free' },
  { shares: 10, adFreeDays: 30, label: '30 days ad-free' },
];

export interface ShareRewardProgress {
  /** Next unrewarded tier, or null if all tiers redeemed */
  nextTier: (typeof SHARE_REWARD_TIERS)[number] | null;
  /** Shares still needed to hit the next tier (0 if already eligible) */
  sharesRemaining: number;
  /** Highest tier the user has redeemed so far */
  highestTier: 0 | 3 | 5 | 10;
}

/**
 * Compute the user's current progress toward the next share reward.
 */
export function getShareRewardProgress(): ShareRewardProgress {
  const { appShareCount, referralRewardTier } = useSettingsStore.getState();
  const nextTier = SHARE_REWARD_TIERS.find((t) => t.shares > referralRewardTier) ?? null;
  const sharesRemaining = nextTier ? Math.max(0, nextTier.shares - appShareCount) : 0;
  return { nextTier, sharesRemaining, highestTier: referralRewardTier };
}

/**
 * Check share count against the reward ladder and grant rewards the user
 * has earned but not yet received. Call after every successful share.
 *
 * @returns the highest newly-unlocked tier, or null if nothing new
 */
export function checkAndGrantShareMilestones(): (typeof SHARE_REWARD_TIERS)[number] | null {
  const state = useSettingsStore.getState();
  const { appShareCount, referralRewardTier } = state;

  // Find the highest tier the user qualifies for that they haven't been
  // rewarded for yet.
  let granted: (typeof SHARE_REWARD_TIERS)[number] | null = null;
  for (const tier of SHARE_REWARD_TIERS) {
    if (appShareCount >= tier.shares && referralRewardTier < tier.shares) {
      granted = tier;
    }
  }
  if (!granted) return null;

  extendAdFreeBy(granted.adFreeDays);
  state.setReferralRewardTier(granted.shares);
  return granted;
}

// ─── Internal ───────────────────────────────────────────────────────────

/**
 * Extend the user's ad-free window by N days. If they already have time
 * remaining, we stack on top of it rather than overwriting.
 */
function extendAdFreeBy(days: number): void {
  const { adFreeUntil, setAdFreeUntil } = useSettingsStore.getState();
  const now = Date.now();
  const base = adFreeUntil && adFreeUntil > now ? adFreeUntil : now;
  setAdFreeUntil(base + days * DAY_MS);
}

/**
 * Parse a referrer string like `utm_source=vaultcalc&utm_content=ABC123XY`
 * and return the `utm_content` value if it looks like a valid code.
 */
export function extractCodeFromReferrer(referrer: string): string | null {
  if (!referrer) return null;
  // Some referrer strings are URL-encoded once more by the Play Store
  const decoded = decodeMaybe(referrer);
  const params = new URLSearchParams(decoded);
  if (params.get('utm_source') !== UTM_SOURCE) return null;
  const code = params.get('utm_content');
  if (!code) return null;
  // Reject anything that doesn't match our base36 format (prevents stray
  // UTM strings from other campaigns from granting rewards).
  if (!/^[a-z0-9]{4,16}$/i.test(code)) return null;
  return code;
}

function decodeMaybe(s: string): string {
  try {
    // If the string contains a literal %, it's been URL-encoded
    return s.includes('%') ? decodeURIComponent(s) : s;
  } catch {
    return s;
  }
}

/**
 * 8-char base36 code. Not cryptographic — just needs to be unique enough
 * that two random codes don't collide in a practical install base.
 * 36^8 ≈ 2.8 trillion possible codes.
 */
function generateReferralCode(): string {
  let out = '';
  while (out.length < CODE_LENGTH) {
    out += Math.random().toString(36).slice(2);
  }
  return out.slice(0, CODE_LENGTH).toLowerCase();
}
