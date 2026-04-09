/**
 * VaultCalc - Import Progress Overlay
 *
 * Modal overlay shown during file import. Displays a centered card
 * with animated Lottie loader, file count, current filename, and a progress bar.
 *
 * @see FEATURE_INDEX.md FILE-010
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import type { ImportProgress } from '@services/import';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';

const vaultLoaderAnimation = require('@shared/assets/vault-loader.json');

interface ImportProgressOverlayProps {
  progress: ImportProgress;
}

export function ImportProgressOverlay({
  progress,
}: ImportProgressOverlayProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const fraction = progress.total > 0 ? progress.current / progress.total : 0;
  const percent = Math.round(fraction * 100);

  return (
    <View style={styles.scrim}>
      <View style={styles.card}>
        <LottieView
          source={vaultLoaderAnimation}
          autoPlay
          loop
          style={styles.lottie}
        />

        <Text style={styles.title}>
          Encrypting {progress.current} of {progress.total}
        </Text>

        <Text style={styles.filename} numberOfLines={1}>
          {progress.currentFileName}
        </Text>

        {/* Progress bar with percentage */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.percentText}>{percent}%</Text>
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
  lottie: {
    width: 120,
    height: 120,
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
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
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
  percentText: {
    ...typography.labelSmall,
    color: c.textTertiary,
    width: 32,
    textAlign: 'right',
  },
});
