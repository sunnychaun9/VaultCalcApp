/**
 * VaultCalc - About Screen
 *
 * Displays app branding, version info, social proof,
 * and a "Share with friends" viral loop trigger.
 *
 * @see 02-UX-Design.md Section 9 (SET-06)
 * @see FEATURE_INDEX.md SETTINGS-006
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useActivityTracker } from '@features/auth';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { Icon, IconButton } from '@shared/components/Icon';
import { shareApp } from '@services/share';
import { useSettingsStore } from '@store/settingsStore';
import { alert } from '@store/alertStore';

/**
 * About Screen Component
 *
 * Shows:
 * - App name, tagline, and social proof
 * - Version and build info card
 * - Share with friends CTA (viral loop)
 * - Footer
 */
export function AboutScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation();
  const { onActivity } = useActivityTracker();
  const appShareCount = useSettingsStore(s => s.appShareCount);

  const handleBack = useCallback(() => {
    onActivity();
    navigation.goBack();
  }, [onActivity, navigation]);

  const handleShareApp = useCallback(async () => {
    onActivity();
    try {
      await shareApp();
      useSettingsStore.getState().incrementAppShareCount();

      // Reward feedback on first share
      if (appShareCount === 0) {
        alert(
          'Thanks for sharing!',
          'You\'re helping others protect their privacy. We appreciate it.',
        );
      }
    } catch {
      // Share cancelled or failed — silent
    }
  }, [onActivity, appShareCount]);

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
        <Text style={styles.tagline}>Your secrets, hidden in plain sight</Text>
        <Text style={styles.socialProof}>Trusted by privacy-conscious users worldwide</Text>

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

        {/* Share CTA */}
        <Pressable
          onPress={handleShareApp}
          style={({ pressed }) => [styles.shareButton, pressed && styles.shareButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Share VaultCalc with friends"
        >
          <Icon name="share" size={18} color={themeColors.accent} />
          <Text style={styles.shareButtonText}>Share with friends</Text>
        </Pressable>
        <Text style={styles.shareSubtext}>Help others protect their privacy too</Text>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>Made with care for your privacy</Text>
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
    marginBottom: spacing.xs,
  },
  socialProof: {
    ...typography.bodySmall,
    color: c.textTertiary,
    fontStyle: 'italic',
    marginBottom: spacing['2xl'],
  },
  sectionCard: {
    backgroundColor: c.surfaceContainer,
    borderRadius: layout.cardBorderRadius,
    overflow: 'hidden',
    alignSelf: 'stretch',
    marginBottom: spacing.xl,
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
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surfaceContainer,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md + 2,
    borderRadius: layout.buttonBorderRadius,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  shareButtonPressed: {
    opacity: 0.7,
  },
  shareButtonText: {
    ...typography.labelLarge,
    color: c.accent,
  },
  shareSubtext: {
    ...typography.bodySmall,
    color: c.textTertiary,
    marginTop: spacing.sm,
  },
  footer: {
    ...typography.bodySmall,
    color: c.textTertiary,
    textAlign: 'center',
    paddingBottom: spacing.xl,
  },
});
