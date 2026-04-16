/**
 * VaultCalc - Settings Screen
 *
 * Main settings hub with sections for Security, Appearance, and About.
 * Setting rows support navigation, inline pickers, and toggles.
 *
 * @see 02-UX-Design.md Section 9 (SET-01)
 * @see FEATURE_INDEX.md SETTINGS-001, SETTINGS-002, SETTINGS-003, SETTINGS-004
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VaultStackParamList } from '@typedefs/navigation';
import { useSettingsStore } from '@store/settingsStore';
import { useAuthStore } from '@store/authStore';
import { useActivityTracker, isPatternConfigured } from '@features/auth';
import { mediaItems } from '@services/storage/database';
import { checkBiometricAvailability, getBiometricStatusMessage, type BiometricStatus } from '@services/biometric';
import { signInToGoogle, signOutFromGoogle } from '@services/googleDrive';
import { uploadBackupToDrive, restoreBackupFromDrive, type BackupUploadProgress, type RestoreProgress } from '@services/backup';
import { BackupProgressOverlay } from '../components/BackupProgressOverlay';
import { RestoreProgressOverlay } from '../components/RestoreProgressOverlay';
import { useThemeColors, colors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { alert } from '@store/alertStore';
import { SUPPORTED_LANGUAGES } from '@shared/i18n';
import { IconButton } from '@shared/components/Icon';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsRow } from '../components/SettingsRow';
import { enableStealth, disableStealth } from '@services/security/stealth';
import { setAppIcon as nativeSetAppIcon, type AppIconAlias } from '@services/appicon';
import { showRewardedAd, grantAdFreeMode } from '@services/ads';
import { useTranslation } from '@shared/i18n';

/** Format bytes to human-readable string */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}


interface StorageStats {
  totalSize: number;
  photoCount: number;
  videoCount: number;
  docCount: number;
}

/** Lock timeout options for cycling */
const LOCK_TIMEOUTS = [30000, 60000, 120000, 300000] as const;

/** Display labels for lock timeout values — keyed by settings.auto_lock_* i18n keys */
const TIMEOUT_KEYS: Record<number, string> = {
  30000: 'settings.auto_lock_30s',
  60000: 'settings.auto_lock_1m',
  120000: 'settings.auto_lock_2m',
  300000: 'settings.auto_lock_5m',
};

/** Theme mode options for cycling */
const THEME_MODES = ['system', 'light', 'dark'] as const;

/** Display labels for theme modes — keyed by settings.theme_* i18n keys */
const THEME_KEYS: Record<string, string> = {
  system: 'settings.theme_system',
  light: 'settings.theme_light',
  dark: 'settings.theme_dark',
};

/**
 * Settings Screen Component
 *
 * Sections:
 * - SECURITY: Change PIN, Auto-lock timeout, Lock on background
 * - APPEARANCE: Theme, Haptic feedback
 * - ABOUT: App version
 */
export function SettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const isDark = themeColors === colors.dark;
  const styles = useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);
  const navigation = useNavigation<NativeStackNavigationProp<VaultStackParamList>>();
  const { onActivity } = useActivityTracker();

  const {
    lockTimeout,
    setLockTimeout,
    lockOnBackground,
    setLockOnBackground,
    biometricEnabled,
    setBiometricEnabled,
    decoyVaultConfigured,
    themeMode,
    setThemeMode,
    hapticEnabled,
    setHapticEnabled,
    deleteOriginalsAfterImport,
    setDeleteOriginalsAfterImport,
    panicButtonEnabled,
    setPanicButtonEnabled,
    panicTriggerVolume,
    setPanicTriggerVolume,
    panicTriggerPower,
    setPanicTriggerPower,
    panicAction,
    setPanicAction,
    quickUnlockEnabled,
    setQuickUnlockEnabled,
    intruderDetectionEnabled,
    setIntruderDetectionEnabled,
    intruderLocationEnabled,
    setIntruderLocationEnabled,
    stealthModeEnabled,
    setStealthModeEnabled,
    appIcon,
    setAppIcon,
    googleDriveEmail,
    setGoogleDriveConnection,
    lastBackupAt,
    setLastBackupAt,
    autoBackupEnabled,
    setAutoBackupEnabled,
    lastBackupItemCount,
    setLastBackupItemCount,
    unlockMethod,
    showPatternPath,
    setShowPatternPath,
  } = useSettingsStore();

  const isDecoyMode = useAuthStore(s => s.isDecoyMode);

  // Google Drive connection state (CLOUD-001)
  const [isConnecting, setIsConnecting] = useState(false);

  // Backup upload state (CLOUD-003)
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState<BackupUploadProgress | null>(null);

  // Backup restore state (CLOUD-004)
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgress | null>(null);

  // Storage usage stats (SETTINGS-005)
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      const [totalSize, photoCount, videoCount, docCount] = await Promise.all([
        mediaItems.getTotalSize(isDecoyMode),
        mediaItems.getCount('photo', isDecoyMode),
        mediaItems.getCount('video', isDecoyMode),
        mediaItems.getCount('document', isDecoyMode),
      ]);
      if (!cancelled) {
        setStorageStats({ totalSize, photoCount, videoCount, docCount });
      }
    }
    loadStats();
    return () => { cancelled = true; };
  }, [isDecoyMode]);

  // Backup status (CLOUD-006)
  const currentItemCount = storageStats
    ? storageStats.photoCount + storageStats.videoCount + storageStats.docCount
    : 0;

  const { backupStatusLabel, backupStatusColor } = useMemo(() => {
    if (lastBackupAt === null) {
      return { backupStatusLabel: t('settings.backup_never'), backupStatusColor: themeColors.textTertiary };
    }
    const diff = currentItemCount - (lastBackupItemCount ?? 0);
    if (diff > 0) {
      return { backupStatusLabel: t('settings.backup_new_items', { count: diff }), backupStatusColor: themeColors.warning };
    }
    return { backupStatusLabel: t('settings.backup_up_to_date'), backupStatusColor: themeColors.success };
  }, [lastBackupAt, currentItemCount, lastBackupItemCount, themeColors]);

  // Biometric availability (BIO-002)
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus>('unknown');

  useEffect(() => {
    let cancelled = false;
    async function checkBio() {
      const result = await checkBiometricAvailability();
      if (!cancelled) {
        setBiometricStatus(result.status);
        // Auto-disable if hardware/enrollment changed since last check
        if (!result.available && biometricEnabled) {
          setBiometricEnabled(false);
        }
      }
    }
    checkBio();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleBiometric = useCallback((value: boolean) => {
    onActivity();
    if (value) {
      // Enabling — verify availability first
      if (biometricStatus === 'available') {
        setBiometricEnabled(true);
      } else {
        alert(t('settings.biometric_unavailable'), getBiometricStatusMessage(biometricStatus));
      }
    } else {
      setBiometricEnabled(false);
    }
  }, [onActivity, biometricStatus, setBiometricEnabled]);

  const handleBack = useCallback(() => {
    onActivity();
    navigation.goBack();
  }, [onActivity, navigation]);

  const handleChangePin = useCallback(() => {
    onActivity();
    navigation.navigate('ChangePin');
  }, [onActivity, navigation]);

  const handleCycleTimeout = useCallback(() => {
    onActivity();
    const currentIndex = LOCK_TIMEOUTS.indexOf(lockTimeout as typeof LOCK_TIMEOUTS[number]);
    const nextIndex = (currentIndex + 1) % LOCK_TIMEOUTS.length;
    setLockTimeout(LOCK_TIMEOUTS[nextIndex]);
  }, [onActivity, lockTimeout, setLockTimeout]);

  const handleToggleLockOnBackground = useCallback((value: boolean) => {
    onActivity();
    setLockOnBackground(value);
  }, [onActivity, setLockOnBackground]);

  const handleCycleTheme = useCallback(() => {
    onActivity();
    const currentIndex = THEME_MODES.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % THEME_MODES.length;
    setThemeMode(THEME_MODES[nextIndex]);
  }, [onActivity, themeMode, setThemeMode]);

  const handleToggleHaptic = useCallback((value: boolean) => {
    onActivity();
    setHapticEnabled(value);
  }, [onActivity, setHapticEnabled]);

  const handleToggleDeleteOriginals = useCallback((value: boolean) => {
    onActivity();
    setDeleteOriginalsAfterImport(value);
  }, [onActivity, setDeleteOriginalsAfterImport]);

  const handleDecoySetup = useCallback(() => {
    onActivity();
    navigation.navigate('DecoyPinSetup');
  }, [onActivity, navigation]);

  const handleSubscription = useCallback(() => {
    onActivity();
    navigation.navigate('Subscription');
  }, [onActivity, navigation]);

  const handleAbout = useCallback(() => {
    onActivity();
    navigation.navigate('About');
  }, [onActivity, navigation]);

  const handlePrivacyPolicy = useCallback(() => {
    onActivity();
    navigation.navigate('PrivacyPolicy');
  }, [onActivity, navigation]);

  const handleLanguage = useCallback(() => {
    onActivity();
    navigation.navigate('Language');
  }, [onActivity, navigation]);

  // Human-readable label for the current language (shown as subtitle on the row)
  const language = useSettingsStore(s => s.language);
  const currentLanguageLabel = useMemo(() => {
    const entry = SUPPORTED_LANGUAGES.find(l => l.code === language);
    return entry?.nativeName ?? 'System default';
  }, [language]);

  const handleShareApp = useCallback(async () => {
    onActivity();
    try {
      const { shareApp: doShare } = await import('@services/share');
      await doShare();
      useSettingsStore.getState().incrementAppShareCount();
      const { checkAndGrantShareMilestones } = await import('@services/referral');
      const { trackEvent } = await import('@services/analytics');
      trackEvent('referral_sent', {});
      const granted = checkAndGrantShareMilestones();
      if (granted) {
        const { alert } = await import('@store/alertStore');
        alert(t('about.reward_title'), t('about.reward_body', { label: granted.label }));
      }
    } catch {
      // Share cancelled or failed — silent
    }
  }, [onActivity]);

  // Rewarded ad: watch video for 24hr ad-free
  const adFreeUntil = useSettingsStore(s => s.adFreeUntil);
  const premiumStatus = useSettingsStore(s => s.premiumStatus);
  const [isWatchingAd, setIsWatchingAd] = useState(false);

  const isCurrentlyAdFree = premiumStatus === 'premium' || premiumStatus === 'trial' ||
    (adFreeUntil !== null && Date.now() < adFreeUntil);

  const adFreeRemainingHours = adFreeUntil !== null && Date.now() < adFreeUntil
    ? Math.ceil((adFreeUntil - Date.now()) / (60 * 60 * 1000))
    : 0;

  const handleWatchAd = useCallback(async () => {
    onActivity();
    if (isWatchingAd) return;

    alert(
      t('settings.rewarded_confirm_title'),
      t('settings.rewarded_confirm_body'),
      [
        { text: t('common.not_now'), style: 'cancel' },
        {
          text: t('settings.rewarded_confirm_button'),
          onPress: async () => {
            setIsWatchingAd(true);
            try {
              const result = await showRewardedAd();
              if (result.success && result.data?.rewarded) {
                await grantAdFreeMode();
                alert(t('settings.rewarded_success_title'), t('settings.rewarded_success_body'));
              } else if (!result.success) {
                alert(t('settings.rewarded_no_video_title'), result.error || t('settings.rewarded_no_video_body'));
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : t('common.unknown');
              alert(t('settings.rewarded_error_title'), t('settings.rewarded_error_body', { error: msg }));
            } finally {
              setIsWatchingAd(false);
            }
          },
        },
      ],
    );
  }, [onActivity, isWatchingAd]);

  const handleTogglePanicButton = useCallback((value: boolean) => {
    onActivity();
    setPanicButtonEnabled(value);
  }, [onActivity, setPanicButtonEnabled]);

  const handleTogglePanicVolume = useCallback((value: boolean) => {
    onActivity();
    setPanicTriggerVolume(value);
  }, [onActivity, setPanicTriggerVolume]);

  const handleTogglePanicPower = useCallback((value: boolean) => {
    onActivity();
    setPanicTriggerPower(value);
  }, [onActivity, setPanicTriggerPower]);

  const handleToggleIntruderDetection = useCallback(async (value: boolean) => {
    onActivity();
    if (!value) {
      // Turning off — no confirmation needed
      setIntruderDetectionEnabled(false);
      return;
    }

    // Step 1: Show explanation dialog BEFORE requesting any permissions
    alert(
      t('settings.intruder_detection_consent_title'),
      t('settings.intruder_detection_consent_body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.continue'),
          onPress: async () => {
            // Step 2: Request ONLY camera permission (location is a separate toggle)
            try {
              const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.CAMERA,
              );
              const camGranted = granted === PermissionsAndroid.RESULTS.GRANTED;

              // Step 3: Only enable if camera permission is granted
              if (!camGranted) {
                alert(
                  t('settings.intruder_camera_required_title'),
                  t('settings.intruder_camera_required_body'),
                );
                return;
              }

              // Camera granted — enable the feature
              setIntruderDetectionEnabled(true);
            } catch {
              alert(
                t('settings.permission_error'),
                t('settings.intruder_camera_error'),
              );
            }
          },
        },
      ],
    );
  }, [onActivity, setIntruderDetectionEnabled]);

  const handleToggleIntruderLocation = useCallback(async (value: boolean) => {
    onActivity();
    if (!value) {
      setIntruderLocationEnabled(false);
      return;
    }

    // Show explanation dialog before requesting location permission
    alert(
      t('settings.intruder_location_consent_title'),
      t('settings.intruder_location_consent_body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.continue'),
          onPress: async () => {
            try {
              const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
              );
              if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                setIntruderLocationEnabled(true);
              } else {
                alert(
                  t('settings.intruder_location_required_title'),
                  t('settings.intruder_location_required_body'),
                );
              }
            } catch {
              alert(
                t('settings.permission_error'),
                t('settings.intruder_location_error'),
              );
            }
          },
        },
      ],
    );
  }, [onActivity, setIntruderLocationEnabled]);

  const handleToggleStealth = useCallback(async (value: boolean) => {
    onActivity();
    if (value) {
      // Enabling stealth — show confirmation dialog first
      alert(
        t('settings.hide_confirm_title'),
        t('settings.hide_confirm_body'),
        [
          { text: t('common.not_now'), style: 'cancel' },
          {
            text: t('settings.hide_confirm_button'),
            onPress: async () => {
              const result = await enableStealth();
              if (result.success) {
                setStealthModeEnabled(true);
                alert(
                  t('settings.hide_success_title'),
                  t('settings.hide_success_body'),
                );
              } else {
                alert(t('settings.hide_error'), result.error ?? t('common.error_generic'));
              }
            },
          },
        ],
      );
    } else {
      const result = await disableStealth();
      if (result.success) {
        setStealthModeEnabled(false);
      } else {
        alert(t('settings.unhide_error'), result.error ?? t('common.error_generic'));
      }
    }
  }, [onActivity, setStealthModeEnabled]);

  const handleChangeAppIcon = useCallback(async (alias: AppIconAlias) => {
    onActivity();
    if (alias === appIcon) return;
    const result = await nativeSetAppIcon(alias);
    if (result.success) {
      setAppIcon(alias);
      alert(
        t('settings.app_icon_changed_title'),
        t('settings.app_icon_changed_body'),
      );
    } else {
      alert(t('settings.app_icon_change_error'), result.error ?? t('common.error_generic'));
    }
  }, [onActivity, appIcon, setAppIcon]);

  const handleIntruderLogs = useCallback(() => {
    onActivity();
    navigation.navigate('IntruderLogs');
  }, [onActivity, navigation]);

  const handleCycleUnlockMethod = useCallback(() => {
    onActivity();
    const { unlockMethod: current, setUnlockMethod } = useSettingsStore.getState();
    if (current === 'pin') {
      // Switch to pattern — if pattern not configured, navigate to setup
      if (isPatternConfigured()) {
        setUnlockMethod('pattern');
      } else {
        // Navigate to pattern setup which will set the method on completion
        navigation.navigate('PatternSetup');
      }
    } else {
      // Switch back to PIN (PIN is always configured since it's the initial auth)
      setUnlockMethod('pin');
    }
  }, [onActivity, navigation]);

  const handlePatternSetup = useCallback(() => {
    onActivity();
    navigation.navigate('PatternSetup');
  }, [onActivity, navigation]);

  const handleChangePattern = useCallback(() => {
    onActivity();
    navigation.navigate('ChangePattern');
  }, [onActivity, navigation]);

  const handleToggleShowPatternPath = useCallback((value: boolean) => {
    onActivity();
    setShowPatternPath(value);
  }, [onActivity, setShowPatternPath]);

  const handleGoogleDriveConnect = useCallback(async () => {
    if (isConnecting) return;
    onActivity();
    setIsConnecting(true);
    try {
      const result = await signInToGoogle();
      if (result.success && result.account) {
        setGoogleDriveConnection(result.account.email, result.account.displayName);
        alert(t('settings.backup_connected_title'), t('settings.backup_connected_body', { email: result.account.email }));
      } else if (result.errorCode !== 'SIGN_IN_CANCELLED') {
        alert(t('settings.backup_connect_error'), result.error ?? t('common.error_generic'));
      }
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, onActivity, setGoogleDriveConnection]);

  const handleGoogleDriveDisconnect = useCallback(() => {
    onActivity();
    alert(
      t('settings.backup_disconnect_title'),
      t('settings.backup_disconnect_body'),
      [
        { text: t('settings.backup_disconnect_keep'), style: 'cancel' },
        {
          text: t('settings.disconnect'),
          style: 'destructive',
          onPress: async () => {
            await signOutFromGoogle();
            setGoogleDriveConnection(null, null);
            alert(t('settings.backup_disconnected_title'), t('settings.backup_disconnected_body'));
          },
        },
      ],
    );
  }, [onActivity, setGoogleDriveConnection]);

  const handleBackupNow = useCallback(async () => {
    if (isBackingUp) return;
    onActivity();

    // Gate cloud backup behind premium for free users
    if (premiumStatus === 'free') {
      alert(
        t('settings.backup_premium_title'),
        t('settings.backup_premium_body'),
        [
          { text: t('common.not_now'), style: 'cancel', onPress: () => useSettingsStore.getState().incrementPaywallDismissCount() },
          { text: t('common.upgrade'), onPress: () => navigation.navigate('Subscription') },
        ],
      );
      return;
    }

    setIsBackingUp(true);
    setBackupProgress(null);

    const result = await uploadBackupToDrive({
      onProgress: setBackupProgress,
    });

    setIsBackingUp(false);
    setBackupProgress(null);

    if (result.success) {
      setLastBackupAt(Date.now());
      setLastBackupItemCount(currentItemCount);
      alert(t('settings.backup_success_title'), t('settings.backup_success', { count: result.uploadedCount }));
    } else if (result.failures && result.failures.length > 0) {
      setLastBackupAt(Date.now());
      setLastBackupItemCount(currentItemCount);
      alert(
        t('settings.backup_partial_title'),
        t('settings.backup_partial_body', { uploaded: result.uploadedCount, total: result.totalCount, failed: result.failures.length }),
      );
    } else {
      alert(t('settings.backup_failed_title'), result.error ?? t('common.error_generic'));
    }
  }, [isBackingUp, onActivity, setLastBackupAt, setLastBackupItemCount, currentItemCount]);

  const handleRestoreFromDrive = useCallback(() => {
    if (isRestoring) return;
    onActivity();
    alert(
      t('settings.restore_confirm_title'),
      t('settings.restore_confirm_body'),
      [
        { text: t('common.not_now'), style: 'cancel' },
        {
          text: t('settings.restore_from_backup'),
          onPress: async () => {
            setIsRestoring(true);
            setRestoreProgress(null);

            const result = await restoreBackupFromDrive({
              onProgress: setRestoreProgress,
            });

            setIsRestoring(false);
            setRestoreProgress(null);

            if (result.success) {
              alert(
                t('settings.restore_success_title'),
                t('settings.restore_success_body', { count: result.restoredCount }) + (result.skippedCount ? t('settings.restore_skipped', { count: result.skippedCount }) : ''),
              );
            } else if (result.failures && result.failures.length > 0) {
              alert(
                t('settings.restore_partial_title'),
                t('settings.restore_partial_body', { restored: result.restoredCount, total: result.totalCount, failed: result.failures.length }) + (result.skippedCount ? t('settings.restore_partial_skipped', { count: result.skippedCount }) : ''),
              );
            } else {
              alert(t('settings.restore_error'), result.error ?? t('common.error_generic'));
            }
          },
        },
      ],
    );
  }, [isRestoring, onActivity]);

  const handleToggleAutoBackup = useCallback((value: boolean) => {
    onActivity();
    if (value && premiumStatus === 'free') {
      alert(
        t('settings.auto_backup_premium_title'),
        t('settings.auto_backup_premium_body'),
        [
          { text: t('common.not_now'), style: 'cancel' },
          { text: t('common.upgrade'), onPress: () => navigation.navigate('Subscription') },
        ],
      );
      return;
    }
    setAutoBackupEnabled(value);
  }, [onActivity, premiumStatus, navigation, setAutoBackupEnabled]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          name="arrow-left"
          onPress={handleBack}
          color={themeColors.textPrimary}
          accessibilityLabel="Go back"
          containerStyle={styles.backButton}
        />
        <Text style={styles.title}>{t('settings.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── SECURITY ── */}
        <SettingsSection title={t('settings.section_security')} description={t('settings.section_security_desc')}>
          {!isDecoyMode && (
            <SettingsRow type="navigation" icon="key" title={t('settings.change_pin')} onPress={handleChangePin} />
          )}
          {!isDecoyMode && (
            <SettingsRow type="value" icon="lock" title={t('settings.unlock_method')} value={unlockMethod === 'pattern' ? t('settings.pattern') : t('settings.pin')} onPress={handleCycleUnlockMethod} />
          )}
          {!isDecoyMode && unlockMethod === 'pattern' && isPatternConfigured() && (
            <>
              <SettingsRow type="navigation" icon="grid" title={t('settings.change_pattern')} onPress={handleChangePattern} />
              <SettingsRow type="toggle" icon="scan" title={t('settings.show_pattern_path')} value={showPatternPath} onValueChange={handleToggleShowPatternPath} />
            </>
          )}
          {!isDecoyMode && unlockMethod === 'pattern' && !isPatternConfigured() && (
            <SettingsRow type="navigation" icon="grid" title={t('settings.setup_pattern')} onPress={handlePatternSetup} value={t('settings.not_set')} />
          )}
          {!isDecoyMode && unlockMethod !== 'pattern' && (
            <SettingsRow type="navigation" icon="grid" title={t('settings.setup_pattern_desc')} onPress={handlePatternSetup} />
          )}
          <SettingsRow type="value" icon="clock" title={t('settings.auto_lock')} value={t(TIMEOUT_KEYS[lockTimeout])} onPress={handleCycleTimeout} />
          <SettingsRow type="toggle" icon="lock" title={t('settings.lock_on_background')} subtitle={t('settings.lock_on_background_desc')} value={lockOnBackground} onValueChange={handleToggleLockOnBackground} />
          {!isDecoyMode && (
            <SettingsRow type="toggle" icon="fingerprint" title={t('settings.biometric_unlock')} subtitle={biometricStatus !== 'available' && biometricStatus !== 'unknown' ? getBiometricStatusMessage(biometricStatus) : t('settings.biometric_unlock_desc')} value={biometricEnabled} onValueChange={handleToggleBiometric} highlighted />
          )}
          {!isDecoyMode && (
            <SettingsRow type="toggle" icon="key" title={t('settings.quick_unlock')} subtitle={t('settings.quick_unlock_desc')} value={quickUnlockEnabled} onValueChange={setQuickUnlockEnabled} showDivider={false} />
          )}
        </SettingsSection>

        {/* ── PRIVACY ── */}
        {!isDecoyMode && (
          <SettingsSection title={t('settings.section_privacy')} description={t('settings.section_privacy_desc')}>
            <SettingsRow type="toggle" icon="shield" title={t('settings.panic_mode')} subtitle={t('settings.panic_mode_desc')} value={panicButtonEnabled} onValueChange={handleTogglePanicButton} highlighted />
            {panicButtonEnabled && (
              <>
                <SettingsRow type="toggle" icon="shield" title={t('settings.panic_shake')} value={true} onValueChange={() => {}} subtitle={t('settings.panic_shake_always')} />
                <SettingsRow type="toggle" icon="shield" title={t('settings.panic_triple_volume')} value={panicTriggerVolume} onValueChange={handleTogglePanicVolume} />
                <SettingsRow type="toggle" icon="shield" title={t('settings.panic_triple_power')} value={panicTriggerPower} onValueChange={handleTogglePanicPower} />
                <SettingsRow type="toggle" icon="alert-triangle" title={t('settings.decoy_exit_screen')} subtitle={t('settings.decoy_exit_screen_desc')} value={panicAction === 'fakeCrash'} onValueChange={(v) => setPanicAction(v ? 'fakeCrash' : 'lock')} />
              </>
            )}
            <SettingsRow type="toggle" icon="scan" title={t('settings.intruder_detection')} subtitle={t('settings.intruder_detection_desc')} value={intruderDetectionEnabled} onValueChange={handleToggleIntruderDetection} highlighted />
            {intruderDetectionEnabled && (
              <>
                <SettingsRow type="toggle" icon="map-pin" title={t('settings.intruder_location')} subtitle={t('settings.intruder_location_desc')} value={intruderLocationEnabled} onValueChange={handleToggleIntruderLocation} />
                <SettingsRow type="navigation" icon="scan" title={t('settings.intruder_log')} subtitle={t('settings.intruder_log_desc')} onPress={handleIntruderLogs} />
              </>
            )}
            <SettingsRow type="navigation" icon="lock" title={t('settings.app_lock')} subtitle={t('settings.app_lock_desc')} onPress={() => navigation.navigate('AppLock')} />
            <SettingsRow type="navigation" icon="lock" title={t('settings.notification_privacy')} subtitle={t('settings.notification_privacy_desc')} onPress={() => navigation.navigate('NotificationPrivacy')} />
            <SettingsRow type="navigation" icon="shield" title={t('settings.uninstall_protection')} subtitle={t('settings.uninstall_protection_desc')} onPress={() => navigation.navigate('UninstallProtection')} />
            <SettingsRow type="navigation" icon="key" title={t('settings.decoy_vault')} subtitle={t('settings.decoy_vault_desc')} onPress={handleDecoySetup} value={decoyVaultConfigured ? t('settings.decoy_configured') : t('settings.not_set')} />
            <SettingsRow type="toggle" icon="scan" title={t('settings.hide_app_icon')} subtitle={stealthModeEnabled ? t('settings.hide_app_icon_active_desc') : t('settings.hide_app_icon_desc')} value={stealthModeEnabled} onValueChange={handleToggleStealth} showDivider={false} />
          </SettingsSection>
        )}

        {/* ── APP APPEARANCE — hidden in decoy mode and stealth mode ── */}
        {!isDecoyMode && !stealthModeEnabled && (
          <SettingsSection title={t('settings.section_app_appearance')} description={t('settings.section_app_appearance_desc')}>
            {(['default', 'calculator', 'weather', 'notes'] as const).map((alias, idx, arr) => {
              const labels: Record<AppIconAlias, string> = {
                default: t('settings.app_icon_default'),
                calculator: t('settings.app_icon_calculator'),
                weather: t('settings.app_icon_weather'),
                notes: t('settings.app_icon_notes'),
              };
              const icons: Record<AppIconAlias, 'calculator' | 'image' | 'pencil' | 'settings'> = {
                default: 'settings',
                calculator: 'calculator',
                weather: 'image',
                notes: 'pencil',
              };
              return (
                <SettingsRow
                  key={alias}
                  type="value"
                  icon={icons[alias]}
                  title={labels[alias]}
                  value={appIcon === alias ? t('settings.app_icon_selected') : ''}
                  valueColor={themeColors.accent}
                  onPress={() => handleChangeAppIcon(alias)}
                  showDivider={idx < arr.length - 1}
                />
              );
            })}
          </SettingsSection>
        )}

        {/* ── CLOUD BACKUP — hidden in decoy mode ── */}
        {!isDecoyMode && (
          <SettingsSection title={t('settings.section_cloud_backup')} description={t('settings.section_cloud_backup_desc')}>
            {googleDriveEmail ? (
              <>
                <SettingsRow type="value" icon="folder" title={t('settings.google_drive')} value={t('settings.google_drive_connected')} valueColor={themeColors.success} />
                <SettingsRow type="navigation" icon="folder" title={isBackingUp ? t('settings.backing_up') : t('settings.backup_now')} onPress={handleBackupNow} />
                <SettingsRow type="value" icon="clock" title={t('settings.backup_status')} value={backupStatusLabel} valueColor={backupStatusColor} />
                <SettingsRow type="toggle" icon="folder" title={t('settings.auto_backup')} subtitle={t('settings.auto_backup_desc')} value={autoBackupEnabled} onValueChange={handleToggleAutoBackup} />
                <SettingsRow type="navigation" icon="folder" title={isRestoring ? t('settings.restoring') : t('settings.restore_from_backup')} onPress={handleRestoreFromDrive} />
                <SettingsRow type="navigation" icon="trash" title={t('settings.disconnect')} onPress={handleGoogleDriveDisconnect} destructive showDivider={false} />
              </>
            ) : (
              <SettingsRow type="navigation" icon="folder" title={isConnecting ? t('settings.connecting') : t('settings.connect_google_drive')} onPress={handleGoogleDriveConnect} showDivider={false} />
            )}
          </SettingsSection>
        )}

        {/* ── STORAGE ── */}
        <SettingsSection title={t('settings.section_storage')} description={t('settings.section_storage_desc')}>
          <SettingsRow type="toggle" icon="trash" title={t('settings.delete_originals')} subtitle={t('settings.delete_originals_desc')} value={deleteOriginalsAfterImport} onValueChange={handleToggleDeleteOriginals} />
          <SettingsRow type="value" icon="folder" title={t('settings.vault_size')} value={storageStats !== null ? formatBytes(storageStats.totalSize) : '...'} subtitle={storageStats !== null ? t('settings.vault_size_summary', { photos: storageStats.photoCount, videos: storageStats.videoCount, docs: storageStats.docCount }) : undefined} showDivider={false} />
        </SettingsSection>

        {/* ── APPEARANCE ── */}
        <SettingsSection title={t('settings.section_appearance')}>
          <SettingsRow type="value" icon="settings" title={t('settings.theme')} value={t(THEME_KEYS[themeMode])} onPress={handleCycleTheme} />
          <SettingsRow type="toggle" icon="settings" title={t('settings.haptic_feedback')} subtitle={t('settings.haptic_feedback_desc')} value={hapticEnabled} onValueChange={handleToggleHaptic} showDivider={false} />
        </SettingsSection>

        {/* ── ABOUT ── */}
        <SettingsSection title={t('settings.section_about')}>
          {!isDecoyMode && (
            <SettingsRow type="navigation" icon="star" title={t('settings.premium')} subtitle={t('settings.premium_desc')} onPress={handleSubscription} highlighted />
          )}
          {!isDecoyMode && premiumStatus === 'free' && !isCurrentlyAdFree && (
            <SettingsRow type="navigation" icon="play" title={t('settings.remove_ads_rewarded')} subtitle={t('settings.remove_ads_rewarded_desc')} onPress={handleWatchAd} />
          )}
          {!isDecoyMode && adFreeRemainingHours > 0 && premiumStatus === 'free' && (
            <SettingsRow type="value" icon="play" title={t('settings.ad_free_mode')} value={t('settings.ad_free_remaining', { hours: adFreeRemainingHours })} onPress={() => {}} />
          )}
          <SettingsRow type="navigation" icon="share" title={t('settings.share_app')} subtitle={t('settings.share_app_desc')} onPress={handleShareApp} />
          <SettingsRow type="navigation" icon="globe" title={t('settings.language')} subtitle={currentLanguageLabel} onPress={handleLanguage} />
          <SettingsRow type="navigation" icon="shield" title={t('settings.privacy_policy')} subtitle={t('settings.privacy_policy_desc')} onPress={handlePrivacyPolicy} />
          <SettingsRow type="navigation" icon="settings" title={t('settings.about')} onPress={handleAbout} showDivider={false} />
        </SettingsSection>
      </ScrollView>

      {isBackingUp && backupProgress && (
        <BackupProgressOverlay progress={backupProgress} />
      )}

      {isRestoring && restoreProgress && (
        <RestoreProgressOverlay progress={restoreProgress} />
      )}
    </SafeAreaView>
  );
}

const createStyles = (c: ColorTokens, _isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: layout.topBarHeight,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: c.textPrimary,
  },
  title: {
    ...typography.titleLarge,
    color: c.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
  },
});
