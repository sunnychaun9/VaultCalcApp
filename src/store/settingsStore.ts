/**
 * VaultCalc - Settings Store
 *
 * Manages application settings including:
 * - First launch detection
 * - Theme preference
 * - Lock timeout
 * - Feature flags
 *
 * This store is PERSISTED with MMKV for fast synchronous access.
 *
 * @see 04-Technical-Architecture.md Section 4
 * @see SETTINGS-003, SETTINGS-004 in FEATURE_INDEX.md
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@services/storage/mmkv';

/**
 * Theme options
 */
type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Lock timeout options (in milliseconds)
 */
type LockTimeout = 30000 | 60000 | 120000 | 300000; // 30s, 1m, 2m, 5m

/**
 * Settings state interface
 */
interface SettingsState {
  /** Whether this is the first app launch */
  isFirstLaunch: boolean;

  /** Current theme mode */
  themeMode: ThemeMode;

  /** Auto-lock timeout duration */
  lockTimeout: LockTimeout;

  /** Whether biometric unlock is enabled */
  biometricEnabled: boolean;

  /** Whether to lock on app background */
  lockOnBackground: boolean;

  /** Whether intruder detection is enabled */
  intruderDetectionEnabled: boolean;

  /** Whether decoy vault is configured */
  decoyVaultConfigured: boolean;

  /** Whether haptic feedback is enabled for button presses */
  hapticEnabled: boolean;

  /** Whether to delete original source files after import (FILE-009) */
  deleteOriginalsAfterImport: boolean;

  /** Connected Google Drive account email (CLOUD-001) */
  googleDriveEmail: string | null;

  /** Connected Google Drive account display name (CLOUD-001) */
  googleDriveDisplayName: string | null;

  /** Timestamp of last successful backup (CLOUD-003) */
  lastBackupAt: number | null;

  /** Whether auto-backup on app launch is enabled (CLOUD-005) */
  autoBackupEnabled: boolean;

  /** Vault item count at time of last successful backup (CLOUD-006) */
  lastBackupItemCount: number | null;

  /** Whether stealth mode (hidden launcher icon) is enabled (STEALTH-001) */
  stealthModeEnabled: boolean;

  /** Currently selected disguised app icon alias */
  appIcon: 'default' | 'calculator' | 'weather' | 'notes';

  /** Whether shake-to-lock panic button is enabled (ENH-005) */
  panicButtonEnabled: boolean;

  /** Panic trigger: triple volume-down press */
  panicTriggerVolume: boolean;

  /** Panic trigger: triple power button press */
  panicTriggerPower: boolean;

  /** Premium subscription status (PREMIUM-002) */
  premiumStatus: 'free' | 'trial' | 'premium';

  /** Product ID of active premium purchase (PREMIUM-002) */
  premiumProductId: string | null;

  /** Purchase token of active premium purchase (PREMIUM-002) */
  premiumPurchaseToken: string | null;

  /** Timestamp when rewarded ad-free mode expires, epoch ms (ADS-001) */
  adFreeUntil: number | null;

  /** Lifetime count of interstitial ads shown, for soft premium card trigger (ADS-001) */
  totalInterstitialsShown: number;

  /** Cumulative vault unlock count, enables 3rd interstitial after threshold (ADS-001) */
  vaultUnlockCount: number;

  /** UMP consent status cached for synchronous access (ADS-002) */
  consentStatus: 'REQUIRED' | 'NOT_REQUIRED' | 'OBTAINED' | 'UNKNOWN';
}

/**
 * Settings actions interface
 */
interface SettingsActions {
  /** Mark first launch as complete */
  completeFirstLaunch: () => void;

  /** Set theme mode */
  setThemeMode: (mode: ThemeMode) => void;

  /** Set lock timeout */
  setLockTimeout: (timeout: LockTimeout) => void;

  /** Toggle biometric unlock */
  setBiometricEnabled: (enabled: boolean) => void;

  /** Toggle lock on background */
  setLockOnBackground: (enabled: boolean) => void;

  /** Toggle intruder detection */
  setIntruderDetectionEnabled: (enabled: boolean) => void;

  /** Set decoy vault configured status */
  setDecoyVaultConfigured: (configured: boolean) => void;

  /** Toggle haptic feedback */
  setHapticEnabled: (enabled: boolean) => void;

  /** Toggle delete originals after import */
  setDeleteOriginalsAfterImport: (enabled: boolean) => void;

  /** Set Google Drive connection info (CLOUD-001) */
  setGoogleDriveConnection: (email: string | null, displayName: string | null) => void;

  /** Set last backup timestamp (CLOUD-003) */
  setLastBackupAt: (timestamp: number | null) => void;

  /** Toggle auto-backup on app launch (CLOUD-005) */
  setAutoBackupEnabled: (enabled: boolean) => void;

  /** Set last backup item count (CLOUD-006) */
  setLastBackupItemCount: (count: number | null) => void;

  /** Toggle stealth mode (STEALTH-001) */
  setStealthModeEnabled: (enabled: boolean) => void;

  /** Set disguised app icon */
  setAppIcon: (icon: 'default' | 'calculator' | 'weather' | 'notes') => void;

  /** Toggle shake-to-lock panic button (ENH-005) */
  setPanicButtonEnabled: (enabled: boolean) => void;

  /** Toggle panic trigger: volume down */
  setPanicTriggerVolume: (enabled: boolean) => void;

  /** Toggle panic trigger: power button */
  setPanicTriggerPower: (enabled: boolean) => void;

  /** Set premium subscription status (PREMIUM-002) */
  setPremiumStatus: (status: 'free' | 'trial' | 'premium') => void;

  /** Set premium purchase info (PREMIUM-002) */
  setPremiumPurchase: (productId: string | null, purchaseToken: string | null) => void;

  /** Set rewarded ad-free expiration timestamp (ADS-001) */
  setAdFreeUntil: (timestamp: number | null) => void;

  /** Increment lifetime interstitial count (ADS-001) */
  incrementInterstitialsShown: () => void;

  /** Increment cumulative vault unlock count (ADS-001) */
  incrementVaultUnlockCount: () => void;

  /** Set cached UMP consent status (ADS-002) */
  setConsentStatus: (status: 'REQUIRED' | 'NOT_REQUIRED' | 'OBTAINED' | 'UNKNOWN') => void;

  /** Reset all settings to defaults */
  resetToDefaults: () => void;
}

/**
 * Default settings
 */
const defaultSettings: SettingsState = {
  isFirstLaunch: true,
  themeMode: 'system',
  lockTimeout: 60000, // 1 minute default
  biometricEnabled: false,
  lockOnBackground: true,
  intruderDetectionEnabled: false,
  decoyVaultConfigured: false,
  hapticEnabled: true,
  deleteOriginalsAfterImport: false,
  stealthModeEnabled: false,
  appIcon: 'default',
  panicButtonEnabled: false,
  panicTriggerVolume: true,
  panicTriggerPower: false,
  googleDriveEmail: null,
  googleDriveDisplayName: null,
  lastBackupAt: null,
  autoBackupEnabled: false,
  lastBackupItemCount: null,
  premiumStatus: 'free',
  premiumProductId: null,
  premiumPurchaseToken: null,
  adFreeUntil: null,
  totalInterstitialsShown: 0,
  vaultUnlockCount: 0,
  consentStatus: 'UNKNOWN' as const,
};

/**
 * Settings store with MMKV persistence
 *
 * Settings are persisted synchronously via MMKV for instant access
 * on app startup. This enables features like:
 * - Remembering theme preference
 * - Detecting first launch
 * - Preserving security settings
 */
export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...defaultSettings,

      completeFirstLaunch: () => {
        set({ isFirstLaunch: false });
      },

      setThemeMode: (mode) => {
        set({ themeMode: mode });
      },

      setLockTimeout: (timeout) => {
        set({ lockTimeout: timeout });
      },

      setBiometricEnabled: (enabled) => {
        set({ biometricEnabled: enabled });
      },

      setLockOnBackground: (enabled) => {
        set({ lockOnBackground: enabled });
      },

      setIntruderDetectionEnabled: (enabled) => {
        set({ intruderDetectionEnabled: enabled });
      },

      setDecoyVaultConfigured: (configured) => {
        set({ decoyVaultConfigured: configured });
      },

      setHapticEnabled: (enabled) => {
        set({ hapticEnabled: enabled });
      },

      setDeleteOriginalsAfterImport: (enabled) => {
        set({ deleteOriginalsAfterImport: enabled });
      },

      setStealthModeEnabled: (enabled) => {
        set({ stealthModeEnabled: enabled });
      },

      setAppIcon: (icon) => {
        set({ appIcon: icon });
      },

      setPanicButtonEnabled: (enabled) => {
        set({ panicButtonEnabled: enabled });
      },

      setPanicTriggerVolume: (enabled) => {
        set({ panicTriggerVolume: enabled });
      },

      setPanicTriggerPower: (enabled) => {
        set({ panicTriggerPower: enabled });
      },

      setGoogleDriveConnection: (email, displayName) => {
        set({
          googleDriveEmail: email,
          googleDriveDisplayName: displayName,
          // Clear backup timestamp when disconnecting
          ...(email === null ? { lastBackupAt: null, autoBackupEnabled: false, lastBackupItemCount: null } : {}),
        });
      },

      setLastBackupAt: (timestamp) => {
        set({ lastBackupAt: timestamp });
      },

      setAutoBackupEnabled: (enabled) => {
        set({ autoBackupEnabled: enabled });
      },

      setLastBackupItemCount: (count) => {
        set({ lastBackupItemCount: count });
      },

      setPremiumStatus: (status) => {
        set({ premiumStatus: status });
      },

      setPremiumPurchase: (productId, purchaseToken) => {
        set({ premiumProductId: productId, premiumPurchaseToken: purchaseToken });
      },

      setAdFreeUntil: (timestamp) => {
        set({ adFreeUntil: timestamp });
      },

      incrementInterstitialsShown: () => {
        set((state) => ({ totalInterstitialsShown: state.totalInterstitialsShown + 1 }));
      },

      incrementVaultUnlockCount: () => {
        set((state) => ({ vaultUnlockCount: state.vaultUnlockCount + 1 }));
      },

      setConsentStatus: (status) => {
        set({ consentStatus: status });
      },

      resetToDefaults: () => {
        set(defaultSettings);
      },
    }),
    {
      name: 'vaultcalc-settings',
      storage: createJSONStorage(() => mmkvStorage),
      // Only persist state, not actions
      partialize: (state) => ({
        isFirstLaunch: state.isFirstLaunch,
        themeMode: state.themeMode,
        lockTimeout: state.lockTimeout,
        biometricEnabled: state.biometricEnabled,
        lockOnBackground: state.lockOnBackground,
        intruderDetectionEnabled: state.intruderDetectionEnabled,
        decoyVaultConfigured: state.decoyVaultConfigured,
        hapticEnabled: state.hapticEnabled,
        deleteOriginalsAfterImport: state.deleteOriginalsAfterImport,
        stealthModeEnabled: state.stealthModeEnabled,
        appIcon: state.appIcon,
        panicButtonEnabled: state.panicButtonEnabled,
        panicTriggerVolume: state.panicTriggerVolume,
        panicTriggerPower: state.panicTriggerPower,
        googleDriveEmail: state.googleDriveEmail,
        googleDriveDisplayName: state.googleDriveDisplayName,
        lastBackupAt: state.lastBackupAt,
        autoBackupEnabled: state.autoBackupEnabled,
        lastBackupItemCount: state.lastBackupItemCount,
        premiumStatus: state.premiumStatus,
        premiumProductId: state.premiumProductId,
        // premiumPurchaseToken intentionally excluded — billing credential not persisted (H-5)
        adFreeUntil: state.adFreeUntil,
        totalInterstitialsShown: state.totalInterstitialsShown,
        vaultUnlockCount: state.vaultUnlockCount,
        consentStatus: state.consentStatus,
      }),
    },
  ),
);
