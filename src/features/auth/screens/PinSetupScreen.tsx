/**
 * VaultCalc - PIN Setup Screen
 *
 * Screen for setting up the initial PIN during onboarding
 * or changing PIN in settings.
 *
 * Features:
 * - Secure PIN entry with masked display
 * - PIN confirmation with match validation
 * - Visual feedback for PIN strength
 * - Numeric keypad for PIN entry
 *
 * @see FEATURE_INDEX.md AUTH-004
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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { setupPin, getPinRules } from '../services/authService';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import type { RootStackParamList, RootStackScreenProps } from '@typedefs/navigation';

/** PIN setup mode */
type SetupMode = 'create' | 'confirm';

/** PIN rules */
const PIN_RULES = getPinRules();

/**
 * PIN Setup Screen Component
 *
 * Two-phase PIN entry:
 * 1. Create: Enter new PIN (4-12 digits)
 * 2. Confirm: Re-enter to verify
 */
export function PinSetupScreen(): React.JSX.Element {
  const route = useRoute<RootStackScreenProps<'PinSetup'>['route']>();
  const isInitialSetup = route.params?.isInitialSetup ?? true;
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'PinSetup'>>();

  // State
  const [mode, setMode] = useState<SetupMode>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Current PIN being entered based on mode
  const currentPin = mode === 'create' ? pin : confirmPin;
  const setCurrentPin = mode === 'create' ? setPin : setConfirmPin;

  /**
   * Handle numeric keypad press
   */
  const handleKeyPress = useCallback(
    (key: string) => {
      if (isProcessing) return;

      setError(null);

      if (key === 'backspace') {
        setCurrentPin((prev) => prev.slice(0, -1));
      } else if (key === 'clear') {
        setCurrentPin('');
      } else if (currentPin.length < PIN_RULES.MAX_LENGTH) {
        setCurrentPin((prev) => prev + key);
      }
    },
    [currentPin.length, isProcessing, setCurrentPin]
  );

  /**
   * Handle continue/create button press
   */
  const handleContinue = useCallback(async () => {
    if (isProcessing) return;

    // Validate PIN length
    if (currentPin.length < PIN_RULES.MIN_LENGTH) {
      setError(`PIN must be at least ${PIN_RULES.MIN_LENGTH} digits`);
      Vibration.vibrate(50);
      return;
    }

    if (mode === 'create') {
      // Move to confirm mode
      setMode('confirm');
      setError(null);
    } else {
      // Verify PINs match
      if (pin !== confirmPin) {
        setError('PINs do not match');
        setConfirmPin('');
        Vibration.vibrate(50);
        return;
      }

      // Store the PIN
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
          Vibration.vibrate(50);
        }
      } catch {
        setError('An error occurred');
        Vibration.vibrate(50);
      } finally {
        setIsProcessing(false);
      }
    }
  }, [mode, currentPin, pin, confirmPin, isProcessing, isInitialSetup, navigation]);

  /**
   * Handle back button (in confirm mode, go back to create)
   */
  const handleBack = useCallback(() => {
    if (mode === 'confirm') {
      setMode('create');
      setConfirmPin('');
      setError(null);
    } else if (!isInitialSetup) {
      navigation.goBack();
    }
  }, [mode, isInitialSetup, navigation]);

  /**
   * Check if continue button should be enabled
   */
  const canContinue = currentPin.length >= PIN_RULES.MIN_LENGTH;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        {(mode === 'confirm' || !isInitialSetup) && (
          <Pressable
            onPress={handleBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
        )}
        <Text style={styles.title}>
          {mode === 'create' ? 'Create PIN' : 'Confirm PIN'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Instructions */}
      <View style={styles.content}>
        <Text style={styles.instruction}>
          {mode === 'create'
            ? `Enter a ${PIN_RULES.MIN_LENGTH}-${PIN_RULES.MAX_LENGTH} digit PIN`
            : 'Re-enter your PIN to confirm'}
        </Text>

        {/* PIN Display */}
        <View style={styles.pinDisplay}>
          {Array.from({ length: Math.max(currentPin.length, PIN_RULES.MIN_LENGTH) }).map(
            (_, index) => (
              <View
                key={index}
                style={[
                  styles.pinDot,
                  index < currentPin.length && styles.pinDotFilled,
                  index >= PIN_RULES.MIN_LENGTH && styles.pinDotExtra,
                ]}
              />
            )
          )}
        </View>

        {/* PIN Length Indicator */}
        <Text style={styles.lengthIndicator}>
          {currentPin.length} / {PIN_RULES.MAX_LENGTH}
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
          accessibilityLabel={mode === 'create' ? 'Continue' : 'Create PIN'}
        >
          <Text
            style={[
              styles.continueButtonText,
              !canContinue && styles.continueButtonTextDisabled,
            ]}
          >
            {isProcessing
              ? 'Saving...'
              : mode === 'create'
                ? 'Continue'
                : 'Create PIN'}
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
