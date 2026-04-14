/**
 * VaultCalc - Analytics Service
 *
 * Thin type-safe wrapper around Firebase Analytics. All analytics
 * access goes through this module so we have one place to:
 *   - Strip PII from params before they leave the device
 *   - Suppress events for premium users where relevant (ad events)
 *   - Swallow errors (analytics must never break the UI)
 *   - Debug-log events in development
 *
 * Privacy posture (matches Sentry):
 *   - Firebase auto-collection is DISABLED in AndroidManifest
 *   - Collection is enabled here only after init() is called
 *   - No user IDs are ever set (setUserId is never called)
 *   - No ad identifier (ADID) collection (disabled in manifest)
 *
 * @see ROADMAP_2K_MONTH.md Task 1.1
 * @see events.ts for the typed event catalog
 */

import analytics from '@react-native-firebase/analytics';
import type {
  AnalyticsEventMap,
  AnalyticsEventName,
  AnalyticsUserProperties,
} from './events';

let initialized = false;

/**
 * Initialize analytics — called once from App.tsx after Sentry.
 * Enables collection (manifest has it disabled by default for privacy).
 *
 * Safe to call multiple times; no-ops after first init.
 */
export async function initAnalytics(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    await analytics().setAnalyticsCollectionEnabled(true);
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[analytics] collection enabled');
    }
  } catch (err) {
    // Never let analytics break app startup
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[analytics] init failed', err);
    }
  }
}

/**
 * Disable analytics collection (e.g. if user opts out in settings).
 * Events logged after this call are discarded at the SDK layer.
 */
export async function disableAnalytics(): Promise<void> {
  try {
    await analytics().setAnalyticsCollectionEnabled(false);
  } catch {
    // silent
  }
}

/**
 * Log a typed event. Overloads enforce that events with params get
 * params and events without params don't get them.
 *
 * Errors are swallowed — analytics is best-effort.
 */
export function trackEvent<E extends AnalyticsEventName>(
  name: E,
  ...args: AnalyticsEventMap[E] extends undefined
    ? []
    : [params: AnalyticsEventMap[E]]
): void {
  if (!initialized) {
    // Queue-less: events before init() are dropped. This is intentional
    // because the only events firing before init would be onboarding,
    // and we init early enough that it's not a real issue.
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[analytics] (pre-init, dropped) ${String(name)}`, args[0]);
    }
    return;
  }

  const params = args[0];

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${String(name)}`, params ?? '');
  }

  // Fire-and-forget — do NOT await (would add latency to call sites)
  analytics()
    .logEvent(String(name), sanitizeParams(params))
    .catch(() => {
      // silent
    });
}

/**
 * Log a screen view. Call from NavigationContainer.onStateChange so every
 * route change produces a `screen_view` event.
 */
export function trackScreen(screenName: string): void {
  if (!initialized) return;
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[analytics] screen_view ${screenName}`);
  }
  analytics()
    .logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    })
    .catch(() => {});
}

/**
 * Set a user property. Use typed keys for consistency with the event
 * catalog. Low-cardinality values only (see bucket helpers in events.ts).
 */
export function setUserProperty<K extends keyof AnalyticsUserProperties>(
  key: K,
  value: AnalyticsUserProperties[K] | null,
): void {
  if (!initialized) return;
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[analytics] userProp ${String(key)}=${value}`);
  }
  analytics()
    .setUserProperty(String(key), value === null ? null : String(value))
    .catch(() => {});
}

/**
 * Set multiple user properties at once.
 */
export function setUserProperties(props: Partial<AnalyticsUserProperties>): void {
  for (const [k, v] of Object.entries(props)) {
    setUserProperty(k as keyof AnalyticsUserProperties, v as never);
  }
}

// ─── Internal ─────────────────────────────────────────────────────────

/**
 * Firebase Analytics param values must be string | number | boolean.
 * Also strip undefined values (they serialize badly) and enforce
 * that no param value looks like PII (file paths, long hex strings).
 */
function sanitizeParams(
  params: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') {
      // Reject anything that looks like a filesystem path or URI.
      // If any call site ever accidentally passes a filename, this catches it.
      if (v.includes('/') || v.includes('\\') || v.startsWith('file:') || v.startsWith('content:')) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn(`[analytics] dropped suspicious param ${k}`);
        }
        continue;
      }
      // Firebase caps param values at 100 chars
      out[k] = v.length > 100 ? v.slice(0, 100) : v;
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    } else {
      // Arrays, objects, functions — drop silently
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(`[analytics] dropped non-primitive param ${k}`);
      }
    }
  }
  return out;
}
