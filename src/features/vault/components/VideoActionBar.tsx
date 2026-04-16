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
import { Icon, type IconName } from '@shared/components/Icon';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
      Alert.alert(t('common.error'), t('video_actions.share_error'));
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
      Alert.alert(t('video_actions.moved_title'), t('video_actions.moved_body', { count: selectedItems.length }));
    } catch {
      Alert.alert(t('common.error'), t('video_actions.share_error'));
    }
    setIsProcessing(false);
  };

  const handleUnhide = async () => {
    if (selectedItems.length === 0) return;
    Alert.alert(
      t('video_actions.unhide_title'),
      t(selectedCount === 1 ? 'video_actions.unhide_body_one' : 'video_actions.unhide_body_other', { count: selectedCount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('video_actions.unhide'),
          onPress: async () => {
            setIsProcessing(true);
            try {
              await unhideMediaItems(selectedItems);
              queryClient.invalidateQueries({ queryKey: ['media'] });
              onOperationComplete();
            } catch {
              Alert.alert(t('common.error'), t('video_actions.unhide_error'));
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
      t('video_actions.delete_title'),
      t(selectedCount === 1 ? 'video_actions.delete_body_one' : 'video_actions.delete_body_other', { count: selectedCount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              await deleteMediaItems(selectedItems);
              queryClient.invalidateQueries({ queryKey: ['media'] });
              onOperationComplete();
            } catch {
              Alert.alert(t('common.error'), t('video_actions.delete_error'));
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
              {allSelected ? t('video_actions.deselect_all') : t('video_actions.select_all')}
            </Text>
          </Pressable>
          <Text style={styles.countText}>{t('vault.selection_count_other', { count: selectedCount })}</Text>
          <Pressable style={styles.selectBtn} onPress={onDeselectAll} disabled={isProcessing}>
            <Text style={styles.selectBtnText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>

        {/* Action buttons row */}
        <View style={styles.actionsRow}>
          <ActionButton
            icon="share"
            label={t('common.share')}
            onPress={handleShare}
            disabled={isProcessing || selectedCount === 0}
            color={themeColors.accent}
          />
          <ActionButton
            icon="folder"
            label={t('video_actions.move_to_album')}
            onPress={handleMove}
            disabled={isProcessing || selectedCount === 0}
            color={themeColors.accent}
          />
          <ActionButton
            icon="scan"
            label={t('video_actions.unhide')}
            onPress={handleUnhide}
            disabled={isProcessing || selectedCount === 0}
            color={themeColors.accent}
          />
          <ActionButton
            icon="trash"
            label={t('common.delete')}
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
            <Text style={styles.albumPickerTitle}>{t('video_actions.move_to_album')}</Text>
            {albumList.length === 0 ? (
              <Text style={styles.albumPickerEmpty}>{t('video_actions.no_albums')}</Text>
            ) : (
              <FlatList
                data={albumList}
                keyExtractor={a => a.id}
                renderItem={({ item: album }) => (
                  <Pressable
                    style={styles.albumPickerItem}
                    onPress={() => handleMoveToAlbum(album.id)}
                  >
                    <Icon name="folder-open" size={20} color={themeColors.vaultFolderIcon} />
                    <Text style={styles.albumPickerItemText}>{album.name}</Text>
                  </Pressable>
                )}
                style={styles.albumPickerList}
              />
            )}
            <Pressable style={styles.closeBtn} onPress={() => setShowAlbumPicker(false)}>
              <Text style={styles.closeBtnText}>{t('common.cancel')}</Text>
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
  icon: IconName;
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
      <Icon name={icon} size={20} color={disabled ? '#555' : color} />
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
