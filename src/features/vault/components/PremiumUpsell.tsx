/**
 * VaultCalc - Premium Upsell Component
 *
 * Displayed in place of premium feature content for free users.
 * Shows feature name and CTA to navigate to Subscription screen.
 *
 * @see FEATURE_INDEX.md PREMIUM-004
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { Icon, ICON_SIZE } from '@shared/components/Icon';

interface PremiumUpsellProps {
  /** Feature name to display (e.g. "Secure Notes") */
  feature: string;
  /** Navigate to Subscription screen */
  onUpgrade: () => void;
}

/**
 * Upsell card for gated premium features
 */
export function PremiumUpsell({
  feature,
  onUpgrade,
}: PremiumUpsellProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  return (
    <View style={styles.container}>
      <Icon name="lock" size={ICON_SIZE.xl} color={themeColors.textTertiary} style={styles.icon} />

      <Text style={styles.title}>
        &quot;{feature}&quot; is a Premium feature
      </Text>

      <Text style={styles.description}>
        Upgrade to VaultCalc Premium to unlock this feature.
      </Text>

      <Pressable
        onPress={onUpgrade}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Upgrade to Premium"
      >
        <Text style={styles.buttonText}>Upgrade to Premium</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  icon: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.headlineMedium,
    color: c.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  description: {
    ...typography.bodyMedium,
    color: c.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 280,
  },
  button: {
    backgroundColor: c.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: layout.buttonBorderRadius,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    ...typography.labelLarge,
    color: c.textOnAccent,
  },
});
