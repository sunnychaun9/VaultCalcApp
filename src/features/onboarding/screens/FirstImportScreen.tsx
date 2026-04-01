/**
 * VaultCalc - First Import Screen (ONBOARD-005 / ONBOARD-006)
 *
 * Prompts the user to import their first photos after onboarding.
 * Provides a "Skip for Now" option to go directly to the calculator.
 *
 * @see FEATURE_INDEX.md ONBOARD-005, ONBOARD-006
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@typedefs/navigation';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { Icon, ICON_SIZE } from '@shared/components/Icon';
import { pickFilesForTab } from '@services/filePicker';
import { importFiles } from '@services/import';
import { useSettingsStore } from '@store/settingsStore';
import { alert } from '@store/alertStore';

/**
 * First Import Screen Component
 *
 * Shown after the How It Works tutorial during onboarding.
 * Lets the user import photos immediately or skip to the calculator.
 */
export function FirstImportScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [isImporting, setIsImporting] = useState(false);
  const deleteOriginals = useSettingsStore(s => s.deleteOriginalsAfterImport);

  const goToCalculator = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Calculator' }] });
  }, [navigation]);

  const handleImport = useCallback(async () => {
    const files = await pickFilesForTab('images');
    if (files.length === 0) return;

    setIsImporting(true);
    try {
      const result = await importFiles(files, 'photo', { deleteOriginals });

      if (result.failed.length === 0) {
        alert(
          'Safe and sound',
          `${result.imported} ${result.imported === 1 ? 'photo' : 'photos'} encrypted and hidden.`,
          [{ text: 'OK', onPress: goToCalculator }],
        );
      } else if (result.imported > 0) {
        alert(
          'Almost there',
          `${result.imported} imported, but ${result.failed.length} couldn't be added.`,
          [{ text: 'OK', onPress: goToCalculator }],
        );
      } else {
        alert(
          'Couldn\'t import',
          `Something went wrong. Please try again.\n\n${result.failed[0]?.error ?? ''}`,
        );
        setIsImporting(false);
      }
    } catch {
      alert('Something went wrong', 'Import didn\'t work this time. Please try again.');
      setIsImporting(false);
    }
  }, [goToCalculator, deleteOriginals]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Icon name="shield" size={ICON_SIZE.xl} color={themeColors.accent} style={styles.icon} />
        <Text style={styles.title}>Add Your First Photos</Text>
        <Text style={styles.subtitle}>
          Your photos will be encrypted and hidden inside the calculator app.
        </Text>
      </View>

      <View style={styles.bottom}>
        {isImporting ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.accent} />
            <Text style={styles.loadingText}>Encrypting your photos...</Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={handleImport}
              style={styles.button}
              accessibilityRole="button"
              accessibilityLabel="Import Photos"
            >
              <Text style={styles.buttonText}>Import Photos</Text>
            </Pressable>
            <Pressable
              onPress={goToCalculator}
              style={styles.skipButton}
              accessibilityRole="button"
              accessibilityLabel="Skip for Now"
            >
              <Text style={styles.skipText}>Skip for Now</Text>
            </Pressable>
          </>
        )}
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
    icon: {
      fontSize: 64,
      marginBottom: spacing.xl,
    },
    title: {
      ...typography.headlineLarge,
      color: c.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...typography.bodyLarge,
      color: c.textSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
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
    skipButton: {
      height: layout.buttonHeight,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    skipText: {
      ...typography.bodyMedium,
      color: c.textSecondary,
    },
    loadingContainer: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.base,
    },
    loadingText: {
      ...typography.bodyMedium,
      color: c.textSecondary,
    },
  });
