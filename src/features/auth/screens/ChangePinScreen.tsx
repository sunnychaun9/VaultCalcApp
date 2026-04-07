/**
 * VaultCalc - Premium Change PIN Screen
 *
 * 3-phase flow for changing the vault PIN with premium dark UI:
 * 1. Verify current PIN
 * 2. Enter new PIN
 * 3. Confirm new PIN
 *
 * @see FEATURE_INDEX.md AUTH-005, AUTH-010
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { attemptPinAuth, changePin, getPinRules } from '../services/authService';
import { handleFailedAttempt } from '../services/failedAttempts';
import { useActivityTracker } from '../hooks';
import { useShakeAnimation, useDotScaleAnimations, useTapHaptic } from '../hooks/useLockAnimations';
import { typography, spacing } from '@shared/theme';
import { Icon } from '@shared/components/Icon';
import { BG_TOP, BG_BOTTOM, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, CARD_BG, CARD_BORDER } from '../components/LockScreenContainer';

type Phase = 'verify' | 'create' | 'confirm';

const PIN_RULES = getPinRules();
const ACCENT = '#3B82F6';
const ERROR_COLOR = '#EF4444';
const DOT_EMPTY = 'rgba(100, 116, 139, 0.3)';
const DOT_FILLED = ACCENT;
const KEY_BG = 'rgba(51, 65, 85, 0.5)';
const KEY_BG_PRESSED = 'rgba(71, 85, 105, 0.7)';

const PHASE_CONFIG: Record<Phase, { title: string; instruction: string; buttonLabel: string }> = {
  verify: { title: 'Current PIN', instruction: 'Enter your current PIN', buttonLabel: 'Verify' },
  create: { title: 'New PIN', instruction: `Enter a new ${PIN_RULES.MIN_LENGTH}-${PIN_RULES.MAX_LENGTH} digit PIN`, buttonLabel: 'Continue' },
  confirm: { title: 'Confirm PIN', instruction: 'Re-enter your new PIN to confirm', buttonLabel: 'Change PIN' },
};

export function ChangePinScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { onActivity } = useActivityTracker();

  const [phase, setPhase] = useState<Phase>('verify');
  const [currentInput, setCurrentInput] = useState('');
  const [verifiedOldPin, setVerifiedOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const config = PHASE_CONFIG[phase];
  const { shakeValue, triggerShake } = useShakeAnimation();
  const { scales, animateDotIn, resetAll } = useDotScaleAnimations(PIN_RULES.MAX_LENGTH);
  const tap = useTapHaptic();

  const prevLength = useRef(0);
  useEffect(() => {
    const len = currentInput.length;
    if (len > prevLength.current && len <= PIN_RULES.MAX_LENGTH) {
      animateDotIn(len - 1);
    } else if (len < prevLength.current) {
      for (let i = len; i < prevLength.current; i++) {
        scales[i].setValue(0);
      }
    }
    prevLength.current = len;
  }, [currentInput.length, animateDotIn, scales]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (isProcessing) return;
      onActivity();
      setError(null);
      tap();

      if (key === 'backspace') {
        setCurrentInput((prev) => prev.slice(0, -1));
      } else if (key === 'clear') {
        setCurrentInput('');
        resetAll();
      } else if (currentInput.length < PIN_RULES.MAX_LENGTH) {
        setCurrentInput((prev) => prev + key);
      }
    },
    [currentInput.length, isProcessing, onActivity, tap, resetAll]
  );

  const handleContinue = useCallback(async () => {
    if (isProcessing) return;
    onActivity();

    if (currentInput.length < PIN_RULES.MIN_LENGTH) {
      setError(`PIN must be at least ${PIN_RULES.MIN_LENGTH} digits`);
      triggerShake();
      return;
    }

    if (phase === 'verify') {
      setIsProcessing(true);
      try {
        const result = await attemptPinAuth(currentInput);
        if (result.success) {
          setVerifiedOldPin(currentInput);
          setCurrentInput('');
          resetAll();
          setPhase('create');
        } else {
          handleFailedAttempt();
          setError('Incorrect PIN');
          setCurrentInput('');
          resetAll();
          triggerShake();
        }
      } catch {
        setError('Verification failed');
        setCurrentInput('');
        resetAll();
        triggerShake();
      } finally {
        setIsProcessing(false);
      }
    } else if (phase === 'create') {
      setNewPin(currentInput);
      setCurrentInput('');
      resetAll();
      setPhase('confirm');
    } else {
      if (currentInput !== newPin) {
        setError('PINs do not match');
        setCurrentInput('');
        resetAll();
        triggerShake();
        return;
      }

      setIsProcessing(true);
      try {
        const result = await changePin(verifiedOldPin, newPin);
        if (result.success) {
          navigation.goBack();
        } else {
          setError(result.error ?? 'Failed to change PIN');
          triggerShake();
        }
      } catch {
        setError('An error occurred');
        triggerShake();
      } finally {
        setIsProcessing(false);
      }
    }
  }, [phase, currentInput, newPin, verifiedOldPin, isProcessing, navigation, onActivity, triggerShake, resetAll]);

  const handleBack = useCallback(() => {
    onActivity();
    if (phase === 'confirm') {
      setPhase('create');
      setCurrentInput('');
      setError(null);
      resetAll();
    } else if (phase === 'create') {
      setPhase('verify');
      setCurrentInput('');
      setNewPin('');
      setVerifiedOldPin('');
      setError(null);
      resetAll();
    } else {
      navigation.goBack();
    }
  }, [phase, navigation, onActivity, resetAll]);

  const canContinue = currentInput.length >= PIN_RULES.MIN_LENGTH;
  const dotCount = Math.max(currentInput.length, PIN_RULES.MIN_LENGTH);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_TOP} />
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="rgba(255,255,255,0.9)" />
          </Pressable>
          <View style={styles.lockIconWrapper}>
            <Icon name="lock" size={48} color="rgba(255,255,255,0.9)" />
          </View>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.subtitle}>{config.instruction}</Text>
        </View>

        {/* PIN dots */}
        <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeValue }] }]}>
          <View style={styles.dotsRow}>
            {Array.from({ length: dotCount }).map((_, index) => {
              const isFilled = index < currentInput.length;
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
          <Text style={styles.lengthIndicator}>{currentInput.length} / {PIN_RULES.MAX_LENGTH}</Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </Animated.View>

        {/* Keypad */}
        <View style={styles.cardWrapper}>
          <View style={styles.card}>
            <View style={styles.keypad}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((key) => (
                <Pressable
                  key={key}
                  onPress={() => handleKeyPress(key)}
                  style={({ pressed }) => [
                    styles.keypadButton,
                    pressed && styles.keypadButtonPressed,
                    (key === 'clear' || key === 'backspace') && styles.keypadButtonAction,
                  ]}
                >
                  <Text style={[styles.keypadButtonText, (key === 'clear' || key === 'backspace') && styles.keypadButtonTextAction]}>
                    {key === 'backspace' ? '\u232B' : key === 'clear' ? 'C' : key}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Continue */}
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
              {isProcessing ? 'Processing...' : config.buttonLabel}
            </Text>
          </Pressable>
        </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_TOP },
  bgTop: { ...StyleSheet.absoluteFillObject, backgroundColor: BG_TOP },
  bgBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%', backgroundColor: BG_BOTTOM, borderTopLeftRadius: 40, borderTopRightRadius: 40 },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: { alignItems: 'center', paddingTop: 20 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start', marginLeft: spacing.md },
  backButtonText: { fontSize: 24, color: TEXT_PRIMARY },
  lockIconWrapper: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(59, 130, 246, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  lockIcon: { fontSize: 20 },
  title: { ...typography.headlineMedium, color: TEXT_PRIMARY, fontWeight: '600', marginBottom: spacing.xxs },
  subtitle: { ...typography.bodyMedium, color: TEXT_SECONDARY, textAlign: 'center' },
  dotsContainer: { alignItems: 'center', paddingVertical: spacing.xl },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm, paddingHorizontal: spacing.md },
  pinDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  pinDotExtra: { borderStyle: 'dashed' },
  lengthIndicator: { ...typography.labelSmall, color: TEXT_MUTED },
  errorText: { ...typography.bodyMedium, color: ERROR_COLOR, textAlign: 'center', marginTop: spacing.xs },
  cardWrapper: { flexGrow: 1, flexShrink: 0, justifyContent: 'center', paddingHorizontal: spacing.lg },
  card: { backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: CARD_BORDER, padding: spacing.md, elevation: 8 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, maxWidth: 72 * 3 + spacing.sm * 2, alignSelf: 'center' },
  keypadButton: { width: 72, height: 60, borderRadius: 16, backgroundColor: KEY_BG, justifyContent: 'center', alignItems: 'center' },
  keypadButtonPressed: { backgroundColor: KEY_BG_PRESSED },
  keypadButtonAction: { backgroundColor: 'transparent' },
  keypadButtonText: { ...typography.headlineMedium, color: TEXT_PRIMARY },
  keypadButtonTextAction: { ...typography.titleLarge, color: TEXT_SECONDARY },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  continueButton: { backgroundColor: ACCENT, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  continueButtonPressed: { opacity: 0.85 },
  continueButtonDisabled: { backgroundColor: 'rgba(51, 65, 85, 0.5)' },
  continueButtonText: { ...typography.labelLarge, color: '#FFFFFF' },
  continueButtonTextDisabled: { color: TEXT_MUTED },
});
