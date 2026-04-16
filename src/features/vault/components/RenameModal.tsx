/**
 * VaultCalc - Rename Dialog
 *
 * Modal dialog with TextInput for renaming a single media item.
 * Pre-fills with current name (without extension), appends
 * original extension on save.
 *
 * Uses RN Modal instead of bottom sheet to avoid Android keyboard
 * issues where adjustResize collapses the bottom sheet.
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
import { sanitizeUserInput } from '@shared/utils/formatters';

interface RenameModalProps {
  visible: boolean;
  currentName: string;
  onRename: (newName: string) => void;
  onClose: () => void;
}

/** Split "photo.jpg" → ["photo", ".jpg"]; "README" → ["README", ""] */
function splitNameAndExtension(name: string): [string, string] {
  const dot = name.lastIndexOf('.');
  if (dot > 0) {
    return [name.substring(0, dot), name.substring(dot)];
  }
  return [name, ''];
}

export function RenameModal({
  visible,
  currentName,
  onRename,
  onClose,
}: RenameModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const isDark = themeColors === colors.dark;
  const styles = useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);
  const inputRef = useRef<TextInput>(null);

  const [baseName, extension] = splitNameAndExtension(currentName);
  const [value, setValue] = useState(baseName);

  useEffect(() => {
    if (visible) {
      const [newBase] = splitNameAndExtension(currentName);
      setValue(newBase);
    }
  }, [visible, currentName]);

  const handleSubmit = () => {
    const trimmed = sanitizeUserInput(value).trim();
    if (trimmed.length === 0) return;
    onRename(trimmed + extension);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.dialog}>
          <Text style={styles.title}>{t('vault.rename_title')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={value}
              onChangeText={setValue}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
              maxLength={200}
              selectTextOnFocus
              autoFocus
              cursorColor={themeColors.accent}
              selectionColor={isDark ? 'rgba(59,130,246,0.3)' : 'rgba(37,99,235,0.2)'}
              placeholderTextColor={themeColors.textSecondary}
            />
            {extension.length > 0 && (
              <Text style={styles.extension}>{extension}</Text>
            )}
          </View>
          <View style={styles.buttons}>
            <Pressable style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleSubmit}
            >
              <Text style={styles.buttonPrimaryText}>{t('common.rename')}</Text>
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
    // Elevation shadow
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
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
    flex: 1,
  },
  extension: {
    ...typography.bodyMedium,
    color: c.textSecondary,
    marginLeft: spacing.xs,
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
