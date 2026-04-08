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
 * Unlock method options
 */
export type UnlockMethod = 'pin' | 'pattern';

/**
 * What happens when panic mode triggers
 */
export type PanicAction = 'lock' | 'fakeCrash';

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

  /** Whether intruder location logging is enabled (optional, OFF by default) */
  intruderLocationEnabled: boolean;

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

  /** What happens on panic trigger: lock (default) or show fake crash */
  panicAction: PanicAction;

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

  /** Secret quick unlock: long-press = on calculator when display is "0" */
  quickUnlockEnabled: boolean;

  /** Current unlock method: PIN or pattern (AUTH-009) */
  unlockMethod: UnlockMethod;

  /** Whether a paywall should be shown on next vault open */
  paywallPending: boolean;

  /** Cumulative count of successful file imports (triggers paywall at 3) */
  totalImportCount: number;

  /** Timestamp of first app launch (epoch ms, for 3-day engagement trigger) */
  firstLaunchTimestamp: number | null;

  /** How many times the user has dismissed a paywall (for dynamic offers) */
  paywallDismissCount: number;

  /** Timestamp of last review prompt shown (epoch ms) */
  lastReviewPromptAt: number | null;

  /** How many times the review prompt has been shown */
  reviewPromptCount: number;

  /** How many times the user has shared the app (for referral reward) */
  appShareCount: number;

  /** Timestamp when premium lapsed (for win-back offer after 30 days) */
  premiumLapsedAt: number | null;

  /** Whether win-back offer has been shown this install */
  winBackShown: boolean;

  /** A/B test: paywall unlock threshold (assigned randomly on first launch) */
  paywallUnlockThreshold: 3 | 5;

  /** Whether to show pattern path while drawing (AUTH-009) */
  showPatternPath: boolean;
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

  /** Toggle intruder location logging */
  setIntruderLocationEnabled: (enabled: boolean) => void;

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

  /** Set panic action behavior */
  setPanicAction: (action: PanicAction) => void;

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

  /** Set paywall pending flag */
  setPaywallPending: (pending: boolean) => void;

  /** Increment total import count */
  incrementImportCount: (count: number) => void;

  /** Record first launch timestamp (only sets once) */
  recordFirstLaunchTimestamp: () => void;

  /** Increment paywall dismiss count (for dynamic offers) */
  incrementPaywallDismissCount: () => void;

  /** Record that a review prompt was shown */
  recordReviewPrompt: () => void;

  /** Increment app share count */
  incrementAppShareCount: () => void;

  /** Record when premium subscription lapsed (for win-back) */
  recordPremiumLapsed: () => void;

  /** Mark win-back offer as shown */
  markWinBackShown: () => void;

  /** Toggle secret quick unlock gesture */
  setQuickUnlockEnabled: (enabled: boolean) => void;

  /** Set unlock method: PIN or pattern (AUTH-009) */
  setUnlockMethod: (method: UnlockMethod) => void;

  /** Toggle pattern path visibility (AUTH-009) */
  setShowPatternPath: (show: boolean) => void;

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
  intruderLocationEnabled: false,
  decoyVaultConfigured: false,
  hapticEnabled: true,
  deleteOriginalsAfterImport: false,
  stealthModeEnabled: false,
  appIcon: 'default',
  panicButtonEnabled: false,
  panicTriggerVolume: true,
  panicTriggerPower: false,
  panicAction: 'lock' as PanicAction,
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
  paywallPending: false,
  totalImportCount: 0,
  firstLaunchTimestamp: null,
  paywallDismissCount: 0,
  lastReviewPromptAt: null,
  reviewPromptCount: 0,
  appShareCount: 0,
  premiumLapsedAt: null,
  winBackShown: false,
  paywallUnlockThreshold: (Math.random() < 0.5 ? 3 : 5) as 3 | 5,
  quickUnlockEnabled: false,
  unlockMethod: 'pin' as UnlockMethod,
  showPatternPath: true,
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
        // Auto-disable location logging when intruder detection is turned off
        if (!enabled) {
          set({ intruderLocationEnabled: false });
        }
      },

      setIntruderLocationEnabled: (enabled) => {
        set({ intruderLocationEnabled: enabled });
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
      setPanicAction: (action) => {
        set({ panicAction: action });
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
        set((state) => {
          // Track when premium lapses for win-back offer logic
          const wasPremium = state.premiumStatus === 'premium' || state.premiumStatus === 'trial';
          const isLapsing = wasPremium && status === 'free';
          return {
            premiumStatus: status,
            ...(isLapsing ? { premiumLapsedAt: Date.now() } : {}),
            // Clear lapse timestamp when re-subscribing
            ...(status === 'premium' ? { premiumLapsedAt: null, winBackShown: false } : {}),
          };
        });
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

      setPaywallPending: (pending) => {
        set({ paywallPending: pending });
      },
      incrementImportCount: (count) => {
        set((state) => ({ totalImportCount: state.totalImportCount + count }));
      },
      recordFirstLaunchTimestamp: () => {
        set((state) => ({
          firstLaunchTimestamp: state.firstLaunchTimestamp ?? Date.now(),
        }));
      },
      incrementPaywallDismissCount: () => {
        set((state) => ({ paywallDismissCount: state.paywallDismissCount + 1 }));
      },
      recordReviewPrompt: () => {
        set((state) => ({
          lastReviewPromptAt: Date.now(),
          reviewPromptCount: state.reviewPromptCount + 1,
        }));
      },
      incrementAppShareCount: () => {
        set((state) => ({ appShareCount: state.appShareCount + 1 }));
      },
      recordPremiumLapsed: () => {
        set((state) => ({
          premiumLapsedAt: state.premiumLapsedAt ?? Date.now(),
        }));
      },
      markWinBackShown: () => {
        set({ winBackShown: true });
      },
      setQuickUnlockEnabled: (enabled) => {
        set({ quickUnlockEnabled: enabled });
      },
      setUnlockMethod: (method) => {
        set({ unlockMethod: method });
        // Sync to native AppLockModule so LockScreenActivity knows which UI to show
        try {
          const { NativeModules } = require('react-native');
          NativeModules.AppLockModule?.setAppLockCredentials(method, null);
        } catch {}
      },

      setShowPatternPath: (show) => {
        set({ showPatternPath: show });
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
        intruderLocationEnabled: state.intruderLocationEnabled,
        decoyVaultConfigured: state.decoyVaultConfigured,
        hapticEnabled: state.hapticEnabled,
        deleteOriginalsAfterImport: state.deleteOriginalsAfterImport,
        stealthModeEnabled: state.stealthModeEnabled,
        appIcon: state.appIcon,
        panicButtonEnabled: state.panicButtonEnabled,
        panicTriggerVolume: state.panicTriggerVolume,
        panicTriggerPower: state.panicTriggerPower,
        panicAction: state.panicAction,
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
        totalImportCount: state.totalImportCount,
        firstLaunchTimestamp: state.firstLaunchTimestamp,
        paywallDismissCount: state.paywallDismissCount,
        lastReviewPromptAt: state.lastReviewPromptAt,
        reviewPromptCount: state.reviewPromptCount,
        appShareCount: state.appShareCount,
        consentStatus: state.consentStatus,
        quickUnlockEnabled: state.quickUnlockEnabled,
        unlockMethod: state.unlockMethod,
        showPatternPath: state.showPatternPath,
      }),
    },
  ),
);
