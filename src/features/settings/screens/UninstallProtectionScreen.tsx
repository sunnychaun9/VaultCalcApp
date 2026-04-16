/**
 * VaultCalc - Uninstall Protection Screen
 *
 * Uses Android Device Admin API to prevent uninstallation.
 * When enabled, the app cannot be uninstalled until device admin
 * is deactivated. Shows a warning before deactivation.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeModules } from 'react-native';
import { useActivityTracker } from '@features/auth';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { Icon } from '@shared/components/Icon';
import { alert } from '@store/alertStore';
import { useTranslation } from '@shared/i18n';

const { UninstallProtectModule } = NativeModules;

export function UninstallProtectionScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation();
  const { onActivity } = useActivityTracker();
  const { t } = useTranslation();

  const [isEnabled, setIsEnabled] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const enabled = await UninstallProtectModule.isEnabled();
      setIsEnabled(enabled as boolean);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Re-check when screen regains focus (user may have returned from system settings)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', checkStatus);
    return unsubscribe;
  }, [navigation, checkStatus]);

  const handleEnable = useCallback(async () => {
    onActivity();
    try {
      await UninstallProtectModule.requestEnable();
      // System dialog opens — status checked on focus return
    } catch {
      alert(t('common.error'), t('uninstall_protection.enable_error'));
    }
  }, [onActivity, t]);

  const handleDisable = useCallback(() => {
    onActivity();
    alert(
      t('uninstall_protection.disable_title'),
      t('uninstall_protection.disable_body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.disable'),
          style: 'destructive',
          onPress: async () => {
            try {
              await UninstallProtectModule.disable();
              setIsEnabled(false);
            } catch {
              alert(t('common.error'), t('uninstall_protection.disable_error'));
            }
          },
        },
      ],
    );
  }, [onActivity]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={20} color={themeColors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{t('uninstall_protection.title')}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main card */}
        <View style={styles.mainCard}>
          <Text style={styles.cardTitle}>{t('uninstall_protection.subtitle')}</Text>
          <Text style={styles.cardDescription}>
            {t('uninstall_protection.warning_body')}
          </Text>

          <Pressable
            onPress={isEnabled ? handleDisable : handleEnable}
            style={({ pressed }) => [
              styles.actionButton,
              isEnabled && styles.actionButtonDisable,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <Text style={[styles.actionButtonText, isEnabled && styles.actionButtonTextDisable]}>
              {isEnabled ? t('common.disable') : t('common.enable')}
            </Text>
          </Pressable>

          {isEnabled && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{t('uninstall_protection.protected')}</Text>
            </View>
          )}
        </View>

        {/* Tips card */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>{t('uninstall_protection.tips_title')}</Text>

          <View style={styles.tipRow}>
            <View style={styles.tipNumber}>
              <Text style={styles.tipNumberText}>1</Text>
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipLabel}>{t('uninstall_protection.tip1_title')}</Text>
              <Text style={styles.tipDescription}>
                {t('uninstall_protection.tip1_body')}
              </Text>
            </View>
          </View>

          <View style={styles.tipRow}>
            <View style={styles.tipNumber}>
              <Text style={styles.tipNumberText}>2</Text>
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipLabel}>{t('uninstall_protection.tip2_title')}</Text>
              <Text style={styles.tipDescription}>
                {t('uninstall_protection.tip2_body')}
              </Text>
            </View>
          </View>

          <View style={styles.tipRow}>
            <View style={styles.tipNumber}>
              <Text style={styles.tipNumberText}>3</Text>
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipLabel}>{t('uninstall_protection.tip3_title')}</Text>
              <Text style={styles.tipDescription}>
                {t('uninstall_protection.tip3_body')}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ACCENT = '#3B82F6';

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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  backButton: { width: 70 },
  backText: { ...typography.labelLarge, color: c.accent },
  title: { ...typography.titleMedium, color: c.textPrimary },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  // Main card
  mainCard: {
    backgroundColor: ACCENT,
    borderRadius: 20,
    padding: spacing.xl,
  },
  cardTitle: {
    ...typography.titleLarge,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  cardDescription: {
    ...typography.bodyMedium,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonDisable: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonText: {
    ...typography.labelLarge,
    color: ACCENT,
    fontWeight: '600',
  },
  actionButtonTextDisable: {
    color: '#FFFFFF',
  },
  statusBadge: {
    marginTop: spacing.md,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  statusText: {
    ...typography.labelSmall,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Tips card
  tipsCard: {
    backgroundColor: c.surfaceContainer,
    borderRadius: 20,
    padding: spacing.xl,
  },
  tipsTitle: {
    ...typography.titleLarge,
    color: c.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  tipNumber: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  tipNumberText: {
    ...typography.labelMedium,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tipContent: {
    flex: 1,
  },
  tipLabel: {
    ...typography.labelLarge,
    color: c.textPrimary,
    marginBottom: spacing.xxs,
  },
  tipDescription: {
    ...typography.bodySmall,
    color: c.textSecondary,
    lineHeight: 20,
  },
});
