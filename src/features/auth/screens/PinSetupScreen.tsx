/**
 * VaultCalc - Premium PIN Setup Screen (Redesigned)
 *
 * Features:
 * - SVG gradient background (deep dark to slate)
 * - Glassmorphism card with frosted border
 * - Animated PIN dots with glow halos on fill
 * - Circular keypad buttons with spring press animation
 * - Lock icon with breathing pulse animation
 * - Shake + red flash on error
 * - Recovery question setup (phase 3)
 *
 * @see FEATURE_INDEX.md AUTH-004, AUTH-010
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  Animated,
  StatusBar,
  KeyboardAvoidingView,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Defs, LinearGradient, Stop, Rect, RadialGradient } from 'react-native-svg';
import { setupPin, getPinRules } from '../services/authService';
import { SECURITY_QUESTIONS, setupRecovery } from '../services/recoveryService';
import { typography, spacing } from '@shared/theme';
import { trackEvent } from '@services/analytics';
import { Icon } from '@shared/components/Icon';
import {
  useShakeAnimation,
  useDotScaleAnimations,
  useTapHaptic,
  useLockIconPulse,
} from '../hooks/useLockAnimations';
import type { RootStackParamList, RootStackScreenProps } from '@typedefs/navigation';

type SetupMode = 'create' | 'confirm' | 'recovery';

const PIN_RULES = getPinRules();

// ── Premium dark palette ──
const BG_TOP = '#0A0E1A';
const BG_BOTTOM = '#141B2D';
const ACCENT = '#3B82F6';
const ACCENT_GLOW = 'rgba(59, 130, 246, 0.35)';
const ERROR_COLOR = '#EF4444';
const ERROR_GLOW = 'rgba(239, 68, 68, 0.30)';
const TEXT_PRIMARY = '#F1F5F9';
const TEXT_SECONDARY = '#94A3B8';
const TEXT_MUTED = '#64748B';
const CARD_BG = 'rgba(30, 41, 59, 0.55)';
const CARD_BORDER = 'rgba(100, 116, 139, 0.15)';
const DOT_EMPTY = 'rgba(100, 116, 139, 0.25)';
const KEY_BG = 'rgba(51, 65, 85, 0.40)';
const KEY_BG_PRESSED = 'rgba(71, 85, 105, 0.65)';

// Keypad layout
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'] as const;
const KEY_SIZE = 68;

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

  // Recovery question state
  const [selectedQuestionId, setSelectedQuestionId] = useState(0);
  const [securityAnswer, setSecurityAnswer] = useState('');

  const scrollRef = useRef<ScrollView>(null);

  const currentPin = mode === 'create' ? pin : confirmPin;
  const setCurrentPin = mode === 'create' ? setPin : setConfirmPin;

  const { shakeValue, triggerShake } = useShakeAnimation();
  const { scales, glows, animateDotIn, resetAll } = useDotScaleAnimations(PIN_RULES.MAX_LENGTH);
  const { pulseScale, pulseOpacity } = useLockIconPulse();
  const tap = useTapHaptic();

  // Recovery entry animations
  const recoveryFade = useRef(new Animated.Value(0)).current;
  const recoverySlide = useRef(new Animated.Value(30)).current;
  const questionAnims = useMemo(
    () => SECURITY_QUESTIONS.map(() => new Animated.Value(0)),
    [],
  );
  const answerFade = useRef(new Animated.Value(0)).current;
  const inputBorderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mode === 'recovery') {
      // Card fade-in + slide-up
      Animated.parallel([
        Animated.timing(recoveryFade, {
          toValue: 1, duration: 400, useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(recoverySlide, {
          toValue: 0, duration: 400, useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();

      // Staggered question rows
      const stagger = questionAnims.map((anim, i) =>
        Animated.timing(anim, {
          toValue: 1, duration: 300, delay: 200 + i * 50,
          useNativeDriver: true, easing: Easing.out(Easing.cubic),
        }),
      );
      Animated.stagger(50, stagger).start();

      // Answer section fades in after questions
      Animated.timing(answerFade, {
        toValue: 1, duration: 350,
        delay: 200 + SECURITY_QUESTIONS.length * 50 + 100,
        useNativeDriver: true, easing: Easing.out(Easing.cubic),
      }).start();
    }
  }, [mode, recoveryFade, recoverySlide, questionAnims, answerFade]);

  const handleInputFocus = useCallback(() => {
    Animated.timing(inputBorderAnim, {
      toValue: 1, duration: 250, useNativeDriver: false,
    }).start();
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  }, [inputBorderAnim]);

  const handleInputBlur = useCallback(() => {
    Animated.timing(inputBorderAnim, {
      toValue: 0, duration: 250, useNativeDriver: false,
    }).start();
  }, [inputBorderAnim]);

  const inputBorderColor = inputBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(100, 116, 139, 0.1)', ACCENT],
  });

  // Animate dot when currentPin length increases
  const prevLength = useRef(0);
  useEffect(() => {
    const len = currentPin.length;
    if (len > prevLength.current && len <= PIN_RULES.MAX_LENGTH) {
      animateDotIn(len - 1);
    } else if (len < prevLength.current) {
      for (let i = len; i < prevLength.current; i++) {
        scales[i].setValue(0);
        glows[i].setValue(0);
      }
    }
    prevLength.current = len;
  }, [currentPin.length, animateDotIn, scales, glows]);

  // Per-key press animation (spring scale)
  const keyScales = useRef(KEYS.map(() => new Animated.Value(1))).current;

  const handleKeyPressIn = useCallback((index: number) => {
    Animated.spring(keyScales[index], {
      toValue: 0.88,
      friction: 8,
      tension: 300,
      useNativeDriver: true,
    }).start();
  }, [keyScales]);

  const handleKeyPressOut = useCallback((index: number) => {
    Animated.spring(keyScales[index], {
      toValue: 1,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start();
  }, [keyScales]);

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

  const finishSetup = useCallback(() => {
    if (isInitialSetup) {
      navigation.replace('HowItWorks');
    } else {
      navigation.goBack();
    }
  }, [isInitialSetup, navigation]);

  const handleSaveRecovery = useCallback(async () => {
    if (isProcessing) return;
    const trimmed = securityAnswer.trim();
    if (trimmed.length < 1) {
      setError('Type an answer you\'ll remember');
      triggerShake();
      return;
    }
    setIsProcessing(true);
    try {
      const result = await setupRecovery(selectedQuestionId, trimmed);
      if (result.success) {
        finishSetup();
      } else {
        setError(result.error ?? 'Couldn\'t save recovery. Try again.');
        triggerShake();
      }
    } catch {
      setError('Something went wrong. Please try again.');
      triggerShake();
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, securityAnswer, selectedQuestionId, triggerShake, finishSetup]);

  const handleContinue = useCallback(async () => {
    if (isProcessing) return;

    if (mode === 'recovery') {
      await handleSaveRecovery();
      return;
    }

    if (currentPin.length < PIN_RULES.MIN_LENGTH) {
      setError(`Enter at least ${PIN_RULES.MIN_LENGTH} digits`);
      triggerShake();
      return;
    }

    if (mode === 'create') {
      setMode('confirm');
      setError(null);
      resetAll();
    } else {
      if (pin !== confirmPin) {
        setError('Those PINs didn\'t match. Try again.');
        setConfirmPin('');
        resetAll();
        triggerShake();
        return;
      }

      setIsProcessing(true);
      try {
        const result = await setupPin(pin);
        if (result.success) {
          // Only count initial setup — not PIN changes — as funnel completion.
          if (isInitialSetup) {
            trackEvent('pin_setup_completed', { method: 'pin' });
          }
          setMode('recovery');
          setError(null);
        } else {
          setError(result.error ?? 'Couldn\'t save your PIN. Try again.');
          triggerShake();
        }
      } catch {
        setError('Something went wrong. Please try again.');
        triggerShake();
      } finally {
        setIsProcessing(false);
      }
    }
  }, [mode, currentPin, pin, confirmPin, isProcessing, triggerShake, resetAll, handleSaveRecovery]);

  const handleBack = useCallback(() => {
    if (mode === 'recovery') {
      finishSetup();
    } else if (mode === 'confirm') {
      setMode('create');
      setConfirmPin('');
      setError(null);
      resetAll();
    } else if (!isInitialSetup) {
      navigation.goBack();
    }
  }, [mode, isInitialSetup, navigation, resetAll, finishSetup]);

  const canContinue = mode === 'recovery'
    ? securityAnswer.trim().length > 0
    : currentPin.length >= PIN_RULES.MIN_LENGTH;

  const dotCount = Math.max(currentPin.length, PIN_RULES.MIN_LENGTH);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_TOP} translucent={false} />

      {/* SVG gradient background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="pinBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={BG_TOP} />
              <Stop offset="0.5" stopColor={BG_BOTTOM} />
              <Stop offset="1" stopColor="#0F1629" />
            </LinearGradient>
            {/* Subtle radial glow behind lock icon */}
            <RadialGradient id="lockGlow" cx="50%" cy="15%" rx="40%" ry="25%">
              <Stop offset="0" stopColor={ACCENT} stopOpacity="0.08" />
              <Stop offset="1" stopColor={ACCENT} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#pinBg)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#lockGlow)" />
        </Svg>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior="padding"
        >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            {(mode === 'confirm' || mode === 'recovery' || !isInitialSetup) ? (
              <Pressable onPress={handleBack} style={styles.backButton} hitSlop={12}>
                {mode === 'recovery'
                  ? <Text style={styles.backButtonText}>Skip</Text>
                  : <Icon name="arrow-left" size={22} color="rgba(255,255,255,0.8)" />}
              </Pressable>
            ) : <View style={styles.backButton} />}

            {/* Pulsing lock icon */}
            <Animated.View style={[
              styles.lockIconWrapper,
              { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
            ]}>
              <View style={styles.lockIconGlow} />
              <Icon name={mode === 'recovery' ? 'shield' : 'lock'} size={28} color="rgba(255,255,255,0.95)" />
            </Animated.View>

            <Text style={styles.title}>
              {mode === 'create' ? 'Create your PIN' : mode === 'confirm' ? 'Confirm your PIN' : 'Recovery Setup'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'create'
                ? 'Enter a secure PIN to protect your vault'
                : mode === 'confirm'
                  ? 'Re-enter your PIN to confirm'
                  : 'Set a security question in case you forget'}
            </Text>
          </View>

          {mode === 'recovery' ? (
            <>
              {/* Security Question Picker — animated */}
              <Animated.View style={[
                styles.cardWrapper,
                { opacity: recoveryFade, transform: [{ translateY: recoverySlide }] },
              ]}>
                <View style={styles.card}>
                  <View style={styles.recoveryLabelRow}>
                    <Icon name="shield" size={16} color={ACCENT} />
                    <Text style={styles.recoveryLabel}>Security Question</Text>
                  </View>

                  {SECURITY_QUESTIONS.map((q, idx) => {
                    const isSelected = idx === selectedQuestionId;
                    return (
                      <Animated.View
                        key={idx}
                        style={{
                          opacity: questionAnims[idx],
                          transform: [{
                            translateX: questionAnims[idx].interpolate({
                              inputRange: [0, 1], outputRange: [20, 0],
                            }),
                          }],
                        }}
                      >
                        <Pressable
                          onPress={() => { setSelectedQuestionId(idx); setError(null); }}
                          style={[
                            styles.questionRow,
                            isSelected && styles.questionRowSelected,
                          ]}
                        >
                          <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                            {isSelected && <View style={styles.radioInner} />}
                          </View>
                          <Text style={[
                            styles.questionText,
                            isSelected && styles.questionTextSelected,
                          ]}>{q}</Text>
                        </Pressable>
                      </Animated.View>
                    );
                  })}

                  <Animated.View style={{ opacity: answerFade }}>
                    <View style={[styles.recoveryLabelRow, { marginTop: 20 }]}>
                      <Icon name="lock" size={14} color={TEXT_SECONDARY} />
                      <Text style={styles.recoveryLabel}>Your Answer</Text>
                    </View>
                    <Animated.View style={[styles.answerInputWrapper, { borderColor: inputBorderColor }]}>
                      <TextInput
                        style={styles.answerInput}
                        value={securityAnswer}
                        onChangeText={(t) => { setSecurityAnswer(t); setError(null); }}
                        placeholder="Type your answer"
                        placeholderTextColor="rgba(100, 116, 139, 0.5)"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                      />
                    </Animated.View>
                    {error && <Text style={styles.errorText}>{error}</Text>}
                  </Animated.View>
                </View>
              </Animated.View>
            </>
          ) : (
            <>
              {/* PIN dots with glow halos */}
              <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeValue }] }]}>
                <View style={styles.dotsRow}>
                  {Array.from({ length: dotCount }).map((_, index) => {
                    const isFilled = index < currentPin.length;
                    const isError = error !== null && isFilled;
                    const fillColor = isError ? ERROR_COLOR : ACCENT;
                    const glowColor = isError ? ERROR_GLOW : ACCENT_GLOW;

                    const dotScale = scales[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    });
                    const glowOpacity = glows[index];

                    return (
                      <View key={index} style={styles.dotWrapper}>
                        {/* Glow halo (behind the dot) */}
                        <Animated.View
                          style={[
                            styles.dotGlow,
                            {
                              backgroundColor: glowColor,
                              opacity: isFilled ? glowOpacity : 0,
                            },
                          ]}
                        />
                        {/* Dot */}
                        <Animated.View
                          style={[
                            styles.pinDot,
                            {
                              backgroundColor: isFilled ? fillColor : DOT_EMPTY,
                              borderColor: isFilled ? fillColor : 'rgba(100, 116, 139, 0.3)',
                              transform: [{ scale: isFilled ? dotScale : 1 }],
                            },
                            index >= PIN_RULES.MIN_LENGTH && !isFilled && styles.pinDotExtra,
                          ]}
                        />
                      </View>
                    );
                  })}
                </View>

                <Text style={styles.lengthIndicator}>
                  {currentPin.length} / {PIN_RULES.MAX_LENGTH}
                </Text>

                {error && <Text style={styles.errorText}>{error}</Text>}
              </Animated.View>

              {/* Keypad — circular buttons */}
              <View style={styles.keypadWrapper}>
                <View style={styles.keypad}>
                  {KEYS.map((key, keyIndex) => {
                    const isAction = key === 'clear' || key === 'backspace';
                    return (
                      <Animated.View
                        key={key}
                        style={[
                          styles.keyCell,
                          { transform: [{ scale: keyScales[keyIndex] }] },
                        ]}
                      >
                        <Pressable
                          onPress={() => handleKeyPress(key)}
                          onPressIn={() => handleKeyPressIn(keyIndex)}
                          onPressOut={() => handleKeyPressOut(keyIndex)}
                          style={({ pressed }) => [
                            styles.keypadButton,
                            pressed && styles.keypadButtonPressed,
                            isAction && styles.keypadButtonAction,
                          ]}
                          android_ripple={{
                            color: 'rgba(255,255,255,0.08)',
                            borderless: true,
                            radius: KEY_SIZE / 2,
                          }}
                        >
                          <Text
                            style={[
                              styles.keypadButtonText,
                              isAction && styles.keypadButtonTextAction,
                            ]}
                          >
                            {key === 'backspace' ? '\u232B' : key === 'clear' ? 'C' : key}
                          </Text>
                        </Pressable>
                      </Animated.View>
                    );
                  })}
                </View>
              </View>
            </>
          )}

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
                {isProcessing ? 'Saving...' : mode === 'create' ? 'Continue' : mode === 'confirm' ? 'Create PIN' : 'Save Recovery'}
              </Text>
            </Pressable>

            <View style={styles.trustRow}>
              <Icon name="shield" size={14} color="rgba(255,255,255,0.35)" />
              <Text style={styles.trustText}>
                {mode === 'recovery' ? 'Helps recover your PIN if forgotten' : 'Protected with AES-256 encryption'}
              </Text>
            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_TOP },
  safeArea: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // Header
  header: { alignItems: 'center', paddingTop: 16 },
  backButton: {
    minWidth: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'flex-start', marginLeft: spacing.md,
  },
  backButtonText: { fontSize: 16, color: TEXT_PRIMARY, fontWeight: '500' },
  lockIconWrapper: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  lockIconGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  title: {
    ...typography.headlineMedium, color: TEXT_PRIMARY,
    fontWeight: '700', marginBottom: spacing.xxs,
  },
  subtitle: {
    ...typography.bodyMedium, color: TEXT_SECONDARY,
    textAlign: 'center', paddingHorizontal: spacing['2xl'],
  },

  // PIN dots
  dotsContainer: { alignItems: 'center', paddingVertical: spacing.xl },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm, paddingHorizontal: spacing.md },
  dotWrapper: {
    width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  dotGlow: {
    position: 'absolute',
    width: 30, height: 30, borderRadius: 15,
  },
  pinDot: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 2,
  },
  pinDotExtra: { borderStyle: 'dashed' },
  lengthIndicator: { ...typography.labelSmall, color: TEXT_MUTED },
  errorText: {
    ...typography.bodyMedium, color: ERROR_COLOR,
    textAlign: 'center', marginTop: spacing.xs,
  },

  // Keypad
  keypadWrapper: { flexGrow: 1, flexShrink: 0, justifyContent: 'center', paddingHorizontal: spacing.xl },
  keypad: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 16,
    maxWidth: KEY_SIZE * 3 + 16 * 2, alignSelf: 'center',
  },
  keyCell: {
    width: KEY_SIZE, height: KEY_SIZE,
  },
  keypadButton: {
    width: KEY_SIZE, height: KEY_SIZE, borderRadius: KEY_SIZE / 2,
    backgroundColor: KEY_BG,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  keypadButtonPressed: { backgroundColor: KEY_BG_PRESSED },
  keypadButtonAction: { backgroundColor: 'transparent' },
  keypadButtonText: {
    fontSize: 28, fontWeight: '500', color: TEXT_PRIMARY,
    letterSpacing: 0,
  },
  keypadButtonTextAction: {
    fontSize: 22, fontWeight: '400', color: TEXT_SECONDARY,
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    gap: spacing.md, alignItems: 'center',
  },
  continueButton: {
    backgroundColor: ACCENT, paddingVertical: 15, borderRadius: 16,
    alignItems: 'center', width: '100%',
    elevation: 4,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  continueButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  continueButtonDisabled: {
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
    elevation: 0, shadowOpacity: 0,
  },
  continueButtonText: { ...typography.labelLarge, color: '#FFFFFF', fontWeight: '600' },
  continueButtonTextDisabled: { color: TEXT_MUTED },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, opacity: 0.5 },
  trustText: { ...typography.labelSmall, color: TEXT_MUTED },

  // Recovery
  cardWrapper: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  card: {
    backgroundColor: CARD_BG, borderRadius: 24,
    borderWidth: 1, borderColor: CARD_BORDER,
    padding: spacing.lg, elevation: 8,
  },
  recoveryLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm,
  },
  recoveryLabel: { ...typography.labelMedium, color: TEXT_SECONDARY },
  questionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4,
    borderWidth: 1, borderColor: 'transparent',
  },
  questionRowSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.10)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  radioOuter: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: 'rgba(100, 116, 139, 0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  radioOuterSelected: { borderColor: ACCENT },
  radioInner: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT,
  },
  questionText: { ...typography.bodySmall, color: TEXT_SECONDARY, flex: 1 },
  questionTextSelected: { color: ACCENT, fontWeight: '600' },
  answerInputWrapper: {
    borderRadius: 14, borderWidth: 1.5,
    borderColor: 'rgba(100, 116, 139, 0.1)',
    overflow: 'hidden',
  },
  answerInput: {
    backgroundColor: KEY_BG, color: TEXT_PRIMARY,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 16,
  },
});
