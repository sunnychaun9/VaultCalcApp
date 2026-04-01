/**
 * VaultCalc - Soft Premium Suggestion Card
 *
 * Shown once per session after the user has seen 3+ interstitial ads.
 * Gently suggests upgrading to premium for a permanent ad-free experience.
 * Dismissible — appears with animated entrance, never blocks the UI.
 *
 * @see FEATURE_INDEX.md ADS-001
 */

import React, { useMemo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { Icon, IconButton } from '@shared/components/Icon';

interface SoftPremiumCardProps {
  onDismiss: () => void;
  onUpgrade: () => void;
}

export function SoftPremiumCard({ onDismiss, onUpgrade }: SoftPremiumCardProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Entrance animation
  const translateY = useSharedValue(40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 350 });
  }, [translateY, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Icon name="star" size={18} color={themeColors.accent} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>Enjoying VaultCalc?</Text>
          <Text style={styles.subtitle}>Go premium to remove ads forever</Text>
        </View>
        <IconButton
          name="x"
          size={16}
          onPress={onDismiss}
          color={themeColors.textTertiary}
          accessibilityLabel="Dismiss"
        />
      </View>
      <Pressable
        onPress={onUpgrade}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel="Learn more about premium"
      >
        <Text style={styles.ctaText}>Learn more</Text>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    backgroundColor: c.surfaceContainer,
    borderRadius: layout.cardBorderRadius,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  title: {
    ...typography.titleSmall,
    color: c.textPrimary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: spacing.xxs,
  },
  cta: {
    marginTop: spacing.md,
    backgroundColor: c.accent,
    height: layout.buttonHeightSmall,
    borderRadius: layout.buttonBorderRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    ...typography.labelLarge,
    color: c.textOnAccent,
  },
});
