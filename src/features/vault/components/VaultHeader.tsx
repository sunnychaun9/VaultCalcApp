/**
 * VaultCalc - Vault Header Component
 *
 * Compact header with lock button and up to 2 trailing action slots.
 * Selection mode swaps to count + select-all / close controls.
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
import { IconButton } from '@shared/components/Icon';

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
  /** Search toggle handler */
  onSearchPress?: () => void;
  /** Whether search is active (for icon highlight) */
  isSearchActive?: boolean;
}

/**
 * Vault header component with lock button
 */
export function VaultHeader({
  title = 'Vault',
  showSettings = true,
  onSettingsPress,
  isSelectionMode = false,
  selectedCount = 0,
  totalCount = 0,
  onClearSelection,
  onSelectAll,
  onSearchPress,
  isSearchActive = false,
}: VaultHeaderProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation();
  const logout = useAuthStore((state) => state.logout);

  /**
   * Handle lock button press - return to calculator.
   * Shows interstitial ad on vault exit, then locks.
   * Thumbnail cache cleanup happens automatically via the global
   * auth subscription in App.tsx when isAuthenticated flips to false.
   */
  const handleLockPress = async () => {
    // Try to show ad on vault exit (non-blocking — skips if not ready)
    try {
      const { tryShowInterstitial } = require('@services/ads');
      await tryShowInterstitial('Calculator', 'vault_exit');
    } catch {
      // Ad service may not be initialized — proceed with lock
    }
    logout();
    navigation.navigate('Calculator' as never);
  };

  // Selection mode header (FILE-007)
  if (isSelectionMode) {
    const allSelected = totalCount > 0 && selectedCount === totalCount;
    return (
      <View style={styles.container}>
        {/* Close selection */}
        <IconButton
          name="x"
          onPress={onClearSelection!}
          color={themeColors.textPrimary}
          accessibilityLabel="Exit selection mode"
        />

        {/* Selection count */}
        <Text style={styles.title} numberOfLines={1}>
          {selectedCount} selected
        </Text>

        {/* Select All / Deselect All */}
        <Pressable
          onPress={onSelectAll}
          style={({ pressed }) => [
            styles.selectAllButton,
            pressed && styles.pressed,
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
      <IconButton
        name="calculator"
        onPress={handleLockPress}
        color={themeColors.textPrimary}
        accessibilityLabel="Lock vault and return to calculator"
      />

      {/* Title — left-aligned for modern feel */}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {/* Trailing actions: search + settings (2 max) */}
      <View style={styles.trailing}>
        {onSearchPress && (
          <IconButton
            name="search"
            size={20}
            onPress={onSearchPress}
            color={isSearchActive ? themeColors.accent : themeColors.textSecondary}
            accessibilityLabel="Search"
          />
        )}
        {showSettings && (
          <IconButton
            name="settings"
            size={20}
            onPress={onSettingsPress!}
            color={themeColors.textSecondary}
            accessibilityLabel="Open settings"
          />
        )}
      </View>
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.topBarHeight,
    paddingLeft: spacing.xs,
    paddingRight: spacing.xs,
    backgroundColor: c.surface,
  },
  title: {
    ...typography.titleLarge,
    color: c.textPrimary,
    flex: 1,
    marginLeft: spacing.xs,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  pressed: {
    opacity: 0.6,
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
