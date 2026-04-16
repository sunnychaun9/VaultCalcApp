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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, StyleSheet, StatusBar, Animated as RNAnimated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@typedefs/navigation';
import { CalcDisplay, CalcKeypad } from '../components';
import { useCalculator, type PinCheckCallback } from '../hooks';
import { usePinAuth, useBiometricAuth, useFailedAttempts, isPatternConfigured, isPinConfigured } from '@features/auth';
import { isRecoveryConfigured } from '@features/auth/services/recoveryService';
import { useSettingsStore } from '@store/settingsStore';
import { useAuthStore } from '@store/authStore';
import { recordIntruderAttempt, hasCameraPermission } from '@services/intruderCamera';
import { colors, useThemeColors, useCalcThemeColors, calcThemes, type ColorTokens, elevationLevels } from '@shared/theme';
import type { CalcTheme } from '@store/settingsStore';
import { useOrientation } from '@shared/hooks';
import { Icon, IconButton } from '@shared/components/Icon';
import { DecoyExitScreen } from '@features/auth/components';
import { useTranslation } from 'react-i18next';

function formatHistoryTime(timestamp: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60_000) return t('calculator.time_just_now');
  if (diff < 3_600_000) return t('calculator.time_minutes_ago', { count: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t('calculator.time_hours_ago', { count: Math.floor(diff / 3_600_000) });
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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
  const { t } = useTranslation();
  const baseThemeColors = useThemeColors();
  const themeColors = useCalcThemeColors();
  const isDark = baseThemeColors === colors.dark;
  const { isLandscape } = useOrientation();
  const styles = useMemo(() => createStyles(themeColors, isLandscape), [themeColors, isLandscape]);
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { checkAndAuthenticate } = usePinAuth();
  const { triggerBiometric, showBiometricButton } = useBiometricAuth();
  const unlockMethod = useSettingsStore(s => s.unlockMethod);
  const intruderDetectionEnabled = useSettingsStore(s => s.intruderDetectionEnabled);
  const intruderLocationEnabled = useSettingsStore(s => s.intruderLocationEnabled);
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
        // Capture intruder photo if user has enabled the feature and granted permission (SEC-001)
        if (intruderDetectionEnabled) {
          hasCameraPermission().then(granted => {
            if (granted) {
              recordIntruderAttempt(failedAttempts + 1, intruderLocationEnabled).catch(() => {});
            }
          });
        }
      }

      return {
        wasAuthAttempt: result.wasAuthAttempt,
        authenticated: result.authenticated,
      };
    },
    [checkAndAuthenticate, isLockedOut, onFailedAttempt, intruderDetectionEnabled, intruderLocationEnabled, failedAttempts]
  );

  // Auto-navigate to pattern unlock when pattern is the active method
  const navigateToPatternUnlock = useCallback(() => {
    if (unlockMethod === 'pattern' && isPatternConfigured()) {
      rootNav.navigate('PatternUnlock');
    }
  }, [unlockMethod, rootNav]);

  const { display, expression, memoryHasValue, handleButtonPress, history, clearHistory } = useCalculator({
    onPinCheck: handlePinCheck,
  });

  const [showHistory, setShowHistory] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);

  // Calculator theme
  const calcTheme = useSettingsStore(s => s.calcTheme);
  const setCalcTheme = useSettingsStore(s => s.setCalcTheme);

  // Decoy exit overlay (panic mode with decoy exit action)
  const showDecoyExit = useAuthStore(s => s.showDecoyExit);
  const dismissDecoyExit = useAuthStore(s => s.dismissDecoyExit);

  // Secret quick unlock: long-press = when display is "0"
  const quickUnlockEnabled = useSettingsStore(s => s.quickUnlockEnabled);
  const handleEqualsLongPress = useCallback(() => {
    if (!quickUnlockEnabled || display !== '0') return;
    // Directly authenticate and open vault — bypasses PIN
    useAuthStore.getState().authenticate(false);
    rootNav.navigate('Vault' as never);
  }, [quickUnlockEnabled, display, rootNav]);

  // One-time vault hint: show after first vault session when user returns to calculator
  const [showVaultHint, setShowVaultHint] = useState(false);
  const hintOpacity = useRef(new RNAnimated.Value(0)).current;
  const isFirstLaunch = useSettingsStore(s => s.isFirstLaunch);
  const vaultUnlockCount = useSettingsStore(s => s.vaultUnlockCount);

  useEffect(() => {
    // Show hint only once: after first vault unlock, when user lands back on calculator
    if (isFirstLaunch || vaultUnlockCount !== 1) return;
    const timer = setTimeout(() => {
      setShowVaultHint(true);
      RNAnimated.timing(hintOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        RNAnimated.timing(hintOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setShowVaultHint(false);
        });
      }, 5000);
    }, 800);
    return () => clearTimeout(timer);
  }, [vaultUnlockCount, isFirstLaunch, hintOpacity]);

  return (
    <>
    <SafeAreaView style={styles.container} edges={isLandscape ? ['left', 'right'] : ['top']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.calcBackground}
      />

      {/* Subtle gradient background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="calcBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={themeColors.calcBackground} stopOpacity="1" />
              <Stop offset="1" stopColor={themeColors.calcBackgroundGradientEnd} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#calcBg)" />
        </Svg>
      </View>

      <View style={styles.body}>
        {/* Top bar with history + menu icons */}
        {!isLandscape && (
          <View style={styles.topBar}>
            <View style={{ flex: 1 }} />
            <IconButton
              name="clock"
              size={20}
              onPress={() => setShowHistory(true)}
              color={themeColors.textSecondary}
              accessibilityLabel="History"
            />
            <IconButton
              name="more-vertical"
              size={20}
              onPress={() => setShowMenu(!showMenu)}
              color={themeColors.textSecondary}
              accessibilityLabel="Menu"
            />
          </View>
        )}

        {/* Dropdown menu */}
        {showMenu && (
          <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)}>
            <View style={styles.menuPopup}>
              <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); setShowThemePicker(true); }}>
                <Text style={styles.menuItemText}>{t('calculator.theme')}</Text>
              </Pressable>
            </View>
          </Pressable>
        )}

        {/* Calculator Display with warnings */}
        <View style={styles.displayWrapper}>
          <CalcDisplay
            expression={expression}
            result={display}
            history={history.slice(-3)}
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
              <Icon name="grid" size={18} color={themeColors.textSecondary} />
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
              <Icon name="fingerprint" size={18} color={themeColors.textSecondary} />
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
              <Text style={styles.forgotText}>{t('calculator.forgot_pin')}</Text>
            </Pressable>
          )}
        </View>

        {/* Calculator Keypad */}
        <View style={isLandscape ? styles.keypadWrapper : undefined}>
          <CalcKeypad
            onButtonPress={handleButtonPress}
            onEqualsLongPress={quickUnlockEnabled ? handleEqualsLongPress : undefined}
            memoryHasValue={memoryHasValue}
            isLandscape={isLandscape}
          />
        </View>
      </View>

      {/* History modal */}
      <Modal visible={showHistory} animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <IconButton
              name="arrow-left"
              size={22}
              onPress={() => setShowHistory(false)}
              color={themeColors.textPrimary}
              accessibilityLabel="Close history"
              hitSize={44}
            />
            <Text style={styles.historyTitle}>{t('calculator.history_title')}</Text>
            {history.length > 0 ? (
              <Pressable
                onPress={clearHistory}
                style={styles.historyClearBtn}
              >
                <Text style={styles.historyClearText}>{t('calculator.history_clear')}</Text>
              </Pressable>
            ) : (
              <View style={{ width: 44 }} />
            )}
          </View>
          <ScrollView style={styles.historyScroll} contentContainerStyle={styles.historyScrollContent}>
            {history.length === 0 ? (
              <View style={styles.historyEmpty}>
                <Text style={styles.historyEmptyText}>{t('calculator.history_empty')}</Text>
              </View>
            ) : (
              history.slice().reverse().map((entry, idx) => (
                <View key={idx} style={styles.historyEntry}>
                  <Text style={styles.historyTimestamp}>{formatHistoryTime(entry.timestamp, t)}</Text>
                  <Text style={styles.historyExpression}>{entry.expression}</Text>
                  <Text style={styles.historyResult}>{entry.result}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>

    {/* Theme picker modal */}
    <Modal visible={showThemePicker} transparent animationType="fade" onRequestClose={() => setShowThemePicker(false)}>
      <Pressable style={styles.themePickerBackdrop} onPress={() => setShowThemePicker(false)}>
        <View style={styles.themePickerCard}>
          <Text style={styles.themePickerTitle}>{t('calculator.theme_picker_title')}</Text>
          {(Object.keys(calcThemes) as CalcTheme[]).map((key) => {
            const theme = calcThemes[key];
            const isSelected = calcTheme === key;
            const previewColor = isDark ? theme.preview.dark : theme.preview.light;
            return (
              <Pressable
                key={key}
                style={[styles.themePickerRow, isSelected && styles.themePickerRowSelected]}
                onPress={() => { setCalcTheme(key); setShowThemePicker(false); }}
              >
                <View style={[styles.themePickerDot, { backgroundColor: previewColor }]} />
                <Text style={[styles.themePickerLabel, isSelected && styles.themePickerLabelSelected]}>
                  {theme.label}
                </Text>
                {isSelected && <Icon name="check" size={18} color={themeColors.accent} />}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>

    {/* Decoy exit overlay — panic mode with decoy exit action */}
    <DecoyExitScreen visible={showDecoyExit} onDismiss={dismissDecoyExit} />

    {/* One-time vault hint toast */}
    {showVaultHint && (
      <RNAnimated.View style={[styles.vaultHint, { opacity: hintOpacity }]} pointerEvents="none">
        <Text style={styles.vaultHintText}>{t('calculator.vault_hint')}</Text>
      </RNAnimated.View>
    )}
    </>
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
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 140,
    ...elevationLevels.level2.shadow,
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
  historyClearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyClearText: {
    fontSize: 14,
    color: c.accent,
    fontWeight: '500',
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
  // Theme picker modal
  themePickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  themePickerCard: {
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 24,
    width: '80%',
    maxWidth: 320,
  },
  themePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: c.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  themePickerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  themePickerRowSelected: {
    backgroundColor: c.calcButtonPrimary,
  },
  themePickerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 14,
  },
  themePickerLabel: {
    fontSize: 16,
    color: c.textPrimary,
    flex: 1,
  },
  themePickerLabelSelected: {
    fontWeight: '600' as const,
  },
  vaultHint: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    elevation: 8,
  },
  vaultHintText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
