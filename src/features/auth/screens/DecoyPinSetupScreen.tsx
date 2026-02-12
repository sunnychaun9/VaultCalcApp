/**
 * VaultCalc - Decoy PIN Setup Screen
 *
 * 3-phase flow for setting up a decoy vault PIN:
 * 1. Verify primary PIN (security gate)
 * 2. Enter decoy PIN (must differ from primary)
 * 3. Confirm decoy PIN
 *
 * Also allows removing an existing decoy PIN.
 *
 * @see FEATURE_INDEX.md DECOY-001
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
import { attemptPinAuth, setupPin, getPinRules } from '../services/authService';
import { clearDecoyPinCredentials } from '../services/pinStorage';
import { handleFailedAttempt } from '../services/failedAttempts';
import { useActivityTracker } from '../hooks';
import { useSettingsStore } from '@store/settingsStore';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { alert } from '@store/alertStore';

/** Setup phases */
type Phase = 'verify' | 'create' | 'confirm';

/** PIN rules */
const PIN_RULES = getPinRules();

/**
 * Phase configuration for display text
 */
const PHASE_CONFIG: Record<Phase, { title: string; instruction: string; buttonLabel: string }> = {
  verify: {
    title: 'Verify PIN',
    instruction: 'Enter your primary PIN to continue',
    buttonLabel: 'Verify',
  },
  create: {
    title: 'Decoy PIN',
    instruction: `Enter a ${PIN_RULES.MIN_LENGTH}-${PIN_RULES.MAX_LENGTH} digit decoy PIN`,
    buttonLabel: 'Continue',
  },
  confirm: {
    title: 'Confirm Decoy',
    instruction: 'Re-enter decoy PIN to confirm',
    buttonLabel: 'Set Decoy PIN',
  },
};

/**
 * Decoy PIN Setup Screen Component
 *
 * Three-phase decoy PIN setup:
 * 1. Verify: Enter primary PIN → attemptPinAuth()
 * 2. Create: Enter decoy PIN (must differ from primary)
 * 3. Confirm: Re-enter decoy PIN → setupPin(pin, true)
 *
 * If decoy is already configured, shows option to remove it.
 */
export function DecoyPinSetupScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation();
  const { onActivity } = useActivityTracker();

  const decoyVaultConfigured = useSettingsStore(s => s.decoyVaultConfigured);
  const setDecoyVaultConfigured = useSettingsStore(s => s.setDecoyVaultConfigured);

  // State
  const [phase, setPhase] = useState<Phase>('verify');
  const [currentInput, setCurrentInput] = useState('');
  const [verifiedPrimaryPin, setVerifiedPrimaryPin] = useState('');
  const [decoyPin, setDecoyPin] = useState('');
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
   * Handle continue/verify/set button press
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
      // Verify primary PIN
      setIsProcessing(true);
      try {
        const result = await attemptPinAuth(currentInput);
        if (result.success && !result.isDecoy) {
          setVerifiedPrimaryPin(currentInput);
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
      // Check that decoy PIN differs from primary
      if (currentInput === verifiedPrimaryPin) {
        setError('Decoy PIN must differ from primary PIN');
        setCurrentInput('');
        Vibration.vibrate(50);
        return;
      }
      setDecoyPin(currentInput);
      setCurrentInput('');
      setPhase('confirm');
    } else {
      // Confirm phase — check match and save
      if (currentInput !== decoyPin) {
        setError('PINs do not match');
        setCurrentInput('');
        Vibration.vibrate(50);
        return;
      }

      setIsProcessing(true);
      try {
        const result = await setupPin(decoyPin, true);
        if (result.success) {
          setDecoyVaultConfigured(true);
          navigation.goBack();
        } else {
          setError(result.error ?? 'Failed to set decoy PIN');
          Vibration.vibrate(50);
        }
      } catch {
        setError('An error occurred');
        Vibration.vibrate(50);
      } finally {
        setIsProcessing(false);
      }
    }
  }, [phase, currentInput, decoyPin, verifiedPrimaryPin, isProcessing, navigation, onActivity, setDecoyVaultConfigured]);

  /**
   * Handle removing the existing decoy PIN
   */
  const handleRemoveDecoy = useCallback(() => {
    onActivity();
    alert(
      'Remove Decoy Vault',
      'This will remove the decoy PIN. Any files in the decoy vault will remain but won\'t be accessible until a new decoy PIN is set.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            clearDecoyPinCredentials();
            setDecoyVaultConfigured(false);
            navigation.goBack();
          },
        },
      ]
    );
  }, [onActivity, navigation, setDecoyVaultConfigured]);

  /**
   * Handle back button
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
      setDecoyPin('');
      setVerifiedPrimaryPin('');
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

        {/* Remove decoy option (only shown in verify phase when decoy is configured) */}
        {phase === 'verify' && decoyVaultConfigured && (
          <Pressable
            onPress={handleRemoveDecoy}
            style={styles.removeButton}
            accessibilityRole="button"
            accessibilityLabel="Remove decoy vault"
          >
            <Text style={styles.removeButtonText}>Remove existing decoy</Text>
          </Pressable>
        )}
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
  removeButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  removeButtonText: {
    ...typography.bodyMedium,
    color: c.error,
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
