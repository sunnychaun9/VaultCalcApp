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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VaultStackParamList } from '@typedefs/navigation';
import { useSettingsStore } from '@store/settingsStore';
import { useFeatureGate } from '@services/billing';
import { useAuthStore } from '@store/authStore';
import { useActivityTracker } from '@features/auth';
import { mediaItems } from '@services/storage/database';
import { checkBiometricAvailability, getBiometricStatusMessage, type BiometricStatus } from '@services/biometric';
import { signInToGoogle, signOutFromGoogle } from '@services/googleDrive';
import { uploadBackupToDrive, restoreBackupFromDrive, type BackupUploadProgress, type RestoreProgress } from '@services/backup';
import { BackupProgressOverlay } from '../components/BackupProgressOverlay';
import { RestoreProgressOverlay } from '../components/RestoreProgressOverlay';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { alert } from '@store/alertStore';

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
    intruderDetectionEnabled,
    setIntruderDetectionEnabled,
    googleDriveEmail,
    googleDriveDisplayName,
    setGoogleDriveConnection,
    lastBackupAt,
    setLastBackupAt,
    autoBackupEnabled,
    setAutoBackupEnabled,
    lastBackupItemCount,
    setLastBackupItemCount,
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

  const handleToggleIntruderDetection = useCallback((value: boolean) => {
    onActivity();
    setIntruderDetectionEnabled(value);
  }, [onActivity, setIntruderDetectionEnabled]);

  const handleIntruderLogs = useCallback(() => {
    onActivity();
    navigation.navigate('IntruderLogs');
  }, [onActivity, navigation]);

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

          {/* Shake to lock — hidden in decoy mode (ENH-005) */}
          {!isDecoyMode && (
            <>
              <View style={styles.rowDivider} />

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Shake to lock</Text>
                <Switch
                  value={panicButtonEnabled}
                  onValueChange={handleTogglePanicButton}
                  trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
                  thumbColor={themeColors.surface}
                />
              </View>
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
        </View>

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
