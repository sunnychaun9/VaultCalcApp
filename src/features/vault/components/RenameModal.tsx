/**
 * VaultCalc - Rename Modal
 *
 * Modal with TextInput for renaming a single media item.
 * Pre-fills with current name (without extension), appends
 * original extension on save.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, Pressable, Modal, TextInput, StyleSheet } from 'react-native';
import { useThemeColors, type ColorTokens, typography } from '@shared/theme';
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
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const inputRef = useRef<TextInput>(null);

  const [baseName, extension] = splitNameAndExtension(currentName);
  const [value, setValue] = useState(baseName);

  // Reset value when modal opens with a new name
  useEffect(() => {
    if (visible) {
      const [newBase] = splitNameAndExtension(currentName);
      setValue(newBase);
      setTimeout(() => inputRef.current?.focus(), 100);
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
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Rename</Text>
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
              placeholderTextColor={themeColors.textSecondary}
            />
            {extension.length > 0 && (
              <Text style={styles.extension}>{extension}</Text>
            )}
          </View>
          <View style={styles.buttons}>
            <Pressable style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleSubmit}
            >
              <Text style={styles.buttonPrimaryText}>Rename</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 340,
  },
  title: {
    ...typography.titleLarge,
    color: c.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  input: {
    ...typography.bodyMedium,
    color: c.textPrimary,
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flex: 1,
  },
  extension: {
    ...typography.bodyMedium,
    color: c.textSecondary,
    marginLeft: 4,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
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
