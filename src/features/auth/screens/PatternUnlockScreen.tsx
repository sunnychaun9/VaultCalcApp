/**
 * VaultCalc - Premium Pattern Unlock Screen
 *
 * Full-screen pattern unlock with dark gradient, glass card,
 * smooth animations, and trust indicators.
 *
 * Features:
 * - Dark gradient background with glassmorphism
 * - Pattern drawing with glow effect
 * - Shake animation on wrong pattern
 * - Success fade-out animation
 * - Failed attempt warnings and lockout
 * - "Use PIN instead" toggle
 * - Biometric button
 * - Intruder detection
 *
 * @see AUTH-009, AUTH-010 Premium Lock UI
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@typedefs/navigation';
import { PatternView, type PatternState } from '../components/PatternView';
import { LockScreenContainer, TEXT_SECONDARY } from '../components/LockScreenContainer';
import { attemptPatternAuth } from '../services/patternManager';
import { useAuthStore } from '@store/authStore';
import { useSettingsStore } from '@store/settingsStore';
import { useFailedAttempts, useBiometricAuth } from '../hooks';
import { useShakeAnimation, useSuccessAnimation } from '../hooks/useLockAnimations';
import { recordIntruderAttempt } from '@services/intruderCamera';
import { typography, spacing } from '@shared/theme';

/** Colors for the dark lock screen */
const ACCENT = '#3B82F6';
const ERROR_COLOR = '#EF4444';
const WARNING_COLOR = '#EAB308';

export function PatternUnlockScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { authenticate } = useAuthStore();
  const intruderDetectionEnabled = useSettingsStore(s => s.intruderDetectionEnabled);
  const showPatternPath = useSettingsStore(s => s.showPatternPath);
  const {
    warningMessage,
    warningLevel,
    lockoutTimeRemaining,
    isLockedOut,
    onFailedAttempt,
    failedAttempts,
  } = useFailedAttempts();
  const { triggerBiometric, showBiometricButton } = useBiometricAuth();

  const [pattern, setPattern] = useState<number[]>([]);
  const [patternState, setPatternState] = useState<PatternState>('idle');
  const [isProcessing, setIsProcessing] = useState(false);

  const { shakeValue, triggerShake } = useShakeAnimation();
  const { opacity: successOpacity, scale: successScale, triggerSuccess } = useSuccessAnimation();

  const handlePatternChange = useCallback((p: number[]) => {
    setPattern(p);
    setPatternState(p.length > 0 ? 'drawing' : 'idle');
  }, []);

  const handlePatternComplete = useCallback(
    async (completedPattern: number[]) => {
      if (isProcessing || isLockedOut) return;

      setIsProcessing(true);
      const result = await attemptPatternAuth(completedPattern);
      setIsProcessing(false);

      if (result.success) {
        setPatternState('success');
        authenticate(false);

        triggerSuccess(() => {
          navigation.navigate('Vault');
        });
      } else {
        setPatternState('error');
        triggerShake();
        onFailedAttempt();

        if (intruderDetectionEnabled) {
          recordIntruderAttempt(failedAttempts + 1).catch(() => {});
        }

        setTimeout(() => {
          setPattern([]);
          setPatternState('idle');
        }, 1000);
      }
    },
    [isProcessing, isLockedOut, authenticate, navigation, onFailedAttempt, intruderDetectionEnabled, failedAttempts, triggerShake, triggerSuccess]
  );

  const handleSwitchToPin = useCallback(() => {
    navigation.navigate('Calculator');
  }, [navigation]);

  // Warning color
  const wColor =
    warningLevel === 'danger'
      ? ERROR_COLOR
      : warningLevel === 'warning'
        ? WARNING_COLOR
        : TEXT_SECONDARY;

  // Warning/lockout message
  const displayWarning = isLockedOut && lockoutTimeRemaining
    ? `Locked out. Try again in ${lockoutTimeRemaining}`
    : warningMessage;

  const displayWarningColor = isLockedOut ? ERROR_COLOR : wColor;

  return (
    <Animated.View style={[styles.animatedRoot, { opacity: successOpacity, transform: [{ scale: successScale }] }]}>
      <LockScreenContainer
        title="Draw Pattern"
        warningMessage={displayWarning}
        warningColor={displayWarningColor}
        bottomContent={
          <View style={styles.bottomActions}>
            {/* Switch to PIN */}
            <Pressable
              onPress={handleSwitchToPin}
              style={({ pressed }) => [styles.toggleButton, pressed && styles.togglePressed]}
            >
              <Text style={styles.toggleText}>Use PIN Instead</Text>
            </Pressable>

            {/* Biometric button */}
            {showBiometricButton && (
              <Pressable
                onPress={triggerBiometric}
                style={({ pressed }) => [styles.bioButton, pressed && styles.bioButtonPressed]}
                accessibilityRole="button"
                accessibilityLabel="Unlock with fingerprint"
              >
                <Text style={styles.bioIcon}>{'\u{1F9B6}'}</Text>
              </Pressable>
            )}
          </View>
        }
      >
        {/* Pattern grid inside glass card */}
        <Animated.View style={{ transform: [{ translateX: shakeValue }] }}>
          <PatternView
            pattern={pattern}
            onPatternChange={handlePatternChange}
            onPatternComplete={handlePatternComplete}
            state={patternState}
            showPath={showPatternPath}
            disabled={isProcessing || isLockedOut}
          />
        </Animated.View>
      </LockScreenContainer>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedRoot: {
    flex: 1,
  },
  bottomActions: {
    alignItems: 'center',
    gap: spacing.md,
  },
  toggleButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  togglePressed: {
    opacity: 0.6,
  },
  toggleText: {
    ...typography.labelMedium,
    color: ACCENT,
  },
  bioButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  bioButtonPressed: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  bioIcon: {
    fontSize: 24,
  },
});
