/**
 * VaultCalc - Selection Bar
 *
 * Bottom action bar shown when items are selected in the vault grid.
 * Displays selection count with delete and cancel actions.
 *
 * @see FEATURE_INDEX.md FILE-006
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onClearSelection}
        style={styles.cancelButton}
        disabled={isDeleting || isSharing}
        accessibilityRole="button"
        accessibilityLabel="Clear selection"
      >
        <Text style={[styles.cancelText, (isDeleting || isSharing) && styles.disabledText]}>Cancel</Text>
      </Pressable>

      <Text style={styles.countText}>
        {isSharing ? 'Sharing...' : isDeleting ? 'Deleting...' : `${selectedCount} selected`}
      </Text>

      <View style={styles.actions}>
        {onFavorite != null && (
          <IconButton
            name="star"
            size={20}
            onPress={onFavorite}
            disabled={isDeleting || isSharing}
            color={themeColors.accent}
            accessibilityLabel={`Favorite ${selectedCount} selected items`}
          />
        )}
        {onShare != null && (
          <IconButton
            name="share"
            size={20}
            onPress={onShare}
            disabled={isDeleting || isSharing}
            color={themeColors.accent}
            accessibilityLabel={`Share ${selectedCount} selected items`}
          />
        )}
        {onMore != null && (
          <IconButton
            name="more-vertical"
            size={20}
            onPress={onMore}
            disabled={isDeleting || isSharing}
            color={themeColors.accent}
            accessibilityLabel="More actions"
          />
        )}
        <IconButton
          name="trash"
          size={20}
          onPress={onDelete}
          disabled={isDeleting || isSharing}
          color={themeColors.error}
          accessibilityLabel={`Delete ${selectedCount} selected items`}
        />
      </View>
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: layout.bottomBarHeight,
    paddingHorizontal: spacing.base,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
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
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  favText: {
    ...typography.labelLarge,
    color: c.accent,
  },
  shareText: {
    ...typography.labelLarge,
    color: c.accent,
  },
  moreText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: c.accent,
  },
  deleteText: {
    ...typography.labelLarge,
    color: c.error,
  },
  disabledText: {
    color: c.textTertiary,
  },
});
