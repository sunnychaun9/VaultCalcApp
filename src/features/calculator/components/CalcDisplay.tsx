/**
 * VaultCalc - Calculator Display Component
 *
 * Shows the current expression and result.
 * Text scales based on digit count.
 *
 * @see 03-Design-System.md Section 6.1
 * @see FEATURE_INDEX.md CALC-001
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
 * Calculator display component
 * Shows expression (secondary) and result (primary)
 * Optionally displays warning messages for failed attempts
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

      {/* Calculation history (oldest at top, most recent closest to current display) */}
      {history && history.length > 0 && (
        <View style={styles.historyContainer}>
          {history.map((entry, index) => (
            <Text
              key={index}
              style={styles.historyEntry}
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

      {/* Result line (primary) */}
      <Text
        style={[styles.result, resultStyle]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {formattedResult}
      </Text>
    </View>
  );
}

/**
 * Format number with thousands separator
 * Handles decimal numbers and negative numbers
 */
function formatNumber(value: string): string {
  // Don't format special values
  if (value === 'Error' || value === '' || value === '-') {
    return value || '0';
  }

  // Handle negative numbers
  const isNegative = value.startsWith('-');
  const absValue = isNegative ? value.slice(1) : value;

  // Split integer and decimal parts
  const [integerPart, decimalPart] = absValue.split('.');

  // Add thousands separator to integer part
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Reconstruct the number
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
    alignItems: 'flex-end',
    paddingHorizontal: layout.calcDisplayPadding,
    paddingVertical: spacing.base,
    backgroundColor: c.calcDisplay,
  },
  historyContainer: {
    width: '100%',
    marginBottom: spacing.xs,
  },
  historyEntry: {
    ...typography.bodySmall,
    color: c.textTertiary,
    opacity: 0.5,
    textAlign: 'right',
    marginBottom: 2,
  },
  expression: {
    ...typography.bodyLarge,
    color: c.textSecondary,
    opacity: 0.6,
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
  },
  lockoutText: {
    ...typography.labelMedium,
    color: c.textOnDark,
    textAlign: 'center',
  },
});
