/**
 * VaultCalc - Language Selector (LOCALE-001)
 *
 * Lets the user pick a UI language. Writing the preference:
 *   - Persists in settingsStore
 *   - Updates i18next immediately (visible text re-renders)
 *   - Recomputes the target RTL direction — if it differs from the current
 *     native state, we show a restart prompt because RN latches forceRTL
 *     until the process restarts.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Icon, IconButton } from '@shared/components/Icon';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { useActivityTracker } from '@features/auth';
import { useSettingsStore } from '@store/settingsStore';
import { alert } from '@store/alertStore';
import {
  useTranslation,
  changeLanguage,
  resolveDeviceLanguage,
  SUPPORTED_LANGUAGES,
  RTL_LANGUAGES,
  type LanguageCode,
} from '@shared/i18n';

export function LanguageScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation();
  const { onActivity } = useActivityTracker();
  const { t } = useTranslation();

  const current = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  const handleSelect = useCallback(
    async (code: LanguageCode) => {
      onActivity();
      setLanguage(code);
      await changeLanguage(code);

      // Detect whether the new language needs a layout direction flip. If so,
      // prompt for a restart — RN's forceRTL only fully applies on cold start.
      const effective = code === 'system' ? resolveDeviceLanguage() : code;
      const shouldBeRtl = (RTL_LANGUAGES as ReadonlyArray<string>).includes(effective);
      if (shouldBeRtl !== I18nManager.isRTL) {
        try {
          I18nManager.allowRTL(shouldBeRtl);
          I18nManager.forceRTL(shouldBeRtl);
        } catch { /* best-effort */ }
        alert(t('settings.restart_required_title'), t('settings.restart_required_body'));
      }
    },
    [onActivity, setLanguage, t],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton
          name="arrow-left"
          onPress={() => navigation.goBack()}
          color={themeColors.textPrimary}
          accessibilityLabel={t('common.back')}
          containerStyle={styles.backButton}
        />
        <Text style={styles.title}>{t('settings.language')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isSelected = current === lang.code;
          return (
            <Pressable
              key={lang.code}
              onPress={() => handleSelect(lang.code)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowNative}>{lang.nativeName}</Text>
                {lang.code !== 'system' && lang.nativeName !== lang.englishName ? (
                  <Text style={styles.rowEnglish}>{lang.englishName}</Text>
                ) : null}
              </View>
              {isSelected ? (
                <Icon name="check" size={20} color={themeColors.accent} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
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
      height: layout.topBarHeight,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      ...typography.titleLarge,
      color: c.textPrimary,
    },
    placeholder: { width: 40 },
    list: {
      paddingVertical: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: layout.minTouchTarget,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      backgroundColor: c.surface,
    },
    rowPressed: {
      backgroundColor: c.surfaceContainer,
    },
    rowTextCol: {
      flex: 1,
    },
    rowNative: {
      ...typography.bodyLarge,
      color: c.textPrimary,
    },
    rowEnglish: {
      ...typography.bodySmall,
      color: c.textTertiary,
      marginTop: 2,
    },
  });
