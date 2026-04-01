/**
 * VaultCalc - Vault Header Component
 *
 * Compact header with lock button and up to 2 trailing action slots.
 * Selection mode crossfades in with animated count + select-all controls.
 *
 * @see FEATURE_INDEX.md VAULT-001, VAULT-006
 */

import React, { useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
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

const SPRING_CONFIG = { damping: 18, stiffness: 300, mass: 0.7 };

/**
 * Vault header component with animated selection mode transition
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

  // ── Animated crossfade between normal ↔ selection header ──
  const selectionProgress = useSharedValue(isSelectionMode ? 1 : 0);

  useEffect(() => {
    selectionProgress.value = withSpring(isSelectionMode ? 1 : 0, SPRING_CONFIG);
  }, [isSelectionMode, selectionProgress]);

  const normalHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(selectionProgress.value, [0, 0.4], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(selectionProgress.value, [0, 1], [0, -8], Extrapolation.CLAMP) },
    ],
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  }));

  const selectionHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(selectionProgress.value, [0.4, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(selectionProgress.value, [0, 1], [8, 0], Extrapolation.CLAMP) },
    ],
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  }));

  // Count text animation
  const countScale = useSharedValue(1);
  useEffect(() => {
    if (!isSelectionMode || selectedCount <= 0) return;
    countScale.value = withSpring(1.08, { damping: 10, stiffness: 400 });
    const timer = setTimeout(() => {
      countScale.value = withSpring(1, { damping: 14, stiffness: 200 });
    }, 120);
    return () => clearTimeout(timer);
  }, [selectedCount, isSelectionMode, countScale]);

  const countAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countScale.value }],
  }));

  /**
   * Handle lock button press - return to calculator.
   * Shows interstitial ad on vault exit, then locks.
   */
  const handleLockPress = async () => {
    try {
      const { tryShowInterstitial } = require('@services/ads');
      await tryShowInterstitial('Calculator', 'vault_exit');
    } catch {
      // Ad service may not be initialized — proceed with lock
    }
    logout();
    navigation.navigate('Calculator' as never);
  };

  const allSelected = totalCount > 0 && selectedCount === totalCount;

  return (
    <View style={styles.container}>
      {/* Normal header */}
      <Animated.View style={[styles.headerRow, normalHeaderStyle]} pointerEvents={isSelectionMode ? 'none' : 'auto'}>
        <IconButton
          name="calculator"
          onPress={handleLockPress}
          color={themeColors.textPrimary}
          accessibilityLabel="Lock vault and return to calculator"
        />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
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
      </Animated.View>

      {/* Selection header — crossfades in */}
      <Animated.View style={[styles.headerRow, selectionHeaderStyle]} pointerEvents={isSelectionMode ? 'auto' : 'none'}>
        <IconButton
          name="x"
          onPress={onClearSelection!}
          color={themeColors.textPrimary}
          accessibilityLabel="Exit selection mode"
        />
        <Animated.View style={[styles.countContainer, countAnimStyle]}>
          <Text style={styles.countNumber}>{selectedCount}</Text>
          <Text style={styles.countLabel}>selected</Text>
        </Animated.View>
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
      </Animated.View>
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    height: layout.topBarHeight,
    backgroundColor: c.surface,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.topBarHeight,
    paddingLeft: spacing.xs,
    paddingRight: spacing.xs,
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
  // Selection mode
  countContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    marginLeft: spacing.sm,
    gap: spacing.xs,
  },
  countNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: c.accent,
    fontVariant: ['tabular-nums'],
  },
  countLabel: {
    ...typography.bodyMedium,
    color: c.textSecondary,
  },
  selectAllButton: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 20,
  },
  selectAllText: {
    ...typography.labelLarge,
    color: c.accent,
  },
  pressed: {
    opacity: 0.6,
  },
});
