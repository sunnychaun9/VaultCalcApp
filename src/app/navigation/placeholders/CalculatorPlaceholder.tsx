/**
 * VaultCalc - Calculator Placeholder
 *
 * Temporary placeholder component until CALC-001 is implemented.
 * Will be replaced with actual Calculator screen.
 *
 * @see FEATURE_INDEX.md CALC-001
 */

import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';

/**
 * Placeholder for Calculator screen
 * Renders empty white screen matching calculator background
 */
export function CalculatorPlaceholder(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {/* Calculator UI will be implemented in CALC-001 */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
