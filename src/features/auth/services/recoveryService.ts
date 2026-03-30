/**
 * VaultCalc - PIN Recovery Service
 *
 * Manages security question-based PIN recovery.
 * The security answer is hashed with Argon2id (same as PIN)
 * and stored encrypted in MMKV. Works fully offline.
 *
 * Recovery flow:
 * 1. User sets a security question + answer during PIN setup
 * 2. On forgot PIN, user answers the question
 * 3. If correct, user can set a new PIN
 *
 * @see AUTH-RECOVERY
 */

import { hashPin, verifyPin } from '@services/crypto';
import { encryptString, decryptString, initializeCrypto } from '@services/crypto';
import { mmkvStorage } from '@services/storage/mmkv';
import { clearPinCredentials, storePinCredentials, type PinCredentials } from './pinStorage';

// ── Storage keys ──

const STORAGE_KEYS = {
  QUESTION_ID: 'vaultcalc_recovery_question_id',
  ANSWER_HASH: 'vaultcalc_recovery_answer_hash',
  ANSWER_SALT: 'vaultcalc_recovery_answer_salt',
  CONFIGURED: 'vaultcalc_recovery_configured',
} as const;

// ── Security questions ──

export const SECURITY_QUESTIONS = [
  "What was your first pet's name?",
  'In what city were you born?',
  "What is your mother's maiden name?",
  'What was the name of your first school?',
  'What is your favorite movie?',
  "What is your best friend's name?",
  'What was your childhood nickname?',
  'What is your favorite food?',
] as const;

// ── Public API ──

/**
 * Check if recovery has been set up.
 */
export function isRecoveryConfigured(): boolean {
  return mmkvStorage.getItem(STORAGE_KEYS.CONFIGURED) === 'true';
}

/**
 * Get the stored security question ID (index into SECURITY_QUESTIONS).
 * Returns -1 if not configured.
 */
export function getSecurityQuestionId(): number {
  const id = mmkvStorage.getItem(STORAGE_KEYS.QUESTION_ID);
  return id !== null ? parseInt(id, 10) : -1;
}

/**
 * Get the security question text.
 */
export function getSecurityQuestion(): string | null {
  const id = getSecurityQuestionId();
  if (id < 0 || id >= SECURITY_QUESTIONS.length) return null;
  return SECURITY_QUESTIONS[id];
}

/**
 * Set up recovery with a security question and answer.
 * The answer is normalized (lowercased, trimmed) then hashed.
 */
export async function setupRecovery(
  questionId: number,
  answer: string,
): Promise<{ success: boolean; error?: string }> {
  if (questionId < 0 || questionId >= SECURITY_QUESTIONS.length) {
    return { success: false, error: 'Invalid question' };
  }
  const normalized = answer.trim().toLowerCase();
  if (normalized.length < 1) {
    return { success: false, error: 'Answer cannot be empty' };
  }

  try {
    await initializeCrypto();

    // Hash the answer the same way we hash PINs
    const hashResult = await hashPin(normalized);
    if (!hashResult.success || !hashResult.data) {
      return { success: false, error: 'Failed to hash answer' };
    }

    // Encrypt hash + salt before storage
    const encHash = await encryptString(hashResult.data.hash, 'recovery_hash');
    const encSalt = await encryptString(hashResult.data.salt, 'recovery_salt');
    if (!encHash.success || !encSalt.success) {
      return { success: false, error: 'Failed to encrypt recovery data' };
    }

    mmkvStorage.setItem(STORAGE_KEYS.QUESTION_ID, String(questionId));
    mmkvStorage.setItem(STORAGE_KEYS.ANSWER_HASH, encHash.data!);
    mmkvStorage.setItem(STORAGE_KEYS.ANSWER_SALT, encSalt.data!);
    mmkvStorage.setItem(STORAGE_KEYS.CONFIGURED, 'true');

    return { success: true };
  } catch {
    return { success: false, error: 'Setup failed' };
  }
}

/**
 * Verify a security answer.
 */
export async function verifyRecoveryAnswer(
  answer: string,
): Promise<boolean> {
  if (!isRecoveryConfigured()) return false;

  const normalized = answer.trim().toLowerCase();

  try {
    const encHash = mmkvStorage.getItem(STORAGE_KEYS.ANSWER_HASH);
    const encSalt = mmkvStorage.getItem(STORAGE_KEYS.ANSWER_SALT);
    if (!encHash || !encSalt) return false;

    const hash = await decryptString(encHash, 'recovery_hash');
    const salt = await decryptString(encSalt, 'recovery_salt');
    if (!hash.success || !salt.success) return false;

    const result = await verifyPin(normalized, hash.data!, salt.data!);
    return result.success && result.data === true;
  } catch {
    return false;
  }
}

/**
 * Reset PIN after successful recovery verification.
 * Clears old PIN and stores the new one.
 */
export async function resetPinWithRecovery(
  newPin: string,
): Promise<{ success: boolean; error?: string }> {
  if (!/^\d{4,12}$/.test(newPin)) {
    return { success: false, error: 'PIN must be 4-12 digits' };
  }

  try {
    const hashResult = await hashPin(newPin);
    if (!hashResult.success || !hashResult.data) {
      return { success: false, error: 'Failed to hash PIN' };
    }

    clearPinCredentials();

    const credentials: PinCredentials = {
      hash: hashResult.data.hash,
      salt: hashResult.data.salt,
    };

    const stored = await storePinCredentials(credentials, false);
    if (!stored) {
      return { success: false, error: 'Failed to store PIN' };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Reset failed' };
  }
}

/**
 * Clear all recovery data. Used when user wants to reconfigure.
 */
export function clearRecoveryData(): void {
  mmkvStorage.removeItem(STORAGE_KEYS.QUESTION_ID);
  mmkvStorage.removeItem(STORAGE_KEYS.ANSWER_HASH);
  mmkvStorage.removeItem(STORAGE_KEYS.ANSWER_SALT);
  mmkvStorage.removeItem(STORAGE_KEYS.CONFIGURED);
}
