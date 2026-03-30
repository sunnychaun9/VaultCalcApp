/**
 * VaultCalc - Premium Lock Screen Container
 *
 * Shared container for PIN and Pattern lock screens.
 * Provides dark gradient background, brand header, trust indicators,
 * and glassmorphism card styling.
 *
 * @see AUTH-010 Premium Lock UI
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { typography, spacing } from '@shared/theme';

/** Dark gradient colors */
const BG_TOP = '#0F172A';
const BG_BOTTOM = '#1E293B';
const CARD_BG = 'rgba(30, 41, 59, 0.65)';
const CARD_BORDER = 'rgba(100, 116, 139, 0.2)';
const TEXT_PRIMARY = '#F1F5F9';
const TEXT_SECONDARY = '#94A3B8';
const TEXT_MUTED = '#64748B';

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
  subtitle = 'Your private vault is protected',
  warningMessage,
  warningColor,
  children,
  bottomContent,
}: LockScreenContainerProps): React.JSX.Element {
  const styles = useMemo(() => createStyles(), []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_TOP} />

      {/* Gradient background layers */}
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>
        {/* Top section: brand + status */}
        <View style={styles.topSection}>
          {/* Lock icon */}
          <View style={styles.lockIconWrapper}>
            <Text style={styles.lockIcon}>{'\u{1F512}'}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Subtitle or warning */}
          {warningMessage ? (
            <Text style={[styles.subtitle, warningColor ? { color: warningColor } : null]}>
              {warningMessage}
            </Text>
          ) : (
            <Text style={styles.subtitle}>{subtitle}</Text>
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
            <Text style={styles.trustIcon}>{'\u{1F6E1}'}</Text>
            <Text style={styles.trustText}>Protected with encryption</Text>
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
    bgTop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: BG_TOP,
    },
    bgBottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '60%',
      backgroundColor: BG_BOTTOM,
      borderTopLeftRadius: 40,
      borderTopRightRadius: 40,
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
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    lockIcon: {
      fontSize: 22,
    },
    title: {
      ...typography.headlineMedium,
      color: TEXT_PRIMARY,
      fontWeight: '600',
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
