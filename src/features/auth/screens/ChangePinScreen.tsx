/**
 * VaultCalc - Change PIN Screen
 *
 * 3-phase flow for changing the vault PIN:
 * 1. Verify current PIN
 * 2. Enter new PIN
 * 3. Confirm new PIN
 *
 * @see FEATURE_INDEX.md AUTH-005
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { attemptPinAuth, changePin, getPinRules } from '../services/authService';
import { handleFailedAttempt } from '../services/failedAttempts';
import { useActivityTracker } from '../hooks';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';

/** Change PIN phases */
type Phase = 'verify' | 'create' | 'confirm';

/** PIN rules */
const PIN_RULES = getPinRules();

/**
 * Phase configuration for display text
 */
const PHASE_CONFIG: Record<Phase, { title: string; instruction: string; buttonLabel: string }> = {
  verify: {
    title: 'Current PIN',
    instruction: 'Enter your current PIN',
    buttonLabel: 'Verify',
  },
  create: {
    title: 'New PIN',
    instruction: `Enter a new ${PIN_RULES.MIN_LENGTH}-${PIN_RULES.MAX_LENGTH} digit PIN`,
    buttonLabel: 'Continue',
  },
  confirm: {
    title: 'Confirm PIN',
    instruction: 'Re-enter your new PIN to confirm',
    buttonLabel: 'Change PIN',
  },
};

/**
 * Change PIN Screen Component
 *
 * Three-phase PIN change:
 * 1. Verify: Enter current PIN → attemptPinAuth()
 * 2. Create: Enter new PIN (4-12 digits)
 * 3. Confirm: Re-enter new PIN → changePin()
 */
export function ChangePinScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation();
  const { onActivity } = useActivityTracker();

  // State
  const [phase, setPhase] = useState<Phase>('verify');
  const [currentInput, setCurrentInput] = useState('');
  const [verifiedOldPin, setVerifiedOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const config = PHASE_CONFIG[phase];

  /**
   * Handle numeric keypad press
   */
  const handleKeyPress = useCallback(
    (key: string) => {
      if (isProcessing) return;

      onActivity();
      setError(null);

      if (key === 'backspace') {
        setCurrentInput((prev) => prev.slice(0, -1));
      } else if (key === 'clear') {
        setCurrentInput('');
      } else if (currentInput.length < PIN_RULES.MAX_LENGTH) {
        setCurrentInput((prev) => prev + key);
      }
    },
    [currentInput.length, isProcessing, onActivity]
  );

  /**
   * Handle continue/verify/change button press
   */
  const handleContinue = useCallback(async () => {
    if (isProcessing) return;

    onActivity();

    // Validate PIN length
    if (currentInput.length < PIN_RULES.MIN_LENGTH) {
      setError(`PIN must be at least ${PIN_RULES.MIN_LENGTH} digits`);
      Vibration.vibrate(50);
      return;
    }

    if (phase === 'verify') {
      // Verify current PIN
      setIsProcessing(true);
      try {
        const result = await attemptPinAuth(currentInput);
        if (result.success) {
          setVerifiedOldPin(currentInput);
          setCurrentInput('');
          setPhase('create');
        } else {
          handleFailedAttempt();
          setError('Incorrect PIN');
          setCurrentInput('');
          Vibration.vibrate(50);
        }
      } catch {
        setError('Verification failed');
        setCurrentInput('');
        Vibration.vibrate(50);
      } finally {
        setIsProcessing(false);
      }
    } else if (phase === 'create') {
      // Save new PIN and advance to confirm
      setNewPin(currentInput);
      setCurrentInput('');
      setPhase('confirm');
    } else {
      // Confirm phase — check match and save
      if (currentInput !== newPin) {
        setError('PINs do not match');
        setCurrentInput('');
        Vibration.vibrate(50);
        return;
      }

      setIsProcessing(true);
      try {
        const result = await changePin(verifiedOldPin, newPin);
        if (result.success) {
          navigation.goBack();
        } else {
          setError(result.error ?? 'Failed to change PIN');
          Vibration.vibrate(50);
        }
      } catch {
        setError('An error occurred');
        Vibration.vibrate(50);
      } finally {
        setIsProcessing(false);
      }
    }
  }, [phase, currentInput, newPin, verifiedOldPin, isProcessing, navigation, onActivity]);

  /**
   * Handle back button
   * confirm → create → verify → goBack()
   */
  const handleBack = useCallback(() => {
    onActivity();

    if (phase === 'confirm') {
      setPhase('create');
      setCurrentInput('');
      setError(null);
    } else if (phase === 'create') {
      setPhase('verify');
      setCurrentInput('');
      setNewPin('');
      setVerifiedOldPin('');
      setError(null);
    } else {
      navigation.goBack();
    }
  }, [phase, navigation, onActivity]);

  const canContinue = currentInput.length >= PIN_RULES.MIN_LENGTH;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.title}>{config.title}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Instructions */}
      <View style={styles.content}>
        <Text style={styles.instruction}>{config.instruction}</Text>

        {/* PIN Display */}
        <View style={styles.pinDisplay}>
          {Array.from({ length: Math.max(currentInput.length, PIN_RULES.MIN_LENGTH) }).map(
            (_, index) => (
              <View
                key={index}
                style={[
                  styles.pinDot,
                  index < currentInput.length && styles.pinDotFilled,
                  index >= PIN_RULES.MIN_LENGTH && styles.pinDotExtra,
                ]}
              />
            )
          )}
        </View>

        {/* PIN Length Indicator */}
        <Text style={styles.lengthIndicator}>
          {currentInput.length} / {PIN_RULES.MAX_LENGTH}
        </Text>

        {/* Error Message */}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* Numeric Keypad */}
      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map(
          (key) => (
            <Pressable
              key={key}
              onPress={() => handleKeyPress(key)}
              style={({ pressed }) => [
                styles.keypadButton,
                pressed && styles.keypadButtonPressed,
                key === 'clear' && styles.keypadButtonAction,
                key === 'backspace' && styles.keypadButtonAction,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                key === 'backspace' ? 'Delete' : key === 'clear' ? 'Clear' : key
              }
            >
              <Text
                style={[
                  styles.keypadButtonText,
                  (key === 'clear' || key === 'backspace') &&
                    styles.keypadButtonTextAction,
                ]}
              >
                {key === 'backspace' ? '⌫' : key === 'clear' ? 'C' : key}
              </Text>
            </Pressable>
          )
        )}
      </View>

      {/* Continue Button */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue || isProcessing}
          style={({ pressed }) => [
            styles.continueButton,
            !canContinue && styles.continueButtonDisabled,
            pressed && canContinue && styles.continueButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={config.buttonLabel}
        >
          <Text
            style={[
              styles.continueButtonText,
              !canContinue && styles.continueButtonTextDisabled,
            ]}
          >
            {isProcessing ? 'Processing...' : config.buttonLabel}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: c.textPrimary,
  },
  title: {
    ...typography.titleLarge,
    color: c.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  instruction: {
    ...typography.bodyLarge,
    color: c.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  pinDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: c.border,
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  pinDotExtra: {
    borderStyle: 'dashed',
  },
  lengthIndicator: {
    ...typography.labelSmall,
    color: c.textTertiary,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.bodyMedium,
    color: c.error,
    textAlign: 'center',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  keypadButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadButtonPressed: {
    backgroundColor: c.surfaceContainerHigh,
  },
  keypadButtonAction: {
    backgroundColor: 'transparent',
  },
  keypadButtonText: {
    ...typography.headlineMedium,
    color: c.textPrimary,
  },
  keypadButtonTextAction: {
    ...typography.titleLarge,
    color: c.textSecondary,
  },
  footer: {
    padding: spacing.lg,
  },
  continueButton: {
    backgroundColor: c.accent,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonPressed: {
    opacity: 0.9,
  },
  continueButtonDisabled: {
    backgroundColor: c.surfaceContainerHigh,
  },
  continueButtonText: {
    ...typography.labelLarge,
    color: c.textOnAccent,
  },
  continueButtonTextDisabled: {
    color: c.textTertiary,
  },
});
