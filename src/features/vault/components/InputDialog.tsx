/**
 * VaultCalc - Input Dialog
 *
 * Modal dialog with a single TextInput. Used for create/rename flows
 * where a bottom sheet would be dismissed by Android's adjustResize
 * keyboard behavior.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors, colors, type ColorTokens, typography, spacing } from '@shared/theme';

interface InputDialogProps {
  visible: boolean;
  title: string;
  placeholder: string;
  initialValue?: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onDismiss: () => void;
  maxLength?: number;
}

export function InputDialog({
  visible,
  title,
  placeholder,
  initialValue = '',
  confirmLabel,
  onConfirm,
  onDismiss,
  maxLength = 100,
}: InputDialogProps): React.JSX.Element {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const isDark = themeColors === colors.dark;
  const styles = useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [visible, initialValue]);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    onConfirm(trimmed);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={value}
            onChangeText={setValue}
            onSubmitEditing={handleConfirm}
            placeholder={placeholder}
            placeholderTextColor={themeColors.textSecondary}
            returnKeyType="done"
            maxLength={maxLength}
            autoFocus
            cursorColor={themeColors.accent}
            selectionColor={isDark ? 'rgba(59,130,246,0.3)' : 'rgba(37,99,235,0.2)'}
          />
          <View style={styles.buttons}>
            <Pressable style={styles.button} onPress={onDismiss}>
              <Text style={styles.buttonText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleConfirm}
            >
              <Text style={styles.buttonPrimaryText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (c: ColorTokens, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  dialog: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: isDark ? c.surfaceContainerHigh : c.surface,
    borderRadius: 20,
    padding: spacing.xl,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'transparent',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  title: {
    ...typography.titleLarge,
    color: c.textPrimary,
    marginBottom: spacing.lg,
  },
  input: {
    ...typography.bodyMedium,
    color: c.textPrimary,
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.15)' : c.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: spacing.xl,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    ...typography.labelLarge,
    color: c.textSecondary,
  },
  buttonPrimary: {
    backgroundColor: c.accent,
  },
  buttonPrimaryText: {
    ...typography.labelLarge,
    color: c.textOnAccent,
  },
});
