/**
 * VaultCalc - Import Success Toast
 *
 * Animated toast overlay shown after successful file import.
 * Shield icon + "Encrypted" message + file count.
 * Auto-dismisses after 2.5 seconds with fade-out.
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { Icon } from '@shared/components/Icon';

interface ImportSuccessToastProps {
  count: number;
  visible: boolean;
  onDismiss: () => void;
}

export function ImportSuccessToast({
  count,
  visible,
  onDismiss,
}: ImportSuccessToastProps): React.JSX.Element | null {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const iconRotate = useSharedValue(0);
  const checkScale = useSharedValue(0);

  const dismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (!visible) return;

    // Phase 1: Card enters
    opacity.value = withTiming(1, { duration: 200 });
    scale.value = withSpring(1, { damping: 14, stiffness: 200 });

    // Phase 2: Shield icon does a satisfying bounce
    iconRotate.value = withDelay(100, withSequence(
      withTiming(-8, { duration: 100 }),
      withSpring(0, { damping: 8, stiffness: 300 }),
    ));

    // Phase 3: Checkmark pops in
    checkScale.value = withDelay(300, withSpring(1, { damping: 10, stiffness: 250 }));

    // Phase 4: Auto-dismiss after 2.5 seconds
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 250 });
      scale.value = withTiming(0.9, { duration: 250 });
      setTimeout(() => runOnJS(dismiss)(), 280);
    }, 2500);

    return () => clearTimeout(timer);
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${iconRotate.value}deg` }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  if (!visible) return null;

  const fileWord = count === 1 ? 'file' : 'files';

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View style={[styles.card, containerStyle]}>
        <View style={styles.iconRow}>
          <Animated.View style={iconStyle}>
            <View style={styles.shieldCircle}>
              <Icon name="shield" size={28} color={themeColors.accent} fill={themeColors.accent} />
            </View>
          </Animated.View>
          <Animated.View style={[styles.checkBadge, checkStyle]}>
            <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} />
          </Animated.View>
        </View>
        <Text style={styles.title}>Encrypted & Hidden</Text>
        <Text style={styles.subtitle}>
          {count} {fileWord} secured in your vault
        </Text>
      </Animated.View>
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  card: {
    backgroundColor: c.surfaceContainer,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing['2xl'],
    alignItems: 'center',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    minWidth: 200,
  },
  iconRow: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  shieldCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.surfaceContainer,
  },
  title: {
    ...typography.headlineSmall,
    color: c.textPrimary,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: c.textSecondary,
    textAlign: 'center',
  },
});
