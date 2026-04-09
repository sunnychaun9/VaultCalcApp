/**
 * VaultCalc - Ad Service Types
 *
 * Shared types for the ad monetization layer.
 *
 * @see FEATURE_INDEX.md ADS-001
 */

/** Ad error codes from the native AdMobModule */
export type AdErrorCode =
  | 'AD_INIT_ERROR'
  | 'AD_NOT_INITIALIZED'
  | 'AD_LOAD_ERROR'
  | 'AD_NOT_LOADED'
  | 'AD_SHOW_ERROR'
  | 'AD_NO_ACTIVITY';

/** Result of showing a rewarded ad */
export interface RewardedAdResult {
  rewarded: boolean;
  type?: string;
  amount?: number;
}

/** Result envelope for ad operations (mirrors billing pattern) */
export interface AdResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Interstitial trigger points */
export type InterstitialTrigger =
  | 'post_import'
  | 'media_close'
  | 'audio_close'
  | 'note_close'
  | 'unlock_cycle';

/** Screen route names classified as secure (no ads allowed) */
export type SecureScreen =
  | 'Calculator'
  | 'MediaViewer'
  | 'AlbumView'
  | 'NoteEditor'
  | 'ChangePin'
  | 'DecoyPinSetup'
  | 'IntruderLogs'
  | 'Onboarding'
  | 'PinSetup';

/** Ad-eligible screen route names */
export type AdEligibleScreen =
  | 'Settings'
  | 'About';

/** UMP consent status values from the native module */
export type ConsentStatus =
  | 'REQUIRED'
  | 'NOT_REQUIRED'
  | 'OBTAINED'
  | 'UNKNOWN';

/** Remote feature flags controlling ad behavior */
export interface AdFeatureFlags {
  /** Master kill-switch for all ads (default: true) */
  adsEnabled: boolean;
  /** Override the session interstitial cap (null = use default from adConfig) */
  interstitialCapOverride: number | null;
  /** Whether rewarded ads are available (default: true) */
  rewardEnabled: boolean;
}
