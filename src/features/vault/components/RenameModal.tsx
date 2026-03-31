/**
 * VaultCalc - Rename Bottom Sheet
 *
 * Bottom sheet with TextInput for renaming a single media item.
 * Pre-fills with current name (without extension), appends
 * original extension on save.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type BottomSheetType from '@gorhom/bottom-sheet';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { AppBottomSheet } from '@shared/components/AppBottomSheet';
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
  const sheetRef = useRef<BottomSheetType>(null);

  const [baseName, extension] = splitNameAndExtension(currentName);
  const [value, setValue] = useState(baseName);

  useEffect(() => {
    if (visible) {
      const [newBase] = splitNameAndExtension(currentName);
      setValue(newBase);
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [visible, currentName]);

  const handleSubmit = () => {
    const trimmed = sanitizeUserInput(value).trim();
    if (trimmed.length === 0) return;
    onRename(trimmed + extension);
  };

  return (
    <AppBottomSheet
      ref={sheetRef}
      snapPoints={[260]}
      title="Rename"
      onDismiss={onClose}
    >
      <View style={styles.content}>
        <View style={styles.inputRow}>
          <BottomSheetTextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
            maxLength={200}
            selectTextOnFocus
            autoFocus
            placeholderTextColor={themeColors.textSecondary}
          />
          {extension.length > 0 && (
            <Text style={styles.extension}>{extension}</Text>
          )}
        </View>
        <View style={styles.buttons}>
          <Pressable style={styles.button} onPress={() => sheetRef.current?.close()}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleSubmit}
          >
            <Text style={styles.buttonPrimaryText}>Rename</Text>
          </Pressable>
        </View>
      </View>
    </AppBottomSheet>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    ...typography.bodyMedium,
    color: c.textPrimary,
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 12,
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
