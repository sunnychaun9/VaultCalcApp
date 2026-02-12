/**
 * VaultCalc - Vault Header Component
 *
 * Header for the vault screen with title and lock button.
 * Lock button returns user to calculator (locks vault).
 *
 * @see FEATURE_INDEX.md VAULT-001, VAULT-006
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@store/authStore';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';

interface VaultHeaderProps {
  /** Title to display */
  title?: string;
  /** Whether to show settings button */
  showSettings?: boolean;
  /** Settings button press handler */
  onSettingsPress?: () => void;
  /** Whether selection mode is active (FILE-007) */
  isSelectionMode?: boolean;
  /** Number of currently selected items */
  selectedCount?: number;
  /** Total number of items in current view */
  totalCount?: number;
  /** Called when user exits selection mode */
  onClearSelection?: () => void;
  /** Called when user taps Select All */
  onSelectAll?: () => void;
}

/**
 * Vault header component with lock button
 */
export function VaultHeader({
  title = 'Private Storage',
  showSettings = true,
  onSettingsPress,
  isSelectionMode = false,
  selectedCount = 0,
  totalCount = 0,
  onClearSelection,
  onSelectAll,
}: VaultHeaderProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation();
  const logout = useAuthStore((state) => state.logout);

  /**
   * Handle lock button press - return to calculator.
   * Thumbnail cache cleanup happens automatically via the global
   * auth subscription in App.tsx when isAuthenticated flips to false.
   */
  const handleLockPress = () => {
    logout();
    navigation.navigate('Calculator' as never);
  };

  // Selection mode header (FILE-007)
  if (isSelectionMode) {
    const allSelected = totalCount > 0 && selectedCount === totalCount;
    return (
      <View style={styles.container}>
        {/* Close selection */}
        <Pressable
          onPress={onClearSelection}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Exit selection mode"
        >
          <Text style={styles.iconText}>{'\u2715'}</Text>
        </Pressable>

        {/* Selection count */}
        <Text style={styles.title} numberOfLines={1}>
          {selectedCount} selected
        </Text>

        {/* Select All / Deselect All */}
        <Pressable
          onPress={onSelectAll}
          style={({ pressed }) => [
            styles.selectAllButton,
            pressed && styles.iconButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={allSelected ? 'Deselect all' : 'Select all'}
        >
          <Text style={styles.selectAllText}>
            {allSelected ? 'Deselect' : 'All'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Lock/Calculator Button */}
      <Pressable
        onPress={handleLockPress}
        style={({ pressed }) => [
          styles.iconButton,
          pressed && styles.iconButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Lock vault and return to calculator"
      >
        <Text style={styles.iconText}>⊞</Text>
      </Pressable>

      {/* Title */}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {/* Settings Button */}
      {showSettings ? (
        <Pressable
          onPress={onSettingsPress}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Text style={styles.iconText}>⚙</Text>
        </Pressable>
      ) : (
        <View style={styles.iconButton} />
      )}
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: layout.topBarHeight,
    paddingHorizontal: spacing.sm,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  title: {
    ...typography.titleLarge,
    color: c.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  iconButtonPressed: {
    backgroundColor: c.overlay,
  },
  iconText: {
    fontSize: 24,
    color: c.textPrimary,
  },
  selectAllButton: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: 20,
  },
  selectAllText: {
    ...typography.labelLarge,
    color: c.accent,
  },
});
