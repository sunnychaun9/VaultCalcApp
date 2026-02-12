/**
 * VaultCalc - Premium Status Service (PREMIUM-003)
 *
 * Silent one-shot premium status check at app startup.
 * Queries Google Play for active purchases and syncs
 * settingsStore accordingly.
 *
 * Security: An encrypted "premium proof" is stored alongside the
 * plaintext MMKV state. When Play Store is unreachable, the proof
 * must decrypt successfully for premium to be trusted. This prevents
 * trivial MMKV tampering from granting premium access.
 */

import { useSettingsStore } from '@store/settingsStore';
import { storage } from '@services/storage/mmkv';
import { encryptString, decryptString } from '@services/crypto';
import { initializeBilling, restorePurchases, getActivePremiumPurchase } from './billingService';

const PREMIUM_PROOF_KEY = 'vaultcalc_premium_proof';
const PREMIUM_PROOF_AAD = 'premium_proof_v1';

/**
 * Build the plaintext value that gets encrypted into the proof.
 * Ties the premium grant to a specific product and token.
 */
function buildProofPayload(productId: string, purchaseToken: string): string {
  return `premium:${productId}:${purchaseToken}`;
}

/**
 * Write an encrypted premium proof to MMKV.
 * Called when Play Store confirms an active purchase.
 */
async function storePremiumProof(productId: string, purchaseToken: string): Promise<void> {
  try {
    const payload = buildProofPayload(productId, purchaseToken);
    const result = await encryptString(payload, PREMIUM_PROOF_AAD);
    if (result.success && result.data !== undefined) {
      storage.set(PREMIUM_PROOF_KEY, result.data);
    }
  } catch {
    // Non-fatal — proof won't be available for offline verification
  }
}

/**
 * Delete the premium proof from MMKV.
 * Called when Play Store confirms no active purchase.
 */
function clearPremiumProof(): void {
  storage.remove(PREMIUM_PROOF_KEY);
}

/**
 * Verify the encrypted premium proof.
 * Successful AES-GCM decryption proves the proof wasn't tampered with.
 * Additionally verifies the productId embedded in the proof matches
 * the persisted premiumProductId.
 *
 * Note: purchaseToken is NOT persisted to MMKV (H-5), so verification
 * relies on the encrypted proof integrity rather than token comparison.
 */
async function verifyPremiumProof(): Promise<boolean> {
  try {
    const proof = storage.getString(PREMIUM_PROOF_KEY);
    if (!proof) return false;

    const result = await decryptString(proof, PREMIUM_PROOF_AAD);
    if (!result.success || result.data === undefined) return false;

    // Proof format: "premium:{productId}:{purchaseToken}"
    const parts = result.data.split(':');
    if (parts.length !== 3 || parts[0] !== 'premium') return false;

    const { premiumProductId } = useSettingsStore.getState();
    if (!premiumProductId) return false;

    return parts[1] === premiumProductId;
  } catch {
    return false;
  }
}

/**
 * Verify premium subscription status against Google Play.
 * Fire-and-forget — errors are silently swallowed.
 *
 * When Play Store is unreachable, verifies the encrypted premium
 * proof. If the proof is missing or invalid, downgrades to free.
 */
export async function checkPremiumStatus(): Promise<void> {
  try {
    const { premiumStatus } = useSettingsStore.getState();

    // Initialize billing connection
    const initResult = await initializeBilling();
    if (!initResult.success) {
      // Can't reach Play Store — verify encrypted proof before trusting local state
      if (premiumStatus === 'premium') {
        const proofValid = await verifyPremiumProof();
        if (!proofValid) {
          // Proof invalid or missing — tampered MMKV or stale state
          const settings = useSettingsStore.getState();
          settings.setPremiumStatus('free');
          settings.setPremiumPurchase(null, null);
          clearPremiumProof();
        }
      }
      return;
    }

    // Query active purchases
    const restoreResult = await restorePurchases();
    if (!restoreResult.success || !restoreResult.purchases) return;

    const activePurchase = getActivePremiumPurchase(restoreResult.purchases);
    const settings = useSettingsStore.getState();

    if (activePurchase) {
      // Active purchase confirmed by Play Store — update state and proof
      if (premiumStatus !== 'premium' ||
          settings.premiumProductId !== activePurchase.productId ||
          settings.premiumPurchaseToken !== activePurchase.purchaseToken) {
        settings.setPremiumStatus('premium');
        settings.setPremiumPurchase(activePurchase.productId, activePurchase.purchaseToken);
      }
      await storePremiumProof(activePurchase.productId, activePurchase.purchaseToken);
    } else {
      // No active purchase — downgrade if currently premium
      if (premiumStatus === 'premium') {
        settings.setPremiumStatus('free');
        settings.setPremiumPurchase(null, null);
      }
      clearPremiumProof();
    }
  } catch {
    // Swallow — keep local state on any error
  }
}
