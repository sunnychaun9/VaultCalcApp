/**
 * VaultCalc - Selection Overflow Menu
 *
 * Bottom sheet menu for additional selection actions that don't fit
 * inline in the SelectionBar (Add to Album, Move to Album,
 * Unhide, Rename, Properties).
 */

import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type BottomSheetType from '@gorhom/bottom-sheet';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { AppBottomSheet } from '@shared/components/AppBottomSheet';

interface SelectionOverflowMenuProps {
  visible: boolean;
  onClose: () => void;
  onAddToAlbum?: () => void;
  onMoveToAlbum?: () => void;
  onPermanentDelete?: () => void;
  onUnhide?: () => void;
  onRename?: () => void;
  onProperties?: () => void;
}

interface MenuItem {
  label: string;
  onPress: () => void;
}

export function SelectionOverflowMenu({
  visible,
  onClose,
  onAddToAlbum,
  onMoveToAlbum,
  onPermanentDelete,
  onUnhide,
  onRename,
  onProperties,
}: SelectionOverflowMenuProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const sheetRef = useRef<BottomSheetType>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const handleItemPress = useCallback((action: () => void) => {
    onClose();
    action();
  }, [onClose]);

  const menuItems: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [];
    if (onAddToAlbum != null) {
      items.push({ label: 'Add to Album', onPress: onAddToAlbum });
    }
    if (onMoveToAlbum != null) {
      items.push({ label: 'Move to Album', onPress: onMoveToAlbum });
    }
    if (onPermanentDelete != null) {
      items.push({ label: 'Permanently Delete', onPress: onPermanentDelete });
    }
    if (onUnhide != null) {
      items.push({ label: 'Export to Gallery', onPress: onUnhide });
    }
    if (onRename != null) {
      items.push({ label: 'Rename', onPress: onRename });
    }
    if (onProperties != null) {
      items.push({ label: 'Properties', onPress: onProperties });
    }
    return items;
  }, [onAddToAlbum, onMoveToAlbum, onPermanentDelete, onUnhide, onRename, onProperties]);

  // Dynamic snap based on item count: each item ~52dp + handle(20) + title(52) + bottom padding(24)
  const snapHeight = Math.min(menuItems.length * 52 + 96, 500);

  return (
    <AppBottomSheet
      ref={sheetRef}
      snapPoints={[snapHeight]}
      onDismiss={onClose}
      title="Actions"
    >
      <View style={styles.menu}>
        {menuItems.map((item, index) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [
              styles.menuItem,
              index < menuItems.length - 1 && styles.menuItemBorder,
              pressed && styles.menuItemPressed,
            ]}
            onPress={() => handleItemPress(item.onPress)}
            accessibilityRole="menuitem"
            accessibilityLabel={item.label}
          >
            <Text style={styles.menuItemText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </AppBottomSheet>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  menu: {
    paddingHorizontal: spacing.sm,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 10,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    borderRadius: 0,
  },
  menuItemPressed: {
    backgroundColor: c.surfaceContainerHigh,
  },
  menuItemText: {
    ...typography.bodyLarge,
    color: c.textPrimary,
  },
});
