/**
 * VaultCalc - Calculator Display Component (Premium Redesign)
 *
 * Shows the current expression and result with:
 * - Glass morphism effect (frosted background with border)
 * - Animated number transitions
 * - Dynamic text scaling
 * - Subtle expression fade
 *
 * @see CALC-001
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useThemeColors, type ColorTokens, typography, spacing, layout, getCalcDisplayStyle } from '@shared/theme';
import type { HistoryEntry } from '../hooks/useCalculator';

/** Warning level for display styling */
type WarningLevel = 'none' | 'caution' | 'warning' | 'danger';

interface CalcDisplayProps {
  expression: string;
  result: string;
  /** Calculation history (last 3, in-memory only) */
  history?: HistoryEntry[];
  /** Optional warning message to display */
  warningMessage?: string | null;
  /** Warning severity level */
  warningLevel?: WarningLevel;
  /** Lockout time remaining (shows lockout UI) */
  lockoutTime?: string;
}

/**
 * Calculator display component with glass effect and animations
 */
export function CalcDisplay({
  expression,
  result,
  history,
  warningMessage,
  warningLevel = 'none',
  lockoutTime,
}: CalcDisplayProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Animate result text on change
  const resultOpacity = useRef(new Animated.Value(1)).current;
  const resultTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Quick fade-slide on result change
    resultOpacity.setValue(0.6);
    resultTranslateY.setValue(6);

    Animated.parallel([
      Animated.timing(resultOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(resultTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 40,
        bounciness: 0,
      }),
    ]).start();
  }, [result, resultOpacity, resultTranslateY]);

  // Get appropriate text style based on result length
  const resultStyle = useMemo(() => {
    const digitCount = result.replace(/[^0-9]/g, '').length || result.length;
    return getCalcDisplayStyle(digitCount);
  }, [result]);

  // Format number with thousands separator
  const formattedResult = useMemo(() => {
    return formatNumber(result);
  }, [result]);

  // Get warning color based on level
  const warningColor = useMemo(() => {
    switch (warningLevel) {
      case 'caution':
        return themeColors.warning;
      case 'warning':
        return themeColors.error;
      case 'danger':
        return themeColors.error;
      default:
        return themeColors.textSecondary;
    }
  }, [warningLevel, themeColors]);

  return (
    <View
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={`Calculator display, showing ${result}`}
    >
      {/* Glass panel */}
      <View style={styles.glassPanel}>
        {/* Lockout Banner */}
        {lockoutTime && (
          <View style={styles.lockoutBanner}>
            <Text style={styles.lockoutText}>
              Locked for {lockoutTime}
            </Text>
          </View>
        )}

        {/* Warning Message */}
        {warningMessage && !lockoutTime && (
          <Text style={[styles.warningText, { color: warningColor }]}>
            {warningMessage}
          </Text>
        )}

        {/* Calculation history */}
        {history && history.length > 0 && (
          <View style={styles.historyContainer}>
            {history.map((entry, index) => (
              <Text
                key={index}
                style={[
                  styles.historyEntry,
                  { opacity: 0.25 + (index * 0.1) },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {entry.expression} {entry.result}
              </Text>
            ))}
          </View>
        )}

        {/* Expression line (secondary) */}
        {expression.length > 0 && (
          <Text
            style={styles.expression}
            numberOfLines={1}
            ellipsizeMode="head"
          >
            {expression}
          </Text>
        )}

        {/* Result line (primary) — animated */}
        <Animated.Text
          style={[
            styles.result,
            resultStyle,
            {
              opacity: resultOpacity,
              transform: [{ translateY: resultTranslateY }],
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {formattedResult}
        </Animated.Text>
      </View>
    </View>
  );
}

/**
 * Format number with thousands separator
 */
function formatNumber(value: string): string {
  if (value === 'Error' || value === '' || value === '-') {
    return value || '0';
  }

  const isNegative = value.startsWith('-');
  const absValue = isNegative ? value.slice(1) : value;
  const [integerPart, decimalPart] = absValue.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  let formatted = formattedInteger;
  if (decimalPart !== undefined) {
    formatted += '.' + decimalPart;
  }
  if (isNegative) {
    formatted = '-' + formatted;
  }

  return formatted || '0';
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    minHeight: layout.calcDisplayMinHeight,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  glassPanel: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: layout.calcDisplayPadding,
    paddingVertical: spacing.lg,
    backgroundColor: c.calcDisplayGlass,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.calcDisplayGlassBorder,
    overflow: 'hidden',
  },
  historyContainer: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  historyEntry: {
    ...typography.bodySmall,
    color: c.textTertiary,
    textAlign: 'right',
    marginBottom: 2,
  },
  expression: {
    ...typography.bodyLarge,
    color: c.textSecondary,
    opacity: 0.5,
    marginBottom: spacing.xs,
    maxWidth: '100%',
  },
  result: {
    ...typography.calcDisplayLarge,
    color: c.textPrimary,
    textAlign: 'right',
  },
  warningText: {
    ...typography.labelSmall,
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    textAlign: 'center',
  },
  lockoutBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: c.error,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  lockoutText: {
    ...typography.labelMedium,
    color: c.textOnDark,
    textAlign: 'center',
  },
});
