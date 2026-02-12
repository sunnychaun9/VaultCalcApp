/**
 * VaultCalc - Failed Attempts Hook
 *
 * Hook for tracking and displaying failed PIN attempt feedback.
 * Provides warning messages and lockout status to UI components.
 *
 * @see FEATURE_INDEX.md AUTH-006
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Vibration } from 'react-native';
import { useAuthStore } from '@store/authStore';
import {
  getWarningLevel,
  getWarningMessage,
  calculateAttemptDelay,
  checkAndClearLockout,
  getRemainingLockoutTime,
  formatLockoutTime,
  type WarningLevel,
} from '../services/failedAttempts';

interface FailedAttemptsState {
  /** Current warning level */
  warningLevel: WarningLevel;
  /** Warning message to display (null if none) */
  warningMessage: string | null;
  /** Whether currently in delay period after failed attempt */
  isDelayed: boolean;
  /** Remaining delay time in ms */
  delayRemaining: number;
  /** Whether currently locked out */
  isLockedOut: boolean;
  /** Formatted lockout time remaining */
  lockoutTimeRemaining: string;
}

/**
 * Hook for failed attempt tracking and feedback
 *
 * Provides:
 * - Warning messages based on attempt count
 * - Delay tracking after failed attempts
 * - Lockout status and countdown
 * - Haptic feedback on failures
 */
export function useFailedAttempts() {
  const failedAttempts = useAuthStore((state) => state.failedAttempts);
  const isLockedOut = useAuthStore((state) => state.isLockedOut);
  const lockoutEndTime = useAuthStore((state) => state.lockoutEndTime);

  // Local state for delays and countdowns
  const [isDelayed, setIsDelayed] = useState(false);
  const [delayRemaining, setDelayRemaining] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState('');

  // Refs for timers
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate current warning state
  const warningLevel = getWarningLevel(failedAttempts);
  const warningMessage = getWarningMessage(failedAttempts);

  /**
   * Handle a new failed attempt
   * Sets up delay and provides haptic feedback
   */
  const onFailedAttempt = useCallback(() => {
    // Haptic feedback
    Vibration.vibrate([0, 100, 50, 100]); // Double vibration pattern

    // Calculate and set delay
    const delay = calculateAttemptDelay(failedAttempts + 1);
    if (delay > 0) {
      setIsDelayed(true);
      setDelayRemaining(delay);

      // Clear existing timer
      if (delayTimer.current) {
        clearTimeout(delayTimer.current);
      }

      // Set up countdown
      const startTime = Date.now();
      const updateDelay = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, delay - elapsed);
        setDelayRemaining(remaining);
        if (remaining <= 0) {
          setIsDelayed(false);
        }
      };

      // Update every 100ms
      countdownInterval.current = setInterval(updateDelay, 100);

      // Clear delay after duration
      delayTimer.current = setTimeout(() => {
        setIsDelayed(false);
        setDelayRemaining(0);
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
        }
      }, delay);
    }
  }, [failedAttempts]);

  // Handle lockout countdown
  useEffect(() => {
    if (!isLockedOut || !lockoutEndTime) {
      setLockoutRemaining('');
      return;
    }

    const updateLockout = () => {
      const remaining = getRemainingLockoutTime();
      if (remaining <= 0) {
        checkAndClearLockout();
        setLockoutRemaining('');
      } else {
        setLockoutRemaining(formatLockoutTime(remaining));
      }
    };

    // Initial update
    updateLockout();

    // Update every second
    const interval = setInterval(updateLockout, 1000);
    return () => clearInterval(interval);
  }, [isLockedOut, lockoutEndTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (delayTimer.current) {
        clearTimeout(delayTimer.current);
      }
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  const state: FailedAttemptsState = {
    warningLevel,
    warningMessage,
    isDelayed,
    delayRemaining,
    isLockedOut,
    lockoutTimeRemaining: lockoutRemaining,
  };

  return {
    ...state,
    /** Call when a failed attempt occurs */
    onFailedAttempt,
    /** Number of failed attempts */
    failedAttempts,
  };
}
