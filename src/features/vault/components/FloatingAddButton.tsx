/**
 * VaultCalc - Floating Add Button Component
 *
 * FAB for adding files to the vault.
 * Positioned at bottom of screen with spring-physics press feedback.
 *
 * @see FEATURE_INDEX.md VAULT-001
 */

import React, { useMemo } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useThemeColors, type ColorTokens, typography, spacing, elevationLevels } from '@shared/theme';
import { usePressAnimation } from '@shared/hooks/useAnimations';

interface FloatingAddButtonProps {
  /** Handler for button press */
  onPress: () => void;
  /** Button label */
  label?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
}

/**
 * Floating action button for adding files
 */
export function FloatingAddButton({
  onPress,
  label = '+ Add Files',
  disabled = false,
}: FloatingAddButtonProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({
    scaleDown: 0.94,
    opacityDown: 0.9,
  });

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        style={[
          styles.button,
          disabled && styles.buttonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.buttonText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
  },
  button: {
    backgroundColor: c.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 28,
    ...elevationLevels.level2.shadow,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.labelLarge,
    color: c.textOnAccent,
  },
});
