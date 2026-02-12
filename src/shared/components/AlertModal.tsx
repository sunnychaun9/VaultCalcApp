/**
 * VaultCalc - Custom Alert Modal
 *
 * Theme-aware replacement for React Native's Alert.alert().
 * Renders a centered modal driven by alertStore state.
 *
 * Mount once at the app root (App.tsx) — all screens share this single instance.
 */

import React, { useMemo, useCallback } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useAlertStore, type AlertButton } from '@store/alertStore';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';

export function AlertModal(): React.JSX.Element | null {
  const visible = useAlertStore((s) => s.visible);
  const data = useAlertStore((s) => s.data);
  const dismiss = useAlertStore((s) => s.dismiss);
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable style={styles.dialog} onPress={() => {}}>
          <Text style={styles.title}>{data.title}</Text>
          {data.message ? (
            <Text style={styles.message}>{data.message}</Text>
          ) : null}
          <View style={styles.buttonRow}>
            {cancelButton && (
              <Pressable
                style={styles.cancelButton}
                onPress={() => handlePress(cancelButton)}
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>{cancelButton.text}</Text>
              </Pressable>
            )}
            {actionButtons.map((button, index) => (
              <Pressable
                key={index}
                style={[
                  styles.actionButton,
                  button.style === 'destructive' && styles.destructiveButton,
                ]}
                onPress={() => handlePress(button)}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    button.style === 'destructive' && styles.destructiveButtonText,
                  ]}
                >
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
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
      backgroundColor: c.surface,
      borderRadius: layout.cardBorderRadius,
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.base,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
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
      marginBottom: spacing.lg,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    cancelButton: {
      height: layout.buttonHeightSmall,
      paddingHorizontal: spacing.base,
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
      paddingHorizontal: spacing.base,
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
      color: c.textOnAccent,
    },
  });
