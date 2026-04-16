/**
 * VaultCalc - Album View Screen
 *
 * Shows media items inside an album as a grid.
 * Supports long-press selection with actions: Move to Album,
 * Delete (remove from album), Unhide, Rename, Properties.
 *
 * @see FEATURE_INDEX.md ALBUM-002
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VaultStackParamList, VaultStackScreenProps } from '@typedefs/navigation';
import { albums as albumsDb, albumMedia as albumMediaDb, mediaItems as mediaItemsDb, type Album, type MediaItem } from '@services/storage/database';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { useOrientation } from '@shared/hooks';
import { Icon } from '@shared/components/Icon';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AlbumsIllustration } from '@shared/illustrations/EmptyStateIllustrations';
import { useAlbumMediaQuery, useAlbumsQuery } from '../hooks';
import { useVaultStore } from '@store/vaultStore';
import { useAuthStore } from '@store/authStore';
import { useActivityTracker } from '@features/auth';
import { shareMediaItems } from '@services/share';
import { unhideMediaItems } from '@services/unhide';
import { deleteMediaItems } from '@services/deletion/deleteService';
import { alert } from '@store/alertStore';
import { useTranslation } from 'react-i18next';
import { MediaGrid, SelectionBar, SelectionOverflowMenu, AddToAlbumModal, RenameModal, PropertiesModal } from '../components';

export function AlbumViewScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation<NativeStackNavigationProp<VaultStackParamList>>();
  const { isLandscape } = useOrientation();
  const gridColumns = isLandscape ? 5 : layout.vaultGridColumns;
  const route = useRoute<VaultStackScreenProps<'AlbumView'>['route']>();
  const queryClient = useQueryClient();
  const { albumId } = route.params;
  const { onActivity } = useActivityTracker();

  const [album, setAlbum] = React.useState<Album | null>(null);
  const { data: mediaItems = [], isLoading } = useAlbumMediaQuery(albumId);
  const { data: albumsData = [] } = useAlbumsQuery();

  const toggleSelection = useVaultStore(s => s.toggleSelection);
  const isSelectionMode = useVaultStore(s => s.isSelectionMode);
  const selectedIds = useVaultStore(s => s.selectedIds);
  const clearSelection = useVaultStore(s => s.clearSelection);
  const isDecoyMode = useAuthStore(s => s.isDecoyMode);
  const setSuppressAutoLock = useAuthStore(s => s.setSuppressAutoLock);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showMoveToAlbum, setShowMoveToAlbum] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showPropertiesModal, setShowPropertiesModal] = useState(false);

  useEffect(() => {
    albumsDb.getById(albumId).then(setAlbum);
  }, [albumId]);

  // Clear selection when leaving the screen
  useEffect(() => {
    return () => { clearSelection(); };
  }, [clearSelection]);

  const handleItemPress = useCallback((item: MediaItem, originRect?: { x: number; y: number; width: number; height: number }) => {
    if (isSelectionMode) {
      toggleSelection(item.id);
    } else {
      const siblingIds = mediaItems.map(i => i.id);
      navigation.navigate('MediaViewer', { mediaId: item.id, mediaIds: siblingIds, originRect });
    }
  }, [isSelectionMode, toggleSelection, navigation, mediaItems]);

  const handleItemLongPress = useCallback((item: MediaItem) => {
    onActivity();
    toggleSelection(item.id);
  }, [onActivity, toggleSelection]);

  /** Remove selected items from this album (not permanent delete) */
  const handleDelete = useCallback(() => {
    onActivity();
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    alert(
      t('album_view.remove_from_album_title'),
      t(ids.length === 1 ? 'album_view.remove_from_album_body_one' : 'album_view.remove_from_album_body_other', { count: ids.length, album: album?.name ?? '' }),
      [
        { text: t('album_view.keep_here'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await albumMediaDb.removeBatch(albumId, ids);

              // If cover was removed, pick the next available item or null
              if (album?.coverMediaId != null && ids.includes(album.coverMediaId)) {
                const remainingIds = await albumMediaDb.getMediaIds(albumId);
                await albumsDb.updateCover(albumId, remainingIds.length > 0 ? remainingIds[0] : null);
                const updated = await albumsDb.getById(albumId);
                if (updated) setAlbum(updated);
              }

              await queryClient.invalidateQueries({ queryKey: ['albumMedia', albumId] });
              await queryClient.invalidateQueries({ queryKey: ['albumMediaCounts', isDecoyMode] });
              await queryClient.invalidateQueries({ queryKey: ['albumCoverMedia', isDecoyMode] });
              clearSelection();
              alert(t('album_view.removed_title'), t(ids.length === 1 ? 'album_view.removed_body_one' : 'album_view.removed_body_other', { count: ids.length }));
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  }, [onActivity, selectedIds, album, albumId, queryClient, isDecoyMode, clearSelection]);

  /** Permanently delete selected items from vault */
  const handlePermanentDelete = useCallback(() => {
    onActivity();
    const selected = mediaItems.filter(i => selectedIds.has(i.id));
    if (selected.length === 0) return;

    alert(
      t('album_view.delete_forever_title'),
      t(selected.length === 1 ? 'album_view.delete_forever_body_one' : 'album_view.delete_forever_body_other', { count: selected.length }),
      [
        { text: t('common.keep'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const result = await deleteMediaItems(selected);
              const deletedIds = selected.filter(s => !result.failed.some(f => f.id === s.id)).map(s => s.id);

              // Update album cover if it was among deleted items
              // (FK ON DELETE SET NULL handles the DB side, but we also pick a new cover)
              if (album?.coverMediaId != null && deletedIds.includes(album.coverMediaId)) {
                const remainingIds = await albumMediaDb.getMediaIds(albumId);
                await albumsDb.updateCover(albumId, remainingIds.length > 0 ? remainingIds[0] : null);
                const updated = await albumsDb.getById(albumId);
                if (updated) setAlbum(updated);
              }

              await queryClient.invalidateQueries({ queryKey: ['albumMedia', albumId] });
              await queryClient.invalidateQueries({ queryKey: ['albumMediaCounts', isDecoyMode] });
              await queryClient.invalidateQueries({ queryKey: ['albumCoverMedia', isDecoyMode] });
              // Invalidate media type queries so doc/photo/video tabs update
              await queryClient.invalidateQueries({ queryKey: ['media'] });
              clearSelection();

              if (result.failed.length > 0) {
                alert(
                  t('album_view.deleted_partial_title'),
                  t('album_view.deleted_partial_body', { deleted: result.deleted, failed: result.failed.length }),
                );
              } else {
                alert(t('album_view.deleted_title'), t(result.deleted === 1 ? 'album_view.deleted_body_one' : 'album_view.deleted_body_other', { count: result.deleted }));
              }
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  }, [onActivity, mediaItems, selectedIds, album, albumId, queryClient, isDecoyMode, clearSelection]);

  /** Share selected items */
  const handleShare = useCallback(async () => {
    onActivity();
    const selected = mediaItems.filter(i => selectedIds.has(i.id));
    if (selected.length === 0) return;

    setIsSharing(true);
    try {
      const result = await shareMediaItems(selected);
      if (result.failed.length > 0 && result.shared > 0) {
        alert(t('album_view.share_partial_title'), t('album_view.share_partial_body', { shared: result.shared, failed: result.failed.length }));
      } else if (result.failed.length > 0) {
        alert(t('album_view.share_failed_title'), t('album_view.share_failed_body', { error: result.failed[0]?.error ?? t('common.unknown') }));
      }
      clearSelection();
    } catch (e) {
      alert(t('album_view.share_error_title'), e instanceof Error ? e.message : String(e));
    } finally {
      setIsSharing(false);
    }
  }, [onActivity, mediaItems, selectedIds, clearSelection]);

  const handleOverflowMore = useCallback(() => {
    onActivity();
    setShowOverflowMenu(true);
  }, [onActivity]);

  /** Move to Album: remove from current album, add to target */
  const handleMoveToAlbumPress = useCallback(() => {
    setShowMoveToAlbum(true);
  }, []);

  const handleSelectTargetAlbum = useCallback(async (targetAlbum: Album) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setIsMoving(true);
    try {
      await albumMediaDb.removeBatch(albumId, ids);
      const added = await albumMediaDb.addBatch(targetAlbum.id, ids);
      if (targetAlbum.coverMediaId === null && ids.length > 0) {
        await albumsDb.updateCover(targetAlbum.id, ids[0]);
      }
      await queryClient.invalidateQueries({ queryKey: ['albumMedia', albumId] });
      await queryClient.invalidateQueries({ queryKey: ['albumMedia', targetAlbum.id] });
      await queryClient.invalidateQueries({ queryKey: ['albumMediaCounts', isDecoyMode] });
      await queryClient.invalidateQueries({ queryKey: ['albumCoverMedia', isDecoyMode] });
      setShowMoveToAlbum(false);
      clearSelection();
      alert(t('album_view.moved_title'), t('album_view.moved_body', { count: added, album: targetAlbum.name }));
    } finally {
      setIsMoving(false);
    }
  }, [selectedIds, albumId, queryClient, isDecoyMode, clearSelection]);

  /** Unhide (export to gallery) */
  const handleUnhide = useCallback(() => {
    onActivity();
    const selected = mediaItems.filter(i => selectedIds.has(i.id));
    if (selected.length === 0) return;

    alert(
      t('album_view.export_title'),
      t(selected.length === 1 ? 'album_view.export_body_one' : 'album_view.export_body_other', { count: selected.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.export'),
          onPress: async () => {
            setSuppressAutoLock(true);
            try {
              const result = await unhideMediaItems(selected);
              if (result.failed.length > 0 && result.saved > 0) {
                alert(t('album_view.export_partial_title'), t('album_view.export_partial_body', { saved: result.saved, failed: result.failed.length }));
              } else if (result.failed.length > 0) {
                alert(t('album_view.export_failed_title'), t('album_view.export_failed_body', { error: result.failed[0]?.error ?? t('common.unknown') }));
              } else {
                alert(t('album_view.export_success_title'), t(result.saved === 1 ? 'album_view.export_success_body_one' : 'album_view.export_success_body_other', { count: result.saved }));
              }
            } catch (e) {
              alert(t('album_view.export_error_title'), e instanceof Error ? e.message : String(e));
            } finally {
              setSuppressAutoLock(false);
            }
            clearSelection();
          },
        },
      ],
    );
  }, [onActivity, mediaItems, selectedIds, setSuppressAutoLock, clearSelection]);

  /** Rename single item */
  const handleRenamePress = useCallback(() => {
    if (selectedIds.size !== 1) return;
    setShowRenameModal(true);
  }, [selectedIds.size]);

  const handleRenameConfirm = useCallback(async (newName: string) => {
    const id = Array.from(selectedIds)[0];
    if (!id) return;

    await mediaItemsDb.rename(id, newName);
    await queryClient.invalidateQueries({ queryKey: ['albumMedia', albumId] });
    await queryClient.invalidateQueries({ queryKey: ['media'] });
    setShowRenameModal(false);
    clearSelection();
  }, [selectedIds, albumId, queryClient, clearSelection]);

  /** Properties for single item */
  const handlePropertiesPress = useCallback(() => {
    if (selectedIds.size !== 1) return;
    setShowPropertiesModal(true);
  }, [selectedIds.size]);

  const singleSelectedItem = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = Array.from(selectedIds)[0];
    return mediaItems.find(i => i.id === id) ?? null;
  }, [selectedIds, mediaItems]);

  // Filter out current album from targets
  const moveTargetAlbums = useMemo(
    () => albumsData.filter(a => a.id !== albumId),
    [albumsData, albumId],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={22} color={themeColors.textPrimary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {isSelectionMode ? t('vault.selection_count_other', { count: selectedIds.size }) : (album?.name ?? t('navigation.album_view'))}
        </Text>
        <View style={styles.backButton} />
      </View>

      {/* Content */}
      {mediaItems.length > 0 ? (
        <MediaGrid
          items={mediaItems}
          isLoading={isLoading}
          onItemPress={handleItemPress}
          onItemLongPress={handleItemLongPress}
          numColumns={gridColumns}
        />
      ) : (
        <Animated.View entering={FadeInUp.springify().damping(18).stiffness(160)} style={styles.emptyContent}>
          <AlbumsIllustration size={140} color={themeColors.textTertiary} accent={themeColors.accent} />
          <Text style={styles.emptyTitle}>{album?.name ?? t('navigation.album_view')}</Text>
          <Text style={styles.emptyDescription}>
            {t('vault.empty_album_view_description')}
          </Text>
        </Animated.View>
      )}

      {/* Selection Bar */}
      {isSelectionMode && (
        <SelectionBar
          selectedCount={selectedIds.size}
          onDelete={handleDelete}
          onClearSelection={clearSelection}
          onMore={handleOverflowMore}
          onShare={handleShare}
          isDeleting={isDeleting}
          isSharing={isSharing}
        />
      )}

      {/* Overflow Menu */}
      <SelectionOverflowMenu
        visible={showOverflowMenu}
        onClose={() => setShowOverflowMenu(false)}
        onMoveToAlbum={handleMoveToAlbumPress}
        onPermanentDelete={handlePermanentDelete}
        onUnhide={handleUnhide}
        onRename={selectedIds.size === 1 ? handleRenamePress : undefined}
        onProperties={selectedIds.size === 1 ? handlePropertiesPress : undefined}
      />

      {/* Move to Album Modal */}
      <AddToAlbumModal
        visible={showMoveToAlbum}
        albums={moveTargetAlbums}
        isAdding={isMoving}
        onSelectAlbum={handleSelectTargetAlbum}
        onCreateNewAlbum={() => {
          // Not supporting inline album creation from move flow for simplicity
          setShowMoveToAlbum(false);
        }}
        onClose={() => setShowMoveToAlbum(false)}
      />

      {/* Rename Modal */}
      <RenameModal
        visible={showRenameModal}
        currentName={singleSelectedItem?.name ?? ''}
        onRename={handleRenameConfirm}
        onClose={() => setShowRenameModal(false)}
      />

      {/* Properties Modal */}
      <PropertiesModal
        visible={showPropertiesModal}
        item={singleSelectedItem}
        onClose={() => {
          setShowPropertiesModal(false);
          clearSelection();
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.vaultBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    ...typography.titleLarge,
    color: c.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.headlineMedium,
    color: c.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyDescription: {
    ...typography.bodyMedium,
    color: c.textSecondary,
    textAlign: 'center',
  },
});
