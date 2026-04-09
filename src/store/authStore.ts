/**
 * VaultCalc - Authentication Store
 *
 * Manages authentication state including:
 * - Login status
 * - Decoy mode flag
 * - Failed attempt tracking
 * - Lockout state
 * - Session activity tracking (for auto-lock)
 *
 * @see 04-Technical-Architecture.md Section 4.1
 * @see AUTH-008 in FEATURE_INDEX.md
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * Authentication state interface
 */
interface AuthState {
  /** Whether user is currently authenticated */
  isAuthenticated: boolean;

  /** Whether user is in decoy vault mode */
  isDecoyMode: boolean;

  /** Number of consecutive failed PIN attempts */
  failedAttempts: number;

  /** Timestamp of last failed attempt (for lockout calculation) */
  lastFailedAttempt: number | null;

  /** Whether lockout is currently active */
  isLockedOut: boolean;

  /** Lockout end timestamp (null if not locked out) */
  lockoutEndTime: number | null;

  /** Timestamp of last user activity (for auto-lock timeout) */
  lastActivity: number | null;

  /** Timestamp when current session started */
  sessionStartTime: number | null;

  /** When true, auto-lock (background + timeout) is suppressed (e.g. during import) */
  suppressAutoLock: boolean;

  /** Whether the decoy exit overlay is showing (panic mode with decoy exit action) */
  showDecoyExit: boolean;
}

/**
 * Authentication actions interface
 */
interface AuthActions {
  /** Authenticate user (sets isAuthenticated = true) */
  authenticate: (isDecoy?: boolean) => void;

  /** Log out user (return to calculator) */
  logout: () => void;

  /** Record a failed PIN attempt */
  recordFailedAttempt: () => void;

  /** Reset failed attempts counter */
  resetFailedAttempts: () => void;

  /** Set lockout state */
  setLockout: (endTime: number | null) => void;

  /** Update last activity timestamp */
  updateActivity: () => void;

  /** Check if session has timed out based on given timeout duration */
  hasSessionTimedOut: (timeoutMs: number) => boolean;

  /** Set the auto-lock suppression flag */
  setSuppressAutoLock: (suppress: boolean) => void;

  /** Show decoy exit overlay (called by panic mode) */
  triggerDecoyExit: () => void;

  /** Dismiss decoy exit overlay */
  dismissDecoyExit: () => void;

  /** Reset entire auth state */
  reset: () => void;
}

/**
 * Initial authentication state
 */
const initialState: AuthState = {
  isAuthenticated: false,
  isDecoyMode: false,
  failedAttempts: 0,
  lastFailedAttempt: null,
  isLockedOut: false,
  lockoutEndTime: null,
  lastActivity: null,
  sessionStartTime: null,
  suppressAutoLock: false,
  showDecoyExit: false,
};

/**
 * Authentication store
 *
 * Note: This store is NOT persisted. Authentication state
 * resets on app restart for security.
 *
 * Uses subscribeWithSelector middleware for efficient state subscriptions.
 *
 * @see AUTH-008 Auth State Management
 */
export const useAuthStore = create<AuthState & AuthActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    authenticate: (isDecoy = false) => {
      const now = Date.now();
      set({
        isAuthenticated: true,
        isDecoyMode: isDecoy,
        failedAttempts: 0,
        isLockedOut: false,
        lockoutEndTime: null,
        lastActivity: now,
        sessionStartTime: now,
      });
    },

    logout: () => {
      set({
        isAuthenticated: false,
        isDecoyMode: false,
        lastActivity: null,
        sessionStartTime: null,
        showDecoyExit: false,
      });
    },

    recordFailedAttempt: () => {
      set((state) => ({
        failedAttempts: state.failedAttempts + 1,
        lastFailedAttempt: Date.now(),
      }));
    },

    resetFailedAttempts: () => {
      set({
        failedAttempts: 0,
        lastFailedAttempt: null,
      });
    },

    setLockout: (endTime) => {
      set({
        isLockedOut: endTime !== null,
        lockoutEndTime: endTime,
      });
    },

    updateActivity: () => {
      // Only update if authenticated
      if (get().isAuthenticated) {
        set({ lastActivity: Date.now() });
      }
    },

    hasSessionTimedOut: (timeoutMs: number) => {
      const { isAuthenticated, lastActivity, suppressAutoLock } = get();
      if (!isAuthenticated || !lastActivity || suppressAutoLock) {
        return false;
      }
      return Date.now() - lastActivity > timeoutMs;
    },

    setSuppressAutoLock: (suppress: boolean) => {
      set({ suppressAutoLock: suppress });
    },

    triggerDecoyExit: () => {
      set({ showDecoyExit: true });
    },

    dismissDecoyExit: () => {
      set({ showDecoyExit: false });
    },

    reset: () => {
      set(initialState);
    },
  }))
);
