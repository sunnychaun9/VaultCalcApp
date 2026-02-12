/**
 * VaultCalc - Ad Consent Service (ADS-002)
 *
 * Manages Google UMP (User Messaging Platform) consent flow for GDPR
 * and other privacy regulations. Consent must be obtained before any
 * ad SDK operations (load/show).
 *
 * Flow:
 * 1. requestConsentUpdate() — fetch consent requirements from Google
 * 2. showConsentFormIfNeeded() — display form if status is REQUIRED
 * 3. canLoadAds() — gate all ad operations on consent
 *
 * Consent status is cached in settingsStore for synchronous access.
 * The native UMP SDK handles persistence of the actual consent choice.
 */

import { useSettingsStore } from '@store/settingsStore';
import { NativeAds } from './nativeAds';
import type { ConsentStatus } from './types';

let consentChecked = false;

// ---------------------------------------------------------------------------
// Consent flow
// ---------------------------------------------------------------------------

/**
 * Request a consent info update from Google's UMP server.
 * Should be called early in the session (after first eligible interaction)
 * but NOT on cold start.
 *
 * Updates the cached consent status in settingsStore.
 */
export async function requestConsentUpdate(): Promise<ConsentStatus> {
  try {
    const status = await NativeAds.requestConsentUpdate();
    useSettingsStore.getState().setConsentStatus(status);
    consentChecked = true;
    return status;
  } catch {
    consentChecked = true;
    return getCachedConsentStatus();
  }
}

/**
 * Show the consent form if the user's consent is required.
 * No-op if consent is already obtained or not required.
 *
 * @returns The resulting consent status after the form flow
 */
export async function showConsentFormIfNeeded(): Promise<ConsentStatus> {
  const currentStatus = getCachedConsentStatus();

  // Only show the form if consent is required
  if (currentStatus !== 'REQUIRED') {
    return currentStatus;
  }

  try {
    const status = await NativeAds.showConsentForm();
    useSettingsStore.getState().setConsentStatus(status);
    return status;
  } catch {
    return currentStatus;
  }
}

/**
 * Full consent flow: update info then show form if needed.
 * Convenience method combining both steps.
 */
export async function runConsentFlow(): Promise<ConsentStatus> {
  const status = await requestConsentUpdate();
  if (status === 'REQUIRED') {
    return showConsentFormIfNeeded();
  }
  return status;
}

// ---------------------------------------------------------------------------
// Consent status queries
// ---------------------------------------------------------------------------

/**
 * Whether ads can be loaded/shown based on consent state.
 * Returns true if consent is obtained or not required.
 * Returns false if consent is required but not yet obtained, or unknown.
 *
 * Synchronous — reads cached status from settingsStore.
 */
export function canLoadAds(): boolean {
  const status = getCachedConsentStatus();
  return status === 'OBTAINED' || status === 'NOT_REQUIRED';
}

/**
 * Whether the consent flow has been checked this session.
 */
export function isConsentChecked(): boolean {
  return consentChecked;
}

/**
 * Get the cached consent status from settingsStore.
 */
export function getCachedConsentStatus(): ConsentStatus {
  return useSettingsStore.getState().consentStatus;
}

/**
 * Refresh consent status from the native layer (async).
 * Useful after the app returns from background where the user
 * may have changed consent in system settings.
 */
export async function refreshConsentStatus(): Promise<ConsentStatus> {
  try {
    const status = await NativeAds.getConsentStatus();
    useSettingsStore.getState().setConsentStatus(status);
    return status;
  } catch {
    return getCachedConsentStatus();
  }
}

/**
 * Reset session consent state. Call when session resets.
 */
export function resetConsentSession(): void {
  consentChecked = false;
}
