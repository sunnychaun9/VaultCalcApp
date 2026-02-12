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
          <Pressable
            onPress={onFavorite}
            style={styles.actionButton}
            disabled={isDeleting || isSharing}
            accessibilityRole="button"
            accessibilityLabel={`Favorite ${selectedCount} selected items`}
          >
            <Text style={[styles.favText, (isDeleting || isSharing) && styles.disabledText]}>Fav</Text>
          </Pressable>
        )}
        {onShare != null && (
          <Pressable
            onPress={onShare}
            style={styles.actionButton}
            disabled={isDeleting || isSharing}
            accessibilityRole="button"
            accessibilityLabel={`Share ${selectedCount} selected items`}
          >
            <Text style={[styles.shareText, (isDeleting || isSharing) && styles.disabledText]}>Share</Text>
          </Pressable>
        )}
        {onMore != null && (
          <Pressable
            onPress={onMore}
            style={styles.actionButton}
            disabled={isDeleting || isSharing}
            accessibilityRole="button"
            accessibilityLabel="More actions"
          >
            <Text style={[styles.moreText, (isDeleting || isSharing) && styles.disabledText]}>{'\u22EE'}</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onDelete}
          style={styles.actionButton}
          disabled={isDeleting || isSharing}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${selectedCount} selected items`}
        >
          <Text style={[styles.deleteText, (isDeleting || isSharing) && styles.disabledText]}>Delete</Text>
        </Pressable>
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
