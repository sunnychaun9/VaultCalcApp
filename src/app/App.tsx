/**
 * VaultCalc - Main Application Entry Point
 *
 * This is the root component of the application.
 * Sets up navigation, state management, and global providers.
 *
 * @see docs/FEATURE_INDEX.md for implementation roadmap
 * @see 04-Technical-Architecture.md Section 4 and 7
 */

import React, { useEffect, useRef, useState } from 'react';
import { AppState, I18nManager, InteractionManager, StatusBar, StyleSheet, type AppStateStatus } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './navigation';
import { AlertModal } from '@shared/components/AlertModal';
import { ErrorBoundary } from '@shared/components/ErrorBoundary';
import { queryClient } from './queryClient';
import { colors, useThemeColors } from '@shared/theme';
import { initializeDatabase } from '@services/storage';
import { useAuthStore } from '@store/authStore';
import { useSettingsStore } from '@store/settingsStore';
import { SplashTransition } from '@shared/components/SplashTransition';
import { clearThumbnailCache } from '@services/thumbnail';
import { excludeFromRecents } from '@services/security';
import { tryAutoBackup } from '@services/backup';
import { checkPremiumStatus } from '@services/billing';
import {
  initAnalytics,
  trackScreen,
  setUserProperties,
  bucketVaultSize,
  bucketInstallAge,
} from '@services/analytics';
import { initI18n, RTL_LANGUAGES, resolveDeviceLanguage } from '@shared/i18n';

// ─────────────────────────────────────────────────────────────
// Sentry — initialized before React renders so native crashes
// and early JS errors are captured. Privacy-hardened because
// this is a vault app: no PII, no UI breadcrumbs, no user IDs.
// ─────────────────────────────────────────────────────────────
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
  ignoreEmptyBackNavigationTransactions: true,
});

// ─────────────────────────────────────────────────────────────
// User property helpers — seed + subscribe so Firebase Analytics
// always reflects the user's current premium tier, language, and
// vault size. All properties are low-cardinality (bucketed).
// ─────────────────────────────────────────────────────────────
function resolvePremiumTier(): 'free' | 'trial' | 'monthly' | 'yearly' | 'lifetime' {
  const { premiumStatus, premiumProductId } = useSettingsStore.getState();
  if (premiumStatus === 'trial') return 'trial';
  if (premiumStatus === 'free') return 'free';
  // Premium — narrow further by product id
  if (premiumProductId?.includes('monthly')) return 'monthly';
  if (premiumProductId?.includes('yearly')) return 'yearly';
  if (premiumProductId?.includes('lifetime')) return 'lifetime';
  return 'monthly';
}

function getAppLanguage(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  } catch {
    return 'en';
  }
}

/**
 * Apply the user's language preference to native layout direction.
 *
 * `forceRTL` is latched by React Native — it only takes full effect after a
 * process restart. We still call it synchronously before i18n loads so the
 * next cold start picks up the correct direction. The settings screen
 * prompts for a restart when this value changes.
 */
function applyRtlFromLanguage(): void {
  const { language, rtlApplied, setRtlApplied } = useSettingsStore.getState();
  const effective = language === 'system' ? resolveDeviceLanguage() : language;
  const shouldBeRtl = (RTL_LANGUAGES as ReadonlyArray<string>).includes(effective);
  if (shouldBeRtl !== I18nManager.isRTL) {
    try {
      I18nManager.allowRTL(shouldBeRtl);
      I18nManager.forceRTL(shouldBeRtl);
    } catch { /* native call may fail on old Android — non-fatal */ }
  }
  if (shouldBeRtl !== rtlApplied) {
    setRtlApplied(shouldBeRtl);
  }
}

function seedUserProperties(): void {
  const { firstLaunchTimestamp, totalImportCount } = useSettingsStore.getState();
  const daysSinceInstall = firstLaunchTimestamp
    ? Math.floor((Date.now() - firstLaunchTimestamp) / 86_400_000)
    : 0;
  setUserProperties({
    premium_status: resolvePremiumTier(),
    app_language: getAppLanguage(),
    vault_item_bucket: bucketVaultSize(totalImportCount ?? 0),
    install_age_bucket: bucketInstallAge(daysSinceInstall),
  });
}

Sentry.init({
  dsn: 'https://5b80b97be7b78c4c2d17cd91c63864dd@o4511200339492864.ingest.de.sentry.io/4511200729235536',
  release: `com.vaultcalcapp@${require('../../package.json').version}`,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: 1.0,
  enableAutoSessionTracking: true,
  enableAutoPerformanceTracing: true,
  sendDefaultPii: false,
  integrations: [navigationIntegration],
  // Drop UI breadcrumbs — they can contain file names, PIN digits, album titles.
  beforeBreadcrumb: (breadcrumb) => {
    if (breadcrumb.category === 'ui.click' || breadcrumb.category === 'ui.input') {
      return null;
    }
    return breadcrumb;
  },
  // Strip any incidental user identifiers before the event leaves the device.
  beforeSend: (event) => {
    if (event.user) event.user = undefined;
    return event;
  },
});

/**
 * Root application component
 *
 * Provider hierarchy:
 * 1. QueryClientProvider - Async state management (React Query)
 * 2. SafeAreaProvider - Safe area insets
 * 3. NavigationContainer - Navigation state
 * 4. RootNavigator - Screen navigation
 *
 * Zustand stores are accessed directly via hooks (no provider needed).
 */
function App(): React.JSX.Element {
  const themeColors = useThemeColors();
  const isDark = themeColors === colors.dark;
  const [dbReady, setDbReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const navigationRef = useNavigationContainerRef();
  const currentScreenRef = useRef<string | undefined>(undefined);

  // Keep analytics user properties fresh when premium tier changes.
  // settingsStore doesn't use subscribeWithSelector middleware, so we
  // poll the computed tier on every settings change and only push the
  // user property when it actually differs.
  useEffect(() => {
    let lastTier = resolvePremiumTier();
    const unsub = useSettingsStore.subscribe(() => {
      const nextTier = resolvePremiumTier();
      if (nextTier !== lastTier) {
        lastTier = nextTier;
        setUserProperties({ premium_status: nextTier });
      }
    });
    return unsub;
  }, []);

  // Global lock cleanup: when isAuthenticated transitions true → false,
  // clear all decrypted data from disk. This fires for every lock path
  // (auto-lock, manual lock, shake-lock, timeout) without requiring
  // each call site to remember to clean up.
  useEffect(() => {
    const unsub = useAuthStore.subscribe(
      (state) => state.isAuthenticated,
      (isAuth, wasAuth) => {
        if (wasAuth && !isAuth) {
          // Lock cleanup: clear all decrypted data and hide from recents
          clearThumbnailCache();
          queryClient.clear();
          excludeFromRecents(true);
          // Reschedule smart notification based on what the user did this session
          import('@services/notifications/reengagementService').then(({ scheduleSmartNotification }) => {
            scheduleSmartNotification();
          }).catch(() => {});
        } else if (!wasAuth && isAuth) {
          // Authenticated: allow app to appear in recents again
          // (shows calculator since that's the initial route)
          excludeFromRecents(false);
        }
      },
    );
    return unsub;
  }, []);

  // App Open Ad: show once per session when app returns to foreground.
  // Only fires when user is authenticated (vault unlocked) and not on first launch.
  // Also records app open for smart notification suppression.
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      appStateRef.current = nextState;

      if (wasBackground && nextState === 'active') {
        const { isAuthenticated } = useAuthStore.getState();
        const { isFirstLaunch } = useSettingsStore.getState();

        // Record app open so pending notifications are suppressed for active users
        import('@services/notifications/reengagementService').then(({ recordAppOpen }) => {
          recordAppOpen();
        }).catch(() => {});

        if (isAuthenticated && !isFirstLaunch) {
          import('@services/ads').then(({ tryShowAppOpen }) => {
            tryShowAppOpen().catch(() => {});
          }).catch(() => {});
        }
      }
    });

    return () => subscription.remove();
  }, []);

  // i18n + RTL — initialize before dbReady so the first render is translated.
  const [i18nReady, setI18nReady] = useState(false);
  useEffect(() => {
    applyRtlFromLanguage();
    const { language } = useSettingsStore.getState();
    initI18n(language).finally(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    initializeDatabase().then(() => {
      setDbReady(true);
      // Defer all non-critical startup work until after the first frame renders.
      // This keeps the calculator screen interactive as fast as possible.
      InteractionManager.runAfterInteractions(() => {
        // Analytics — enable collection + seed user properties.
        // Firebase auto-init is disabled in AndroidManifest; this call
        // is what actually turns collection on.
        initAnalytics().then(() => {
          seedUserProperties();
        });
        // Referral attribution — read Play Install Referrer exactly once per
        // install and grant 7 days ad-free if this install came from a share.
        // Runs after analytics so the `referral_sent` event is tracked by the
        // attribution of any subsequent share from this user.
        import('@services/referral').then(({ checkIncomingReferral, getOrCreateReferralCode }) => {
          // Ensure we have a referral code for this install (stable across sessions)
          getOrCreateReferralCode();
          checkIncomingReferral();
        }).catch(() => {});
        checkPremiumStatus();
        tryAutoBackup();
        // Validate rewarded ad-free mode (drift detection, anti-tamper)
        import('@services/ads').then(({ validateAdFreeMode }) => validateAdFreeMode()).catch(() => {});
        // Restore Google Drive session if previously connected (CLOUD-001)
        const gdEmail = useSettingsStore.getState().googleDriveEmail;
        if (gdEmail) {
          import('@services/googleDrive').then(({ signInSilently }) => signInSilently());
        }
      });
    });
  }, []);

  return (
    <GestureHandlerRootView style={gestureRootStyle.flex}>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <NavigationContainer
            ref={navigationRef}
            onReady={() => {
              navigationIntegration.registerNavigationContainer(navigationRef);
              const route = navigationRef.getCurrentRoute();
              if (route?.name) {
                currentScreenRef.current = route.name;
                trackScreen(route.name);
              }
            }}
            onStateChange={() => {
              const route = navigationRef.getCurrentRoute();
              if (route?.name && route.name !== currentScreenRef.current) {
                currentScreenRef.current = route.name;
                trackScreen(route.name);
              }
            }}
          >
            <StatusBar
              barStyle={isDark ? 'light-content' : 'dark-content'}
              backgroundColor={themeColors.surface}
            />
            {dbReady && i18nReady && <RootNavigator />}
            <AlertModal />
          </NavigationContainer>
          {showSplash && (
            <SplashTransition
              isReady={dbReady}
              onComplete={() => setShowSplash(false)}
            />
          )}
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const gestureRootStyle = StyleSheet.create({ flex: { flex: 1 } });

export default Sentry.wrap(App);
