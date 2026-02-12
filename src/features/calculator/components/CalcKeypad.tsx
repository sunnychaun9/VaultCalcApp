/**
 * VaultCalc - Calculator Keypad Component
 *
 * The main button grid for the calculator.
 * Layout: 4 columns with memory row, number grid, and equals.
 *
 * @see 03-Design-System.md Section 3.3, 6.3
 * @see 02-UX-Design.md Section 4
 * @see FEATURE_INDEX.md CALC-001
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CalcButton, ButtonType } from './CalcButton';
import { spacing, layout } from '@shared/theme';

interface CalcKeypadProps {
  onButtonPress: (value: string) => void;
  memoryHasValue?: boolean;
}

interface ButtonConfig {
  label: string;
  type: ButtonType;
  accessibilityLabel?: string;
}

// Memory row configuration
const MEMORY_ROW: ButtonConfig[] = [
  { label: 'MC', type: 'function', accessibilityLabel: 'Memory clear' },
  { label: 'MR', type: 'function', accessibilityLabel: 'Memory recall' },
  { label: 'M+', type: 'function', accessibilityLabel: 'Memory add' },
  { label: 'M-', type: 'function', accessibilityLabel: 'Memory subtract' },
  { label: 'C', type: 'clear', accessibilityLabel: 'Clear' },
  { label: '\u232B', type: 'clear', accessibilityLabel: 'Delete last digit' },
];

// Main keypad rows (4 columns each)
const KEYPAD_ROWS: ButtonConfig[][] = [
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
  [
    { label: '%', type: 'operator', accessibilityLabel: 'Percent' },
    { label: '0', type: 'number' },
    { label: '.', type: 'number', accessibilityLabel: 'Decimal point' },
    { label: '+', type: 'operator', accessibilityLabel: 'Add' },
  ],
];

/**
 * Calculator keypad component
 * Renders the complete button grid
 */
export function CalcKeypad({
  onButtonPress,
  memoryHasValue = false,
}: CalcKeypadProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      {/* Memory row - 6 buttons */}
      <View style={styles.memoryRow}>
        {MEMORY_ROW.map((button) => (
          <CalcButton
            key={button.label}
            label={button.label}
            type={button.type}
            onPress={onButtonPress}
            disabled={
              (button.label === 'MC' || button.label === 'MR') && !memoryHasValue
            }
            accessibilityLabel={button.accessibilityLabel}
          />
        ))}
      </View>

      {/* Main keypad - 4 columns */}
      {KEYPAD_ROWS.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
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

      {/* Equals button - full width */}
      <View style={styles.equalsRow}>
        <CalcButton
          label="="
          type="equals"
          onPress={onButtonPress}
          accessibilityLabel="Equals"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    gap: layout.calcButtonGap,
  },
  memoryRow: {
    flexDirection: 'row',
    gap: layout.calcButtonGap,
  },
  row: {
    flexDirection: 'row',
    gap: layout.calcButtonGap,
  },
  equalsRow: {
    flexDirection: 'row',
  },
});
