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
import { AppState, StatusBar, StyleSheet, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
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
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      appStateRef.current = nextState;

      if (wasBackground && nextState === 'active') {
        const { isAuthenticated } = useAuthStore.getState();
        const { isFirstLaunch } = useSettingsStore.getState();
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
      // Fire-and-forget startup tasks — run in background, don't block UI
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
  }, []);

  return (
    <GestureHandlerRootView style={gestureRootStyle.flex}>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <NavigationContainer>
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

export default App;
