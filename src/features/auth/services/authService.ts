/**
 * VaultCalc - Authentication Service
 *
 * Handles PIN verification and authentication logic.
 * Integrates with crypto service for secure verification.
 *
 * @see FEATURE_INDEX.md AUTH-001, AUTH-003
 */

import { hashPin, verifyPin } from '@services/crypto';
import {
  isPinConfigured,
  getPinCredentials,
  storePinCredentials,
  clearPinCredentials,
  type PinCredentials,
} from './pinStorage';

/** Authentication result */
export interface AuthResult {
  success: boolean;
  isDecoy?: boolean;
  error?: string;
}

/** PIN validation rules */
const PIN_RULES = {
  MIN_LENGTH: 4,
  MAX_LENGTH: 12,
} as const;

/**
 * Validate PIN format.
 * PIN must be 4-12 digits.
 */
export function isValidPinFormat(pin: string): boolean {
  if (pin.length < PIN_RULES.MIN_LENGTH || pin.length > PIN_RULES.MAX_LENGTH) {
    return false;
  }
  // Must be all digits
  return /^\d+$/.test(pin);
}

/**
 * Check if PIN entry should be attempted.
 * Only numeric strings of valid length should trigger PIN check.
 *
 * @param input The calculator input to check
 * @returns Whether this could be a PIN attempt
 */
export function isPotentialPin(input: string): boolean {
  // Must be numeric only
  if (!/^\d+$/.test(input)) {
    return false;
  }

  // Must be within PIN length bounds
  const length = input.length;
  return length >= PIN_RULES.MIN_LENGTH && length <= PIN_RULES.MAX_LENGTH;
}

/**
 * Attempt to authenticate with a PIN.
 * Checks against both primary and decoy PINs.
 *
 * @param pin The PIN to verify
 * @returns Authentication result
 */
export async function attemptPinAuth(pin: string): Promise<AuthResult> {
  // Check if PIN is configured
  if (!isPinConfigured()) {
    return { success: false, error: 'PIN not configured' };
  }

  // Validate PIN format
  if (!isValidPinFormat(pin)) {
    return { success: false, error: 'Invalid PIN format' };
  }

  try {
    // Get primary PIN credentials
    const primaryCredentials = await getPinCredentials(false);
    if (!primaryCredentials) {
      return { success: false, error: 'Failed to retrieve credentials' };
    }

    // Verify against primary PIN
    const primaryResult = await verifyPin(
      pin,
      primaryCredentials.hash,
      primaryCredentials.salt
    );

    if (primaryResult.success && primaryResult.data === true) {
      return { success: true, isDecoy: false };
    }

    // Check decoy PIN if primary didn't match
    const decoyCredentials = await getPinCredentials(true);
    if (decoyCredentials) {
      const decoyResult = await verifyPin(
        pin,
        decoyCredentials.hash,
        decoyCredentials.salt
      );

      if (decoyResult.success && decoyResult.data === true) {
        return { success: true, isDecoy: true };
      }
    }

    // Neither PIN matched
    return { success: false };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Set up a new PIN.
 *
 * @param pin The PIN to set
 * @param isDecoy Whether this is a decoy PIN
 * @returns Whether setup was successful
 */
export async function setupPin(
  pin: string,
  isDecoy: boolean = false
): Promise<{ success: boolean; error?: string }> {
  // Validate PIN format
  if (!isValidPinFormat(pin)) {
    return {
      success: false,
      error: `PIN must be ${PIN_RULES.MIN_LENGTH}-${PIN_RULES.MAX_LENGTH} digits`,
    };
  }

  try {
    // Hash the PIN
    const hashResult = await hashPin(pin);
    if (!hashResult.success || !hashResult.data) {
      return { success: false, error: 'Failed to hash PIN' };
    }

    // Store credentials
    const credentials: PinCredentials = {
      hash: hashResult.data.hash,
      salt: hashResult.data.salt,
    };

    const stored = await storePinCredentials(credentials, isDecoy);
    if (!stored) {
      return { success: false, error: 'Failed to store PIN' };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Setup failed',
    };
  }
}

/**
 * Check if authentication is required.
 * Returns true if PIN is configured but user is not authenticated.
 */
export function isAuthRequired(): boolean {
  return isPinConfigured();
}

/**
 * Change an existing PIN.
 * Verifies the old PIN, then replaces it with the new one.
 *
 * @param oldPin The current PIN to verify
 * @param newPin The new PIN to set
 * @returns Whether the change was successful
 */
export async function changePin(
  oldPin: string,
  newPin: string
): Promise<{ success: boolean; error?: string }> {
  // Validate formats
  if (!isValidPinFormat(oldPin)) {
    return { success: false, error: 'Invalid current PIN format' };
  }
  if (!isValidPinFormat(newPin)) {
    return {
      success: false,
      error: `New PIN must be ${PIN_RULES.MIN_LENGTH}-${PIN_RULES.MAX_LENGTH} digits`,
    };
  }

  try {
    // Verify old PIN
    const authResult = await attemptPinAuth(oldPin);
    if (!authResult.success) {
      return { success: false, error: 'Current PIN is incorrect' };
    }

    // Clear old credentials
    clearPinCredentials();

    // Hash and store new PIN
    const hashResult = await hashPin(newPin);
    if (!hashResult.success || !hashResult.data) {
      return { success: false, error: 'Failed to hash new PIN' };
    }

    const credentials: PinCredentials = {
      hash: hashResult.data.hash,
      salt: hashResult.data.salt,
    };

    const stored = await storePinCredentials(credentials, false);
    if (!stored) {
      return { success: false, error: 'Failed to store new PIN' };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PIN change failed',
    };
  }
}

/**
 * Get PIN rules for UI display.
 */
export function getPinRules(): typeof PIN_RULES {
  return PIN_RULES;
}
