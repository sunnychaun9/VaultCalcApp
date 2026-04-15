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
import { trackEvent } from '@services/analytics';
import { useTranslation } from '@shared/i18n';

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
  const { t } = useTranslation();

  const goToCalculator = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Calculator' }] });
  }, [navigation]);

  const handleImport = useCallback(async () => {
    const files = await pickFilesForTab('images');
    if (files.length === 0) return;

    setIsImporting(true);
    try {
      const result = await importFiles(files, 'photo', { deleteOriginals });

      if (result.imported > 0) {
        trackEvent('first_import', { count: result.imported, type: 'image' });
      }

      if (result.failed.length === 0) {
        alert(
          t('onboarding.first_import_success_title'),
          t('onboarding.first_import_success', { count: result.imported }) as string,
          [{ text: t('common.ok'), onPress: goToCalculator }],
        );
      } else if (result.imported > 0) {
        alert(
          t('onboarding.first_import_partial_title'),
          t('onboarding.first_import_partial_body', { imported: result.imported, failed: result.failed.length }) as string,
          [{ text: t('common.ok'), onPress: goToCalculator }],
        );
      } else {
        alert(
          t('onboarding.first_import_error_title'),
          `${t('onboarding.first_import_error_body')}\n\n${result.failed[0]?.error ?? ''}`,
        );
        setIsImporting(false);
      }
    } catch {
      alert(t('onboarding.first_import_error_title'), t('onboarding.first_import_error_body') as string);
      setIsImporting(false);
    }
  }, [goToCalculator, deleteOriginals, t]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Icon name="shield" size={ICON_SIZE.xl} color={themeColors.accent} style={styles.icon} />
        <Text style={styles.title}>{t('onboarding.first_import_title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.first_import_subtitle')}</Text>
      </View>

      <View style={styles.bottom}>
        {isImporting ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.accent} />
            <Text style={styles.loadingText}>{t('onboarding.first_import_encrypting')}</Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={handleImport}
              style={styles.button}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.first_import_cta')}
            >
              <Text style={styles.buttonText}>{t('onboarding.first_import_cta')}</Text>
            </Pressable>
            <Pressable
              onPress={goToCalculator}
              style={styles.skipButton}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.first_import_skip')}
            >
              <Text style={styles.skipText}>{t('onboarding.first_import_skip')}</Text>
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
