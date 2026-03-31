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
import { MediaGrid, SelectionBar, SelectionOverflowMenu, AddToAlbumModal, RenameModal, PropertiesModal } from '../components';

export function AlbumViewScreen(): React.JSX.Element {
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
      'Remove from Album',
      `Remove ${ids.length} item(s) from "${album?.name ?? 'this album'}"? Items will not be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
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
              alert('Removed', `${ids.length} item(s) removed from album.`);
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
      'Permanently Delete',
      `Delete ${selected.length} item(s) permanently? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
                  'Partial Deletion',
                  `${result.deleted} deleted, ${result.failed.length} failed.\n\nFailed: ${result.failed.map(f => f.name).join(', ')}`,
                );
              } else {
                alert('Deleted', `${result.deleted} item(s) permanently deleted.`);
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
        alert('Partial Share', `${result.shared} shared, ${result.failed.length} failed.`);
      } else if (result.failed.length > 0) {
        alert('Share Failed', `Could not share: ${result.failed[0]?.error ?? 'Unknown error'}`);
      }
      clearSelection();
    } catch (e) {
      alert('Share Error', e instanceof Error ? e.message : String(e));
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
      alert('Moved', `${added} item(s) moved to "${targetAlbum.name}".`);
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
      'Export to Gallery',
      `Save ${selected.length} item(s) to your device gallery?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            setSuppressAutoLock(true);
            try {
              const result = await unhideMediaItems(selected);
              if (result.failed.length > 0 && result.saved > 0) {
                alert('Partial Export', `${result.saved} exported, ${result.failed.length} failed.`);
              } else if (result.failed.length > 0) {
                alert('Export Failed', `Could not export: ${result.failed[0]?.error ?? 'Unknown error'}`);
              } else {
                alert('Exported', `${result.saved} item(s) saved to gallery.`);
              }
            } catch (e) {
              alert('Export Error', e instanceof Error ? e.message : String(e));
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
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={20} color={themeColors.textPrimary} />
          <Text style={styles.backText}> Back</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {isSelectionMode ? `${selectedIds.size} selected` : (album?.name ?? 'Album')}
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
          <Text style={styles.emptyTitle}>{album?.name ?? 'Album'}</Text>
          <Text style={styles.emptyDescription}>
            This album is empty. Add photos or videos from your vault.
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
    width: 60,
  },
  backText: {
    ...typography.bodyMedium,
    color: c.accent,
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
