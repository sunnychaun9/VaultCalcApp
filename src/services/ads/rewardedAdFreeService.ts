/**
 * VaultCalc - Rewarded Ad-Free Service
 *
 * Manages the 24-hour ad-free mode granted by watching a rewarded ad.
 * Uses device time + monotonic drift detection for anti-tamper.
 * No external time API dependencies.
 *
 * Persistence: adFreeUntil + encrypted AES-GCM proof in MMKV.
 * Drift detection: compares wall-clock deltas against
 * SystemClock.elapsedRealtime() deltas to detect clock manipulation.
 *
 * Reboot-safe: stores boot count alongside drift anchors.
 * After a reboot, elapsedRealtime resets to 0, so we fall back
 * to wall-clock-only validation with tighter tolerance.
 *
 * @see FEATURE_INDEX.md ADS-001
 */

import { useSettingsStore } from '@store/settingsStore';
import { storage } from '@services/storage/mmkv';
import { encryptString, decryptString } from '@services/crypto';
import { NativeAds } from './nativeAds';
import {
  REWARDED_AD_FREE_DURATION_MS,
  AD_FREE_PROOF_AAD,
  CLOCK_DRIFT_TOLERANCE_MS,
} from './adConfig';

const AD_FREE_PROOF_KEY = 'vaultcalc_ad_free_proof';
const DRIFT_ELAPSED_KEY = 'vaultcalc_drift_elapsed';
const DRIFT_WALLCLOCK_KEY = 'vaultcalc_drift_wallclock';
const DRIFT_BOOTCOUNT_KEY = 'vaultcalc_drift_bootcount';

/** Tighter tolerance used after reboot when elapsed time is unavailable */
const REBOOT_DRIFT_TOLERANCE_MS = 2 * 60 * 1000; // 2 minutes

// ---------------------------------------------------------------------------
// Grant ad-free mode
// ---------------------------------------------------------------------------

/**
 * Grant 24-hour ad-free mode after a rewarded ad completion.
 *
 * 1. Compute expiresAt = now + 24hr
 * 2. Store adFreeUntil in settingsStore (MMKV)
 * 3. Store encrypted proof (AES-GCM)
 * 4. Snapshot drift detection anchors (including boot count)
 */
export async function grantAdFreeMode(): Promise<boolean> {
  try {
    const now = Date.now();
    const expiresAt = now + REWARDED_AD_FREE_DURATION_MS;

    // Update store
    useSettingsStore.getState().setAdFreeUntil(expiresAt);

    // Encrypt and store proof
    const payload = `adfree:${now}:${expiresAt}`;
    const result = await encryptString(payload, AD_FREE_PROOF_AAD);
    if (result.success && result.data !== undefined) {
      storage.set(AD_FREE_PROOF_KEY, result.data);
    }

    // Snapshot drift anchors with boot count
    await snapshotDriftAnchors();

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Check if ad-free is active
// ---------------------------------------------------------------------------

/**
 * Synchronous check: is the 24hr ad-free mode currently active?
 * Reads from settingsStore (MMKV-backed, synchronous).
 * Full validation (proof + drift) is done asynchronously at startup.
 */
export function isAdFreeActive(): boolean {
  const { adFreeUntil } = useSettingsStore.getState();
  if (adFreeUntil === null) return false;
  return Date.now() < adFreeUntil;
}

// ---------------------------------------------------------------------------
// Startup validation
// ---------------------------------------------------------------------------

/**
 * Validate ad-free mode on app startup.
 * Checks encrypted proof integrity and detects clock manipulation.
 * Reboot-safe: detects reboots via boot count and uses appropriate
 * drift detection strategy.
 *
 * Call from App.tsx after DB init (non-blocking, fire-and-forget).
 */
export async function validateAdFreeMode(): Promise<void> {
  const { adFreeUntil } = useSettingsStore.getState();

  // No ad-free mode active — nothing to validate
  if (adFreeUntil === null) return;

  // Check expiration
  if (Date.now() >= adFreeUntil) {
    clearAdFreeMode();
    return;
  }

  // Verify encrypted proof
  const proofValid = await verifyAdFreeProof(adFreeUntil);
  if (!proofValid) {
    clearAdFreeMode();
    return;
  }

  // Detect clock rollback via drift detection (reboot-aware)
  const driftOk = await checkDrift();
  if (!driftOk) {
    clearAdFreeMode();
    return;
  }

  // Valid — update drift anchors for next check
  await snapshotDriftAnchors();
}

// ---------------------------------------------------------------------------
// Proof verification
// ---------------------------------------------------------------------------

/**
 * Verify the encrypted ad-free proof.
 * Decrypts and checks that the embedded expiresAt matches the stored value.
 */
async function verifyAdFreeProof(expectedExpiresAt: number): Promise<boolean> {
  try {
    const proof = storage.getString(AD_FREE_PROOF_KEY);
    if (!proof) return false;

    const result = await decryptString(proof, AD_FREE_PROOF_AAD);
    if (!result.success || result.data === undefined) return false;

    // Proof format: "adfree:{grantTimestamp}:{expiresAt}"
    const parts = result.data.split(':');
    if (parts.length !== 3 || parts[0] !== 'adfree') return false;

    const embeddedExpiresAt = parseInt(parts[2], 10);
    if (isNaN(embeddedExpiresAt)) return false;

    return embeddedExpiresAt === expectedExpiresAt;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Reboot-safe drift detection
// ---------------------------------------------------------------------------

/**
 * Snapshot the current wall-clock, monotonic elapsed time, and boot count.
 * Used to detect clock manipulation between app launches.
 */
async function snapshotDriftAnchors(): Promise<void> {
  try {
    const [elapsed, bootCount] = await Promise.all([
      NativeAds.getElapsedRealtime(),
      NativeAds.getBootCount(),
    ]);
    const wallClock = Date.now();
    storage.set(DRIFT_ELAPSED_KEY, elapsed.toString());
    storage.set(DRIFT_WALLCLOCK_KEY, wallClock.toString());
    storage.set(DRIFT_BOOTCOUNT_KEY, bootCount.toString());
  } catch {
    // Non-fatal — drift detection will be unavailable
  }
}

/**
 * Check for clock manipulation. Reboot-aware:
 *
 * - If NO reboot occurred: compare wall-clock delta vs monotonic elapsed-time
 *   delta. If wall clock drifted backward beyond tolerance → tampered.
 *
 * - If reboot occurred: elapsedRealtime has reset, so we can't use it.
 *   Fall back to wall-clock-only check with a tighter tolerance:
 *   if wall clock is earlier than the grant timestamp embedded in the
 *   proof, the clock was rolled back.
 *
 * Returns true if no manipulation detected (or if anchors unavailable).
 */
async function checkDrift(): Promise<boolean> {
  try {
    const prevElapsedStr = storage.getString(DRIFT_ELAPSED_KEY);
    const prevWallClockStr = storage.getString(DRIFT_WALLCLOCK_KEY);
    const prevBootCountStr = storage.getString(DRIFT_BOOTCOUNT_KEY);
    if (!prevElapsedStr || !prevWallClockStr) return true; // No anchors — skip

    const prevElapsed = parseFloat(prevElapsedStr);
    const prevWallClock = parseFloat(prevWallClockStr);
    const prevBootCount = prevBootCountStr ? parseInt(prevBootCountStr, 10) : -1;
    if (isNaN(prevElapsed) || isNaN(prevWallClock)) return true;

    const [currentElapsed, currentBootCount] = await Promise.all([
      NativeAds.getElapsedRealtime(),
      NativeAds.getBootCount(),
    ]);
    const currentWallClock = Date.now();

    const rebooted = prevBootCount >= 0 &&
                     currentBootCount >= 0 &&
                     currentBootCount !== prevBootCount;

    if (rebooted) {
      // Reboot detected — elapsed time is meaningless.
      // Fall back to wall-clock-only: check if current wall clock
      // is suspiciously earlier than the previous snapshot.
      const wallClockDelta = currentWallClock - prevWallClock;
      // If wall clock went backward by more than the tight tolerance,
      // the clock was likely rolled back.
      return wallClockDelta >= -REBOOT_DRIFT_TOLERANCE_MS;
    }

    // No reboot — use full monotonic drift comparison
    const elapsedDelta = currentElapsed - prevElapsed;
    const wallClockDelta = currentWallClock - prevWallClock;

    // drift = how much more time actually passed vs what wall clock claims.
    // A positive drift means wall clock advanced less than real time
    // (i.e., clock was rolled back).
    const drift = elapsedDelta - wallClockDelta;
    return drift <= CLOCK_DRIFT_TOLERANCE_MS;
  } catch {
    return true; // Can't check — allow
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Clear all ad-free state and proof.
 */
function clearAdFreeMode(): void {
  useSettingsStore.getState().setAdFreeUntil(null);
  storage.remove(AD_FREE_PROOF_KEY);
  storage.remove(DRIFT_ELAPSED_KEY);
  storage.remove(DRIFT_WALLCLOCK_KEY);
  storage.remove(DRIFT_BOOTCOUNT_KEY);
}
