/**
 * VaultCalc - Premium Lock Screen Container
 *
 * Shared container for PIN and Pattern lock screens.
 * Provides dark gradient background, brand header, trust indicators,
 * and glassmorphism card styling.
 *
 * @see AUTH-010 Premium Lock UI
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect, RadialGradient } from 'react-native-svg';
import { typography, spacing } from '@shared/theme';
import { Icon } from '@shared/components/Icon';
import { useTranslation } from '@shared/i18n';

/** Premium dark palette — synced with PinSetupScreen */
const BG_TOP = '#0A0E1A';
const BG_BOTTOM = '#141B2D';
const CARD_BG = 'rgba(30, 41, 59, 0.55)';
const CARD_BORDER = 'rgba(100, 116, 139, 0.15)';
const TEXT_PRIMARY = '#F1F5F9';
const TEXT_SECONDARY = '#94A3B8';
const TEXT_MUTED = '#64748B';
const ACCENT = '#3B82F6';

export { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, CARD_BG, CARD_BORDER, BG_TOP, BG_BOTTOM };

interface LockScreenContainerProps {
  /** Title text, e.g. "Enter Password" or "Draw Pattern" */
  title: string;
  /** Optional subtitle override */
  subtitle?: string;
  /** Warning/error message (replaces subtitle) */
  warningMessage?: string | null;
  /** Warning color */
  warningColor?: string;
  /** Main content (PIN keypad or Pattern grid) */
  children: React.ReactNode;
  /** Bottom section (toggle, biometric, etc.) */
  bottomContent?: React.ReactNode;
  /** Whether this is a setup screen (shows back arrow area instead of lock icon) */
  isSetup?: boolean;
}

/**
 * Premium lock screen wrapper with dark gradient and glass card.
 */
export function LockScreenContainer({
  title,
  subtitle,
  warningMessage,
  warningColor,
  children,
  bottomContent,
}: LockScreenContainerProps): React.JSX.Element {
  const styles = useMemo(() => createStyles(), []);
  const { t } = useTranslation();
  const resolvedSubtitle = subtitle ?? t('lock_screen.tagline');

  // Lock icon breathing pulse
  const pulseScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.06, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulseScale]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_TOP} />

      {/* SVG gradient background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="lockBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={BG_TOP} />
              <Stop offset="0.5" stopColor={BG_BOTTOM} />
              <Stop offset="1" stopColor="#0F1629" />
            </LinearGradient>
            <RadialGradient id="lockGlow" cx="50%" cy="12%" rx="40%" ry="22%">
              <Stop offset="0" stopColor={ACCENT} stopOpacity="0.08" />
              <Stop offset="1" stopColor={ACCENT} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#lockBg)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#lockGlow)" />
        </Svg>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>
        {/* Top section: brand + status */}
        <View style={styles.topSection}>
          {/* Pulsing lock icon */}
          <Animated.View style={[styles.lockIconWrapper, { transform: [{ scale: pulseScale }] }]}>
            <Icon name="lock" size={28} color="rgba(255,255,255,0.95)" />
          </Animated.View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Subtitle or warning */}
          {warningMessage ? (
            <Text style={[styles.subtitle, warningColor ? { color: warningColor } : null]}>
              {warningMessage}
            </Text>
          ) : (
            <Text style={styles.subtitle}>{resolvedSubtitle}</Text>
          )}
        </View>

        {/* Middle section: glass card with auth UI */}
        <View style={styles.cardWrapper}>
          <View style={styles.card}>
            {children}
          </View>
        </View>

        {/* Bottom section: toggle, biometric, trust */}
        <View style={styles.bottomSection}>
          {bottomContent}

          {/* Trust indicator */}
          <View style={styles.trustRow}>
            <Icon name="shield" size={16} color="rgba(255,255,255,0.4)" />
            <Text style={styles.trustText}>{t('lock_screen.encryption_badge')}</Text>
          </View>
        </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: BG_TOP,
    },
    safeArea: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    topSection: {
      alignItems: 'center',
      paddingTop: 40,
      paddingBottom: spacing.lg,
    },
    lockIconWrapper: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    title: {
      ...typography.headlineMedium,
      color: TEXT_PRIMARY,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    subtitle: {
      ...typography.bodyMedium,
      color: TEXT_SECONDARY,
      textAlign: 'center',
      paddingHorizontal: spacing['2xl'],
    },
    cardWrapper: {
      flexGrow: 1,
      flexShrink: 0,
      paddingHorizontal: spacing.lg,
      justifyContent: 'center',
    },
    card: {
      backgroundColor: CARD_BG,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: CARD_BORDER,
      padding: spacing.lg,
      // Elevation for subtle shadow
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
    },
    bottomSection: {
      alignItems: 'center',
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    trustRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      opacity: 0.6,
    },
    trustIcon: {
      fontSize: 12,
    },
    trustText: {
      ...typography.labelSmall,
      color: TEXT_MUTED,
    },
  });
