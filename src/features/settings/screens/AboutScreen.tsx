/**
 * VaultCalc - About Screen
 *
 * Displays app name, tagline, version, and build information.
 *
 * @see 02-UX-Design.md Section 9 (SET-06)
 * @see FEATURE_INDEX.md SETTINGS-006
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useActivityTracker } from '@features/auth';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { IconButton } from '@shared/components/Icon';

/**
 * About Screen Component
 *
 * Shows:
 * - App name and tagline
 * - Version and build info card
 * - Footer text
 */
export function AboutScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation();
  const { onActivity } = useActivityTracker();

  const handleBack = useCallback(() => {
    onActivity();
    navigation.goBack();
  }, [onActivity, navigation]);

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
        <Text style={styles.title}>About</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.appName}>VaultCalc</Text>
        <Text style={styles.tagline}>Private photo vault</Text>

        {/* Info card */}
        <View style={styles.sectionCard}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Build</Text>
            <Text style={styles.rowValue}>1</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>Made with care</Text>
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
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing['3xl'],
  },
  appName: {
    ...typography.headlineLarge,
    color: c.textPrimary,
    marginBottom: spacing.xs,
  },
  tagline: {
    ...typography.bodyLarge,
    color: c.textSecondary,
    marginBottom: spacing['2xl'],
  },
  sectionCard: {
    backgroundColor: c.surfaceContainer,
    borderRadius: layout.cardBorderRadius,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.cardPadding,
    minHeight: layout.minTouchTarget,
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
  footer: {
    ...typography.bodySmall,
    color: c.textTertiary,
    textAlign: 'center',
    paddingBottom: spacing.xl,
  },
});
