/**
 * VaultCalc - Calculator Button Component (Premium Redesign)
 *
 * Individual calculator button with:
 * - Animated scale press feedback (spring physics)
 * - Subtle elevation shadow
 * - Accent-colored operators
 * - Glowing equals button
 * - Haptic feedback
 *
 * @see CALC-001
 */

import React, { useCallback, useRef } from 'react';
import {
  Pressable,
  Text,
  Animated,
  StyleSheet,
  Vibration,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useSettingsStore } from '@store/settingsStore';
import { useCalcThemeColors, type ColorTokens, typography, layout } from '@shared/theme';

export type ButtonType = 'number' | 'operator' | 'function' | 'equals' | 'clear';

interface CalcButtonProps {
  label: string;
  type?: ButtonType;
  onPress: (label: string) => void;
  onLongPress?: () => void;
  span?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  compact?: boolean;
}

export function CalcButton({
  label,
  type = 'number',
  onPress,
  onLongPress,
  span = 1,
  disabled = false,
  accessibilityLabel,
  compact = false,
}: CalcButtonProps): React.JSX.Element {
  const themeColors = useCalcThemeColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  }, [scaleAnim]);

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
    <Animated.View
      style={[
        styles.wrapper,
        compact && styles.wrapperCompact,
        { flex: span > 1 ? span : 1 },
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Pressable
        onPress={handlePress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.button,
          compact && styles.buttonCompact,
          buttonStyle,
          disabled && styles.disabled,
        ]}
        android_ripple={{
          color: type === 'equals'
            ? 'rgba(255, 255, 255, 0.15)'
            : 'rgba(255, 255, 255, 0.08)',
          borderless: false,
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `${label} button`}
        accessibilityState={{ disabled }}
      >
        <Text
          style={[
            styles.text,
            compact && styles.textCompact,
            textStyle,
            disabled && styles.textDisabled,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function getButtonStyle(type: ButtonType, _span: number, c: ColorTokens): ViewStyle {
  switch (type) {
    case 'number':
      return {
        backgroundColor: c.calcButtonPrimary,
        elevation: 2,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      };
    case 'operator':
      return {
        backgroundColor: c.calcButtonOperator,
        elevation: 2,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      };
    case 'function':
      return {
        backgroundColor: 'transparent',
      };
    case 'clear':
      return {
        backgroundColor: 'transparent',
      };
    case 'equals':
      return {
        backgroundColor: c.calcButtonEquals,
        elevation: 6,
        shadowColor: c.calcButtonEqualsGlow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 10,
      };
    default:
      return {};
  }
}

function getTextStyle(type: ButtonType, c: ColorTokens): TextStyle {
  switch (type) {
    case 'equals':
      return { color: c.calcButtonEqualsText, fontSize: 32, fontWeight: '600' };
    case 'function':
      return { ...typography.calcButtonSmall, color: c.calcButtonOperatorText };
    case 'operator':
      return { color: c.calcButtonOperatorText, fontSize: 30 };
    case 'clear':
      return { color: c.calcButtonOperatorText };
    default:
      return { color: c.textPrimary };
  }
}

const styles = StyleSheet.create({
  wrapper: {
    height: layout.calcButtonHeight,
  },
  wrapperCompact: {
    height: layout.calcButtonHeightCompact,
  },
  button: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    minWidth: layout.minTouchTarget,
    overflow: 'hidden',
  },
  buttonCompact: {
    borderRadius: 12,
  },
  text: {
    ...typography.calcButton,
  },
  textCompact: {
    fontSize: 22,
  },
  disabled: {
    opacity: 0.38,
  },
  textDisabled: {
    opacity: 0.38,
  },
});
