/**
 * VaultCalc - Premium Pattern Setup Screen
 *
 * Screen for setting up and confirming a pattern lock.
 * Premium dark theme with glass card and smooth animations.
 *
 * Two-phase flow: Draw pattern -> Confirm pattern -> Save.
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
import { setupPattern, validatePattern, MIN_PATTERN_LENGTH } from '../services/patternManager';
import { useSettingsStore } from '@store/settingsStore';
import { useActivityTracker } from '../hooks';
import { useShakeAnimation, useSuccessAnimation } from '../hooks/useLockAnimations';
import { typography, spacing } from '@shared/theme';
import { Icon } from '@shared/components/Icon';
import { useTranslation } from '@shared/i18n';
import { BG_TOP, BG_BOTTOM, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, CARD_BG, CARD_BORDER } from '../components/LockScreenContainer';

type SetupPhase = 'draw' | 'confirm';
const ERROR_COLOR = '#EF4444';

export function PatternSetupScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<VaultStackParamList>>();
  const { onActivity } = useActivityTracker();
  const { t } = useTranslation();
  const setUnlockMethod = useSettingsStore(s => s.setUnlockMethod);

  const [phase, setPhase] = useState<SetupPhase>('draw');
  const [pattern, setPattern] = useState<number[]>([]);
  const [savedPattern, setSavedPattern] = useState<number[]>([]);
  const [patternState, setPatternState] = useState<PatternState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { shakeValue, triggerShake } = useShakeAnimation();
  const { opacity: successOpacity, scale: successScale, triggerSuccess } = useSuccessAnimation();

  const handlePatternChange = useCallback((newPattern: number[]) => {
    setPattern(newPattern);
    setPatternState(newPattern.length > 0 ? 'drawing' : 'idle');
    setError(null);
  }, []);

  const handlePatternComplete = useCallback(
    async (completedPattern: number[]) => {
      if (isProcessing) return;

      if (phase === 'draw') {
        const validation = validatePattern(completedPattern);
        if (!validation.valid) {
          setPatternState('error');
          setError(validation.error ?? t('pattern_setup.error_invalid'));
          triggerShake();
          setTimeout(() => {
            setPattern([]);
            setPatternState('idle');
          }, 1000);
          return;
        }

        setPatternState('success');
        setSavedPattern(completedPattern);
        setTimeout(() => {
          setPhase('confirm');
          setPattern([]);
          setPatternState('idle');
          setError(null);
        }, 600);
      } else {
        const matches =
          completedPattern.length === savedPattern.length &&
          completedPattern.every((dot, i) => dot === savedPattern[i]);

        if (!matches) {
          setPatternState('error');
          setError(t('pattern_setup.error_mismatch'));
          triggerShake();
          setTimeout(() => {
            setPattern([]);
            setPatternState('idle');
          }, 1000);
          return;
        }

        setIsProcessing(true);
        setPatternState('success');

        try {
          const result = await setupPattern(savedPattern);
          if (result.success) {
            setUnlockMethod('pattern');
            onActivity();
            triggerSuccess(() => {
              navigation.goBack();
            });
          } else {
            setPatternState('error');
            setError(result.error ?? t('pattern_setup.error_save_failed'));
            triggerShake();
          }
        } catch {
          setPatternState('error');
          setError(t('pattern_setup.error_generic'));
          triggerShake();
        } finally {
          setIsProcessing(false);
        }
      }
    },
    [phase, savedPattern, isProcessing, onActivity, navigation, setUnlockMethod, triggerShake, triggerSuccess]
  );

  const handleBack = useCallback(() => {
    onActivity();
    if (phase === 'confirm') {
      setPhase('draw');
      setPattern([]);
      setSavedPattern([]);
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
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Icon name="arrow-left" size={24} color="rgba(255,255,255,0.9)" />
            </Pressable>
            <View style={styles.lockIconWrapper}>
              <Icon name="lock" size={48} color="rgba(255,255,255,0.9)" />
            </View>
            <Text style={styles.title}>
              {phase === 'draw' ? t('pattern_setup.draw_title') : t('pattern_setup.confirm_title')}
            </Text>
            <Text style={styles.subtitle}>
              {phase === 'draw'
                ? t('pattern_setup.draw_subtitle')
                : t('pattern_setup.confirm_subtitle')}
            </Text>
          </View>

          {/* Pattern grid in glass card */}
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

            {/* Status */}
            <Text style={styles.dotCount}>
              {pattern.length > 0 ? t('pattern_setup.dots_selected', { count: pattern.length }) : ' '}
            </Text>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {isProcessing && (
              <Text style={styles.processingText}>{t('pattern_setup.saving')}</Text>
            )}
            <View style={styles.trustRow}>
              <Icon name="shield" size={16} color="rgba(255,255,255,0.4)" />
              <Text style={styles.trustText}>{t('pattern_setup.encryption_badge')}</Text>
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
  dotCount: { ...typography.labelSmall, color: TEXT_MUTED, marginTop: spacing.md },
  errorText: { ...typography.bodyMedium, color: ERROR_COLOR, textAlign: 'center', marginTop: spacing.xs },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, alignItems: 'center', gap: spacing.md },
  processingText: { ...typography.bodyMedium, color: TEXT_SECONDARY },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, opacity: 0.6 },
  trustIcon: { fontSize: 12 },
  trustText: { ...typography.labelSmall, color: TEXT_MUTED },
});
