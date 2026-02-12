/**
 * VaultCalc - Selection Overflow Menu
 *
 * Popup menu for additional selection actions that don't fit
 * inline in the SelectionBar (Add to Album, Move to Album,
 * Unhide, Rename, Properties).
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';

interface SelectionOverflowMenuProps {
  visible: boolean;
  onClose: () => void;
  onAddToAlbum?: () => void;
  onMoveToAlbum?: () => void;
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
  onUnhide,
  onRename,
  onProperties,
}: SelectionOverflowMenuProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const menuItems: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [];
    if (onAddToAlbum != null) {
      items.push({ label: 'Add to Album', onPress: onAddToAlbum });
    }
    if (onMoveToAlbum != null) {
      items.push({ label: 'Move to Album', onPress: onMoveToAlbum });
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
  }, [onAddToAlbum, onMoveToAlbum, onUnhide, onRename, onProperties]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.menuContainer}>
          <View style={styles.menu}>
            {menuItems.map((item, index) => (
              <Pressable
                key={item.label}
                style={({ pressed }) => [
                  styles.menuItem,
                  index < menuItems.length - 1 && styles.menuItemBorder,
                  pressed && styles.menuItemPressed,
                ]}
                onPress={() => {
                  onClose();
                  item.onPress();
                }}
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
              >
                <Text style={styles.menuItemText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menuContainer: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing['2xl'],
  },
  menu: {
    backgroundColor: c.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    minHeight: 48,
    justifyContent: 'center',
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  menuItemPressed: {
    backgroundColor: c.surfaceContainerHigh,
  },
  menuItemText: {
    ...typography.bodyLarge,
    color: c.textPrimary,
  },
});
