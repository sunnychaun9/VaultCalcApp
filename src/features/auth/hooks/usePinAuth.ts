/**
 * VaultCalc - PIN Authentication Hook
 *
 * Hook for handling PIN detection and authentication in the calculator.
 * Integrates with auth store and navigation.
 *
 * @see FEATURE_INDEX.md AUTH-001, AUTH-004
 */

import { useCallback, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@typedefs/navigation';
import { useAuthStore } from '@store/authStore';
import {
  isPotentialPin,
  attemptPinAuth,
  isAuthRequired,
} from '../services/authService';
import { isPinConfigured } from '../services/pinStorage';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/** PIN auth callback result */
export interface PinAuthResult {
  /** Whether PIN was detected and auth was attempted */
  wasAuthAttempt: boolean;
  /** Whether authentication succeeded */
  authenticated: boolean;
  /** Whether this was a decoy PIN */
  isDecoy?: boolean;
}

/**
 * Hook for PIN authentication in calculator.
 *
 * Provides a callback to check if calculator input is a PIN,
 * and handles authentication if it matches.
 */
export function usePinAuth() {
  const navigation = useNavigation<NavigationProp>();
  const { authenticate, recordFailedAttempt, isLockedOut } = useAuthStore();

  // Track if we're currently processing to prevent double-attempts
  const isProcessing = useRef(false);

  /**
   * Check if the given input is a PIN and attempt authentication.
   * Called when user presses "=" in calculator.
   *
   * If no PIN is configured and input looks like a PIN, navigates to setup.
   *
   * @param input The calculator display value
   * @returns Result indicating if auth was attempted and succeeded
   */
  const checkAndAuthenticate = useCallback(
    async (input: string): Promise<PinAuthResult> => {
      // Prevent concurrent auth attempts
      if (isProcessing.current) {
        return { wasAuthAttempt: false, authenticated: false };
      }

      // Don't attempt if locked out
      if (isLockedOut) {
        return { wasAuthAttempt: false, authenticated: false };
      }

      // Check if input could be a PIN (right length, all digits)
      if (!isPotentialPin(input)) {
        return { wasAuthAttempt: false, authenticated: false };
      }

      // Check if PIN is configured - if not, navigate to setup
      if (!isPinConfigured()) {
        // Navigate to PIN setup with a slight delay
        setTimeout(() => {
          navigation.navigate('PinSetup', { isInitialSetup: true });
        }, 50);
        return { wasAuthAttempt: true, authenticated: false };
      }

      try {
        isProcessing.current = true;

        // Attempt authentication
        const result = await attemptPinAuth(input);

        if (result.success) {
          // Authentication successful
          authenticate(result.isDecoy);

          // Initialize ad SDK lazily on first unlock + record unlock cycle
          try {
            const ads = require('@services/ads');
            ads.initializeAdsLazily();
            ads.recordVaultUnlock();
            ads.preloadInterstitial('Calculator');
          } catch { /* ads may not be available */ }

          // Show paywall on 3rd vault unlock for free users
          try {
            const store = require('@store/settingsStore').useSettingsStore.getState();
            if (store.premiumStatus === 'free' && !result.isDecoy && store.vaultUnlockCount === 3) {
              store.setPaywallPending(true);
            }
          } catch { /* non-critical */ }

          // Review prompt on 5th unlock (positive engagement moment)
          if (!result.isDecoy) {
            setTimeout(() => {
              try { require('@services/review').triggerReviewPrompt(); } catch {}
            }, 4000); // 4s delay — let vault UI load first
          }

          // Navigate to vault
          // Using setTimeout to ensure state updates before navigation
          setTimeout(() => {
            navigation.navigate('Vault');
          }, 50);

          return {
            wasAuthAttempt: true,
            authenticated: true,
            isDecoy: result.isDecoy,
          };
        } else {
          // Authentication failed - record attempt
          recordFailedAttempt();
          return { wasAuthAttempt: true, authenticated: false };
        }
      } catch {
        return { wasAuthAttempt: true, authenticated: false };
      } finally {
        isProcessing.current = false;
      }
    },
    [authenticate, recordFailedAttempt, isLockedOut, navigation]
  );

  /**
   * Check if authentication is needed to access vault.
   */
  const needsAuth = useCallback((): boolean => {
    return isAuthRequired();
  }, []);

  /**
   * Check if PIN setup is required (first launch).
   */
  const needsPinSetup = useCallback((): boolean => {
    return !isPinConfigured();
  }, []);

  /**
   * Navigate to PIN setup screen.
   * Used when no PIN is configured yet.
   */
  const navigateToPinSetup = useCallback(() => {
    navigation.navigate('PinSetup', { isInitialSetup: true });
  }, [navigation]);

  return {
    checkAndAuthenticate,
    needsAuth,
    needsPinSetup,
    navigateToPinSetup,
    isLockedOut,
  };
}
