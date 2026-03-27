/**
 * VaultCalc - Auth Session Hook
 *
 * Manages authenticated session including:
 * - Activity tracking for timeout
 * - Auto-lock on inactivity (AUTH-009)
 * - Auto-lock on app background (AUTH-010)
 *
 * @see FEATURE_INDEX.md AUTH-008, AUTH-009, AUTH-010
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@store/authStore';
import { useSettingsStore } from '@store/settingsStore';

/** Session check interval in milliseconds */
const SESSION_CHECK_INTERVAL = 5000; // Check every 5 seconds

/**
 * Grace period before locking on background (milliseconds).
 * Prevents locking during permission dialogs, file pickers,
 * and other system overlays that briefly background the app.
 */
const BACKGROUND_LOCK_GRACE_MS = 4000;

/**
 * Hook for managing authenticated session lifecycle.
 *
 * Features:
 * - Tracks user activity to reset timeout
 * - Automatically locks vault after inactivity timeout
 * - Locks vault when app goes to background (if enabled)
 * - Provides methods to manually update activity
 *
 * @returns Session management utilities
 */
export function useAuthSession() {
  const navigation = useNavigation();

  // Auth state
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const updateActivity = useAuthStore((state) => state.updateActivity);
  const hasSessionTimedOut = useAuthStore((state) => state.hasSessionTimedOut);

  // Lock suppression (e.g. during file picker / import)
  const suppressAutoLock = useAuthStore((state) => state.suppressAutoLock);

  // Settings
  const lockTimeout = useSettingsStore((state) => state.lockTimeout);
  const lockOnBackground = useSettingsStore((state) => state.lockOnBackground);

  // Refs for cleanup
  const timeoutCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateSubscription = useRef<ReturnType<typeof AppState.addEventListener> | null>(null);
  const backgroundLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Lock the vault and navigate to calculator
   */
  const lockVault = useCallback(() => {
    logout();
    // Navigate to calculator screen
    navigation.navigate('Calculator' as never);
  }, [logout, navigation]);

  /**
   * Handle app state changes (foreground/background)
   *
   * Uses a grace period to avoid locking during transient system dialogs
   * (permission requests, file pickers, share sheets, etc.) that briefly
   * put the app in background/inactive state.
   */
  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      // Skip if auto-lock is suppressed (file picker / import in progress)
      if (!isAuthenticated || !lockOnBackground || suppressAutoLock) {
        // Cancel any pending lock timer
        if (backgroundLockTimer.current) {
          clearTimeout(backgroundLockTimer.current);
          backgroundLockTimer.current = null;
        }
        return;
      }

      if (nextAppState === 'background') {
        // Start grace period — only lock if app stays in background
        // This prevents locking during permission dialogs, file pickers, etc.
        if (!backgroundLockTimer.current) {
          backgroundLockTimer.current = setTimeout(() => {
            backgroundLockTimer.current = null;
            // Re-check state before locking (user may have returned)
            if (AppState.currentState !== 'active') {
              lockVault();
            }
          }, BACKGROUND_LOCK_GRACE_MS);
        }
      } else if (nextAppState === 'active') {
        // App came back to foreground — cancel the pending lock
        if (backgroundLockTimer.current) {
          clearTimeout(backgroundLockTimer.current);
          backgroundLockTimer.current = null;
        }
      }
      // 'inactive' is ignored — it fires for transient overlays
      // (permission dialogs, notification shade, etc.)
    },
    [isAuthenticated, lockOnBackground, suppressAutoLock, lockVault]
  );

  /**
   * Check if session has timed out and lock if necessary
   */
  const checkSessionTimeout = useCallback(() => {
    if (isAuthenticated && !suppressAutoLock && hasSessionTimedOut(lockTimeout)) {
      lockVault();
    }
  }, [isAuthenticated, suppressAutoLock, hasSessionTimedOut, lockTimeout, lockVault]);

  /**
   * Touch session to indicate user activity.
   * Call this on user interactions to prevent auto-lock.
   */
  const touchSession = useCallback(() => {
    updateActivity();
  }, [updateActivity]);

  // Set up session timeout checking
  useEffect(() => {
    if (isAuthenticated) {
      // Start checking for timeout periodically
      timeoutCheckInterval.current = setInterval(
        checkSessionTimeout,
        SESSION_CHECK_INTERVAL
      );
    }

    return () => {
      // Clean up interval on unmount or when auth changes
      if (timeoutCheckInterval.current) {
        clearInterval(timeoutCheckInterval.current);
        timeoutCheckInterval.current = null;
      }
    };
  }, [isAuthenticated, checkSessionTimeout]);

  // Set up app state listener for background detection
  useEffect(() => {
    if (isAuthenticated) {
      appStateSubscription.current = AppState.addEventListener(
        'change',
        handleAppStateChange
      );
    }

    return () => {
      // Clean up listener and pending lock timer on unmount or when auth changes
      if (appStateSubscription.current) {
        appStateSubscription.current.remove();
        appStateSubscription.current = null;
      }
      if (backgroundLockTimer.current) {
        clearTimeout(backgroundLockTimer.current);
        backgroundLockTimer.current = null;
      }
    };
  }, [isAuthenticated, handleAppStateChange]);

  return {
    /** Whether user is currently authenticated */
    isAuthenticated,
    /** Update activity timestamp (call on user interaction) */
    touchSession,
    /** Manually lock the vault */
    lockVault,
    /** Current lock timeout setting in ms */
    lockTimeout,
    /** Whether lock on background is enabled */
    lockOnBackground,
  };
}

/**
 * Hook for tracking user activity in vault screens.
 *
 * Automatically calls touchSession on mount and provides
 * a method to track activity on user interactions.
 *
 * Usage:
 * ```tsx
 * function VaultScreen() {
 *   const { onActivity } = useActivityTracker();
 *
 *   return (
 *     <ScrollView onScrollBeginDrag={onActivity}>
 *       ...
 *     </ScrollView>
 *   );
 * }
 * ```
 */
export function useActivityTracker() {
  const updateActivity = useAuthStore((state) => state.updateActivity);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Track activity on mount
  useEffect(() => {
    if (isAuthenticated) {
      updateActivity();
    }
  }, [isAuthenticated, updateActivity]);

  /**
   * Call this on user interactions to prevent auto-lock
   */
  const onActivity = useCallback(() => {
    updateActivity();
  }, [updateActivity]);

  return {
    /** Call on user interactions */
    onActivity,
    /** Whether user is authenticated */
    isAuthenticated,
  };
}
