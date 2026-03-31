/**
 * VaultCalc - Search Bar Component
 *
 * Inline search input for filtering vault items by filename.
 * Collapsible — shows as an icon button until tapped.
 *
 * @see VAULT-003
 */

import React, { useRef, useCallback, useMemo } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { Icon, IconButton } from '@shared/components/Icon';

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
      <Icon name="search" size={16} color={themeColors.textTertiary} />
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
        <IconButton
          name="x"
          size={12}
          onPress={handleClear}
          color={themeColors.textSecondary}
          accessibilityLabel="Clear search"
          hitSize={24}
          containerStyle={styles.clearButton}
        />
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
    marginLeft: spacing.xs,
  },
});
