/**
 * VaultCalc - Settings Section Component
 *
 * Card container for a group of settings rows.
 * Includes section title and optional description.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors, colors, type ColorTokens, typography, spacing, layout, getSurfaceStyle } from '@shared/theme';

interface SettingsSectionProps {
  /** Section title (e.g. "Security") */
  title: string;
  /** Optional description below the title */
  description?: string;
  children: React.ReactNode;
}

export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const isDark = themeColors === colors.dark;
  const styles = useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {description != null && (
          <Text style={styles.description}>{description}</Text>
        )}
      </View>

      {/* Card */}
      <View style={styles.card}>
        {children}
      </View>
    </View>
  );
}

const createStyles = (c: ColorTokens, isDark: boolean) => StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  header: {
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.labelLarge,
    color: c.textSecondary,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  description: {
    ...typography.bodySmall,
    color: c.textTertiary,
    marginTop: 2,
  },
  card: {
    ...getSurfaceStyle('level1', c, isDark),
    borderRadius: layout.cardBorderRadius,
    overflow: 'hidden',
  },
});
