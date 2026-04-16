/**
 * VaultCalc - Feature Discovery Card
 *
 * "Did you know?" cards that surface one untried feature per session.
 * Tracks which features the user has already discovered via settingsStore.
 * Shows at most one card per vault session, dismissible.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { Icon, type IconName } from '@shared/components/Icon';
import { useSettingsStore } from '@store/settingsStore';
import { trackEvent } from '@services/analytics';

interface FeatureTip {
  id: string;
  icon: IconName;
  titleKey: string;
  bodyKey: string;
  /** Settings key that indicates user has engaged with this feature */
  discoveredWhen: () => boolean;
}

const FEATURE_TIPS: FeatureTip[] = [
  {
    id: 'intruder',
    icon: 'camera',
    titleKey: 'feature_discovery.intruder_title',
    bodyKey: 'feature_discovery.intruder_body',
    discoveredWhen: () => useSettingsStore.getState().intruderDetectionEnabled,
  },
  {
    id: 'disguise',
    icon: 'eye-off',
    titleKey: 'feature_discovery.disguise_title',
    bodyKey: 'feature_discovery.disguise_body',
    discoveredWhen: () => useSettingsStore.getState().appIcon !== 'default',
  },
  {
    id: 'backup',
    icon: 'shield-check',
    titleKey: 'feature_discovery.backup_title',
    bodyKey: 'feature_discovery.backup_body',
    discoveredWhen: () => useSettingsStore.getState().googleDriveEmail !== null,
  },
  {
    id: 'biometric',
    icon: 'fingerprint',
    titleKey: 'feature_discovery.biometric_title',
    bodyKey: 'feature_discovery.biometric_body',
    discoveredWhen: () => useSettingsStore.getState().biometricEnabled,
  },
  {
    id: 'panic',
    icon: 'shield',
    titleKey: 'feature_discovery.panic_title',
    bodyKey: 'feature_discovery.panic_body',
    discoveredWhen: () => useSettingsStore.getState().panicButtonEnabled,
  },
  {
    id: 'decoy',
    icon: 'lock',
    titleKey: 'feature_discovery.decoy_title',
    bodyKey: 'feature_discovery.decoy_body',
    discoveredWhen: () => useSettingsStore.getState().decoyVaultConfigured,
  },
];

// Session-level flag — only one card per vault session
let sessionTipShown = false;

export function FeatureDiscoveryCard(): React.JSX.Element | null {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const [dismissed, setDismissed] = useState(false);
  const [tip, setTip] = useState<FeatureTip | null>(null);

  // Pick one undiscovered feature on mount
  useEffect(() => {
    if (sessionTipShown) return;

    // Delay to let the main vault content render first
    const timer = setTimeout(() => {
      const undiscovered = FEATURE_TIPS.filter(t => {
        try { return !t.discoveredWhen(); } catch { return true; }
      });
      if (undiscovered.length === 0) return;

      // Pick a random undiscovered tip
      const pick = undiscovered[Math.floor(Math.random() * undiscovered.length)];
      setTip(pick);
      sessionTipShown = true;
      trackEvent('feature_discovery_shown', { feature: pick.id });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Animations
  const translateY = useSharedValue(60);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!tip) return;
    translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
    opacity.value = withDelay(50, withTiming(1, { duration: 300 }));
  }, [tip]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handleDismiss = () => {
    opacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(40, { duration: 200 });
    setTimeout(() => setDismissed(true), 220);
  };

  if (!tip || dismissed) return null;

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <View style={styles.iconCircle}>
        <Icon name={tip.icon} size={20} color={themeColors.accent} />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>{t('feature_discovery.did_you_know')}</Text>
        <Text style={styles.title}>{t(tip.titleKey)}</Text>
        <Text style={styles.body}>{t(tip.bodyKey)}</Text>
      </View>
      <Pressable onPress={handleDismiss} style={styles.closeButton} hitSlop={12}>
        <Icon name="x" size={16} color={themeColors.textTertiary} />
      </Pressable>
    </Animated.View>
  );
}

/** Reset the session flag (call on vault lock/unlock cycle) */
export function resetFeatureDiscoverySession(): void {
  sessionTipShown = false;
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: c.surfaceContainer,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 2,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: c.accent,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: c.textPrimary,
    marginBottom: 4,
  },
  body: {
    ...typography.bodySmall,
    color: c.textSecondary,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginLeft: 4,
    marginTop: -2,
  },
});
