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
import { alert } from '@store/alertStore';

const { UninstallProtectModule } = NativeModules;

export function UninstallProtectionScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation();
  const { onActivity } = useActivityTracker();

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
      alert('Error', 'Failed to request device admin activation.');
    }
  }, [onActivity]);

  const handleDisable = useCallback(() => {
    onActivity();
    alert(
      'Disable Uninstall Protection?',
      'This will allow the app to be uninstalled. Your hidden files will be lost forever if the app is removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            try {
              await UninstallProtectModule.disable();
              setIsEnabled(false);
            } catch {
              alert('Error', 'Failed to disable. Try deactivating in Android Settings > Security > Device Admin Apps.');
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
          <Text style={styles.backText}>{'\u2190'} Back</Text>
        </Pressable>
        <Text style={styles.title}>Uninstall Protection</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main card */}
        <View style={styles.mainCard}>
          <Text style={styles.cardTitle}>Avoid accidental uninstallation</Text>
          <Text style={styles.cardDescription}>
            After uninstalling VaultCalc, hidden files won't return to your gallery and may be lost.
            Please unhide your vault files before uninstalling or enable Uninstall Protection.
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
              {isEnabled ? 'Disable' : 'Enable'}
            </Text>
          </Pressable>

          {isEnabled && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Protected</Text>
            </View>
          )}
        </View>

        {/* Tips card */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Tips</Text>

          <View style={styles.tipRow}>
            <View style={styles.tipNumber}>
              <Text style={styles.tipNumberText}>1</Text>
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipLabel}>Don't delete folders in Vault</Text>
              <Text style={styles.tipDescription}>
                Please do not move or delete folders in Vault, or your hidden files may no longer be protected.
              </Text>
            </View>
          </View>

          <View style={styles.tipRow}>
            <View style={styles.tipNumber}>
              <Text style={styles.tipNumberText}>2</Text>
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipLabel}>Prevent files deletion by cleaner apps</Text>
              <Text style={styles.tipDescription}>
                To avoid hidden files being cleared by some cleaner apps, please exclude VaultCalc from the cleanup of these apps.
              </Text>
            </View>
          </View>

          <View style={styles.tipRow}>
            <View style={styles.tipNumber}>
              <Text style={styles.tipNumberText}>3</Text>
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipLabel}>Unhide files before uninstalling</Text>
              <Text style={styles.tipDescription}>
                If you plan to uninstall, export all vault files to your gallery first using the "Export to Gallery" option.
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
