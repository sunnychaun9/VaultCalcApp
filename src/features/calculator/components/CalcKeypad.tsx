/**
 * VaultCalc - Calculator Keypad Component
 *
 * Redesigned layout matching HideU/Google Calculator style:
 * - Optional scientific row (sin, cos, tan, ln, log, etc.)
 * - 4-column basic layout: %, (, ), ⌫ / 7,8,9,÷ / 4,5,6,× / 1,2,3,− / 0,.,=,+
 * - Prominent blue equals button
 *
 * @see CALC-001
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CalcButton, type ButtonType } from './CalcButton';
import { spacing } from '@shared/theme';

interface CalcKeypadProps {
  onButtonPress: (value: string) => void;
  onEqualsLongPress?: () => void;
  memoryHasValue?: boolean;
  isLandscape?: boolean;
}

interface ButtonConfig {
  label: string;
  type: ButtonType;
  accessibilityLabel?: string;
}

// Scientific functions row
const SCIENTIFIC_ROW_1: ButtonConfig[] = [
  { label: 'sin', type: 'function' },
  { label: 'cos', type: 'function' },
  { label: 'tan', type: 'function' },
  { label: 'ln', type: 'function' },
  { label: 'log', type: 'function' },
];

const SCIENTIFIC_ROW_2: ButtonConfig[] = [
  { label: '^', type: 'operator', accessibilityLabel: 'Power' },
  { label: '%', type: 'operator', accessibilityLabel: 'Percent' },
  { label: '(', type: 'function', accessibilityLabel: 'Open bracket' },
  { label: ')', type: 'function', accessibilityLabel: 'Close bracket' },
  { label: '\u232B', type: 'clear', accessibilityLabel: 'Delete last digit' },
];

// Basic keypad rows (4 columns)
const BASIC_TOP_ROW: ButtonConfig[] = [
  { label: '%', type: 'operator', accessibilityLabel: 'Percent' },
  { label: '(', type: 'function', accessibilityLabel: 'Open bracket' },
  { label: ')', type: 'function', accessibilityLabel: 'Close bracket' },
  { label: '\u232B', type: 'clear', accessibilityLabel: 'Delete last digit' },
];

const BASIC_ROWS: ButtonConfig[][] = [
  [
    { label: '7', type: 'number' },
    { label: '8', type: 'number' },
    { label: '9', type: 'number' },
    { label: '\u00F7', type: 'operator', accessibilityLabel: 'Divide' },
  ],
  [
    { label: '4', type: 'number' },
    { label: '5', type: 'number' },
    { label: '6', type: 'number' },
    { label: '\u00D7', type: 'operator', accessibilityLabel: 'Multiply' },
  ],
  [
    { label: '1', type: 'number' },
    { label: '2', type: 'number' },
    { label: '3', type: 'number' },
    { label: '\u2212', type: 'operator', accessibilityLabel: 'Subtract' },
  ],
];

// Bottom row: 0, ., =, +
// = button gets special styling (prominent blue)

// Landscape layout: 5 columns
const LANDSCAPE_ROWS: ButtonConfig[][] = [
  [
    { label: '%', type: 'operator', accessibilityLabel: 'Percent' },
    { label: '7', type: 'number' },
    { label: '8', type: 'number' },
    { label: '9', type: 'number' },
    { label: '\u00F7', type: 'operator', accessibilityLabel: 'Divide' },
  ],
  [
    { label: '(', type: 'function', accessibilityLabel: 'Open bracket' },
    { label: '4', type: 'number' },
    { label: '5', type: 'number' },
    { label: '6', type: 'number' },
    { label: '\u00D7', type: 'operator', accessibilityLabel: 'Multiply' },
  ],
  [
    { label: ')', type: 'function', accessibilityLabel: 'Close bracket' },
    { label: '1', type: 'number' },
    { label: '2', type: 'number' },
    { label: '3', type: 'number' },
    { label: '\u2212', type: 'operator', accessibilityLabel: 'Subtract' },
  ],
  [
    { label: '\u232B', type: 'clear', accessibilityLabel: 'Delete' },
    { label: '0', type: 'number' },
    { label: '.', type: 'number', accessibilityLabel: 'Decimal point' },
    { label: '=', type: 'equals', accessibilityLabel: 'Equals' },
    { label: '+', type: 'operator', accessibilityLabel: 'Add' },
  ],
];

export function CalcKeypad({
  onButtonPress,
  onEqualsLongPress,
  memoryHasValue: _memoryHasValue = false,
  isLandscape = false,
}: CalcKeypadProps): React.JSX.Element {
  const [showScientific] = useState(false);
  const gap = isLandscape ? spacing.xs : spacing.sm;

  if (isLandscape) {
    return (
      <View style={[styles.container, { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, gap }]}>
        {LANDSCAPE_ROWS.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={[styles.row, { gap }]}>
            {row.map((button) => (
              <CalcButton
                key={button.label + rowIndex}
                label={button.label}
                type={button.type}
                onPress={onButtonPress}
                accessibilityLabel={button.accessibilityLabel}
                compact
              />
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Scientific toggle row */}
      {showScientific && (
        <>
          {/* INV / DEG header */}
          <View style={[styles.row, styles.sciHeaderRow]}>
            <Pressable style={styles.sciToggle} onPress={() => {}}>
              <Text style={styles.sciToggleText}>INV</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable style={styles.sciToggle} onPress={() => {}}>
              <Text style={styles.sciToggleText}>DEG</Text>
            </Pressable>
          </View>
          {/* Scientific functions */}
          <View style={[styles.row, { gap }]}>
            {SCIENTIFIC_ROW_1.map((button) => (
              <CalcButton
                key={button.label}
                label={button.label}
                type={button.type}
                onPress={onButtonPress}
                accessibilityLabel={button.accessibilityLabel}
              />
            ))}
          </View>
          {/* Power, %, (, ), backspace */}
          <View style={[styles.row, { gap }]}>
            {SCIENTIFIC_ROW_2.map((button) => (
              <CalcButton
                key={button.label}
                label={button.label}
                type={button.type}
                onPress={onButtonPress}
                accessibilityLabel={button.accessibilityLabel}
              />
            ))}
          </View>
          {/* Extra: !, √, π, e, C */}
          <View style={[styles.row, { gap }]}>
            <CalcButton label="!" type="function" onPress={onButtonPress} accessibilityLabel="Factorial" />
            <CalcButton label="\u221A" type="function" onPress={onButtonPress} accessibilityLabel="Square root" />
            <CalcButton label="\u03C0" type="function" onPress={onButtonPress} accessibilityLabel="Pi" />
            <CalcButton label="e" type="function" onPress={onButtonPress} accessibilityLabel="Euler's number" />
            <CalcButton label="C" type="clear" onPress={onButtonPress} accessibilityLabel="Clear" />
          </View>
        </>
      )}

      {!showScientific && (
        <>
          {/* Top row: %, (, ), ⌫ */}
          <View style={[styles.row, { gap }]}>
            {BASIC_TOP_ROW.map((button) => (
              <CalcButton
                key={button.label}
                label={button.label}
                type={button.type}
                onPress={onButtonPress}
                accessibilityLabel={button.accessibilityLabel}
              />
            ))}
          </View>
        </>
      )}

      {/* Number rows: 7,8,9,÷ / 4,5,6,× / 1,2,3,− */}
      {BASIC_ROWS.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={[styles.row, { gap }]}>
          {row.map((button) => (
            <CalcButton
              key={button.label}
              label={button.label}
              type={button.type}
              onPress={onButtonPress}
              accessibilityLabel={button.accessibilityLabel}
            />
          ))}
        </View>
      ))}

      {/* Bottom row: 0, ., =, + */}
      <View style={[styles.row, { gap }]}>
        <CalcButton label="0" type="number" onPress={onButtonPress} />
        <CalcButton label="." type="number" onPress={onButtonPress} accessibilityLabel="Decimal point" />
        <CalcButton label="=" type="equals" onPress={onButtonPress} onLongPress={onEqualsLongPress} accessibilityLabel="Equals" />
        <CalcButton label="+" type="operator" onPress={onButtonPress} accessibilityLabel="Add" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sciHeaderRow: {
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  sciToggle: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  sciToggleText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
});
