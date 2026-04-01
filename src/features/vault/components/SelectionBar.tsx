/**
 * VaultCalc - Selection Bar
 *
 * Bottom action bar shown when items are selected in the vault grid.
 * Slides up with spring animation on entry.
 * Displays selection count with action icons.
 *
 * @see FEATURE_INDEX.md FILE-006
 */

import React, { useMemo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { IconButton } from '@shared/components/Icon';

interface SelectionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onClearSelection: () => void;
  onMore?: () => void;
  onShare?: () => void;
  onFavorite?: () => void;
  /** Whether a batch delete is in progress */
  isDeleting?: boolean;
  /** Whether a share operation is in progress */
  isSharing?: boolean;
}

const SPRING_CONFIG = { damping: 16, stiffness: 280, mass: 0.7 };
const BAR_HEIGHT = layout.bottomBarHeight + 4; // Slightly taller for premium feel

export function SelectionBar({
  selectedCount,
  onDelete,
  onClearSelection,
  onMore,
  onShare,
  onFavorite,
  isDeleting = false,
  isSharing = false,
}: SelectionBarProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Slide-up entrance animation
  const translateY = useSharedValue(BAR_HEIGHT);

  useEffect(() => {
    translateY.value = withSpring(0, SPRING_CONFIG);
  }, [translateY]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Count bounce on change
  const countScale = useSharedValue(1);
  useEffect(() => {
    countScale.value = withSpring(1.1, { damping: 10, stiffness: 400 });
    const timer = setTimeout(() => {
      countScale.value = withSpring(1, { damping: 14, stiffness: 200 });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedCount, countScale]);

  const countAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countScale.value }],
  }));

  const busy = isDeleting || isSharing;

  return (
    <Animated.View style={[styles.container, slideStyle]}>
      <Pressable
        onPress={onClearSelection}
        style={styles.cancelButton}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Clear selection"
      >
        <Text style={[styles.cancelText, busy && styles.disabledText]}>Cancel</Text>
      </Pressable>

      <Animated.View style={countAnimStyle}>
        <Text style={styles.countText}>
          {isSharing ? 'Sharing...' : isDeleting ? 'Deleting...' : (
            <>
              <Text style={styles.countNumber}>{selectedCount}</Text>
              {' selected'}
            </>
          )}
        </Text>
      </Animated.View>

      <View style={styles.actions}>
        {onFavorite != null && (
          <IconButton
            name="star"
            size={20}
            onPress={onFavorite}
            disabled={busy}
            color={themeColors.accent}
            accessibilityLabel={`Favorite ${selectedCount} selected items`}
          />
        )}
        {onShare != null && (
          <IconButton
            name="share"
            size={20}
            onPress={onShare}
            disabled={busy}
            color={themeColors.accent}
            accessibilityLabel={`Share ${selectedCount} selected items`}
          />
        )}
        {onMore != null && (
          <IconButton
            name="more-vertical"
            size={20}
            onPress={onMore}
            disabled={busy}
            color={themeColors.accent}
            accessibilityLabel="More actions"
          />
        )}
        <IconButton
          name="trash"
          size={20}
          onPress={onDelete}
          disabled={busy}
          color={themeColors.error}
          accessibilityLabel={`Delete ${selectedCount} selected items`}
        />
      </View>
    </Animated.View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: BAR_HEIGHT,
    paddingHorizontal: spacing.base,
    backgroundColor: c.surfaceContainer,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cancelButton: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  cancelText: {
    ...typography.labelLarge,
    color: c.textSecondary,
  },
  countText: {
    ...typography.labelLarge,
    color: c.textPrimary,
  },
  countNumber: {
    fontWeight: '700',
    color: c.accent,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  disabledText: {
    color: c.textTertiary,
  },
});
