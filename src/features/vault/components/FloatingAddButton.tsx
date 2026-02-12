/**
 * VaultCalc - Floating Add Button Component
 *
 * FAB for adding files to the vault.
 * Positioned at bottom of screen.
 *
 * @see FEATURE_INDEX.md VAULT-001
 */

import React, { useMemo } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
} from 'react-native';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';

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

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    backgroundColor: c.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.labelLarge,
    color: c.textOnAccent,
  },
});
