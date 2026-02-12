/**
 * VaultCalc - Intruder Logs Screen
 *
 * Lists all intruder detection attempts with timestamps and decrypted photos.
 * Supports clearing the log and viewing full-screen photos.
 *
 * @see FEATURE_INDEX.md SEC-003
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useActivityTracker } from '@features/auth';
import { intruderLogs, type IntruderLog } from '@services/storage';
import { decryptFile, getVaultDirectory } from '@services/crypto';
import { deleteFile } from '@services/media';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { alert } from '@store/alertStore';

/** Format a timestamp to a locale-aware date+time string */
function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}

/** Format device info object to a readable string */
function formatDeviceInfo(info: Record<string, unknown> | null): string | null {
  if (!info) return null;
  const parts: string[] = [];
  if (info.model) parts.push(String(info.model));
  if (info.os) parts.push(String(info.os));
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Individual intruder log item with decrypt-on-demand thumbnail
 */
function IntruderLogItem({
  log,
  themeColors,
  onPhotoPress,
}: {
  log: IntruderLog;
  themeColors: ColorTokens;
  onPhotoPress: (log: IntruderLog) => void;
}): React.JSX.Element {
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let tempPath: string | null = null;

    async function decryptThumbnail() {
      if (!log.photoPath) return;

      const vaultDirResult = await getVaultDirectory();
      if (!vaultDirResult.success || !vaultDirResult.data || cancelled) return;

      tempPath = `${vaultDirResult.data}/temp_intruder_${log.id}.jpg`;
      const result = await decryptFile(log.photoPath, tempPath, log.id);

      if (!cancelled && result.success) {
        setThumbnailUri(`file://${tempPath}`);
      }
    }

    decryptThumbnail();

    return () => {
      cancelled = true;
      if (tempPath) {
        deleteFile(tempPath);
      }
    };
  }, [log.photoPath, log.id]);

  const deviceInfo = formatDeviceInfo(log.deviceInfo);

  const handlePress = useCallback(() => {
    if (log.photoPath) {
      onPhotoPress(log);
    }
  }, [log, onPhotoPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.logRow, pressed && log.photoPath ? styles.logRowPressed : null]}
      disabled={!log.photoPath}
    >
      <View style={styles.thumbnail}>
        {thumbnailUri ? (
          <Image source={{ uri: thumbnailUri }} style={styles.thumbnailImage} />
        ) : (
          <Text style={styles.thumbnailPlaceholder}>{log.photoPath ? '...' : '⊘'}</Text>
        )}
      </View>
      <View style={styles.logInfo}>
        <Text style={styles.logTimestamp}>{formatTimestamp(log.timestamp)}</Text>
        {deviceInfo && <Text style={styles.logDevice}>{deviceInfo}</Text>}
      </View>
    </Pressable>
  );
}

/**
 * Intruder Logs Screen Component
 *
 * Displays a list of intruder attempts with:
 * - Decrypted photo thumbnails (on-demand)
 * - Timestamps and device info
 * - Full-screen photo modal on tap
 * - Clear All functionality
 */
export function IntruderLogsScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation();
  const { onActivity } = useActivityTracker();

  const [logs, setLogs] = useState<IntruderLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<IntruderLog | null>(null);
  const [fullPhotoUri, setFullPhotoUri] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    const allLogs = await intruderLogs.getAll();
    setLogs(allLogs);
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Clean up full-screen photo temp file on dismiss
  const dismissFullPhoto = useCallback(() => {
    if (fullPhotoUri) {
      const filePath = fullPhotoUri.replace('file://', '');
      deleteFile(filePath);
    }
    setFullPhotoUri(null);
    setSelectedLog(null);
  }, [fullPhotoUri]);

  const handlePhotoPress = useCallback(async (log: IntruderLog) => {
    onActivity();
    if (!log.photoPath) return;

    const vaultDirResult = await getVaultDirectory();
    if (!vaultDirResult.success || !vaultDirResult.data) return;

    const tempPath = `${vaultDirResult.data}/temp_intruder_full_${log.id}.jpg`;
    const result = await decryptFile(log.photoPath, tempPath, log.id);

    if (result.success) {
      setSelectedLog(log);
      setFullPhotoUri(`file://${tempPath}`);
    }
  }, [onActivity]);

  const handleBack = useCallback(() => {
    onActivity();
    navigation.goBack();
  }, [onActivity, navigation]);

  const handleClearAll = useCallback(() => {
    onActivity();
    alert(
      'Clear Intruder Log',
      'Delete all intruder log entries and photos? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            // Delete encrypted photo files
            for (const log of logs) {
              if (log.photoPath) {
                await deleteFile(log.photoPath);
              }
            }
            await intruderLogs.deleteAll();
            setLogs([]);
          },
        },
      ],
    );
  }, [onActivity, logs]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<IntruderLog>) => (
    <IntruderLogItem
      log={item}
      themeColors={themeColors}
      onPhotoPress={handlePhotoPress}
    />
  ), [themeColors, handlePhotoPress]);

  const keyExtractor = useCallback((item: IntruderLog) => item.id, []);

  const renderSeparator = useCallback(() => (
    <View style={styles.rowDivider} />
  ), [styles.rowDivider]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No intruder attempts recorded</Text>
    </View>
  ), [styles.emptyContainer, styles.emptyText]);

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
        <Text style={styles.title}>Intruder Log</Text>
        {logs.length > 0 ? (
          <Pressable
            onPress={handleClearAll}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Clear all intruder logs"
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {/* Log list */}
      <FlatList
        data={logs}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={renderSeparator}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={logs.length === 0 ? styles.emptyListContent : undefined}
      />

      {/* Full-screen photo modal */}
      <Modal
        visible={fullPhotoUri !== null}
        transparent
        animationType="fade"
        onRequestClose={dismissFullPhoto}
      >
        <Pressable style={styles.modalBackdrop} onPress={dismissFullPhoto}>
          <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
            <View style={styles.modalHeader}>
              <Pressable
                onPress={dismissFullPhoto}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Close photo"
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
              {selectedLog && (
                <Text style={styles.modalTimestamp}>
                  {formatTimestamp(selectedLog.timestamp)}
                </Text>
              )}
              <View style={styles.placeholder} />
            </View>
            {fullPhotoUri && (
              <Image
                source={{ uri: fullPhotoUri }}
                style={styles.fullPhoto}
                resizeMode="contain"
              />
            )}
          </SafeAreaView>
        </Pressable>
      </Modal>
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
  clearButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearButtonText: {
    ...typography.bodyMedium,
    color: c.error,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  logRowPressed: {
    backgroundColor: c.surfaceContainerHigh,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: c.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: 48,
    height: 48,
  },
  thumbnailPlaceholder: {
    ...typography.bodyLarge,
    color: c.textTertiary,
  },
  logInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  logTimestamp: {
    ...typography.bodyLarge,
    color: c.textPrimary,
  },
  logDevice: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: 2,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    marginLeft: spacing.base,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyText: {
    ...typography.bodyLarge,
    color: c.textTertiary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: layout.topBarHeight,
  },
  modalCloseText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  modalTimestamp: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  fullPhoto: {
    flex: 1,
  },
});
