/**
 * VaultCalc - Calculator Button Component
 *
 * Individual calculator button with proper styling and press feedback.
 *
 * @see 03-Design-System.md Section 6.3
 * @see FEATURE_INDEX.md CALC-001
 */

import React, { useCallback } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  Vibration,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useSettingsStore } from '@store/settingsStore';
import { useThemeColors, type ColorTokens, typography, layout } from '@shared/theme';

export type ButtonType = 'number' | 'operator' | 'function' | 'equals' | 'clear';

interface CalcButtonProps {
  label: string;
  type?: ButtonType;
  onPress: (label: string) => void;
  span?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  compact?: boolean;
}

/**
 * Calculator button component
 * Supports different button types with appropriate styling
 */
export function CalcButton({
  label,
  type = 'number',
  onPress,
  span = 1,
  disabled = false,
  accessibilityLabel,
  compact = false,
}: CalcButtonProps): React.JSX.Element {
  const themeColors = useThemeColors();

  const handlePress = useCallback(() => {
    if (!disabled) {
      if (useSettingsStore.getState().hapticEnabled) {
        const duration = type === 'operator' || type === 'equals' ? 10 : 5;
        Vibration.vibrate(duration);
      }
      onPress(label);
    }
  }, [disabled, label, onPress, type]);

  const buttonStyle = getButtonStyle(type, span, themeColors);
  const textStyle = getTextStyle(type, themeColors);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        buttonStyle,
        pressed && styles.pressed,
        pressed && type === 'equals' && { backgroundColor: themeColors.calcButtonEqualsPressed },
        disabled && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label} button`}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.text, compact && styles.textCompact, textStyle, disabled && styles.textDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function getButtonStyle(type: ButtonType, span: number, c: ColorTokens): ViewStyle {
  const baseStyle: ViewStyle = {};

  if (span > 1) {
    baseStyle.flex = span;
  }

  switch (type) {
    case 'number':
      return { ...baseStyle, backgroundColor: c.calcButtonPrimary };
    case 'operator':
      return { ...baseStyle, backgroundColor: c.calcButtonOperator };
    case 'function':
      return { ...baseStyle, backgroundColor: 'transparent' };
    case 'clear':
      return { ...baseStyle, backgroundColor: 'transparent' };
    case 'equals':
      return { ...baseStyle, backgroundColor: c.calcButtonEquals, borderRadius: 24 };
    default:
      return baseStyle;
  }
}

function getTextStyle(type: ButtonType, c: ColorTokens): TextStyle {
  switch (type) {
    case 'equals':
      return { color: c.calcButtonEqualsText, fontSize: 28 };
    case 'function':
      return { ...typography.calcButtonSmall, color: c.accent };
    case 'operator':
      return { color: c.accent };
    case 'clear':
      return { color: c.accent };
    default:
      return { color: c.textPrimary };
  }
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    height: layout.calcButtonHeight,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    minWidth: layout.minTouchTarget,
  },
  buttonCompact: {
    height: layout.calcButtonHeightCompact,
    borderRadius: 12,
  },
  text: {
    ...typography.calcButton,
  },
  textCompact: {
    fontSize: 20,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  disabled: {
    opacity: 0.38,
  },
  textDisabled: {
    opacity: 0.38,
  },
});
