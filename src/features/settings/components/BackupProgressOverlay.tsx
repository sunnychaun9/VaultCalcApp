/**
 * VaultCalc - Backup Progress Overlay
 *
 * Modal overlay shown during backup upload. Displays a centered card
 * with phase label, file count, and a progress bar.
 * Mirrors ImportProgressOverlay pattern.
 *
 * @see FEATURE_INDEX.md CLOUD-003
 */

import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import type { BackupUploadProgress } from '@services/backup';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';

interface BackupProgressOverlayProps {
  progress: BackupUploadProgress;
}

export function BackupProgressOverlay({
  progress,
}: BackupProgressOverlayProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const fraction = progress.total > 0 ? progress.current / progress.total : 0;

  const title =
    progress.phase === 'preparing'
      ? 'Preparing Backup...'
      : progress.phase === 'uploading'
        ? `Uploading ${progress.current} of ${progress.total}`
        : 'Backup Complete';

  return (
    <View style={styles.scrim}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={themeColors.accent} />

        <Text style={styles.title}>{title}</Text>

        {progress.phase === 'uploading' && progress.currentLabel ? (
          <Text style={styles.filename} numberOfLines={1}>
            {progress.currentLabel}
          </Text>
        ) : null}

        {progress.phase === 'uploading' && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(fraction * 100)}%` }]} />
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.scrim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: layout.cardBorderRadius,
    padding: spacing.xl,
    width: '80%',
    maxWidth: 320,
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    ...typography.titleMedium,
    color: c.textPrimary,
    textAlign: 'center',
  },
  filename: {
    ...typography.bodySmall,
    color: c.textSecondary,
    textAlign: 'center',
    maxWidth: '100%',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.accent,
    borderRadius: 2,
  },
});
