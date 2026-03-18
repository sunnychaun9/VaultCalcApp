/**
 * VaultCalc - Pattern Lock Manager
 *
 * Handles pattern validation, authentication, and setup logic.
 * Integrates with patternStorage for secure persistence.
 *
 * @see AUTH-009 Pattern Lock
 */

import {
  isPatternConfigured,
  storePatternHash,
  verifyPattern,
  clearPatternCredentials,
} from './patternStorage';

/** Minimum number of dots required for a valid pattern */
export const MIN_PATTERN_LENGTH = 4;

/** Maximum dots (all 9 in the grid) */
export const MAX_PATTERN_LENGTH = 9;

/** Pattern validation result */
export interface PatternValidation {
  valid: boolean;
  error?: string;
}

/**
 * Check if a pattern is a simple straight line.
 * Straight lines (horizontal, vertical, diagonal) are too easy to guess.
 */
function isStraightLine(pattern: number[]): boolean {
  if (pattern.length < 3) return false;

  // Rows: [0,1,2], [3,4,5], [6,7,8]
  const rows = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
  // Columns: [0,3,6], [1,4,7], [2,5,8]
  const cols = [[0, 3, 6], [1, 4, 7], [2, 5, 8]];
  // Diagonals: [0,4,8], [2,4,6]
  const diags = [[0, 4, 8], [2, 4, 6]];

  const allLines = [...rows, ...cols, ...diags];

  for (const line of allLines) {
    // Check if the pattern is a subset of any line (in order or reverse)
    const lineSet = new Set(line);
    if (pattern.every(p => lineSet.has(p))) {
      return true;
    }
  }

  return false;
}

/**
 * Validate a pattern for setup (not for unlock).
 * Enforces minimum length and complexity requirements.
 */
export function validatePattern(pattern: number[]): PatternValidation {
  if (pattern.length < MIN_PATTERN_LENGTH) {
    return {
      valid: false,
      error: `Connect at least ${MIN_PATTERN_LENGTH} dots`,
    };
  }

  // Check for duplicate dots (shouldn't happen with proper gesture tracking)
  const uniqueDots = new Set(pattern);
  if (uniqueDots.size !== pattern.length) {
    return { valid: false, error: 'Invalid pattern' };
  }

  // Check for simple straight-line patterns
  if (isStraightLine(pattern)) {
    return {
      valid: false,
      error: 'Pattern is too simple. Try a more complex shape.',
    };
  }

  return { valid: true };
}

/**
 * Set up a new pattern.
 */
export async function setupPattern(
  pattern: number[]
): Promise<{ success: boolean; error?: string }> {
  const validation = validatePattern(pattern);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const stored = await storePatternHash(pattern);
    if (!stored) {
      return { success: false, error: 'Failed to save pattern' };
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
 * Attempt pattern authentication.
 */
export async function attemptPatternAuth(
  pattern: number[]
): Promise<{ success: boolean; error?: string }> {
  if (!isPatternConfigured()) {
    return { success: false, error: 'Pattern not configured' };
  }

  if (pattern.length < MIN_PATTERN_LENGTH) {
    return { success: false, error: 'Pattern too short' };
  }

  try {
    const isValid = await verifyPattern(pattern);
    return { success: isValid };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Change an existing pattern.
 * Verifies the old pattern first, then stores the new one.
 */
export async function changePattern(
  oldPattern: number[],
  newPattern: number[]
): Promise<{ success: boolean; error?: string }> {
  // Verify old pattern
  const authResult = await attemptPatternAuth(oldPattern);
  if (!authResult.success) {
    return { success: false, error: 'Current pattern is incorrect' };
  }

  // Validate new pattern
  const validation = validatePattern(newPattern);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Clear old and store new
  clearPatternCredentials();
  return setupPattern(newPattern);
}

/**
 * Re-export for convenience.
 */
export { isPatternConfigured, clearPatternCredentials };
