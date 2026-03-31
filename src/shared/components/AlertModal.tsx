/**
 * VaultCalc - Alert Modal (Variant-Aware)
 *
 * Global alert dialog with two visual variants:
 *
 * - **info** (default): Neutral appearance, accent-colored action buttons.
 *   Used for confirmations, success messages, errors.
 *
 * - **destructive**: Red accent, warning icon, subtle shake on open.
 *   Auto-detected when any button has `style: 'destructive'`.
 *   Used for delete confirmations, permanent actions.
 *
 * Mounted once at app root (App.tsx). All screens share this instance
 * via alertStore.
 */

import React, { useMemo, useCallback, useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { useAlertStore, type AlertButton, type AlertVariant } from '@store/alertStore';
import { useThemeColors, colors, type ColorTokens, typography, spacing, layout, getSurfaceStyle } from '@shared/theme';
import { Icon } from '@shared/components/Icon';

export function AlertModal(): React.JSX.Element | null {
  const visible = useAlertStore((s) => s.visible);
  const data = useAlertStore((s) => s.data);
  const dismiss = useAlertStore((s) => s.dismiss);
  const themeColors = useThemeColors();
  const isDark = themeColors === colors.dark;
  const variant = data?.variant ?? 'info';
  const styles = useMemo(() => createStyles(themeColors, isDark, variant), [themeColors, isDark, variant]);

  // ── Shake animation for destructive variant ──
  const shakeX = useSharedValue(0);
  const iconScale = useSharedValue(0);

  useEffect(() => {
    if (visible && variant === 'destructive') {
      // Subtle horizontal shake — signals danger without being alarming
      shakeX.value = withDelay(
        150,
        withSequence(
          withTiming(-4, { duration: 50 }),
          withTiming(4, { duration: 50 }),
          withTiming(-3, { duration: 40 }),
          withTiming(3, { duration: 40 }),
          withTiming(-1, { duration: 30 }),
          withSpring(0, { damping: 20, stiffness: 400 }),
        ),
      );
      // Warning icon pop-in
      iconScale.value = withDelay(
        80,
        withSpring(1, { damping: 10, stiffness: 300, mass: 0.6 }),
      );
    } else {
      shakeX.value = 0;
      iconScale.value = 0;
    }
  }, [visible, variant, shakeX, iconScale]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconScale.value,
  }));

  const handlePress = useCallback(
    (button: AlertButton) => {
      dismiss();
      button.onPress?.();
    },
    [dismiss],
  );

  if (!data) return null;

  const cancelButton = data.buttons.find((b) => b.style === 'cancel');
  const actionButtons = data.buttons.filter((b) => b.style !== 'cancel');
  const isDestructive = variant === 'destructive';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Animated.View style={shakeStyle}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            {/* Warning icon for destructive variant */}
            {isDestructive && (
              <Animated.View style={[styles.iconContainer, iconStyle]}>
                <View style={styles.iconCircle}>
                  <Icon name="trash" size={24} color={themeColors.error} />
                </View>
              </Animated.View>
            )}

            {/* Title */}
            <Text style={styles.title}>{data.title}</Text>

            {/* Message */}
            {data.message ? (
              <Text style={styles.message}>{data.message}</Text>
            ) : null}

            {/* Buttons */}
            <View style={styles.buttonRow}>
              {cancelButton && (
                <Pressable
                  style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
                  onPress={() => handlePress(cancelButton)}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelButtonText}>{cancelButton.text}</Text>
                </Pressable>
              )}
              {actionButtons.map((button, index) => {
                const isBtnDestructive = button.style === 'destructive';
                return (
                  <Pressable
                    key={index}
                    style={({ pressed }) => [
                      styles.actionButton,
                      isBtnDestructive && styles.destructiveButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => handlePress(button)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.actionButtonText,
                        isBtnDestructive && styles.destructiveButtonText,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const createStyles = (c: ColorTokens, isDark: boolean, variant: AlertVariant) => {
  const isDestructive = variant === 'destructive';
  // Destructive dialogs get a subtle red tint on the top border
  const dialogBorder = isDestructive
    ? { borderTopWidth: 3, borderTopColor: c.error }
    : {};

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing['2xl'],
    },
    dialog: {
      width: '100%',
      maxWidth: 320,
      ...getSurfaceStyle('level2', c, isDark),
      borderRadius: layout.cardBorderRadius,
      paddingTop: isDestructive ? spacing.lg : spacing.xl,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.base,
      ...dialogBorder,
    },

    // ── Warning icon (destructive only) ──
    iconContainer: {
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    iconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: c.error + '15', // 8% error tint
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: c.error + '30', // 19% error border
    },

    // ── Text ──
    title: {
      ...typography.titleLarge,
      color: isDestructive ? c.error : c.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    message: {
      ...typography.bodyMedium,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
      lineHeight: 20,
    },

    // ── Buttons ──
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    cancelButton: {
      height: layout.buttonHeightSmall,
      paddingHorizontal: spacing.lg,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: layout.buttonBorderRadius,
    },
    cancelButtonText: {
      ...typography.bodyMedium,
      color: c.textSecondary,
      fontWeight: '600',
    },
    actionButton: {
      height: layout.buttonHeightSmall,
      paddingHorizontal: spacing.lg,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: layout.buttonBorderRadius,
      backgroundColor: c.accent,
    },
    actionButtonText: {
      ...typography.bodyMedium,
      color: c.textOnAccent,
      fontWeight: '600',
    },
    destructiveButton: {
      backgroundColor: c.error,
    },
    destructiveButtonText: {
      color: '#FFFFFF',
    },
    buttonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.97 }],
    },
  });
};
