/**
 * VaultCalc - Search Bar Component
 *
 * Inline search input for filtering vault items by filename.
 * Collapsible — shows as an icon button until tapped.
 *
 * @see VAULT-003
 */

import React, { useRef, useCallback, useMemo } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search files...',
}: SearchBarProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const inputRef = useRef<TextInput>(null);

  const handleClear = useCallback(() => {
    onChangeText('');
    inputRef.current?.focus();
  }, [onChangeText]);

  return (
    <View style={styles.container}>
      <Text style={styles.searchIcon}>{'\u{1F50D}'}</Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={themeColors.textTertiary}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={handleClear} style={styles.clearButton}>
          <Text style={styles.clearIcon}>{'\u2715'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceContainer,
    borderRadius: 12,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: spacing.sm,
    opacity: 0.6,
  },
  input: {
    flex: 1,
    ...typography.bodyMedium,
    color: c.textPrimary,
    paddingVertical: 0,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  clearIcon: {
    fontSize: 12,
    color: c.textSecondary,
  },
});
