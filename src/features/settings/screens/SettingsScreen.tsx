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

/** Display labels for lock timeout values */
const TIMEOUT_LABELS: Record<number, string> = {
  30000: '30s',
  60000: '1m',
  120000: '2m',
  300000: '5m',
};

/** Theme mode options for cycling */
const THEME_MODES = ['system', 'light', 'dark'] as const;

/** Display labels for theme modes */
const THEME_LABELS: Record<string, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
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
      return { backupStatusLabel: 'Never backed up', backupStatusColor: themeColors.textTertiary };
    }
    const diff = currentItemCount - (lastBackupItemCount ?? 0);
    if (diff > 0) {
      return { backupStatusLabel: `${diff} new item${diff === 1 ? '' : 's'}`, backupStatusColor: themeColors.warning };
    }
    return { backupStatusLabel: 'Up to date', backupStatusColor: themeColors.success };
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
        alert('Biometric Unavailable', getBiometricStatusMessage(biometricStatus));
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
        alert('Reward unlocked!', `You earned ${granted.label} for sharing VaultCalc. Enjoy!`);
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
      'Go ad-free for 24 hours?',
      'Watch a short video and all ads disappear for a full day.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Watch video',
          onPress: async () => {
            setIsWatchingAd(true);
            try {
              const result = await showRewardedAd();
              if (result.success && result.data?.rewarded) {
                await grantAdFreeMode();
                alert('You\'re ad-free!', 'No ads for the next 24 hours. Enjoy the quiet.');
              } else if (!result.success) {
                alert('No video available', result.error || 'We couldn\'t load a video right now. Try again in a minute.');
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown error';
              alert('Couldn\'t play video', `${msg}. Please check your internet and try again.`);
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
      'Intruder Selfie Detection',
      'This feature uses your front camera to capture a photo when someone enters the wrong PIN.\n\nPhotos are encrypted and stored only on your device. You can review them in Intruder Logs.\n\nCamera permission is required to enable this feature.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
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
                  'Camera Permission Required',
                  'Intruder detection needs camera access to photograph unauthorized attempts. Please allow camera access in your device settings to use this feature.',
                );
                return;
              }

              // Camera granted — enable the feature
              setIntruderDetectionEnabled(true);
            } catch {
              alert(
                'Permission Error',
                'Could not request camera permission. Please try again.',
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
      'Record Intruder Location',
      'VaultCalc can store the approximate location of unauthorized access attempts.\n\nThis uses your last known location only — no continuous tracking or background access.\n\nLocation permission is required to enable this.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            try {
              const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
              );
              if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                setIntruderLocationEnabled(true);
              } else {
                alert(
                  'Location Permission Required',
                  'To record intruder location, allow location access in your device settings.',
                );
              }
            } catch {
              alert(
                'Permission Error',
                'Could not request location permission. Please try again.',
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
        'Go invisible?',
        'The app icon will vanish from your home screen.\n\nTo reopen, tap the "Calculator" notification in your notification shade.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Hide it',
            onPress: async () => {
              const result = await enableStealth();
              if (result.success) {
                setStealthModeEnabled(true);
                alert(
                  'You\'re invisible',
                  'The app icon is hidden.\n\nTo reopen:\nTap the "Calculator" notification in your notification shade.',
                );
              } else {
                alert('Couldn\'t hide', result.error ?? 'Something went wrong. Please try again.');
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
        alert('Couldn\'t restore', result.error ?? 'Something went wrong. Please try again.');
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
        'New look applied',
        'Head to your home screen to see the change.',
      );
    } else {
      alert('Couldn\'t change icon', result.error ?? 'Something went wrong. Please try again.');
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
        alert('You\'re connected', `Signed in as ${result.account.email}`);
      } else if (result.errorCode !== 'SIGN_IN_CANCELLED') {
        alert('Couldn\'t connect', result.error ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, onActivity, setGoogleDriveConnection]);

  const handleGoogleDriveDisconnect = useCallback(() => {
    onActivity();
    alert(
      'Disconnect Google Drive?',
      'Your backup connection will be removed. You can always reconnect later.',
      [
        { text: 'Keep connected', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await signOutFromGoogle();
            setGoogleDriveConnection(null, null);
            alert('Disconnected', 'Google Drive is no longer linked.');
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
        'Cloud backup is a Premium feature',
        'Keep your encrypted files safe with automatic Google Drive backup. Upgrade to unlock.',
        [
          { text: 'Not now', style: 'cancel', onPress: () => useSettingsStore.getState().incrementPaywallDismissCount() },
          { text: 'Upgrade', onPress: () => navigation.navigate('Subscription') },
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
      alert('Backed up', `${result.uploadedCount} ${result.uploadedCount === 1 ? 'file' : 'files'} safely uploaded to Google Drive.`);
    } else if (result.failures && result.failures.length > 0) {
      setLastBackupAt(Date.now());
      setLastBackupItemCount(currentItemCount);
      alert(
        'Almost done',
        `${result.uploadedCount} of ${result.totalCount} files uploaded. ${result.failures.length} couldn't be backed up.`,
      );
    } else {
      alert('Backup didn\'t work', result.error ?? 'Something went wrong. Please try again.');
    }
  }, [isBackingUp, onActivity, setLastBackupAt, setLastBackupItemCount, currentItemCount]);

  const handleRestoreFromDrive = useCallback(() => {
    if (isRestoring) return;
    onActivity();
    alert(
      'Restore your files?',
      'Your encrypted backup will be downloaded from Google Drive. Files you already have will be skipped.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Restore',
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
                'Welcome back',
                `${result.restoredCount} ${result.restoredCount === 1 ? 'file' : 'files'} restored.${result.skippedCount ? ` ${result.skippedCount} already in your vault.` : ''}`,
              );
            } else if (result.failures && result.failures.length > 0) {
              alert(
                'Almost done',
                `${result.restoredCount} of ${result.totalCount} files restored. ${result.failures.length} couldn't be downloaded.${result.skippedCount ? ` ${result.skippedCount} skipped.` : ''}`,
              );
            } else {
              alert('Couldn\'t restore', result.error ?? 'Something went wrong. Please try again.');
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
        'Auto-backup is a Premium feature',
        'Never worry about losing files again. Upgrade to enable automatic cloud backup.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => navigation.navigate('Subscription') },
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
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── SECURITY ── */}
        <SettingsSection title="Security" description="Protect your vault">
          {!isDecoyMode && (
            <SettingsRow type="navigation" icon="key" title="Change PIN" onPress={handleChangePin} />
          )}
          {!isDecoyMode && (
            <SettingsRow type="value" icon="lock" title="Unlock method" value={unlockMethod === 'pattern' ? 'Pattern' : 'PIN'} onPress={handleCycleUnlockMethod} />
          )}
          {!isDecoyMode && unlockMethod === 'pattern' && isPatternConfigured() && (
            <>
              <SettingsRow type="navigation" icon="grid" title="Change pattern" onPress={handleChangePattern} />
              <SettingsRow type="toggle" icon="scan" title="Show pattern path" value={showPatternPath} onValueChange={handleToggleShowPatternPath} />
            </>
          )}
          {!isDecoyMode && unlockMethod === 'pattern' && !isPatternConfigured() && (
            <SettingsRow type="navigation" icon="grid" title="Set up pattern" onPress={handlePatternSetup} value="Not set" />
          )}
          {!isDecoyMode && unlockMethod !== 'pattern' && (
            <SettingsRow type="navigation" icon="grid" title="Set up pattern lock" onPress={handlePatternSetup} />
          )}
          <SettingsRow type="value" icon="clock" title="Auto-lock after" value={TIMEOUT_LABELS[lockTimeout]} onPress={handleCycleTimeout} />
          <SettingsRow type="toggle" icon="lock" title="Lock on background" subtitle="Automatically lock when you leave the app" value={lockOnBackground} onValueChange={handleToggleLockOnBackground} />
          {!isDecoyMode && (
            <SettingsRow type="toggle" icon="fingerprint" title="Biometric unlock" subtitle={biometricStatus !== 'available' && biometricStatus !== 'unknown' ? getBiometricStatusMessage(biometricStatus) : 'Use fingerprint or face to unlock'} value={biometricEnabled} onValueChange={handleToggleBiometric} highlighted />
          )}
          {!isDecoyMode && (
            <SettingsRow type="toggle" icon="key" title="Quick unlock" subtitle="Long-press = on calculator to open vault instantly" value={quickUnlockEnabled} onValueChange={setQuickUnlockEnabled} showDivider={false} />
          )}
        </SettingsSection>

        {/* ── PRIVACY ── */}
        {!isDecoyMode && (
          <SettingsSection title="Privacy" description="Advanced protection features">
            <SettingsRow type="toggle" icon="shield" title="Panic mode" subtitle="Shake or press buttons to instantly hide everything" value={panicButtonEnabled} onValueChange={handleTogglePanicButton} highlighted />
            {panicButtonEnabled && (
              <>
                <SettingsRow type="toggle" icon="shield" title="Shake device" value={true} onValueChange={() => {}} subtitle="Always enabled" />
                <SettingsRow type="toggle" icon="shield" title="Triple press volume" value={panicTriggerVolume} onValueChange={handleTogglePanicVolume} />
                <SettingsRow type="toggle" icon="shield" title="Triple press power" value={panicTriggerPower} onValueChange={handleTogglePanicPower} />
                <SettingsRow type="toggle" icon="alert-triangle" title="Decoy exit screen" subtitle="Show an error screen instead of locking" value={panicAction === 'fakeCrash'} onValueChange={(v) => setPanicAction(v ? 'fakeCrash' : 'lock')} />
              </>
            )}
            <SettingsRow type="toggle" icon="scan" title="Intruder selfie detection" subtitle="Capture a photo when someone enters the wrong PIN" value={intruderDetectionEnabled} onValueChange={handleToggleIntruderDetection} highlighted />
            {intruderDetectionEnabled && (
              <>
                <SettingsRow type="toggle" icon="map-pin" title="Record intruder location" subtitle="Store approximate location of unauthorized attempts (optional)" value={intruderLocationEnabled} onValueChange={handleToggleIntruderLocation} />
                <SettingsRow type="navigation" icon="scan" title="Intruder log" subtitle="See who tried to break in" onPress={handleIntruderLogs} />
              </>
            )}
            <SettingsRow type="navigation" icon="lock" title="App Lock" subtitle="Protect other apps behind your PIN" onPress={() => navigation.navigate('AppLock')} />
            <SettingsRow type="navigation" icon="lock" title="Notification Privacy" subtitle="Hide sensitive notification previews" onPress={() => navigation.navigate('NotificationPrivacy')} />
            <SettingsRow type="navigation" icon="shield" title="Uninstall Protection" subtitle="Stop anyone from deleting this app" onPress={() => navigation.navigate('UninstallProtection')} />
            <SettingsRow type="navigation" icon="key" title="Decoy vault" subtitle="A fake vault to show if someone forces you to unlock" onPress={handleDecoySetup} value={decoyVaultConfigured ? 'Configured' : 'Not set'} />
            <SettingsRow type="toggle" icon="scan" title="Hide app icon" subtitle={stealthModeEnabled ? 'App is hidden. Tap notification to open.' : 'Hide from launcher. Open via notification.'} value={stealthModeEnabled} onValueChange={handleToggleStealth} showDivider={false} />
          </SettingsSection>
        )}

        {/* ── APP APPEARANCE — hidden in decoy mode and stealth mode ── */}
        {!isDecoyMode && !stealthModeEnabled && (
          <SettingsSection title="App Appearance" description="Change how the app looks on your home screen">
            {(['default', 'calculator', 'weather', 'notes'] as const).map((alias, idx, arr) => {
              const labels: Record<AppIconAlias, string> = {
                default: 'Default (VaultCalc)',
                calculator: 'Calculator',
                weather: 'Weather',
                notes: 'Notes',
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
                  value={appIcon === alias ? 'Selected' : ''}
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
          <SettingsSection title="Cloud Backup" description="Keep your vault safe in the cloud">
            {googleDriveEmail ? (
              <>
                <SettingsRow type="value" icon="folder" title="Google Drive" value="Connected" valueColor={themeColors.success} />
                <SettingsRow type="navigation" icon="folder" title={isBackingUp ? 'Backing Up...' : 'Back Up Now'} onPress={handleBackupNow} />
                <SettingsRow type="value" icon="clock" title="Backup status" value={backupStatusLabel} valueColor={backupStatusColor} />
                <SettingsRow type="toggle" icon="folder" title="Auto-backup" subtitle="Back up automatically when files change" value={autoBackupEnabled} onValueChange={handleToggleAutoBackup} />
                <SettingsRow type="navigation" icon="folder" title={isRestoring ? 'Restoring...' : 'Restore from Backup'} onPress={handleRestoreFromDrive} />
                <SettingsRow type="navigation" icon="trash" title="Disconnect" onPress={handleGoogleDriveDisconnect} destructive showDivider={false} />
              </>
            ) : (
              <SettingsRow type="navigation" icon="folder" title={isConnecting ? 'Connecting...' : 'Connect Google Drive'} onPress={handleGoogleDriveConnect} showDivider={false} />
            )}
          </SettingsSection>
        )}

        {/* ── STORAGE ── */}
        <SettingsSection title="Storage" description="Manage vault files and space">
          <SettingsRow type="toggle" icon="trash" title="Delete originals after import" subtitle="Automatically remove source files so no trace is left" value={deleteOriginalsAfterImport} onValueChange={handleToggleDeleteOriginals} />
          <SettingsRow type="value" icon="folder" title="Vault size" value={storageStats !== null ? formatBytes(storageStats.totalSize) : '...'} subtitle={storageStats !== null ? `${storageStats.photoCount} photos, ${storageStats.videoCount} videos, ${storageStats.docCount} docs` : undefined} showDivider={false} />
        </SettingsSection>

        {/* ── APPEARANCE ── */}
        <SettingsSection title="Appearance">
          <SettingsRow type="value" icon="settings" title="Theme" value={THEME_LABELS[themeMode]} onPress={handleCycleTheme} />
          <SettingsRow type="toggle" icon="settings" title="Haptic feedback" subtitle="Feel a gentle tap when you press buttons" value={hapticEnabled} onValueChange={handleToggleHaptic} showDivider={false} />
        </SettingsSection>

        {/* ── ABOUT ── */}
        <SettingsSection title="About">
          {!isDecoyMode && (
            <SettingsRow type="navigation" icon="star" title="VaultCalc Premium" subtitle="Remove ads and unlock everything" onPress={handleSubscription} highlighted />
          )}
          {!isDecoyMode && premiumStatus === 'free' && !isCurrentlyAdFree && (
            <SettingsRow type="navigation" icon="play" title="Remove ads for 24 hours" subtitle="Watch a short video" onPress={handleWatchAd} />
          )}
          {!isDecoyMode && adFreeRemainingHours > 0 && premiumStatus === 'free' && (
            <SettingsRow type="value" icon="play" title="Ad-free mode" value={`${adFreeRemainingHours}h left`} onPress={() => {}} />
          )}
          <SettingsRow type="navigation" icon="share" title="Tell a friend" subtitle="Help others discover private file protection" onPress={handleShareApp} />
          <SettingsRow type="navigation" icon="globe" title="Language" subtitle={currentLanguageLabel} onPress={handleLanguage} />
          <SettingsRow type="navigation" icon="shield" title="Privacy Policy" subtitle="How your data is handled" onPress={handlePrivacyPolicy} />
          <SettingsRow type="navigation" icon="settings" title="About VaultCalc" onPress={handleAbout} showDivider={false} />
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
