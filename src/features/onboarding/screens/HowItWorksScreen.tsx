/**
 * VaultCalc - How It Works Screen (ONBOARD-004)
 *
 * Tutorial screen shown after initial PIN setup.
 * Explains the core concept: use the calculator, enter PIN + press =, access vault.
 *
 * @see FEATURE_INDEX.md ONBOARD-004
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@typedefs/navigation';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { trackEvent } from '@services/analytics';
import { useTranslation } from '@shared/i18n';

// Step numbers are fixed — titles/subtitles pulled from i18n inside the component.
const STEP_NUMBERS = ['1', '2', '3'] as const;

/**
 * How It Works Screen Component
 *
 * Three-step tutorial explaining the vault access mechanism.
 * Shown once after initial PIN creation during onboarding.
 */
export function HowItWorksScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();

  const steps = useMemo(() => [
    { number: STEP_NUMBERS[0], title: t('onboarding.step1_title'), subtitle: t('onboarding.step1_subtitle') },
    { number: STEP_NUMBERS[1], title: t('onboarding.step2_title'), subtitle: t('onboarding.step2_subtitle') },
    { number: STEP_NUMBERS[2], title: t('onboarding.step3_title'), subtitle: t('onboarding.step3_subtitle') },
  ], [t]);

  const handleGotIt = useCallback(() => {
    trackEvent('tutorial_completed');
    navigation.navigate('FirstImport');
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.how_it_works_title')}</Text>

        <View style={styles.steps}>
          {steps.map(step => (
            <View key={step.number} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{step.number}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.disclosure}>
          This app can appear as a calculator, weather, or notes app on your home screen for privacy. You can change this anytime in Settings.
        </Text>
      </View>

      <View style={styles.bottom}>
        <Pressable
          onPress={handleGotIt}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={t('common.got_it')}
        >
          <Text style={styles.buttonText}>{t('common.got_it')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const STEP_NUMBER_SIZE = 36;

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.surface,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.base,
    },
    title: {
      ...typography.headlineLarge,
      color: c.textPrimary,
      textAlign: 'center',
      marginBottom: spacing['3xl'],
    },
    steps: {
      gap: spacing.xl,
    },
    disclosure: {
      ...typography.bodySmall,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: spacing['2xl'],
      paddingHorizontal: spacing.base,
      lineHeight: 18,
    },
    step: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.base,
    },
    stepNumber: {
      width: STEP_NUMBER_SIZE,
      height: STEP_NUMBER_SIZE,
      borderRadius: STEP_NUMBER_SIZE / 2,
      backgroundColor: c.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepNumberText: {
      ...typography.titleMedium,
      color: c.textOnAccent,
      fontWeight: '600',
    },
    stepText: {
      flex: 1,
    },
    stepTitle: {
      ...typography.titleMedium,
      color: c.textPrimary,
    },
    stepSubtitle: {
      ...typography.bodyMedium,
      color: c.textSecondary,
      marginTop: spacing.xxs,
    },
    bottom: {
      paddingHorizontal: spacing.base,
      paddingBottom: spacing['2xl'],
    },
    button: {
      height: layout.buttonHeight,
      borderRadius: layout.buttonBorderRadius,
      backgroundColor: c.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: {
      ...typography.bodyLarge,
      color: c.textOnAccent,
      fontWeight: '600',
    },
  });
