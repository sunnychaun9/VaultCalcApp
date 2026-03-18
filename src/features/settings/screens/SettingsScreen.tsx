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
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VaultStackParamList } from '@typedefs/navigation';
import { useSettingsStore } from '@store/settingsStore';
import { useFeatureGate } from '@services/billing';
import { useAuthStore } from '@store/authStore';
import { useActivityTracker, isPatternConfigured } from '@features/auth';
import { mediaItems } from '@services/storage/database';
import { checkBiometricAvailability, getBiometricStatusMessage, type BiometricStatus } from '@services/biometric';
import { signInToGoogle, signOutFromGoogle } from '@services/googleDrive';
import { uploadBackupToDrive, restoreBackupFromDrive, type BackupUploadProgress, type RestoreProgress } from '@services/backup';
import { BackupProgressOverlay } from '../components/BackupProgressOverlay';
import { RestoreProgressOverlay } from '../components/RestoreProgressOverlay';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { alert } from '@store/alertStore';
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

/** Format a timestamp to relative time string */
function formatLastBackup(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
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
    googleDriveDisplayName,
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
  const { isPremium } = useFeatureGate('cloudBackup');

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
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SECURITY Section */}
        <Text style={styles.sectionHeader}>SECURITY</Text>
        <View style={styles.sectionCard}>
          {/* Change PIN — hidden in decoy mode (DECOY-005) */}
          {!isDecoyMode && (
            <>
              <Pressable
                onPress={handleChangePin}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel="Change PIN"
              >
                <Text style={styles.rowLabel}>Change PIN</Text>
                <Text style={styles.rowChevron}>→</Text>
              </Pressable>

              <View style={styles.rowDivider} />
            </>
          )}

          {/* Unlock method — hidden in decoy mode (AUTH-009) */}
          {!isDecoyMode && (
            <>
              <Pressable
                onPress={handleCycleUnlockMethod}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Unlock method: ${unlockMethod === 'pattern' ? 'Pattern' : 'PIN'}`}
              >
                <Text style={styles.rowLabel}>Unlock method</Text>
                <Text style={styles.rowValue}>
                  {unlockMethod === 'pattern' ? 'Pattern' : 'PIN'}
                </Text>
              </Pressable>

              <View style={styles.rowDivider} />

              {/* Pattern setup / change */}
              {unlockMethod === 'pattern' && isPatternConfigured() ? (
                <>
                  <Pressable
                    onPress={handleChangePattern}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Change pattern"
                  >
                    <Text style={styles.rowLabel}>Change pattern</Text>
                    <Text style={styles.rowChevron}>→</Text>
                  </Pressable>

                  <View style={styles.rowDivider} />

                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Show pattern path</Text>
                    <Switch
                      value={showPatternPath}
                      onValueChange={handleToggleShowPatternPath}
                      trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
                      thumbColor={themeColors.surface}
                    />
                  </View>

                  <View style={styles.rowDivider} />
                </>
              ) : unlockMethod !== 'pattern' ? (
                <>
                  <Pressable
                    onPress={handlePatternSetup}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Set up pattern lock"
                  >
                    <Text style={styles.rowLabel}>Set up pattern lock</Text>
                    <Text style={styles.rowChevron}>→</Text>
                  </Pressable>

                  <View style={styles.rowDivider} />
                </>
              ) : (
                <>
                  <Pressable
                    onPress={handlePatternSetup}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Set up pattern"
                  >
                    <Text style={styles.rowLabel}>Set up pattern</Text>
                    <Text style={[styles.rowValue, { color: themeColors.warning }]}>Not set</Text>
                  </Pressable>

                  <View style={styles.rowDivider} />
                </>
              )}
            </>
          )}

          {/* Auto-lock timeout */}
          <Pressable
            onPress={handleCycleTimeout}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Auto-lock after ${TIMEOUT_LABELS[lockTimeout]}`}
          >
            <Text style={styles.rowLabel}>Auto-lock after</Text>
            <Text style={styles.rowValue}>{TIMEOUT_LABELS[lockTimeout]}</Text>
          </Pressable>

          <View style={styles.rowDivider} />

          {/* Lock on background */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Lock on background</Text>
            <Switch
              value={lockOnBackground}
              onValueChange={handleToggleLockOnBackground}
              trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
              thumbColor={themeColors.surface}
            />
          </View>

          {/* Panic Mode — hidden in decoy mode (ENH-005) */}
          {!isDecoyMode && (
            <>
              <View style={styles.rowDivider} />

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Panic mode</Text>
                <Switch
                  value={panicButtonEnabled}
                  onValueChange={handleTogglePanicButton}
                  trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
                  thumbColor={themeColors.surface}
                />
              </View>

              <View style={styles.storageDetailRow}>
                <Text style={styles.storageDetailText}>
                  Instantly hides your vault if someone sees your phone.
                </Text>
              </View>

              {panicButtonEnabled && (
                <>
                  <View style={styles.rowDivider} />
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>  Shake device</Text>
                    <Switch
                      value={true}
                      disabled
                      trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
                      thumbColor={themeColors.surface}
                    />
                  </View>

                  <View style={styles.rowDivider} />
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>  Triple press volume down</Text>
                    <Switch
                      value={panicTriggerVolume}
                      onValueChange={handleTogglePanicVolume}
                      trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
                      thumbColor={themeColors.surface}
                    />
                  </View>

                  <View style={styles.rowDivider} />
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>  Triple press power button</Text>
                    <Switch
                      value={panicTriggerPower}
                      onValueChange={handleTogglePanicPower}
                      trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
                      thumbColor={themeColors.surface}
                    />
                  </View>
                </>
              )}
            </>
          )}

          {/* Biometric unlock — hidden in decoy mode (DECOY-005) */}
          {!isDecoyMode && (
            <>
              <View style={styles.rowDivider} />

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Biometric unlock</Text>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
                  thumbColor={themeColors.surface}
                />
              </View>
              {biometricStatus !== 'available' && biometricStatus !== 'unknown' && (
                <View style={styles.storageDetailRow}>
                  <Text style={styles.storageDetailText}>
                    {getBiometricStatusMessage(biometricStatus)}
                  </Text>
                </View>
              )}
            </>
          )}

          {/* App Lock — hidden in decoy mode */}
          {!isDecoyMode && (
            <>
              <View style={styles.rowDivider} />

              <Pressable
                onPress={() => navigation.navigate('AppLock')}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel="App Lock"
              >
                <Text style={styles.rowLabel}>App Lock</Text>
                <Text style={styles.rowChevron}>→</Text>
              </Pressable>
            </>
          )}

          {/* Notification Privacy — hidden in decoy mode */}
          {!isDecoyMode && (
            <>
              <View style={styles.rowDivider} />

              <Pressable
                onPress={() => navigation.navigate('NotificationPrivacy')}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel="Notification Privacy"
              >
                <Text style={styles.rowLabel}>Notification Privacy</Text>
                <Text style={styles.rowChevron}>→</Text>
              </Pressable>
            </>
          )}

          {/* Decoy vault — hidden in decoy mode (DECOY-005) */}
          {!isDecoyMode && (
            <>
              <View style={styles.rowDivider} />

              <Pressable
                onPress={handleDecoySetup}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel="Decoy vault"
              >
                <Text style={styles.rowLabel}>Decoy vault</Text>
                <Text style={styles.rowValue}>
                  {decoyVaultConfigured ? 'Configured' : 'Not set'}
                </Text>
              </Pressable>
            </>
          )}

          {/* Intruder detection — hidden in decoy mode (SEC-004) */}
          {!isDecoyMode && (
            <>
              <View style={styles.rowDivider} />

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Intruder detection</Text>
                <Switch
                  value={intruderDetectionEnabled}
                  onValueChange={handleToggleIntruderDetection}
                  trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
                  thumbColor={themeColors.surface}
                />
              </View>
            </>
          )}

          {/* Intruder log — hidden in decoy mode, only when detection enabled (SEC-003) */}
          {!isDecoyMode && intruderDetectionEnabled && (
            <>
              <View style={styles.rowDivider} />

              <Pressable
                onPress={handleIntruderLogs}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel="Intruder log"
              >
                <Text style={styles.rowLabel}>Intruder log</Text>
                <Text style={styles.rowChevron}>→</Text>
              </Pressable>
            </>
          )}

          {/* Stealth mode — hidden in decoy mode (STEALTH-001) */}
          {!isDecoyMode && (
            <>
              <View style={styles.rowDivider} />

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Hide app icon</Text>
                <Switch
                  value={stealthModeEnabled}
                  onValueChange={handleToggleStealth}
                  trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
                  thumbColor={themeColors.surface}
                />
              </View>

              <View style={styles.storageDetailRow}>
                <Text style={styles.storageDetailText}>
                  {stealthModeEnabled
                    ? 'App is hidden. Tap notification to open.'
                    : 'Hide from launcher. Open via notification.'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* APP APPEARANCE Section — hidden in decoy mode and stealth mode */}
        {!isDecoyMode && !stealthModeEnabled && (
          <>
            <Text style={styles.sectionHeader}>APP APPEARANCE</Text>
            <View style={styles.sectionCard}>
              {(['default', 'calculator', 'weather', 'notes'] as const).map((alias, idx) => {
                const labels: Record<AppIconAlias, string> = {
                  default: 'Default (VaultCalc)',
                  calculator: 'Calculator',
                  weather: 'Weather',
                  notes: 'Notes',
                };
                return (
                  <React.Fragment key={alias}>
                    {idx > 0 && <View style={styles.rowDivider} />}
                    <Pressable
                      onPress={() => handleChangeAppIcon(alias)}
                      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: appIcon === alias }}
                    >
                      <Text style={styles.rowLabel}>{labels[alias]}</Text>
                      {appIcon === alias && (
                        <Text style={[styles.rowValue, { color: themeColors.accent }]}>Selected</Text>
                      )}
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
          </>
        )}

        {/* CLOUD BACKUP Section — hidden in decoy mode (CLOUD-001, PREMIUM-004) */}
        {!isDecoyMode && (
          <>
            <Text style={styles.sectionHeader}>CLOUD BACKUP</Text>
            <View style={styles.sectionCard}>
              {isPremium ? (
                googleDriveEmail ? (
                  <>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Google Drive</Text>
                      <Text style={styles.rowValue}>Connected</Text>
                    </View>

                    <View style={styles.rowDivider} />

                    <View style={styles.storageDetailRow}>
                      <Text style={styles.storageDetailText}>
                        {googleDriveDisplayName ?? googleDriveEmail}
                      </Text>
                      <Text style={styles.storageDetailText}>
                        {googleDriveDisplayName ? googleDriveEmail : ''}
                      </Text>
                    </View>

                    <View style={styles.rowDivider} />

                    <Pressable
                      onPress={handleBackupNow}
                      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                      accessibilityRole="button"
                      accessibilityLabel="Back up now"
                    >
                      <Text style={styles.rowLabel}>
                        {isBackingUp ? 'Backing Up...' : 'Back Up Now'}
                      </Text>
                      <Text style={styles.rowChevron}>→</Text>
                    </Pressable>

                    <View style={styles.rowDivider} />

                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Backup status</Text>
                      <Text style={[styles.rowValue, { color: backupStatusColor }]}>
                        {backupStatusLabel}
                      </Text>
                    </View>

                    {lastBackupAt !== null && (
                      <>
                        <View style={styles.rowDivider} />

                        <View style={styles.storageDetailRow}>
                          <Text style={styles.storageDetailText}>
                            {lastBackupItemCount !== null ? `${lastBackupItemCount} items · ` : ''}{formatLastBackup(lastBackupAt)}
                          </Text>
                        </View>
                      </>
                    )}

                    <View style={styles.rowDivider} />

                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Auto-backup</Text>
                      <Switch
                        value={autoBackupEnabled}
                        onValueChange={handleToggleAutoBackup}
                        trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
                        thumbColor={themeColors.surface}
                      />
                    </View>

                    <View style={styles.rowDivider} />

                    <Pressable
                      onPress={handleRestoreFromDrive}
                      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                      accessibilityRole="button"
                      accessibilityLabel="Restore from backup"
                    >
                      <Text style={styles.rowLabel}>
                        {isRestoring ? 'Restoring...' : 'Restore from Backup'}
                      </Text>
                      <Text style={styles.rowChevron}>→</Text>
                    </Pressable>

                    <View style={styles.rowDivider} />

                    <Pressable
                      onPress={handleGoogleDriveDisconnect}
                      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                      accessibilityRole="button"
                      accessibilityLabel="Disconnect Google Drive"
                    >
                      <Text style={[styles.rowLabel, { color: themeColors.error }]}>Disconnect</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={handleGoogleDriveConnect}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Connect Google Drive"
                  >
                    <Text style={styles.rowLabel}>
                      {isConnecting ? 'Connecting...' : 'Connect Google Drive'}
                    </Text>
                    <Text style={styles.rowChevron}>→</Text>
                  </Pressable>
                )
              ) : (
                <Pressable
                  onPress={handleSubscription}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Upgrade to unlock Cloud Backup"
                >
                  <Text style={styles.rowLabel}>🔒  Cloud Backup</Text>
                  <Text style={styles.rowValue}>Upgrade →</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* STORAGE Section */}
        <Text style={styles.sectionHeader}>STORAGE</Text>
        <View style={styles.sectionCard}>
          {/* Delete originals after import */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Delete originals after import</Text>
            <Switch
              value={deleteOriginalsAfterImport}
              onValueChange={handleToggleDeleteOriginals}
              trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
              thumbColor={themeColors.surface}
            />
          </View>

          <View style={styles.rowDivider} />

          {/* Storage usage (SETTINGS-005) */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Vault size</Text>
            <Text style={styles.rowValue}>
              {storageStats !== null ? formatBytes(storageStats.totalSize) : '...'}
            </Text>
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.storageDetailRow}>
            <Text style={styles.storageDetailText}>
              {storageStats !== null
                ? `${storageStats.photoCount} photos, ${storageStats.videoCount} videos, ${storageStats.docCount} docs`
                : '...'}
            </Text>
          </View>
        </View>

        {/* APPEARANCE Section */}
        <Text style={styles.sectionHeader}>APPEARANCE</Text>
        <View style={styles.sectionCard}>
          {/* Theme */}
          <Pressable
            onPress={handleCycleTheme}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Theme: ${THEME_LABELS[themeMode]}`}
          >
            <Text style={styles.rowLabel}>Theme</Text>
            <Text style={styles.rowValue}>{THEME_LABELS[themeMode]}</Text>
          </Pressable>

          <View style={styles.rowDivider} />

          {/* Haptic feedback */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Haptic feedback</Text>
            <Switch
              value={hapticEnabled}
              onValueChange={handleToggleHaptic}
              trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
              thumbColor={themeColors.surface}
            />
          </View>
        </View>

        {/* ABOUT Section */}
        <Text style={styles.sectionHeader}>ABOUT</Text>
        <View style={styles.sectionCard}>
          {/* VaultCalc Premium — hidden in decoy mode (PREMIUM-001) */}
          {!isDecoyMode && (
            <>
              <Pressable
                onPress={handleSubscription}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel="VaultCalc Premium"
              >
                <Text style={styles.rowLabel}>VaultCalc Premium</Text>
                <Text style={styles.rowChevron}>→</Text>
              </Pressable>

              <View style={styles.rowDivider} />
            </>
          )}

          <Pressable
            onPress={handleAbout}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel="About VaultCalc"
          >
            <Text style={styles.rowLabel}>About VaultCalc</Text>
            <Text style={styles.rowChevron}>→</Text>
          </Pressable>
        </View>
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

const createStyles = (c: ColorTokens) => StyleSheet.create({
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
  sectionHeader: {
    ...typography.labelMedium,
    color: c.textTertiary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: c.surfaceContainer,
    borderRadius: layout.cardBorderRadius,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.cardPadding,
    minHeight: layout.minTouchTarget,
  },
  rowPressed: {
    backgroundColor: c.surfaceContainerHigh,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    marginLeft: layout.cardPadding,
  },
  rowLabel: {
    ...typography.bodyLarge,
    color: c.textPrimary,
    flex: 1,
  },
  rowValue: {
    ...typography.bodyMedium,
    color: c.textSecondary,
  },
  rowChevron: {
    ...typography.bodyLarge,
    color: c.textTertiary,
  },
  storageDetailRow: {
    paddingHorizontal: layout.cardPadding,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  storageDetailText: {
    ...typography.bodySmall,
    color: c.textTertiary,
  },
});
