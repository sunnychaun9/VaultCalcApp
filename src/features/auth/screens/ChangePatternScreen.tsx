/**
 * VaultCalc - Premium Change Pattern Screen
 *
 * Three-phase flow for changing an existing pattern with premium dark UI:
 * 1. Verify current pattern
 * 2. Draw new pattern
 * 3. Confirm new pattern
 *
 * @see AUTH-009, AUTH-010 Premium Lock UI
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Animated, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VaultStackParamList } from '@typedefs/navigation';
import { PatternView, type PatternState } from '../components/PatternView';
import {
  attemptPatternAuth,
  setupPattern,
  validatePattern,
  clearPatternCredentials,
  MIN_PATTERN_LENGTH,
} from '../services/patternManager';
import { useActivityTracker } from '../hooks';
import { useShakeAnimation, useSuccessAnimation } from '../hooks/useLockAnimations';
import { typography, spacing } from '@shared/theme';
import { BG_TOP, BG_BOTTOM, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, CARD_BG, CARD_BORDER } from '../components/LockScreenContainer';

type ChangePhase = 'verify' | 'draw' | 'confirm';
const ERROR_COLOR = '#EF4444';

const titles: Record<ChangePhase, string> = {
  verify: 'Verify Pattern',
  draw: 'New Pattern',
  confirm: 'Confirm Pattern',
};

const instructions: Record<ChangePhase, string> = {
  verify: 'Draw your current pattern',
  draw: `Draw a new pattern (at least ${MIN_PATTERN_LENGTH} dots)`,
  confirm: 'Draw your new pattern again to confirm',
};

export function ChangePatternScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<VaultStackParamList>>();
  const { onActivity } = useActivityTracker();

  const [phase, setPhase] = useState<ChangePhase>('verify');
  const [pattern, setPattern] = useState<number[]>([]);
  const [newPattern, setNewPattern] = useState<number[]>([]);
  const [patternState, setPatternState] = useState<PatternState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { shakeValue, triggerShake } = useShakeAnimation();
  const { opacity: successOpacity, scale: successScale, triggerSuccess } = useSuccessAnimation();

  const handlePatternChange = useCallback((p: number[]) => {
    setPattern(p);
    setPatternState(p.length > 0 ? 'drawing' : 'idle');
    setError(null);
  }, []);

  const handlePatternComplete = useCallback(
    async (completedPattern: number[]) => {
      if (isProcessing) return;

      if (phase === 'verify') {
        setIsProcessing(true);
        const result = await attemptPatternAuth(completedPattern);
        setIsProcessing(false);

        if (result.success) {
          setPatternState('success');
          setTimeout(() => {
            setPhase('draw');
            setPattern([]);
            setPatternState('idle');
            setError(null);
          }, 600);
        } else {
          setPatternState('error');
          setError('Incorrect pattern');
          triggerShake();
          setTimeout(() => { setPattern([]); setPatternState('idle'); }, 1000);
        }
      } else if (phase === 'draw') {
        const validation = validatePattern(completedPattern);
        if (!validation.valid) {
          setPatternState('error');
          setError(validation.error ?? 'Invalid pattern');
          triggerShake();
          setTimeout(() => { setPattern([]); setPatternState('idle'); }, 1000);
          return;
        }

        setPatternState('success');
        setNewPattern(completedPattern);
        setTimeout(() => {
          setPhase('confirm');
          setPattern([]);
          setPatternState('idle');
          setError(null);
        }, 600);
      } else {
        const matches =
          completedPattern.length === newPattern.length &&
          completedPattern.every((dot, i) => dot === newPattern[i]);

        if (!matches) {
          setPatternState('error');
          setError('Patterns do not match');
          triggerShake();
          setTimeout(() => { setPattern([]); setPatternState('idle'); }, 1000);
          return;
        }

        setIsProcessing(true);
        setPatternState('success');

        clearPatternCredentials();
        const result = await setupPattern(newPattern);
        setIsProcessing(false);

        if (result.success) {
          onActivity();
          triggerSuccess(() => navigation.goBack());
        } else {
          setPatternState('error');
          setError(result.error ?? 'Failed to save pattern');
          triggerShake();
        }
      }
    },
    [phase, newPattern, isProcessing, onActivity, navigation, triggerShake, triggerSuccess]
  );

  const handleBack = useCallback(() => {
    onActivity();
    if (phase === 'confirm') {
      setPhase('draw');
      setPattern([]);
      setNewPattern([]);
      setPatternState('idle');
      setError(null);
    } else if (phase === 'draw') {
      setPhase('verify');
      setPattern([]);
      setPatternState('idle');
      setError(null);
    } else {
      navigation.goBack();
    }
  }, [phase, onActivity, navigation]);

  return (
    <Animated.View style={[styles.animatedRoot, { opacity: successOpacity, transform: [{ scale: successScale }] }]}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={BG_TOP} />
        <View style={styles.bgTop} />
        <View style={styles.bgBottom} />

        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </Pressable>
            <View style={styles.lockIconWrapper}>
              <Text style={styles.lockIcon}>{'\u{1F512}'}</Text>
            </View>
            <Text style={styles.title}>{titles[phase]}</Text>
            <Text style={styles.subtitle}>{instructions[phase]}</Text>
          </View>

          <View style={styles.cardWrapper}>
            <View style={styles.card}>
              <Animated.View style={{ transform: [{ translateX: shakeValue }] }}>
                <PatternView
                  pattern={pattern}
                  onPatternChange={handlePatternChange}
                  onPatternComplete={handlePatternComplete}
                  state={patternState}
                  disabled={isProcessing}
                />
              </Animated.View>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          <View style={styles.footer}>
            {isProcessing && (
              <Text style={styles.processingText}>
                {phase === 'verify' ? 'Verifying...' : 'Saving...'}
              </Text>
            )}
            <View style={styles.trustRow}>
              <Text style={styles.trustIcon}>{'\u{1F6E1}'}</Text>
              <Text style={styles.trustText}>Protected with encryption</Text>
            </View>
          </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedRoot: { flex: 1 },
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
  cardWrapper: { flexGrow: 1, flexShrink: 0, justifyContent: 'center', paddingHorizontal: spacing.lg, alignItems: 'center' },
  card: { backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: CARD_BORDER, padding: spacing.lg, elevation: 8, width: '100%' },
  errorText: { ...typography.bodyMedium, color: ERROR_COLOR, textAlign: 'center', marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, alignItems: 'center', gap: spacing.md },
  processingText: { ...typography.bodyMedium, color: TEXT_SECONDARY },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, opacity: 0.6 },
  trustIcon: { fontSize: 12 },
  trustText: { ...typography.labelSmall, color: TEXT_MUTED },
});
