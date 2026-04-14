/**
 * VaultCalc - Analytics Event Catalog
 *
 * Type-safe event definitions. Every analytics event used in the app
 * must be declared here. This gives us:
 *   - Compile-time safety on event names and parameters
 *   - A single source of truth for the funnel
 *   - Easy auditing of what data leaves the device
 *
 * Privacy rule: NO PII in event params. No file names, no PIN digits,
 * no email addresses, no personal content. Counts and categories only.
 *
 * @see ROADMAP_2K_MONTH.md Task 1.1
 */

/**
 * Event parameter map. Keys are event names, values are the param shape.
 * Events with no params are typed as `undefined`.
 *
 * Firebase Analytics automatic parameters (timestamp, session_id, etc.)
 * are added by the SDK — don't duplicate them here.
 */
export interface AnalyticsEventMap {
  // ─── Onboarding funnel ─────────────────────────────────────────────
  /** User landed on the first onboarding slide */
  onboarding_started: undefined;
  /** User tapped "Secure My Files" on the final slide */
  onboarding_completed: undefined;
  /** User successfully set up a PIN */
  pin_setup_completed: { method: 'pin' | 'pattern' };
  /** User finished the 3-step how-it-works tutorial */
  tutorial_completed: undefined;
  /** User imported their first file (key activation metric) */
  first_import: { count: number; type: MediaTypeParam };

  // ─── Core engagement ───────────────────────────────────────────────
  /** User unlocked the real vault (not decoy) */
  vault_unlocked: { method: 'pin' | 'pattern' | 'biometric' };
  /** User imported files in a subsequent session */
  media_imported: { count: number; type: MediaTypeParam };
  /** User opened a media viewer */
  media_viewed: { type: MediaTypeParam };
  /** User shared the app (referral) */
  referral_sent: { method?: string };
  /** A feature discovery card was shown */
  feature_discovery_shown: { feature: string };
  /** User tapped a feature discovery card */
  feature_discovery_tapped: { feature: string };
  /** Intruder alert captured a selfie */
  intruder_alert_triggered: { risk_level: 'low' | 'medium' | 'high' };

  // ─── Monetization funnel ───────────────────────────────────────────
  /** Subscription screen opened */
  paywall_shown: { trigger: PaywallTrigger };
  /** User tapped a plan card */
  paywall_plan_selected: { plan: PlanParam };
  /** Purchase succeeded */
  paywall_purchased: { plan: PlanParam; price_usd_micros?: number };
  /** User dismissed the paywall without purchasing */
  paywall_dismissed: { plan_viewed?: PlanParam };

  // ─── Ad funnel ─────────────────────────────────────────────────────
  /** Ad successfully displayed */
  ad_shown: { format: AdFormat; trigger: string };
  /** User clicked an ad */
  ad_clicked: { format: AdFormat };
  /** User completed a rewarded ad → 24hr ad-free granted */
  rewarded_ad_completed: { trigger: string };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

// ─── Param types ─────────────────────────────────────────────────────
export type MediaTypeParam = 'image' | 'video' | 'audio' | 'document' | 'note' | 'mixed';
export type PlanParam = 'monthly' | 'yearly' | 'lifetime' | 'remove_ads';
export type AdFormat = 'interstitial' | 'rewarded' | 'app_open';
export type PaywallTrigger =
  | 'vault_unlock_threshold'
  | 'post_import_threshold'
  | 'feature_locked'
  | 'settings_tap'
  | 'soft_premium_card'
  | 'winback_lapsed'
  | 'other';

// ─── User properties ──────────────────────────────────────────────────
export interface AnalyticsUserProperties {
  premium_status: 'free' | 'trial' | 'monthly' | 'yearly' | 'lifetime';
  app_language: string;
  /** Bucketed vault size: '0', '1-10', '11-50', '51-200', '200+' */
  vault_item_bucket: '0' | '1-10' | '11-50' | '51-200' | '200+';
  /** Bucketed days since install: '0', '1-7', '8-30', '31-90', '90+' */
  install_age_bucket: '0' | '1-7' | '8-30' | '31-90' | '90+';
}

/**
 * Bucket helpers — keep user properties low-cardinality so Firebase
 * Analytics dashboards stay clean (high cardinality = expensive + noisy).
 */
export function bucketVaultSize(count: number): AnalyticsUserProperties['vault_item_bucket'] {
  if (count <= 0) return '0';
  if (count <= 10) return '1-10';
  if (count <= 50) return '11-50';
  if (count <= 200) return '51-200';
  return '200+';
}

export function bucketInstallAge(days: number): AnalyticsUserProperties['install_age_bucket'] {
  if (days <= 0) return '0';
  if (days <= 7) return '1-7';
  if (days <= 30) return '8-30';
  if (days <= 90) return '31-90';
  return '90+';
}
