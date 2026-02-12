/**
 * VaultCalc - Welcome Screen (ONB-01)
 *
 * First screen shown on initial app launch.
 * Displays app name, tagline, and a "Get Started" CTA
 * that navigates to PIN setup.
 *
 * @see 02-UX-Design.md Section 3, ONB-01
 * @see FEATURE_INDEX.md ONBOARD-001
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@typedefs/navigation';
import { useSettingsStore } from '@store/settingsStore';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';

/**
 * Welcome Screen Component
 *
 * Shows app branding and a single CTA to begin onboarding.
 * On "Get Started": marks first launch complete, resets to Calculator,
 * then navigates to PinSetup in initial-setup mode.
 */
export function WelcomeScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'Onboarding'>>();
  const completeFirstLaunch = useSettingsStore(s => s.completeFirstLaunch);

  const handleGetStarted = useCallback(() => {
    completeFirstLaunch();
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Calculator' },
        { name: 'PinSetup', params: { isInitialSetup: true } },
      ],
    });
  }, [completeFirstLaunch, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.appName}>VaultCalc</Text>
        <Text style={styles.tagline}>
          Your files, encrypted and organized in one app.
        </Text>
      </View>

      <View style={styles.bottom}>
        <Pressable
          onPress={handleGetStarted}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="Get Started"
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.surface,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.base,
    },
    appName: {
      ...typography.headlineLarge,
      color: c.textPrimary,
      marginBottom: spacing.sm,
    },
    tagline: {
      ...typography.bodyLarge,
      color: c.textSecondary,
      textAlign: 'center',
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
