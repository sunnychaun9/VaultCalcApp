/**
 * VaultCalc - Failed Attempts Service
 *
 * Handles failed PIN attempt tracking, warnings, and lockout logic.
 *
 * Security features:
 * - Progressive delays after failed attempts
 * - Warning messages as attempts increase
 * - Lockout thresholds for AUTH-007
 *
 * @see FEATURE_INDEX.md AUTH-006, AUTH-007
 */

import { useAuthStore } from '@store/authStore';

/**
 * Failed attempt thresholds and timing
 */
export const FAILED_ATTEMPT_CONFIG = {
  /** Number of attempts before showing warning */
  WARNING_THRESHOLD: 3,
  /** Number of attempts before lockout */
  LOCKOUT_THRESHOLD: 5,
  /** Maximum attempts before data wipe warning */
  MAX_ATTEMPTS: 10,
  /** Base delay in ms after failed attempt */
  BASE_DELAY_MS: 500,
  /** Delay multiplier per attempt */
  DELAY_MULTIPLIER: 1.5,
  /** Maximum delay in ms */
  MAX_DELAY_MS: 5000,
} as const;

/**
 * Warning level based on failed attempts
 */
export type WarningLevel = 'none' | 'caution' | 'warning' | 'danger';

/**
 * Get warning level based on failed attempt count
 */
export function getWarningLevel(failedAttempts: number): WarningLevel {
  if (failedAttempts < FAILED_ATTEMPT_CONFIG.WARNING_THRESHOLD) {
    return 'none';
  }
  if (failedAttempts < FAILED_ATTEMPT_CONFIG.LOCKOUT_THRESHOLD) {
    return 'caution';
  }
  if (failedAttempts < FAILED_ATTEMPT_CONFIG.MAX_ATTEMPTS) {
    return 'warning';
  }
  return 'danger';
}

/**
 * Get warning message based on failed attempts
 */
export function getWarningMessage(failedAttempts: number): string | null {
  const remaining = FAILED_ATTEMPT_CONFIG.MAX_ATTEMPTS - failedAttempts;
  const warningLevel = getWarningLevel(failedAttempts);

  switch (warningLevel) {
    case 'none':
      return null;
    case 'caution':
      return `${remaining} attempts remaining`;
    case 'warning':
      return `Warning: ${remaining} attempts remaining before lockout`;
    case 'danger':
      return `Final warning: ${remaining} attempt(s) remaining`;
  }
}

/**
 * Calculate delay before next attempt is allowed
 * Uses exponential backoff with a cap
 */
export function calculateAttemptDelay(failedAttempts: number): number {
  if (failedAttempts === 0) {
    return 0;
  }

  const delay =
    FAILED_ATTEMPT_CONFIG.BASE_DELAY_MS *
    Math.pow(FAILED_ATTEMPT_CONFIG.DELAY_MULTIPLIER, failedAttempts - 1);

  return Math.min(delay, FAILED_ATTEMPT_CONFIG.MAX_DELAY_MS);
}

/**
 * Check if lockout should be triggered
 */
export function shouldTriggerLockout(failedAttempts: number): boolean {
  return failedAttempts >= FAILED_ATTEMPT_CONFIG.LOCKOUT_THRESHOLD;
}

/**
 * Calculate lockout duration based on failed attempts
 * Progressive lockout: 30s, 1m, 5m, 15m, 1h
 */
export function calculateLockoutDuration(failedAttempts: number): number {
  const lockoutLevel =
    failedAttempts - FAILED_ATTEMPT_CONFIG.LOCKOUT_THRESHOLD;

  const durations = [
    30 * 1000, // 30 seconds
    60 * 1000, // 1 minute
    5 * 60 * 1000, // 5 minutes
    15 * 60 * 1000, // 15 minutes
    60 * 60 * 1000, // 1 hour
  ];

  const index = Math.min(lockoutLevel, durations.length - 1);
  return durations[Math.max(0, index)];
}

/**
 * Format lockout remaining time for display
 */
export function formatLockoutTime(remainingMs: number): string {
  if (remainingMs <= 0) {
    return 'Unlocking...';
  }

  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * Record a failed attempt and handle lockout if needed
 * Returns the delay before next attempt is allowed
 */
export function handleFailedAttempt(): {
  delay: number;
  warning: string | null;
  isLockedOut: boolean;
  lockoutDuration: number;
} {
  const store = useAuthStore.getState();
  store.recordFailedAttempt();

  const failedAttempts = store.failedAttempts + 1; // +1 because we just recorded it
  const delay = calculateAttemptDelay(failedAttempts);
  const warning = getWarningMessage(failedAttempts);
  const shouldLockout = shouldTriggerLockout(failedAttempts);
  const lockoutDuration = shouldLockout
    ? calculateLockoutDuration(failedAttempts)
    : 0;

  if (shouldLockout) {
    const lockoutEndTime = Date.now() + lockoutDuration;
    store.setLockout(lockoutEndTime);
  }

  return {
    delay,
    warning,
    isLockedOut: shouldLockout,
    lockoutDuration,
  };
}

/**
 * Check and clear expired lockout
 */
export function checkAndClearLockout(): boolean {
  const store = useAuthStore.getState();
  const { isLockedOut, lockoutEndTime } = store;

  if (!isLockedOut || !lockoutEndTime) {
    return false;
  }

  if (Date.now() >= lockoutEndTime) {
    store.setLockout(null);
    return true; // Lockout was cleared
  }

  return false; // Still locked out
}

/**
 * Get remaining lockout time in milliseconds
 */
export function getRemainingLockoutTime(): number {
  const { isLockedOut, lockoutEndTime } = useAuthStore.getState();

  if (!isLockedOut || !lockoutEndTime) {
    return 0;
  }

  return Math.max(0, lockoutEndTime - Date.now());
}
