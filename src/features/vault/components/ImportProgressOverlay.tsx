/**
 * VaultCalc - Import Progress Overlay
 *
 * Modal overlay shown during file import. Displays a centered card
 * with file count, current filename, and a progress bar.
 *
 * @see FEATURE_INDEX.md FILE-010
 */

import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import type { ImportProgress } from '@services/import';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';

interface ImportProgressOverlayProps {
  progress: ImportProgress;
}

export function ImportProgressOverlay({
  progress,
}: ImportProgressOverlayProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const fraction = progress.total > 0 ? progress.current / progress.total : 0;

  return (
    <View style={styles.scrim}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={themeColors.accent} />

        <Text style={styles.title}>
          Importing {progress.current} of {progress.total}
        </Text>

        <Text style={styles.filename} numberOfLines={1}>
          {progress.currentFileName}
        </Text>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(fraction * 100)}%` }]} />
        </View>
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
