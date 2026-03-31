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
import { IconButton } from '@shared/components/Icon';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsRow } from '../components/SettingsRow';
import { enableStealth, disableStealth } from '@services/security/stealth';
import { setAppIcon as nativeSetAppIcon, type AppIconAlias } from '@services/appicon';

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
    intruderDetectionEnabled,
    setIntruderDetectionEnabled,
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
    if (value) {
      // Request camera + location permissions for intruder intelligence
      try {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        const camGranted = results[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted';
        const locGranted = results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 'granted';
        if (!camGranted) {
          alert(
            'Camera Permission Needed',
            'Camera access is required to capture intruder photos. Please grant camera permission in app settings.',
          );
        }
        if (!locGranted) {
          alert(
            'Location Permission (Optional)',
            'Location access allows intruder reports to include the location. You can enable it later in app settings.',
          );
        }
      } catch {
        // Permission request failed — still enable the feature
      }
    }
    setIntruderDetectionEnabled(value);
  }, [onActivity, setIntruderDetectionEnabled]);

  const handleToggleStealth = useCallback(async (value: boolean) => {
    onActivity();
    if (value) {
      // Enabling stealth — show confirmation dialog first
      alert(
        'Enable Stealth Mode?',
        'The VaultCalc icon will be hidden from your launcher.\n\nTo reopen the app, tap the "Calculator" notification in your notification shade.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async () => {
              const result = await enableStealth();
              if (result.success) {
                setStealthModeEnabled(true);
                alert(
                  'Stealth Mode Enabled',
                  'VaultCalc icon is now hidden.\n\nTo reopen the app:\nTap the "Calculator" notification in your notification shade.',
                );
              } else {
                alert('Error', result.error ?? 'Failed to enable stealth mode.');
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
        alert('Error', result.error ?? 'Failed to disable stealth mode.');
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
        'App icon changed',
        'You may need to return to the home screen to see the change.',
      );
    } else {
      alert('Error', result.error ?? 'Failed to change app icon.');
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
        alert('Connected', `Signed in as ${result.account.email}`);
      } else if (result.errorCode !== 'SIGN_IN_CANCELLED') {
        alert('Sign-In Failed', result.error ?? 'An unknown error occurred.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, onActivity, setGoogleDriveConnection]);

  const handleGoogleDriveDisconnect = useCallback(() => {
    onActivity();
    alert(
      'Disconnect Google Drive',
      'This will remove your Google Drive connection. You can reconnect later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await signOutFromGoogle();
            setGoogleDriveConnection(null, null);
            alert('Disconnected', 'Google Drive has been disconnected.');
          },
        },
      ],
    );
  }, [onActivity, setGoogleDriveConnection]);

  const handleBackupNow = useCallback(async () => {
    if (isBackingUp) return;
    onActivity();
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
      alert('Backup Complete', `Uploaded ${result.uploadedCount} of ${result.totalCount} files.`);
    } else if (result.failures && result.failures.length > 0) {
      setLastBackupAt(Date.now());
      setLastBackupItemCount(currentItemCount);
      alert(
        'Backup Partially Complete',
        `Uploaded ${result.uploadedCount} of ${result.totalCount} files. ${result.failures.length} failed.`,
      );
    } else {
      alert('Backup Failed', result.error ?? 'An unknown error occurred.');
    }
  }, [isBackingUp, onActivity, setLastBackupAt, setLastBackupItemCount, currentItemCount]);

  const handleRestoreFromDrive = useCallback(() => {
    if (isRestoring) return;
    onActivity();
    alert(
      'Restore from Backup',
      'This will download and restore files from your Google Drive backup. Existing items will be skipped.',
      [
        { text: 'Cancel', style: 'cancel' },
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
                'Restore Complete',
                `Restored ${result.restoredCount} items.${result.skippedCount ? ` ${result.skippedCount} already existed.` : ''}`,
              );
            } else if (result.failures && result.failures.length > 0) {
              alert(
                'Restore Partially Complete',
                `Restored ${result.restoredCount} of ${result.totalCount} items. ${result.failures.length} failed.${result.skippedCount ? ` ${result.skippedCount} skipped.` : ''}`,
              );
            } else {
              alert('Restore Failed', result.error ?? 'An unknown error occurred.');
            }
          },
        },
      ],
    );
  }, [isRestoring, onActivity]);

  const handleToggleAutoBackup = useCallback((value: boolean) => {
    onActivity();
    setAutoBackupEnabled(value);
  }, [onActivity, setAutoBackupEnabled]);

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
          <SettingsRow type="toggle" icon="lock" title="Lock on background" subtitle="Lock vault when app goes to background" value={lockOnBackground} onValueChange={handleToggleLockOnBackground} />
          {!isDecoyMode && (
            <SettingsRow type="toggle" icon="fingerprint" title="Biometric unlock" subtitle={biometricStatus !== 'available' && biometricStatus !== 'unknown' ? getBiometricStatusMessage(biometricStatus) : 'Use fingerprint or face to unlock'} value={biometricEnabled} onValueChange={handleToggleBiometric} highlighted />
          )}
        </SettingsSection>

        {/* ── PRIVACY ── */}
        {!isDecoyMode && (
          <SettingsSection title="Privacy" description="Advanced protection features">
            <SettingsRow type="toggle" icon="shield" title="Panic mode" subtitle="Instantly hides vault when someone sees your phone" value={panicButtonEnabled} onValueChange={handleTogglePanicButton} highlighted />
            {panicButtonEnabled && (
              <>
                <SettingsRow type="toggle" icon="shield" title="Shake device" value={true} onValueChange={() => {}} disabled subtitle="Always enabled" />
                <SettingsRow type="toggle" icon="shield" title="Triple press volume" value={panicTriggerVolume} onValueChange={handleTogglePanicVolume} />
                <SettingsRow type="toggle" icon="shield" title="Triple press power" value={panicTriggerPower} onValueChange={handleTogglePanicPower} />
              </>
            )}
            <SettingsRow type="toggle" icon="scan" title="Intruder detection" subtitle="Capture photo on failed unlock" value={intruderDetectionEnabled} onValueChange={handleToggleIntruderDetection} highlighted />
            {intruderDetectionEnabled && (
              <SettingsRow type="navigation" icon="scan" title="Intruder log" subtitle="View captured reports" onPress={handleIntruderLogs} />
            )}
            <SettingsRow type="navigation" icon="lock" title="App Lock" subtitle="Lock other apps with PIN or pattern" onPress={() => navigation.navigate('AppLock')} />
            <SettingsRow type="navigation" icon="lock" title="Notification Privacy" subtitle="Mask notification content" onPress={() => navigation.navigate('NotificationPrivacy')} />
            <SettingsRow type="navigation" icon="shield" title="Uninstall Protection" subtitle="Prevent app removal" onPress={() => navigation.navigate('UninstallProtection')} />
            <SettingsRow type="navigation" icon="key" title="Decoy vault" subtitle="Secondary vault with separate PIN" onPress={handleDecoySetup} value={decoyVaultConfigured ? 'Configured' : 'Not set'} />
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
          <SettingsRow type="toggle" icon="trash" title="Delete originals after import" subtitle="Removes source files from gallery" value={deleteOriginalsAfterImport} onValueChange={handleToggleDeleteOriginals} />
          <SettingsRow type="value" icon="folder" title="Vault size" value={storageStats !== null ? formatBytes(storageStats.totalSize) : '...'} subtitle={storageStats !== null ? `${storageStats.photoCount} photos, ${storageStats.videoCount} videos, ${storageStats.docCount} docs` : undefined} showDivider={false} />
        </SettingsSection>

        {/* ── APPEARANCE ── */}
        <SettingsSection title="Appearance">
          <SettingsRow type="value" icon="settings" title="Theme" value={THEME_LABELS[themeMode]} onPress={handleCycleTheme} />
          <SettingsRow type="toggle" icon="settings" title="Haptic feedback" subtitle="Vibrate on button presses" value={hapticEnabled} onValueChange={handleToggleHaptic} showDivider={false} />
        </SettingsSection>

        {/* ── ABOUT ── */}
        <SettingsSection title="About">
          {!isDecoyMode && (
            <SettingsRow type="navigation" icon="star" title="VaultCalc Premium" subtitle="Unlock all features" onPress={handleSubscription} highlighted />
          )}
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
