/**
 * VaultCalc - Video Action Bar
 *
 * Bottom action bar for batch video operations.
 * Shown when videos are selected in multi-select mode.
 * Supports: Select All, Deselect All, Share, Move, Unhide, Delete.
 *
 * @see FEATURE_INDEX.md VIDEO-010
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { albums, albumMedia, type MediaItem, type Album } from '@services/storage/database';
import { shareMediaItems } from '@services/share';
import { deleteMediaItems } from '@services/deletion';
import { unhideMediaItems } from '@services/unhide';
import { useAuthStore } from '@store/authStore';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';

interface VideoActionBarProps {
  selectedItems: MediaItem[];
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onOperationComplete: () => void;
}

export function VideoActionBar({
  selectedItems,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onOperationComplete,
}: VideoActionBarProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const queryClient = useQueryClient();
  const isDecoyMode = useAuthStore(s => s.isDecoyMode);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [albumList, setAlbumList] = useState<Album[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedCount = selectedItems.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;

  const handleShare = async () => {
    if (selectedItems.length === 0) return;
    setIsProcessing(true);
    try {
      await shareMediaItems(selectedItems);
    } catch {
      Alert.alert('Error', 'Failed to share selected videos.');
    }
    setIsProcessing(false);
  };

  const handleMove = async () => {
    const allAlbums = await albums.getAll(isDecoyMode);
    setAlbumList(allAlbums);
    setShowAlbumPicker(true);
  };

  const handleMoveToAlbum = async (albumId: string) => {
    setIsProcessing(true);
    try {
      const mediaIds = selectedItems.map(i => i.id);
      await albumMedia.addBatch(albumId, mediaIds);
      queryClient.invalidateQueries({ queryKey: ['albumMedia', albumId] });
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      setShowAlbumPicker(false);
      onOperationComplete();
      Alert.alert('Moved', `${selectedItems.length} video(s) moved to album.`);
    } catch {
      Alert.alert('Error', 'Failed to move videos.');
    }
    setIsProcessing(false);
  };

  const handleUnhide = async () => {
    if (selectedItems.length === 0) return;
    Alert.alert(
      'Unhide Videos',
      `Restore ${selectedCount} video(s) to device gallery?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unhide',
          onPress: async () => {
            setIsProcessing(true);
            try {
              await unhideMediaItems(selectedItems);
              queryClient.invalidateQueries({ queryKey: ['media'] });
              onOperationComplete();
            } catch {
              Alert.alert('Error', 'Failed to unhide videos.');
            }
            setIsProcessing(false);
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    if (selectedItems.length === 0) return;
    Alert.alert(
      'Delete Videos',
      `Permanently delete ${selectedCount} video(s)? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              await deleteMediaItems(selectedItems);
              queryClient.invalidateQueries({ queryKey: ['media'] });
              onOperationComplete();
            } catch {
              Alert.alert('Error', 'Failed to delete videos.');
            }
            setIsProcessing(false);
          },
        },
      ],
    );
  };

  return (
    <>
      <View style={styles.container}>
        {/* Top row: Select All / Deselect All */}
        <View style={styles.selectRow}>
          <Pressable
            style={styles.selectBtn}
            onPress={allSelected ? onDeselectAll : onSelectAll}
            disabled={isProcessing}
          >
            <Text style={styles.selectBtnText}>
              {allSelected ? 'Deselect All' : 'Select All'}
            </Text>
          </Pressable>
          <Text style={styles.countText}>{selectedCount} selected</Text>
          <Pressable style={styles.selectBtn} onPress={onDeselectAll} disabled={isProcessing}>
            <Text style={styles.selectBtnText}>Cancel</Text>
          </Pressable>
        </View>

        {/* Action buttons row */}
        <View style={styles.actionsRow}>
          <ActionButton
            icon={'\u2B06'}
            label="Share"
            onPress={handleShare}
            disabled={isProcessing || selectedCount === 0}
            color={themeColors.accent}
          />
          <ActionButton
            icon={'\uD83D\uDCC1'}
            label="Move"
            onPress={handleMove}
            disabled={isProcessing || selectedCount === 0}
            color={themeColors.accent}
          />
          <ActionButton
            icon={'\uD83D\uDC41'}
            label="Unhide"
            onPress={handleUnhide}
            disabled={isProcessing || selectedCount === 0}
            color={themeColors.accent}
          />
          <ActionButton
            icon={'\uD83D\uDDD1'}
            label="Delete"
            onPress={handleDelete}
            disabled={isProcessing || selectedCount === 0}
            color={themeColors.error}
          />
        </View>
      </View>

      {/* Album Picker Modal */}
      <Modal visible={showAlbumPicker} transparent animationType="slide" onRequestClose={() => setShowAlbumPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAlbumPicker(false)}>
          <View style={styles.albumPickerContainer}>
            <Text style={styles.albumPickerTitle}>Move to Album</Text>
            {albumList.length === 0 ? (
              <Text style={styles.albumPickerEmpty}>No albums found. Create an album first.</Text>
            ) : (
              <FlatList
                data={albumList}
                keyExtractor={a => a.id}
                renderItem={({ item: album }) => (
                  <Pressable
                    style={styles.albumPickerItem}
                    onPress={() => handleMoveToAlbum(album.id)}
                  >
                    <Text style={styles.albumPickerItemIcon}>{'\uD83D\uDCC2'}</Text>
                    <Text style={styles.albumPickerItemText}>{album.name}</Text>
                  </Pressable>
                )}
                style={styles.albumPickerList}
              />
            )}
            <Pressable style={styles.closeBtn} onPress={() => setShowAlbumPicker(false)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Action Button ─────────────────────────────────────────────────

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  color,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled: boolean;
  color: string;
}): React.JSX.Element {
  return (
    <Pressable
      style={actionStyles.button}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[actionStyles.icon, { color: disabled ? '#555' : color }]}>{icon}</Text>
      <Text style={[actionStyles.label, { color: disabled ? '#555' : '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

const actionStyles = StyleSheet.create({
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  icon: { fontSize: 22, marginBottom: 4 },
  label: { fontSize: 11, fontWeight: '600' },
});

// ─── Styles ──────────────────────────────────────────────────────────

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingBottom: 8,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  selectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  selectBtnText: {
    ...typography.labelMedium,
    color: c.accent,
  },
  countText: {
    ...typography.labelLarge,
    color: c.textPrimary,
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingTop: 8,
  },

  // ── Album picker ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  albumPickerContainer: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    maxHeight: 400,
  },
  albumPickerTitle: {
    ...typography.titleMedium,
    color: '#FFFFFF',
    marginBottom: spacing.md,
  },
  albumPickerEmpty: {
    ...typography.bodyMedium,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  albumPickerList: { maxHeight: 250 },
  albumPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  albumPickerItemIcon: { fontSize: 22, marginRight: 12 },
  albumPickerItemText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  closeBtn: {
    marginTop: spacing.md,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  closeBtnText: {
    ...typography.labelLarge,
    color: '#FFFFFF',
  },
});
