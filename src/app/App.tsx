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
import { AppState, InteractionManager, StatusBar, StyleSheet, type AppStateStatus } from 'react-native';
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

// ─────────────────────────────────────────────────────────────
// Sentry — initialized before React renders so native crashes
// and early JS errors are captured. Privacy-hardened because
// this is a vault app: no PII, no UI breadcrumbs, no user IDs.
// ─────────────────────────────────────────────────────────────
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
  ignoreEmptyBackNavigationTransactions: true,
});

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

  useEffect(() => {
    initializeDatabase().then(() => {
      setDbReady(true);
      // Defer all non-critical startup work until after the first frame renders.
      // This keeps the calculator screen interactive as fast as possible.
      InteractionManager.runAfterInteractions(() => {
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
            }}
          >
            <StatusBar
              barStyle={isDark ? 'light-content' : 'dark-content'}
              backgroundColor={themeColors.surface}
            />
            {dbReady && <RootNavigator />}
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
