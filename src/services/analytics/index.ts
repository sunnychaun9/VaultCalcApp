/**
 * VaultCalc - Analytics module public API
 *
 * @see ROADMAP_2K_MONTH.md Task 1.1
 */

export {
  initAnalytics,
  disableAnalytics,
  trackEvent,
  trackScreen,
  setUserProperty,
  setUserProperties,
} from './analyticsService';

export { bucketVaultSize, bucketInstallAge } from './events';

export type {
  AnalyticsEventName,
  AnalyticsEventMap,
  AnalyticsUserProperties,
  MediaTypeParam,
  PlanParam,
  AdFormat,
  PaywallTrigger,
} from './events';
