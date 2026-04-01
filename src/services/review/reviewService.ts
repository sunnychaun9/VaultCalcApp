/**
 * VaultCalc - In-App Review Service
 *
 * Smart review prompt system that asks at the right moment:
 * - After successful file import (user just experienced value)
 * - After 5th vault unlock (user is engaged)
 *
 * Rules:
 * - Never ask before 3 vault unlocks (too early)
 * - Max 2 prompts ever (avoid annoyance)
 * - Minimum 7 days between prompts
 * - Never ask after errors or on first session
 * - Google Play API handles additional rate-limiting internally
 *
 * Two-step flow:
 * 1. Show a custom pre-prompt alert ("Enjoying privacy?")
 * 2. If positive → launch Google Play In-App Review API
 * 3. If negative → silently record and don't ask again for 30 days
 */

import { NativeModules, Platform } from 'react-native';
import { useSettingsStore } from '@store/settingsStore';
import { alert } from '@store/alertStore';

const { InAppReviewModule } = NativeModules;

// ── Constants ─────────────────────────────────────────────────

/** Minimum vault unlocks before first review prompt */
const MIN_UNLOCKS_FOR_REVIEW = 3;

/** Maximum number of review prompts ever shown */
const MAX_REVIEW_PROMPTS = 2;

/** Minimum gap between review prompts (7 days) */
const MIN_REVIEW_GAP_MS = 7 * 24 * 60 * 60 * 1000;

// In-memory session flag — only prompt once per session
let reviewPromptedThisSession = false;

// ── Core Logic ────────────────────────────────────────────────

/**
 * Check if conditions are met to show a review prompt.
 *
 * Returns false if:
 * - Platform is not Android
 * - Already prompted this session
 * - Too few vault unlocks
 * - Max prompts reached
 * - Too soon since last prompt
 * - App was installed too recently (< 1 day)
 */
export function shouldPromptReview(): boolean {
  if (Platform.OS !== 'android') return false;
  if (reviewPromptedThisSession) return false;

  const {
    vaultUnlockCount,
    reviewPromptCount,
    lastReviewPromptAt,
    firstLaunchTimestamp,
  } = useSettingsStore.getState();

  // Not enough engagement yet
  if (vaultUnlockCount < MIN_UNLOCKS_FOR_REVIEW) return false;

  // Already asked enough times
  if (reviewPromptCount >= MAX_REVIEW_PROMPTS) return false;

  // Too soon since last prompt
  if (lastReviewPromptAt !== null) {
    const gap = Date.now() - lastReviewPromptAt;
    if (gap < MIN_REVIEW_GAP_MS) return false;
  }

  // App installed less than 1 day ago
  if (firstLaunchTimestamp !== null) {
    const age = Date.now() - firstLaunchTimestamp;
    if (age < 24 * 60 * 60 * 1000) return false;
  }

  return true;
}

/**
 * Show the pre-prompt alert and optionally launch Google Play review.
 *
 * Two-step flow:
 * 1. Custom alert: "Enjoying privacy? Rate us"
 * 2. If user taps "Rate now" → launch Google Play In-App Review API
 * 3. If user taps "Not now" → record and back off
 *
 * Call this after positive moments (successful import, vault unlock).
 * Never call after errors.
 */
export function triggerReviewPrompt(): void {
  if (!shouldPromptReview()) return;

  reviewPromptedThisSession = true;
  useSettingsStore.getState().recordReviewPrompt();

  alert(
    'Enjoying privacy?',
    'Your files are safe with VaultCalc. If you\'re enjoying the app, a quick rating helps others find it too.',
    [
      {
        text: 'Not now',
        style: 'cancel',
      },
      {
        text: 'Rate VaultCalc',
        onPress: () => {
          launchPlayStoreReview();
        },
      },
    ],
  );
}

/**
 * Launch the Google Play In-App Review flow.
 * This is a native API call — Google controls whether the dialog
 * actually appears. It may silently no-op.
 */
async function launchPlayStoreReview(): Promise<void> {
  try {
    if (InAppReviewModule) {
      await InAppReviewModule.launchReviewFlow();
    }
  } catch {
    // Non-fatal — Google may rate-limit or the API may fail.
    // The user already had a good experience, don't show an error.
  }
}

/**
 * Reset the session flag. Call on cold start or new auth session.
 */
export function resetReviewSession(): void {
  reviewPromptedThisSession = false;
}
