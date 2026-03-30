/**
 * VaultCalc - Forgot PIN Screen
 *
 * Two-phase recovery flow:
 * 1. Answer security question
 * 2. Set a new PIN
 *
 * @see AUTH-RECOVERY
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@typedefs/navigation';
import {
  getSecurityQuestion,
  isRecoveryConfigured,
  verifyRecoveryAnswer,
  resetPinWithRecovery,
} from '../services/recoveryService';
import { getPinRules } from '../services/authService';
import { useShakeAnimation, useDotScaleAnimations, useTapHaptic } from '../hooks/useLockAnimations';
import { typography, spacing } from '@shared/theme';
import { BG_TOP, BG_BOTTOM, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, CARD_BG, CARD_BORDER } from '../components/LockScreenContainer';

type Phase = 'question' | 'newpin' | 'confirmpin';

const PIN_RULES = getPinRules();
const ACCENT = '#3B82F6';
const ERROR_COLOR = '#EF4444';
const KEY_BG = 'rgba(51, 65, 85, 0.5)';
const KEY_BG_PRESSED = 'rgba(71, 85, 105, 0.7)';
const DOT_EMPTY = 'rgba(100, 116, 139, 0.3)';

export function ForgotPinScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [phase, setPhase] = useState<Phase>('question');
  const [answer, setAnswer] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(5);

  const question = getSecurityQuestion();
  const recoveryAvailable = isRecoveryConfigured() && question !== null;

  const { shakeValue, triggerShake } = useShakeAnimation();
  const { scales, animateDotIn, resetAll } = useDotScaleAnimations(PIN_RULES.MAX_LENGTH);
  const tap = useTapHaptic();

  const currentPin = phase === 'newpin' ? newPin : confirmPin;
  const setCurrentPin = phase === 'newpin' ? setNewPin : setConfirmPin;

  // Animate dots
  const prevLength = useRef(0);
  useEffect(() => {
    if (phase === 'question') return;
    const len = currentPin.length;
    if (len > prevLength.current && len <= PIN_RULES.MAX_LENGTH) {
      animateDotIn(len - 1);
    } else if (len < prevLength.current) {
      for (let i = len; i < prevLength.current; i++) {
        scales[i].setValue(0);
      }
    }
    prevLength.current = len;
  }, [currentPin.length, phase, animateDotIn, scales]);

  const handleKeyPress = useCallback((key: string) => {
    if (isProcessing) return;
    setError(null);
    tap();
    if (key === 'backspace') {
      setCurrentPin(prev => prev.slice(0, -1));
    } else if (key === 'clear') {
      setCurrentPin('');
      resetAll();
    } else if (currentPin.length < PIN_RULES.MAX_LENGTH) {
      setCurrentPin(prev => prev + key);
    }
  }, [currentPin.length, isProcessing, setCurrentPin, tap, resetAll]);

  const handleVerifyAnswer = useCallback(async () => {
    if (isProcessing || attemptsLeft <= 0) return;
    const trimmed = answer.trim();
    if (trimmed.length < 1) {
      setError('Please enter your answer');
      triggerShake();
      return;
    }

    setIsProcessing(true);
    try {
      const correct = await verifyRecoveryAnswer(trimmed);
      if (correct) {
        setPhase('newpin');
        setError(null);
        resetAll();
      } else {
        const remaining = attemptsLeft - 1;
        setAttemptsLeft(remaining);
        setError(remaining > 0 ? `Wrong answer. ${remaining} attempt${remaining !== 1 ? 's' : ''} left.` : 'Too many attempts. Please try later.');
        triggerShake();
      }
    } catch {
      setError('Verification failed');
      triggerShake();
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, answer, attemptsLeft, triggerShake, resetAll]);

  const handleContinue = useCallback(async () => {
    if (isProcessing) return;

    if (phase === 'question') {
      await handleVerifyAnswer();
      return;
    }

    if (currentPin.length < PIN_RULES.MIN_LENGTH) {
      setError(`PIN must be at least ${PIN_RULES.MIN_LENGTH} digits`);
      triggerShake();
      return;
    }

    if (phase === 'newpin') {
      setPhase('confirmpin');
      setError(null);
      resetAll();
      prevLength.current = 0;
    } else {
      if (newPin !== confirmPin) {
        setError('PINs do not match');
        setConfirmPin('');
        resetAll();
        prevLength.current = 0;
        triggerShake();
        return;
      }

      setIsProcessing(true);
      try {
        const result = await resetPinWithRecovery(newPin);
        if (result.success) {
          navigation.navigate('Calculator');
        } else {
          setError(result.error ?? 'Failed to reset PIN');
          triggerShake();
        }
      } catch {
        setError('An error occurred');
        triggerShake();
      } finally {
        setIsProcessing(false);
      }
    }
  }, [phase, currentPin, newPin, confirmPin, isProcessing, navigation, triggerShake, resetAll, handleVerifyAnswer]);

  const handleBack = useCallback(() => {
    if (phase === 'confirmpin') {
      setPhase('newpin');
      setConfirmPin('');
      setError(null);
      resetAll();
      prevLength.current = 0;
    } else if (phase === 'newpin') {
      setPhase('question');
      setNewPin('');
      setError(null);
      resetAll();
      prevLength.current = 0;
    } else {
      navigation.goBack();
    }
  }, [phase, navigation, resetAll]);

  const canContinue = phase === 'question'
    ? answer.trim().length > 0 && attemptsLeft > 0
    : currentPin.length >= PIN_RULES.MIN_LENGTH;

  // Not configured — show message
  if (!recoveryAvailable) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={BG_TOP} />
        <View style={styles.bgTop} />
        <View style={styles.bgBottom} />
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.centeredContent}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F512}'}</Text>
            <Text style={styles.title}>No Recovery Set Up</Text>
            <Text style={[styles.subtitle, { marginBottom: 32 }]}>
              Recovery was not configured during PIN setup. Unfortunately, your PIN cannot be reset without it.
            </Text>
            <Pressable onPress={() => navigation.goBack()} style={styles.continueButton}>
              <Text style={styles.continueButtonText}>Go Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const dotCount = Math.max(currentPin.length, PIN_RULES.MIN_LENGTH);

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
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <View style={styles.lockIconWrapper}>
            <Text style={styles.lockIcon}>{phase === 'question' ? '\u{1F511}' : '\u{1F512}'}</Text>
          </View>
          <Text style={styles.title}>
            {phase === 'question' ? 'Forgot PIN' : phase === 'newpin' ? 'New PIN' : 'Confirm PIN'}
          </Text>
          <Text style={styles.subtitle}>
            {phase === 'question'
              ? 'Answer your security question'
              : phase === 'newpin'
                ? `Enter a new ${PIN_RULES.MIN_LENGTH}-${PIN_RULES.MAX_LENGTH} digit PIN`
                : 'Re-enter your new PIN'}
          </Text>
        </View>

        {phase === 'question' ? (
          <Animated.View style={[styles.cardWrapper, { transform: [{ translateX: shakeValue }] }]}>
            <View style={styles.card}>
              <Text style={styles.questionLabel}>Security Question</Text>
              <Text style={styles.questionDisplay}>{question}</Text>
              <TextInput
                style={styles.answerInput}
                value={answer}
                onChangeText={(t) => { setAnswer(t); setError(null); }}
                placeholder="Type your answer"
                placeholderTextColor="rgba(100, 116, 139, 0.5)"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {error && <Text style={styles.errorText}>{error}</Text>}
            </View>
          </Animated.View>
        ) : (
          <>
            {/* PIN dots */}
            <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeValue }] }]}>
              <View style={styles.dotsRow}>
                {Array.from({ length: dotCount }).map((_, index) => {
                  const isFilled = index < currentPin.length;
                  const isErr = error !== null && isFilled;
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
                          backgroundColor: isErr ? ERROR_COLOR : isFilled ? ACCENT : DOT_EMPTY,
                          borderColor: isErr ? ERROR_COLOR : isFilled ? ACCENT : 'rgba(100, 116, 139, 0.4)',
                          transform: [{ scale: isFilled ? dotScale : 1 }],
                        },
                      ]}
                    />
                  );
                })}
              </View>
              <Text style={styles.lengthIndicator}>{currentPin.length} / {PIN_RULES.MAX_LENGTH}</Text>
              {error && <Text style={styles.errorText}>{error}</Text>}
            </Animated.View>

            {/* Keypad */}
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
                        <Text style={[
                          styles.keypadButtonText,
                          (key === 'clear' || key === 'backspace') && styles.keypadButtonTextAction,
                        ]}>
                          {key === 'backspace' ? '\u232B' : key === 'clear' ? 'C' : key}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              </View>
            </View>
          </>
        )}

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
              {isProcessing ? 'Processing...' : phase === 'question' ? 'Verify' : phase === 'newpin' ? 'Continue' : 'Reset PIN'}
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
  centeredContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing['2xl'] },
  header: { alignItems: 'center', paddingTop: 20 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start', marginLeft: spacing.md },
  backButtonText: { fontSize: 24, color: TEXT_PRIMARY },
  lockIconWrapper: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(59, 130, 246, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  lockIcon: { fontSize: 20 },
  title: { ...typography.headlineMedium, color: TEXT_PRIMARY, fontWeight: '600', marginBottom: spacing.xxs },
  subtitle: { ...typography.bodyMedium, color: TEXT_SECONDARY, textAlign: 'center', paddingHorizontal: spacing.lg },
  dotsContainer: { alignItems: 'center', paddingVertical: spacing.xl },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: spacing.sm },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  lengthIndicator: { ...typography.labelSmall, color: TEXT_MUTED },
  errorText: { ...typography.bodyMedium, color: ERROR_COLOR, textAlign: 'center', marginTop: spacing.sm },
  cardWrapper: { flexGrow: 1, flexShrink: 0, justifyContent: 'center', paddingHorizontal: spacing.lg },
  card: { backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: CARD_BORDER, padding: spacing.lg, elevation: 8 },
  questionLabel: { ...typography.labelMedium, color: TEXT_MUTED, marginBottom: spacing.sm },
  questionDisplay: { ...typography.titleMedium, color: TEXT_PRIMARY, marginBottom: spacing.lg },
  answerInput: { backgroundColor: KEY_BG, color: TEXT_PRIMARY, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  keypadButton: { width: 72, height: 60, borderRadius: 16, backgroundColor: KEY_BG, justifyContent: 'center', alignItems: 'center' },
  keypadButtonPressed: { backgroundColor: KEY_BG_PRESSED },
  keypadButtonAction: { backgroundColor: 'transparent' },
  keypadButtonText: { ...typography.headlineMedium, color: TEXT_PRIMARY },
  keypadButtonTextAction: { ...typography.titleLarge, color: TEXT_SECONDARY },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.md },
  continueButton: { backgroundColor: ACCENT, paddingVertical: 14, borderRadius: 14, alignItems: 'center', width: '100%' },
  continueButtonPressed: { opacity: 0.85 },
  continueButtonDisabled: { backgroundColor: 'rgba(51, 65, 85, 0.5)' },
  continueButtonText: { ...typography.labelLarge, color: '#FFFFFF' },
  continueButtonTextDisabled: { color: TEXT_MUTED },
});
