/**
 * VaultCalc - Premium PIN Setup Screen
 *
 * Screen for setting up the initial PIN during onboarding
 * or changing PIN in settings. Premium dark theme with
 * smooth animations and modern UI.
 *
 * Features:
 * - Dark gradient background with glass card
 * - Animated dot fill with spring physics
 * - Shake animation on error
 * - Numeric keypad with haptic feedback
 * - PIN confirmation with match validation
 *
 * @see FEATURE_INDEX.md AUTH-004, AUTH-010
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { setupPin, getPinRules } from '../services/authService';
import { typography, spacing } from '@shared/theme';
import { useShakeAnimation, useDotScaleAnimations, useTapHaptic } from '../hooks/useLockAnimations';
import type { RootStackParamList, RootStackScreenProps } from '@typedefs/navigation';
import { BG_TOP, BG_BOTTOM, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, CARD_BG, CARD_BORDER } from '../components/LockScreenContainer';

type SetupMode = 'create' | 'confirm';

const PIN_RULES = getPinRules();
const ACCENT = '#3B82F6';
const ERROR_COLOR = '#EF4444';
const DOT_EMPTY = 'rgba(100, 116, 139, 0.3)';
const DOT_FILLED = ACCENT;
const KEY_BG = 'rgba(51, 65, 85, 0.5)';
const KEY_BG_PRESSED = 'rgba(71, 85, 105, 0.7)';

export function PinSetupScreen(): React.JSX.Element {
  const route = useRoute<RootStackScreenProps<'PinSetup'>['route']>();
  const isInitialSetup = route.params?.isInitialSetup ?? true;
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'PinSetup'>>();

  const [mode, setMode] = useState<SetupMode>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentPin = mode === 'create' ? pin : confirmPin;
  const setCurrentPin = mode === 'create' ? setPin : setConfirmPin;

  const { shakeValue, triggerShake } = useShakeAnimation();
  const { scales, animateDotIn, resetAll } = useDotScaleAnimations(PIN_RULES.MAX_LENGTH);
  const tap = useTapHaptic();

  // Animate dot when currentPin length increases
  const prevLength = useRef(0);
  useEffect(() => {
    const len = currentPin.length;
    if (len > prevLength.current && len <= PIN_RULES.MAX_LENGTH) {
      animateDotIn(len - 1);
    } else if (len < prevLength.current) {
      // Reset scales for removed dots
      for (let i = len; i < prevLength.current; i++) {
        scales[i].setValue(0);
      }
    }
    prevLength.current = len;
  }, [currentPin.length, animateDotIn, scales]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (isProcessing) return;
      setError(null);
      tap();

      if (key === 'backspace') {
        setCurrentPin((prev) => prev.slice(0, -1));
      } else if (key === 'clear') {
        setCurrentPin('');
        resetAll();
      } else if (currentPin.length < PIN_RULES.MAX_LENGTH) {
        setCurrentPin((prev) => prev + key);
      }
    },
    [currentPin.length, isProcessing, setCurrentPin, tap, resetAll]
  );

  const handleContinue = useCallback(async () => {
    if (isProcessing) return;

    if (currentPin.length < PIN_RULES.MIN_LENGTH) {
      setError(`PIN must be at least ${PIN_RULES.MIN_LENGTH} digits`);
      triggerShake();
      return;
    }

    if (mode === 'create') {
      setMode('confirm');
      setError(null);
      resetAll();
    } else {
      if (pin !== confirmPin) {
        setError('PINs do not match');
        setConfirmPin('');
        resetAll();
        triggerShake();
        return;
      }

      setIsProcessing(true);
      try {
        const result = await setupPin(pin);
        if (result.success) {
          if (isInitialSetup) {
            navigation.replace('HowItWorks');
          } else {
            navigation.goBack();
          }
        } else {
          setError(result.error ?? 'Failed to save PIN');
          triggerShake();
        }
      } catch {
        setError('An error occurred');
        triggerShake();
      } finally {
        setIsProcessing(false);
      }
    }
  }, [mode, currentPin, pin, confirmPin, isProcessing, isInitialSetup, navigation, triggerShake, resetAll]);

  const handleBack = useCallback(() => {
    if (mode === 'confirm') {
      setMode('create');
      setConfirmPin('');
      setError(null);
      resetAll();
    } else if (!isInitialSetup) {
      navigation.goBack();
    }
  }, [mode, isInitialSetup, navigation, resetAll]);

  const canContinue = currentPin.length >= PIN_RULES.MIN_LENGTH;

  const dotCount = Math.max(currentPin.length, PIN_RULES.MIN_LENGTH);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_TOP} />
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          {(mode === 'confirm' || !isInitialSetup) ? (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </Pressable>
          ) : <View style={styles.backButton} />}
          <View style={styles.lockIconWrapper}>
            <Text style={styles.lockIcon}>{'\u{1F512}'}</Text>
          </View>
          <Text style={styles.title}>
            {mode === 'create' ? 'Create PIN' : 'Confirm PIN'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'create'
              ? `Enter a ${PIN_RULES.MIN_LENGTH}-${PIN_RULES.MAX_LENGTH} digit PIN`
              : 'Re-enter your PIN to confirm'}
          </Text>
        </View>

        {/* PIN dots */}
        <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeValue }] }]}>
          <View style={styles.dotsRow}>
            {Array.from({ length: dotCount }).map((_, index) => {
              const isFilled = index < currentPin.length;
              const isError = error !== null && isFilled;
              const dotScale = scales[index].interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              });
              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.pinDot,
                    {
                      backgroundColor: isError ? ERROR_COLOR : isFilled ? DOT_FILLED : DOT_EMPTY,
                      borderColor: isError ? ERROR_COLOR : isFilled ? DOT_FILLED : 'rgba(100, 116, 139, 0.4)',
                      transform: [{ scale: isFilled ? dotScale : 1 }],
                    },
                    index >= PIN_RULES.MIN_LENGTH && !isFilled && styles.pinDotExtra,
                  ]}
                />
              );
            })}
          </View>

          <Text style={styles.lengthIndicator}>
            {currentPin.length} / {PIN_RULES.MAX_LENGTH}
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </Animated.View>

        {/* Keypad in glass card */}
        <View style={styles.cardWrapper}>
          <View style={styles.card}>
            <View style={styles.keypad}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map(
                (key) => (
                  <Pressable
                    key={key}
                    onPress={() => handleKeyPress(key)}
                    style={({ pressed }) => [
                      styles.keypadButton,
                      pressed && styles.keypadButtonPressed,
                      (key === 'clear' || key === 'backspace') && styles.keypadButtonAction,
                    ]}
                  >
                    <Text
                      style={[
                        styles.keypadButtonText,
                        (key === 'clear' || key === 'backspace') && styles.keypadButtonTextAction,
                      ]}
                    >
                      {key === 'backspace' ? '\u232B' : key === 'clear' ? 'C' : key}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          </View>
        </View>

        {/* Continue button */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleContinue}
            disabled={!canContinue || isProcessing}
            style={({ pressed }) => [
              styles.continueButton,
              !canContinue && styles.continueButtonDisabled,
              pressed && canContinue && styles.continueButtonPressed,
            ]}
          >
            <Text style={[styles.continueButtonText, !canContinue && styles.continueButtonTextDisabled]}>
              {isProcessing ? 'Saving...' : mode === 'create' ? 'Continue' : 'Create PIN'}
            </Text>
          </Pressable>

          <View style={styles.trustRow}>
            <Text style={styles.trustIcon}>{'\u{1F6E1}'}</Text>
            <Text style={styles.trustText}>Protected with encryption</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_TOP },
  bgTop: { ...StyleSheet.absoluteFillObject, backgroundColor: BG_TOP },
  bgBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%', backgroundColor: BG_BOTTOM, borderTopLeftRadius: 40, borderTopRightRadius: 40 },
  safeArea: { flex: 1 },
  header: { alignItems: 'center', paddingTop: 20 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start', marginLeft: spacing.md },
  backButtonText: { fontSize: 24, color: TEXT_PRIMARY },
  lockIconWrapper: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(59, 130, 246, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  lockIcon: { fontSize: 20 },
  title: { ...typography.headlineMedium, color: TEXT_PRIMARY, fontWeight: '600', marginBottom: spacing.xxs },
  subtitle: { ...typography.bodyMedium, color: TEXT_SECONDARY, textAlign: 'center' },
  dotsContainer: { alignItems: 'center', paddingVertical: spacing.xl },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: spacing.sm },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  pinDotExtra: { borderStyle: 'dashed' },
  lengthIndicator: { ...typography.labelSmall, color: TEXT_MUTED },
  errorText: { ...typography.bodyMedium, color: ERROR_COLOR, textAlign: 'center', marginTop: spacing.xs },
  cardWrapper: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  card: { backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: CARD_BORDER, padding: spacing.md, elevation: 8 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  keypadButton: { width: 72, height: 60, borderRadius: 16, backgroundColor: KEY_BG, justifyContent: 'center', alignItems: 'center' },
  keypadButtonPressed: { backgroundColor: KEY_BG_PRESSED },
  keypadButtonAction: { backgroundColor: 'transparent' },
  keypadButtonText: { ...typography.headlineMedium, color: TEXT_PRIMARY },
  keypadButtonTextAction: { ...typography.titleLarge, color: TEXT_SECONDARY },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md, alignItems: 'center' },
  continueButton: { backgroundColor: ACCENT, paddingVertical: 14, borderRadius: 14, alignItems: 'center', width: '100%' },
  continueButtonPressed: { opacity: 0.85 },
  continueButtonDisabled: { backgroundColor: 'rgba(51, 65, 85, 0.5)' },
  continueButtonText: { ...typography.labelLarge, color: '#FFFFFF' },
  continueButtonTextDisabled: { color: TEXT_MUTED },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, opacity: 0.6 },
  trustIcon: { fontSize: 12 },
  trustText: { ...typography.labelSmall, color: TEXT_MUTED },
});
