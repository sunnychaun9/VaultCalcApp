/**
 * VaultCalc - Calculator Screen
 *
 * Main calculator screen with display and keypad.
 * This screen is the primary interface of the app.
 * Integrates PIN detection for vault access.
 *
 * @see 02-UX-Design.md Section 4
 * @see FEATURE_INDEX.md CALC-001, CALC-002, AUTH-001, AUTH-006
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalcDisplay, CalcKeypad } from '../components';
import { useCalculator, type PinCheckCallback } from '../hooks';
import { usePinAuth, useBiometricAuth, useFailedAttempts } from '@features/auth';
import { useSettingsStore } from '@store/settingsStore';
import { recordIntruderAttempt } from '@services/intruderCamera';
import { colors, useThemeColors, type ColorTokens } from '@shared/theme';

/**
 * Calculator Screen Component
 *
 * The main calculator interface. Features:
 * - Display of expression and result with auto-scaling text
 * - Full arithmetic operations (+, -, ×, ÷)
 * - Memory operations (MC, MR, M+, M-)
 * - Percentage calculation
 * - Clear and backspace
 * - Operator chaining with proper precedence
 * - PIN detection for vault access (AUTH-001)
 * - Failed attempt tracking and warnings (AUTH-006)
 */
export function CalculatorScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const isDark = themeColors === colors.dark;
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const { checkAndAuthenticate } = usePinAuth();
  const { triggerBiometric, showBiometricButton } = useBiometricAuth();
  const intruderDetectionEnabled = useSettingsStore(s => s.intruderDetectionEnabled);
  const {
    warningMessage,
    warningLevel,
    lockoutTimeRemaining,
    isLockedOut,
    onFailedAttempt,
  } = useFailedAttempts();

  // Create PIN check callback for calculator
  const handlePinCheck: PinCheckCallback = useCallback(
    async (input: string) => {
      // Don't attempt if locked out
      if (isLockedOut) {
        return { wasAuthAttempt: false, authenticated: false };
      }

      const result = await checkAndAuthenticate(input);

      // Handle failed attempt
      if (result.wasAuthAttempt && !result.authenticated) {
        onFailedAttempt();
        // Silently capture intruder photo if enabled (SEC-001)
        if (intruderDetectionEnabled) {
          recordIntruderAttempt().catch(() => {});
        }
      }

      return {
        wasAuthAttempt: result.wasAuthAttempt,
        authenticated: result.authenticated,
      };
    },
    [checkAndAuthenticate, isLockedOut, onFailedAttempt, intruderDetectionEnabled]
  );

  const { display, expression, memoryHasValue, handleButtonPress, history } = useCalculator({
    onPinCheck: handlePinCheck,
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.calcBackground}
      />

      {/* Calculator Display with warnings */}
      <View style={styles.displayWrapper}>
        <CalcDisplay
          expression={expression}
          result={display}
          history={history}
          warningMessage={warningMessage}
          warningLevel={warningLevel}
          lockoutTime={isLockedOut ? lockoutTimeRemaining : undefined}
        />
        {/* Biometric re-trigger button (BIO-004) */}
        {showBiometricButton && (
          <Pressable
            onPress={triggerBiometric}
            style={({ pressed }) => [
              styles.bioButton,
              pressed && styles.bioButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Unlock with fingerprint"
          >
            <Text style={styles.bioButtonIcon}>{'\u{1F512}'}</Text>
          </Pressable>
        )}
      </View>

      {/* Calculator Keypad */}
      <CalcKeypad
        onButtonPress={handleButtonPress}
        memoryHasValue={memoryHasValue}
      />
    </SafeAreaView>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.calcBackground,
  },
  displayWrapper: {
    flex: 1,
  },
  bioButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  bioButtonPressed: {
    opacity: 1,
  },
  bioButtonIcon: {
    fontSize: 18,
  },
});
