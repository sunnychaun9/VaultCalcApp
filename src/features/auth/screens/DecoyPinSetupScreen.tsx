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
  ScrollView,
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
import { Icon } from '@shared/components/Icon';
import { alert } from '@store/alertStore';
import { useTranslation } from '@shared/i18n';

/** Setup phases */
type Phase = 'verify' | 'create' | 'confirm';

/** PIN rules */
const PIN_RULES = getPinRules();

/* Phase config is built inside the component for i18n access */

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

  const { t } = useTranslation();
  const decoyVaultConfigured = useSettingsStore(s => s.decoyVaultConfigured);
  const setDecoyVaultConfigured = useSettingsStore(s => s.setDecoyVaultConfigured);

  // State
  const [phase, setPhase] = useState<Phase>('verify');
  const [currentInput, setCurrentInput] = useState('');
  const [verifiedPrimaryPin, setVerifiedPrimaryPin] = useState('');
  const [decoyPin, setDecoyPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const PHASE_CONFIG: Record<Phase, { title: string; instruction: string; buttonLabel: string }> = {
    verify: { title: t('decoy_pin.step_verify'), instruction: t('decoy_pin.step_verify_subtitle'), buttonLabel: t('decoy_pin.button_verify') },
    create: { title: t('decoy_pin.step_decoy'), instruction: t('decoy_pin.step_decoy_subtitle'), buttonLabel: t('common.continue') },
    confirm: { title: t('decoy_pin.step_confirm'), instruction: t('decoy_pin.step_confirm_subtitle'), buttonLabel: t('decoy_pin.title') },
  };
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
      setError(t('decoy_pin.error_too_short'));
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
          setError(t('decoy_pin.error_incorrect'));
          setCurrentInput('');
          Vibration.vibrate(50);
        }
      } catch {
        setError(t('decoy_pin.error_verify_generic'));
        setCurrentInput('');
        Vibration.vibrate(50);
      } finally {
        setIsProcessing(false);
      }
    } else if (phase === 'create') {
      // Check that decoy PIN differs from primary
      if (currentInput === verifiedPrimaryPin) {
        setError(t('decoy_pin.error_same_as_main'));
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
        setError(t('decoy_pin.error_mismatch'));
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
          setError(result.error ?? t('decoy_pin.error_save_failed'));
          Vibration.vibrate(50);
        }
      } catch {
        setError(t('decoy_pin.error_generic'));
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
      t('decoy_pin.remove_title'),
      t('decoy_pin.remove_body'),
      [
        { text: t('decoy_pin.remove_keep'), style: 'cancel' },
        {
          text: t('common.remove'),
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
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={24} color="rgba(255,255,255,0.9)" />
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
            <Text style={styles.removeButtonText}>{t('decoy_pin.remove_existing')}</Text>
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
            {isProcessing ? t('common.processing') : config.buttonLabel}
          </Text>
        </Pressable>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface,
  },
  scrollContent: {
    flexGrow: 1,
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
    flexGrow: 1,
    flexShrink: 0,
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
    maxWidth: 72 * 3 + spacing.md * 2 + spacing.lg * 2, alignSelf: 'center',
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
