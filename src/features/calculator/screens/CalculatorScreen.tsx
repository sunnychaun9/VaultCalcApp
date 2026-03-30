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

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@typedefs/navigation';
import { CalcDisplay, CalcKeypad } from '../components';
import { useCalculator, type PinCheckCallback } from '../hooks';
import { usePinAuth, useBiometricAuth, useFailedAttempts, isPatternConfigured, isPinConfigured } from '@features/auth';
import { isRecoveryConfigured } from '@features/auth/services/recoveryService';
import { useSettingsStore } from '@store/settingsStore';
import { recordIntruderAttempt } from '@services/intruderCamera';
import { colors, useThemeColors, type ColorTokens } from '@shared/theme';
import { useOrientation } from '@shared/hooks';

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
  const { isLandscape } = useOrientation();
  const styles = useMemo(() => createStyles(themeColors, isLandscape), [themeColors, isLandscape]);
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { checkAndAuthenticate } = usePinAuth();
  const { triggerBiometric, showBiometricButton } = useBiometricAuth();
  const unlockMethod = useSettingsStore(s => s.unlockMethod);
  const intruderDetectionEnabled = useSettingsStore(s => s.intruderDetectionEnabled);
  const {
    warningMessage,
    warningLevel,
    lockoutTimeRemaining,
    isLockedOut,
    onFailedAttempt,
    failedAttempts,
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
          recordIntruderAttempt(failedAttempts + 1).catch(() => {});
        }
      }

      return {
        wasAuthAttempt: result.wasAuthAttempt,
        authenticated: result.authenticated,
      };
    },
    [checkAndAuthenticate, isLockedOut, onFailedAttempt, intruderDetectionEnabled, failedAttempts]
  );

  // Auto-navigate to pattern unlock when pattern is the active method
  const navigateToPatternUnlock = useCallback(() => {
    if (unlockMethod === 'pattern' && isPatternConfigured()) {
      rootNav.navigate('PatternUnlock');
    }
  }, [unlockMethod, rootNav]);

  const { display, expression, memoryHasValue, handleButtonPress, history } = useCalculator({
    onPinCheck: handlePinCheck,
  });

  const [showHistory, setShowHistory] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={isLandscape ? ['left', 'right'] : ['top']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.calcBackground}
      />

      <View style={styles.body}>
        {/* Top bar with history + menu icons */}
        {!isLandscape && (
          <View style={styles.topBar}>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setShowHistory(true)} style={styles.topBarIcon}>
              <Text style={styles.topBarIconText}>{'\u{1F553}'}</Text>
            </Pressable>
            <Pressable onPress={() => setShowMenu(!showMenu)} style={styles.topBarIcon}>
              <Text style={styles.topBarIconText}>{'\u22EE'}</Text>
            </Pressable>
          </View>
        )}

        {/* Dropdown menu */}
        {showMenu && (
          <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)}>
            <View style={styles.menuPopup}>
              <Pressable style={styles.menuItem} onPress={() => setShowMenu(false)}>
                <Text style={styles.menuItemText}>Theme</Text>
              </Pressable>
            </View>
          </Pressable>
        )}

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
          {/* Pattern unlock trigger button (AUTH-009) */}
          {unlockMethod === 'pattern' && isPatternConfigured() && (
            <Pressable
              onPress={navigateToPatternUnlock}
              style={({ pressed }) => [
                styles.bioButton,
                { right: 8, left: undefined },
                pressed && styles.bioButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Unlock with pattern"
            >
              <Text style={styles.bioButtonIcon}>{'\u229E'}</Text>
            </Pressable>
          )}
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
          {/* Forgot PIN? — shown after 3+ failed attempts */}
          {failedAttempts >= 3 && isPinConfigured() && isRecoveryConfigured() && (
            <Pressable
              onPress={() => rootNav.navigate('ForgotPin')}
              style={({ pressed }) => [styles.forgotButton, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Forgot PIN"
            >
              <Text style={styles.forgotText}>Forgot PIN?</Text>
            </Pressable>
          )}
        </View>

        {/* Calculator Keypad */}
        <View style={isLandscape ? styles.keypadWrapper : undefined}>
          <CalcKeypad
            onButtonPress={handleButtonPress}
            memoryHasValue={memoryHasValue}
            isLandscape={isLandscape}
          />
        </View>
      </View>

      {/* History modal */}
      <Modal visible={showHistory} animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <Pressable onPress={() => setShowHistory(false)} style={styles.historyBackBtn}>
              <Text style={styles.historyBackText}>{'\u2190'}</Text>
            </Pressable>
            <Text style={styles.historyTitle}>History</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView style={styles.historyScroll} contentContainerStyle={styles.historyScrollContent}>
            {history.length === 0 ? (
              <View style={styles.historyEmpty}>
                <Text style={styles.historyEmptyText}>No history yet</Text>
              </View>
            ) : (
              history.slice().reverse().map((entry, idx) => (
                <View key={idx} style={styles.historyEntry}>
                  <Text style={styles.historyTimestamp}>Just now</Text>
                  <Text style={styles.historyExpression}>{entry.expression}</Text>
                  <Text style={styles.historyResult}>{entry.result}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (c: ColorTokens, isLandscape: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.calcBackground,
  },
  body: {
    flex: 1,
    flexDirection: isLandscape ? 'row' : 'column',
  },
  displayWrapper: {
    flex: isLandscape ? 2 : 1,
  },
  keypadWrapper: {
    flex: 3,
    justifyContent: 'center',
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
  forgotButton: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: c.surfaceContainerHigh,
    opacity: 0.7,
  },
  forgotText: {
    fontSize: 12,
    color: c.accent,
  },
  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 4,
    height: 44,
  },
  topBarIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarIconText: {
    fontSize: 20,
    color: c.textSecondary,
  },
  // Menu popup
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  menuPopup: {
    position: 'absolute',
    top: isLandscape ? 8 : 52,
    right: 12,
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 140,
    elevation: 8,
    zIndex: 101,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 14,
    color: c.textPrimary,
  },
  // History modal
  historyContainer: {
    flex: 1,
    backgroundColor: c.calcBackground,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  historyBackBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyBackText: {
    fontSize: 22,
    color: c.textPrimary,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: c.textPrimary,
    flex: 1,
    marginLeft: 4,
  },
  historyScroll: {
    flex: 1,
  },
  historyScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  historyEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyEmptyText: {
    fontSize: 16,
    color: c.textTertiary,
  },
  historyEntry: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  historyTimestamp: {
    fontSize: 12,
    color: c.textTertiary,
    marginBottom: 8,
  },
  historyExpression: {
    fontSize: 18,
    color: c.textSecondary,
    textAlign: 'right',
  },
  historyResult: {
    fontSize: 24,
    fontWeight: '500',
    color: c.textPrimary,
    textAlign: 'right',
    marginTop: 4,
  },
});
