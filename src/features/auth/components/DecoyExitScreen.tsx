/**
 * VaultCalc - Decoy Exit Screen
 *
 * App-branded "Something went wrong" overlay used as a panic mode action.
 * When triggered, the vault locks and this screen masks the app with a
 * generic error screen that does NOT mimic any Android system UI.
 *
 * PLAY STORE COMPLIANCE:
 * - Uses app's own theme colors (not system dialog styling)
 * - Generic wording ("Something went wrong") — NOT "App keeps stopping"
 * - Clearly branded with app icon/illustration — not a system crash
 * - "Close" minimizes the app, "Try Again" dismisses to calculator
 *
 * @see Panic Mode feature
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Modal,
  BackHandler,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useThemeColors, colors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { Icon } from '@shared/components/Icon';
import { useTranslation } from '@shared/i18n';

interface DecoyExitScreenProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Decoy exit overlay — shown as a fullscreen modal over the entire app.
 *
 * Lifecycle:
 * 1. Modal opens with dimmed background
 * 2. Card fades in with scale-up spring animation (400ms delay)
 * 3. "Close" → minimizes the app (moves to background)
 * 4. "Try Again" → dismisses the overlay, returns to calculator
 */
export function DecoyExitScreen({ visible, onDismiss }: DecoyExitScreenProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const { t } = useTranslation();
  const isDark = themeColors === colors.dark;
  const styles = React.useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);

  // Animation values
  const backdropOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.88);
  const iconScale = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      backdropOpacity.value = 0;
      cardOpacity.value = 0;
      cardScale.value = 0.88;
      iconScale.value = 0;
      return;
    }

    // Fade in backdrop
    backdropOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) });

    // Card appears after a short delay
    cardOpacity.value = withDelay(400, withTiming(1, { duration: 280 }));
    cardScale.value = withDelay(400, withSpring(1, { damping: 16, stiffness: 140 }));

    // Icon bounces in slightly after card
    iconScale.value = withDelay(550, withSpring(1, { damping: 12, stiffness: 160 }));
  }, [visible, backdropOpacity, cardOpacity, cardScale, iconScale]);

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  // "Close" → minimize the app (move to background)
  const handleClose = useCallback(() => {
    cardOpacity.value = withTiming(0, { duration: 150 });
    cardScale.value = withTiming(0.92, { duration: 150 });
    backdropOpacity.value = withTiming(0, { duration: 200 });

    setTimeout(() => {
      onDismiss();
      // Move app to background
      try {
        BackHandler.exitApp();
      } catch {
        // Fallback — just dismiss the overlay
      }
    }, 200);
  }, [onDismiss, cardOpacity, cardScale, backdropOpacity]);

  // "Try Again" → dismiss overlay, return to calculator
  const handleTryAgain = useCallback(() => {
    cardOpacity.value = withTiming(0, { duration: 150 });
    cardScale.value = withTiming(0.95, { duration: 150 });
    backdropOpacity.value = withTiming(0, { duration: 200 });

    setTimeout(onDismiss, 180);
  }, [onDismiss, cardOpacity, cardScale, backdropOpacity]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <Animated.View style={[styles.backdrop, backdropAnimStyle]}>
        <Animated.View style={[styles.card, cardAnimStyle]}>
          {/* Icon */}
          <Animated.View style={[styles.iconContainer, iconAnimStyle]}>
            <View style={styles.iconCircle}>
              <Icon name="alert-triangle" size={32} color={themeColors.error} />
            </View>
          </Animated.View>

          {/* Title */}
          <Text style={styles.title}>{t('decoy_exit.title')}</Text>

          {/* Message */}
          <Text style={styles.message}>
            {t('decoy_exit.body')}
          </Text>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonPressed]}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close app"
            >
              <Text style={styles.buttonSecondaryText}>{t('decoy_exit.close_app')}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.buttonPrimary, pressed && styles.buttonPrimaryPressed]}
              onPress={handleTryAgain}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.buttonPrimaryText}>{t('decoy_exit.try_again')}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Styles: App-themed (NOT system dialog) ─────────────────────

const createStyles = (c: ColorTokens, isDark: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: c.surfaceContainer,
      borderRadius: layout.cardBorderRadius,
      paddingTop: spacing['2xl'],
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      // App-level elevation (not system dialog shadow)
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.5 : 0.15,
      shadowRadius: 12,
    },
    iconContainer: {
      marginBottom: spacing.lg,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(220,38,38,0.08)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      ...typography.titleLarge,
      color: c.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    message: {
      ...typography.bodyMedium,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.xl,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.md,
      width: '100%',
    },
    buttonSecondary: {
      flex: 1,
      height: layout.buttonHeight,
      borderRadius: layout.buttonBorderRadius,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonPressed: {
      opacity: 0.7,
    },
    buttonSecondaryText: {
      ...typography.labelLarge,
      color: c.textSecondary,
    },
    buttonPrimary: {
      flex: 1,
      height: layout.buttonHeight,
      borderRadius: layout.buttonBorderRadius,
      backgroundColor: c.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonPrimaryPressed: {
      opacity: 0.85,
    },
    buttonPrimaryText: {
      ...typography.labelLarge,
      color: '#FFFFFF',
      fontWeight: '600',
    },
  });
