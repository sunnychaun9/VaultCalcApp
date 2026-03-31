/**
 * VaultCalc - Vault Home Screen
 *
 * Main vault screen showing protected files organized by type.
 * Features tab navigation for different file types.
 *
 * @see 02-UX-Design.md Section 5
 * @see FEATURE_INDEX.md VAULT-001
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView as RNScrollView,
  TextInput,
  StyleSheet,
} from 'react-native';
import type BottomSheetType from '@gorhom/bottom-sheet';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { AppBottomSheet } from '@shared/components/AppBottomSheet';
import PagerView from 'react-native-pager-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VaultStackParamList } from '@typedefs/navigation';
import { VaultHeader, EmptyState, FloatingAddButton, MediaGrid, MediaList, DocumentList, AudioList, SelectionBar, ImportProgressOverlay, AlbumList, AddToAlbumModal, NoteList, SelectionOverflowMenu, RenameModal, PropertiesModal, SearchBar } from '../components';
import { useMediaQuery, useAlbumsQuery, useNotesQuery, type TabType } from '../hooks';
import { useActivityTracker } from '@features/auth';
import { useVaultStore } from '@store/vaultStore';
import { useAuthStore } from '@store/authStore';
import { useSettingsStore } from '@store/settingsStore';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { useOrientation } from '@shared/hooks';
import { Icon } from '@shared/components/Icon';
import { mediaItems as mediaItemsDb, albums as albumsDb, albumMedia as albumMediaDb, notes as notesDb, type MediaItem, type MediaType, type Album, type Note } from '@services/storage/database';
import { pickFilesForTab } from '@services/filePicker';
import { importFiles, type ImportProgress } from '@services/import';
import { generateKey } from '@services/crypto';
import { deleteMediaItems } from '@services/deletion';
import { shareMediaItems, shareNoteAsText } from '@services/share';
import { unhideMediaItems } from '@services/unhide';
import { requestGalleryPermissions, hasGalleryPermissions, type GalleryMediaType } from '@services/gallery';
import { alert } from '@store/alertStore';
import { sanitizeUserInput } from '@shared/utils/formatters';

/** Tab configuration */
const TABS: { key: TabType; label: string }[] = [
  { key: 'images', label: 'Images' },
  { key: 'videos', label: 'Videos' },
  { key: 'audio', label: 'Audio' },
  { key: 'documents', label: 'Docs' },
  { key: 'albums', label: 'Albums' },
  { key: 'notes', label: 'Notes' },
];

/** Map UI tab → database MediaType (null = unsupported) */
const TAB_TO_MEDIA_TYPE: Record<TabType, MediaType | null> = {
  images: 'photo',
  videos: 'video',
  audio: 'audio',
  documents: 'document',
  albums: null,
  notes: null,
};

/**
 * Vault Home Screen Component
 *
 * The main vault interface showing:
 * - Header with lock button
 * - Tab navigation for file types
 * - File grid/list (empty state for now)
 * - FAB for adding files
 */
export function VaultHomeScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation<NativeStackNavigationProp<VaultStackParamList>>();
  const { isLandscape } = useOrientation();
  const gridColumns = isLandscape ? 5 : layout.vaultGridColumns;
  const queryClient = useQueryClient();
  const tabScrollRef = useRef<RNScrollView>(null);
  const pagerRef = useRef<PagerView>(null);
  const sortSheetRef = useRef<BottomSheetType>(null);
  const createAlbumSheetRef = useRef<BottomSheetType>(null);
  const renameAlbumSheetRef = useRef<BottomSheetType>(null);
  const createNoteSheetRef = useRef<BottomSheetType>(null);
  const [activeTab, setActiveTab] = useState<TabType>('images');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  // Sort sheet state removed — managed by sheet ref
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showPropertiesModal, setShowPropertiesModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Track user activity to prevent auto-lock (AUTH-008)
  const { onActivity } = useActivityTracker();

  // Media query for active tab (VAULT-003)
  const { data: items, isLoading } = useMediaQuery(activeTab, showFavoritesOnly);
  const toggleSelection = useVaultStore(s => s.toggleSelection);
  const isSelectionMode = useVaultStore(s => s.isSelectionMode);
  const selectedIds = useVaultStore(s => s.selectedIds);
  const clearSelection = useVaultStore(s => s.clearSelection);
  const selectAll = useVaultStore(s => s.selectAll);
  const sortBy = useVaultStore(s => s.sortBy);
  const sortOrder = useVaultStore(s => s.sortOrder);
  const setSortBy = useVaultStore(s => s.setSortBy);
  const toggleSortOrder = useVaultStore(s => s.toggleSortOrder);
  const viewMode = useVaultStore(s => s.viewMode);
  const setViewMode = useVaultStore(s => s.setViewMode);

  // Search filter — applied client-side on top of the React Query data
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i => i.originalName.toLowerCase().includes(q));
  }, [items, searchQuery]);
  const isDecoyMode = useAuthStore(s => s.isDecoyMode);
  const setSuppressAutoLock = useAuthStore(s => s.setSuppressAutoLock);
  const deleteOriginalsAfterImport = useSettingsStore(s => s.deleteOriginalsAfterImport);

  // Albums state (ALBUM-001)
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const albumNameInputRef = useRef<TextInput>(null);
  const { data: albumsData = [], isLoading: albumsLoading } = useAlbumsQuery();

  // Notes state (NOTES-001)
  const { data: notesData = [], isLoading: notesLoading } = useNotesQuery();
  const [showCreateNote, setShowCreateNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const noteNameInputRef = useRef<TextInput>(null);

  // Add to Album state (ALBUM-003)
  const [showAddToAlbum, setShowAddToAlbum] = useState(false);
  const [isAddingToAlbum, setIsAddingToAlbum] = useState(false);
  const pendingAddMediaIdsRef = useRef<string[] | null>(null);

  // Rename Album state (ALBUM-005)
  const [showRenameAlbum, setShowRenameAlbum] = useState(false);
  const [renameAlbumTarget, setRenameAlbumTarget] = useState<Album | null>(null);
  const [renameAlbumName, setRenameAlbumName] = useState('');
  const renameInputRef = useRef<TextInput>(null);

  // Album media counts (ALBUM-002)
  const { data: mediaCounts } = useQuery({
    queryKey: ['albumMediaCounts', isDecoyMode],
    queryFn: () => albumsDb.getMediaCountsByDecoy(isDecoyMode),
    enabled: albumsData.length > 0,
  });

  // Album cover media (ALBUM-004)
  const { data: coverMediaMap } = useQuery({
    queryKey: ['albumCoverMedia', isDecoyMode],
    queryFn: () => albumsDb.getCoverMediaMap(isDecoyMode),
    enabled: albumsData.length > 0,
  });

  // Auto-focus album name input when modal opens
  useEffect(() => {
    if (showCreateAlbum) {
      setTimeout(() => albumNameInputRef.current?.focus(), 100);
    }
  }, [showCreateAlbum]);

  // Auto-focus rename input when modal opens (ALBUM-005)
  useEffect(() => {
    if (showRenameAlbum) {
      setTimeout(() => renameInputRef.current?.focus(), 100);
    }
  }, [showRenameAlbum]);

  // Auto-focus note name input when modal opens (NOTES-001)
  useEffect(() => {
    if (showCreateNote) {
      setTimeout(() => noteNameInputRef.current?.focus(), 100);
    }
  }, [showCreateNote]);

  /**
   * Handle settings button press
   */
  const handleSettingsPress = useCallback(() => {
    onActivity();
    navigation.navigate('Settings');
  }, [onActivity, navigation]);

  /**
   * Handle subscription/upgrade press (PREMIUM-004)
   */
  const handleSubscription = useCallback(() => {
    onActivity();
    navigation.navigate('Subscription');
  }, [onActivity, navigation]);

  /**
   * Handle create album modal open
   */
  const handleCreateAlbum = useCallback(() => {
    onActivity();
    setShowCreateAlbum(true);
    createAlbumSheetRef.current?.expand();
  }, [onActivity]);

  /**
   * Handle confirm create album
   */
  const handleConfirmCreateAlbum = useCallback(async () => {
    const trimmed = sanitizeUserInput(newAlbumName).trim();
    if (trimmed.length === 0) return;

    const newAlbum = await albumsDb.create(trimmed, isDecoyMode);
    await queryClient.invalidateQueries({ queryKey: ['albums'] });

    const pendingIds = pendingAddMediaIdsRef.current;
    if (pendingIds !== null && pendingIds.length > 0) {
      const added = await albumMediaDb.addBatch(newAlbum.id, pendingIds);
      await albumsDb.updateCover(newAlbum.id, pendingIds[0]);
      await queryClient.invalidateQueries({ queryKey: ['albumMedia', newAlbum.id] });
      await queryClient.invalidateQueries({ queryKey: ['albumMediaCounts', isDecoyMode] });
      await queryClient.invalidateQueries({ queryKey: ['albumCoverMedia', isDecoyMode] });
      pendingAddMediaIdsRef.current = null;
      clearSelection();
      setShowCreateAlbum(false);
      setNewAlbumName('');
      alert('Added to Album', `Created "${newAlbum.name}" and added ${added} item(s).`);
    } else {
      setShowCreateAlbum(false);
      setNewAlbumName('');
    }
  }, [newAlbumName, isDecoyMode, queryClient, clearSelection]);

  /**
   * Handle album press — navigate to AlbumView
   */
  const handleAlbumPress = useCallback((album: Album) => {
    onActivity();
    navigation.navigate('AlbumView', { albumId: album.id });
  }, [onActivity, navigation]);

  /**
   * Handle album long press — show delete/rename options (ALBUM-005)
   */
  const handleAlbumLongPress = useCallback((album: Album) => {
    onActivity();
    alert(album.name, undefined, [
      {
        text: 'Rename',
        onPress: () => {
          setRenameAlbumTarget(album);
          setRenameAlbumName(album.name);
          setShowRenameAlbum(true);
          renameAlbumSheetRef.current?.expand();
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          alert(
            'Delete Album',
            `Delete "${album.name}"? Media items will not be deleted.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await albumsDb.deleteById(album.id);
                  await queryClient.invalidateQueries({ queryKey: ['albums'] });
                  await queryClient.invalidateQueries({ queryKey: ['albumMediaCounts', isDecoyMode] });
                  await queryClient.invalidateQueries({ queryKey: ['albumCoverMedia', isDecoyMode] });
                  alert('Deleted', `"${album.name}" has been deleted.`);
                },
              },
            ],
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [onActivity, queryClient, isDecoyMode]);

  /**
   * Handle confirm rename album (ALBUM-005)
   */
  const handleConfirmRenameAlbum = useCallback(async () => {
    const trimmed = sanitizeUserInput(renameAlbumName).trim();
    if (trimmed.length === 0 || renameAlbumTarget === null) return;

    await albumsDb.rename(renameAlbumTarget.id, trimmed);
    await queryClient.invalidateQueries({ queryKey: ['albums'] });
    setShowRenameAlbum(false);
    setRenameAlbumTarget(null);
    setRenameAlbumName('');
  }, [renameAlbumName, renameAlbumTarget, queryClient]);

  /**
   * Handle create note modal open (NOTES-001)
   */
  const handleCreateNote = useCallback(() => {
    onActivity();
    setShowCreateNote(true);
    createNoteSheetRef.current?.expand();
  }, [onActivity]);

  /**
   * Handle confirm create note (NOTES-001, NOTES-002)
   */
  const handleConfirmCreateNote = useCallback(async () => {
    const trimmed = sanitizeUserInput(newNoteTitle).trim();
    if (trimmed.length === 0) return;

    const keyResult = await generateKey(16);
    if (!keyResult.success || !keyResult.data) return;
    const id = keyResult.data.replace(/[+/=]/g, '').substring(0, 22);
    await notesDb.insert({
      id,
      title: trimmed,
      content: '',
      createdAt: Date.now(),
      isDecoy: isDecoyMode,
    });
    await queryClient.invalidateQueries({ queryKey: ['notes'] });
    setShowCreateNote(false);
    setNewNoteTitle('');
    navigation.navigate('NoteEditor', { noteId: id });
  }, [newNoteTitle, isDecoyMode, queryClient, navigation]);

  /**
   * Handle note press — open editor (NOTES-002)
   */
  const handleNotePress = useCallback((note: Note) => {
    onActivity();
    if (isSelectionMode) {
      toggleSelection(note.id);
    } else {
      navigation.navigate('NoteEditor', { noteId: note.id });
    }
  }, [onActivity, isSelectionMode, toggleSelection, navigation]);

  /**
   * Handle note long press — enter selection mode (NOTES-001)
   */
  const handleNoteLongPress = useCallback((note: Note) => {
    onActivity();
    toggleSelection(note.id);
  }, [onActivity, toggleSelection]);

  /**
   * Handle share selected items (ENH-001)
   */
  const handleShare = useCallback(async () => {
    onActivity();

    // Notes tab: share selected notes as text
    if (activeTab === 'notes') {
      const selectedNotes = notesData.filter(n => selectedIds.has(n.id));
      if (selectedNotes.length === 0) return;
      setIsSharing(true);
      try {
        const combined = selectedNotes.map(n => `${n.title}\n\n${n.content}`).join('\n\n---\n\n');
        const title = selectedNotes.length === 1 ? selectedNotes[0].title : 'Notes';
        await shareNoteAsText(title, selectedNotes.length === 1 ? selectedNotes[0].content : combined);
        clearSelection();
      } finally {
        setIsSharing(false);
      }
      return;
    }

    // Media tabs: share selected items
    const selectedItems = items.filter(item => selectedIds.has(item.id));
    if (selectedItems.length === 0) return;

    setIsSharing(true);
    try {
      const result = await shareMediaItems(selectedItems);
      if (result.failed.length > 0 && result.shared > 0) {
        alert(
          'Partial Share',
          `${result.shared} shared, ${result.failed.length} failed.\n\nFailed: ${result.failed.map(f => f.name).join(', ')}`,
        );
      } else if (result.failed.length > 0) {
        alert('Share Failed', `Could not share: ${result.failed[0]?.error ?? 'Unknown error'}`);
      }
      clearSelection();
    } catch (e) {
      alert('Share Error', e instanceof Error ? e.message : String(e));
    } finally {
      setIsSharing(false);
    }
  }, [onActivity, activeTab, notesData, items, selectedIds, clearSelection]);

  /**
   * Handle batch favorite toggle of selected items (ENH-002).
   * If every selected item is already favorited → un-favorite all.
   * Otherwise → favorite all.
   */
  const handleFavorite = useCallback(async () => {
    onActivity();
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // Determine toggle direction from current data
    const allFavorited = ids.every(id => items.find(i => i.id === id)?.isFavorite);
    const newValue = !allFavorited;

    const mediaType = TAB_TO_MEDIA_TYPE[activeTab];

    // Optimistic cache update — apply immediately before the DB write.
    // No invalidateQueries afterward: the optimistic update is authoritative
    // for this field, and a redundant refetch causes FlashList to re-layout
    // and recycle cells, which briefly blanks decrypted thumbnails.
    if (mediaType !== null) {
      queryClient.setQueryData<MediaItem[]>(
        ['media', mediaType, isDecoyMode],
        (old) => old?.map(i => ids.includes(i.id) ? { ...i, isFavorite: newValue } : i),
      );
    }

    await mediaItemsDb.setFavorite(ids, newValue);
    clearSelection();
  }, [onActivity, selectedIds, items, activeTab, queryClient, isDecoyMode, clearSelection]);

  /**
   * Handle add to album press — open album picker modal (ALBUM-003)
   */
  const handleAddToAlbumPress = useCallback(() => {
    onActivity();
    setShowAddToAlbum(true);
  }, [onActivity]);

  /**
   * Handle album selected for adding media (ALBUM-003)
   */
  const handleSelectAlbumForAdd = useCallback(async (album: Album) => {
    const mediaIds = Array.from(selectedIds);
    setIsAddingToAlbum(true);
    try {
      const added = await albumMediaDb.addBatch(album.id, mediaIds);
      if (album.coverMediaId === null && mediaIds.length > 0) {
        await albumsDb.updateCover(album.id, mediaIds[0]);
        await queryClient.invalidateQueries({ queryKey: ['albumCoverMedia', isDecoyMode] });
      }
      await queryClient.invalidateQueries({ queryKey: ['albumMedia', album.id] });
      await queryClient.invalidateQueries({ queryKey: ['albumMediaCounts', isDecoyMode] });
      setShowAddToAlbum(false);
      clearSelection();
      alert('Added to Album', `${added} item(s) added to "${album.name}".`);
    } finally {
      setIsAddingToAlbum(false);
    }
  }, [selectedIds, queryClient, isDecoyMode, clearSelection]);

  /**
   * Handle create new album from add-to-album modal (ALBUM-003)
   */
  const handleCreateNewAlbumForAdd = useCallback(() => {
    pendingAddMediaIdsRef.current = Array.from(selectedIds);
    setShowAddToAlbum(false);
    setShowCreateAlbum(true);
    createAlbumSheetRef.current?.expand();
  }, [selectedIds]);

  /**
   * Handle overflow "More" button press
   */
  const handleOverflowMore = useCallback(() => {
    onActivity();
    setShowOverflowMenu(true);
  }, [onActivity]);

  /**
   * Handle unhide (export to gallery) selected items
   */
  const handleUnhide = useCallback(() => {
    onActivity();
    const selected = items.filter(i => selectedIds.has(i.id));
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
                alert(
                  'Partial Export',
                  `${result.saved} exported, ${result.failed.length} failed.\n\nFailed: ${result.failed.map(f => f.name).join(', ')}`,
                );
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
  }, [onActivity, items, selectedIds, setSuppressAutoLock, clearSelection]);

  /**
   * Handle rename of a single selected media item
   */
  const handleRenamePress = useCallback(() => {
    onActivity();
    if (selectedIds.size !== 1) return;
    setShowRenameModal(true);
  }, [onActivity, selectedIds.size]);

  const handleRenameConfirm = useCallback(async (newName: string) => {
    const id = Array.from(selectedIds)[0];
    if (!id) return;

    const mediaType = TAB_TO_MEDIA_TYPE[activeTab];

    // Optimistic cache update
    if (mediaType !== null) {
      queryClient.setQueryData<MediaItem[]>(
        ['media', mediaType, isDecoyMode],
        (old) => old?.map(i => i.id === id ? { ...i, name: newName } : i),
      );
    }

    await mediaItemsDb.rename(id, newName);

    if (mediaType !== null) {
      await queryClient.invalidateQueries({ queryKey: ['media', mediaType, isDecoyMode] });
    }
    await queryClient.invalidateQueries({ queryKey: ['albumMedia'] });

    setShowRenameModal(false);
    clearSelection();
  }, [selectedIds, activeTab, queryClient, isDecoyMode, clearSelection]);

  /**
   * Handle properties view for a single selected media item
   */
  const handlePropertiesPress = useCallback(() => {
    onActivity();
    if (selectedIds.size !== 1) return;
    setShowPropertiesModal(true);
  }, [onActivity, selectedIds.size]);

  /** The single selected item (for rename/properties), or null */
  const singleSelectedItem = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = Array.from(selectedIds)[0];
    return items.find(i => i.id === id) ?? null;
  }, [selectedIds, items]);

  /**
   * Handle add button press — pick files then import (FILE-002, GALLERY-001)
   */
  const handleAddPress = useCallback(async () => {
    onActivity();

    // Albums tab: open create album modal instead of file picker
    if (activeTab === 'albums') {
      handleCreateAlbum();
      return;
    }

    // Notes tab: create note directly (all features are free)
    if (activeTab === 'notes') {
      handleCreateNote();
      return;
    }

    // Images/Videos tabs: use in-app gallery picker (GALLERY-001)
    // This ensures only local files are selectable (no cloud-backed URIs).
    // No setSuppressAutoLock needed — gallery is in-app, not a separate Activity.
    if (activeTab === 'images' || activeTab === 'videos') {
      const galleryMediaType: GalleryMediaType = activeTab === 'videos' ? 'video' : 'image';
      const hasPerms = await hasGalleryPermissions(galleryMediaType);
      if (!hasPerms) {
        const granted = await requestGalleryPermissions(galleryMediaType);
        if (!granted) return;
      }
      navigation.navigate('GalleryAlbumList', { mediaType: galleryMediaType });
      return;
    }

    // Documents tab: continue using SAF picker (non-media files aren't in MediaStore)
    setSuppressAutoLock(true);
    try {
      const files = await pickFilesForTab(activeTab);
      if (files.length === 0) {
        setSuppressAutoLock(false);
        return;
      }

      const mediaType = TAB_TO_MEDIA_TYPE[activeTab];
      if (mediaType === null) {
        setSuppressAutoLock(false);
        return;
      }

      setIsImporting(true);
      setImportProgress({ current: 0, total: files.length, currentFileName: files[0].name });

      const result = await importFiles(files, mediaType, {
        deleteOriginals: deleteOriginalsAfterImport,
        onProgress: setImportProgress,
        isDecoy: isDecoyMode,
      });
      await queryClient.invalidateQueries({ queryKey: ['media', mediaType, isDecoyMode] });

      // Try to show ad after import (non-blocking)
      if (result.imported > 0) {
        try {
          const { tryShowInterstitial } = require('@services/ads');
          tryShowInterstitial('VaultHome', 'post_import').catch(() => {});
        } catch { /* ad service may not be ready */ }
      }

      if (result.failed.length === 0) {
        let originalsMsg = '';
        if (result.originalsDeleted > 0) {
          originalsMsg += `\n${result.originalsDeleted} original(s) removed from device.`;
        }
        if (result.originalsDeleteFailed > 0) {
          originalsMsg += `\n${result.originalsDeleteFailed} original(s) could not be removed. You may need to delete them manually.`;
        }
        alert('Import Complete', `${result.imported} file(s) imported successfully.${originalsMsg}`);
      } else if (result.imported > 0) {
        alert(
          'Partial Import',
          `${result.imported} imported, ${result.failed.length} failed.\n\nFailed: ${result.failed.map(f => f.name).join(', ')}`,
        );
      } else {
        alert(
          'Import Failed',
          `All ${result.total} file(s) failed to import.\n\n${result.failed[0]?.error ?? 'Unknown error'}`,
        );
      }
    } catch (e) {
      alert('Import Error', e instanceof Error ? e.message : String(e));
    } finally {
      setSuppressAutoLock(false);
      onActivity(); // Reset timeout so session doesn't expire right after import
      setIsImporting(false);
      setImportProgress(null);
    }
  }, [onActivity, activeTab, queryClient, deleteOriginalsAfterImport, isDecoyMode, setSuppressAutoLock, handleCreateAlbum, handleCreateNote, handleSubscription, navigation]);

  /**
   * Handle tab press
   */
  const handleTabPress = useCallback((tab: TabType) => {
    onActivity();
    setActiveTab(tab);
    setShowFavoritesOnly(false);
    setSearchQuery('');
    setShowSearch(false);
    const idx = TABS.findIndex(t => t.key === tab);
    pagerRef.current?.setPage(idx);
  }, [onActivity]);

  // Auto-scroll tab bar to keep active tab visible
  useEffect(() => {
    const idx = TABS.findIndex(t => t.key === activeTab);
    // Approximate: each tab ~70px wide, scroll to center it
    const scrollX = Math.max(0, idx * 70 - 100);
    tabScrollRef.current?.scrollTo({ x: scrollX, animated: true });
  }, [activeTab]);

  // Handle pager swipe — sync activeTab with the native pager position
  const handlePageSelected = useCallback((e: { nativeEvent: { position: number } }) => {
    const idx = e.nativeEvent.position;
    const tab = TABS[idx]?.key;
    if (tab && tab !== activeTab) {
      onActivity();
      setActiveTab(tab);
      setShowFavoritesOnly(false);
      setSearchQuery('');
      setShowSearch(false);
    }
  }, [activeTab, onActivity]);

  /**
   * Handle grid item press
   */
  const handleItemPress = useCallback((item: MediaItem, originRect?: { x: number; y: number; width: number; height: number }) => {
    if (isDeleting) return;
    onActivity();
    if (isSelectionMode) {
      toggleSelection(item.id);
    } else if (activeTab === 'audio') {
      // Open audio player for audio items
      const siblingIds = filteredItems.map(i => i.id);
      navigation.navigate('AudioPlayer', { mediaId: item.id, mediaIds: siblingIds });
    } else {
      // Pass sibling IDs + origin rect for hero transition
      const siblingIds = filteredItems.map(i => i.id);
      navigation.navigate('MediaViewer', { mediaId: item.id, mediaIds: siblingIds, originRect });
    }
  }, [isDeleting, onActivity, isSelectionMode, toggleSelection, navigation, filteredItems]);

  /**
   * Handle grid item long press — enter selection mode
   */
  const handleItemLongPress = useCallback((item: MediaItem) => {
    if (isDeleting) return;
    onActivity();
    toggleSelection(item.id);
  }, [isDeleting, onActivity, toggleSelection]);

  /**
   * Handle batch delete of selected items (FILE-006, FILE-008, NOTES-001)
   */
  const handleDelete = useCallback(() => {
    onActivity();

    // Notes tab: delete notes by IDs
    if (activeTab === 'notes') {
      const selectedNoteIds = notesData.filter(n => selectedIds.has(n.id)).map(n => n.id);
      if (selectedNoteIds.length === 0) return;

      alert(
        'Delete Notes',
        `Delete ${selectedNoteIds.length} note(s)? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setIsDeleting(true);
              try {
                await notesDb.deleteByIds(selectedNoteIds);
                await queryClient.invalidateQueries({ queryKey: ['notes'] });
                clearSelection();
                alert('Deleted', `${selectedNoteIds.length} note(s) deleted.`);
              } finally {
                setIsDeleting(false);
              }
            },
          },
        ],
      );
      return;
    }

    const selectedItems = items.filter(item => selectedIds.has(item.id));
    if (selectedItems.length === 0) return;

    alert(
      'Delete Items',
      `Delete ${selectedItems.length} item(s)? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const result = await deleteMediaItems(selectedItems);
              const mediaType = TAB_TO_MEDIA_TYPE[activeTab];
              if (mediaType !== null) {
                await queryClient.invalidateQueries({ queryKey: ['media', mediaType, isDecoyMode] });
              }
              clearSelection();

              if (result.failed.length > 0) {
                alert(
                  'Partial Deletion',
                  `${result.deleted} deleted, ${result.failed.length} failed.\n\nFailed: ${result.failed.map(f => f.name).join(', ')}`,
                );
              } else {
                alert('Deleted', `${result.deleted} item(s) deleted.`);
              }
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  }, [onActivity, activeTab, notesData, items, selectedIds, queryClient, clearSelection, isDecoyMode]);

  /**
   * Handle select all / deselect all toggle (FILE-007)
   */
  const handleSelectAll = useCallback(() => {
    onActivity();
    const allSelected = filteredItems.length > 0 && selectedIds.size === filteredItems.length;
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(filteredItems.map(item => item.id));
    }
  }, [onActivity, filteredItems, selectedIds.size, clearSelection, selectAll]);

  // Whether the current tab supports media actions (search, sort, fav, view toggle)
  const isMediaTab = activeTab === 'images' || activeTab === 'videos' || activeTab === 'documents' || activeTab === 'audio';

  // Section header text — e.g. "All Images" or "Favorites (3)"
  const sectionTitle = useMemo(() => {
    if (searchQuery.trim()) return `Results`;
    if (showFavoritesOnly) return 'Favorites';
    const labels: Record<TabType, string> = {
      images: 'All Images',
      videos: 'All Videos',
      audio: 'All Audio',
      documents: 'All Documents',
      albums: 'Albums',
      notes: 'Notes',
    };
    return labels[activeTab];
  }, [activeTab, showFavoritesOnly, searchQuery]);

  const itemCount = useMemo(() => {
    if (activeTab === 'albums') return albumsData.length;
    if (activeTab === 'notes') return notesData.length;
    return filteredItems.length;
  }, [activeTab, filteredItems.length, albumsData.length, notesData.length]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header — compact: lock + title + search + settings */}
      <VaultHeader
        title="Vault"
        showSettings={true}
        onSettingsPress={handleSettingsPress}
        isSelectionMode={isSelectionMode}
        selectedCount={selectedIds.size}
        totalCount={filteredItems.length}
        onClearSelection={clearSelection}
        onSelectAll={handleSelectAll}
        onSearchPress={isMediaTab ? () => { setShowSearch(s => !s); if (showSearch) setSearchQuery(''); } : undefined}
        isSearchActive={showSearch}
      />

      {/* Search bar — slides in below header when active */}
      {showSearch && isMediaTab && (
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={`Search ${activeTab}...`}
        />
      )}

      {/* Compact pill tabs */}
      <View style={styles.tabBar}>
        <RNScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
          bounces={false}
        >
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => handleTabPress(tab.key)}
              style={[
                styles.tab,
                activeTab === tab.key && styles.tabActive,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.key }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </RNScrollView>

        {/* Inline sort/fav/view toggles — right side of tab row */}
        {isMediaTab && !isSelectionMode && (
          <View style={styles.tabTrailing}>
            {(activeTab === 'images' || activeTab === 'videos') && (
              <Pressable
                onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                style={styles.tabTrailingBtn}
                accessibilityRole="button"
                accessibilityLabel={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
              >
                <Icon
                  name={viewMode === 'grid' ? 'list' : 'grid'}
                  size={18}
                  color={themeColors.textTertiary}
                />
              </Pressable>
            )}
            <Pressable
              onPress={() => sortSheetRef.current?.expand()}
              style={styles.tabTrailingBtn}
              accessibilityRole="button"
              accessibilityLabel="Sort options"
            >
              <Icon
                name="arrow-up-down"
                size={18}
                color={(sortBy !== 'date' || sortOrder !== 'desc') ? themeColors.accent : themeColors.textTertiary}
              />
            </Pressable>
            <Pressable
              onPress={() => setShowFavoritesOnly(prev => !prev)}
              style={styles.tabTrailingBtn}
              accessibilityRole="button"
              accessibilityLabel={showFavoritesOnly ? 'Show all items' : 'Show favorites only'}
            >
              <Icon
                name="star"
                size={18}
                color={showFavoritesOnly ? '#FFD700' : themeColors.textTertiary}
                fill={showFavoritesOnly ? '#FFD700' : 'none'}
              />
            </Pressable>
          </View>
        )}
      </View>

      {/* Section header — "All Images (24)" */}
      {!isSelectionMode && itemCount > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          <Text style={styles.sectionCount}>{itemCount}</Text>
        </View>
      )}

      {/* Content Area — native swipeable pager between tabs */}
      <PagerView
        ref={pagerRef}
        style={styles.content}
        initialPage={0}
        onPageSelected={handlePageSelected}
        overdrag={false}
      >
        {/* Images page */}
        <View key="images" style={styles.page}>
          {activeTab === 'images' && (
            filteredItems.length > 0 ? (
              viewMode === 'list' ? (
                <MediaList
                  items={filteredItems}
                  isLoading={isLoading}
                  onItemPress={handleItemPress}
                  onItemLongPress={handleItemLongPress}
                />
              ) : (
                <MediaGrid
                  items={filteredItems}
                  isLoading={isLoading}
                  onItemPress={handleItemPress}
                  onItemLongPress={handleItemLongPress}
                  numColumns={gridColumns}
                />
              )
            ) : searchQuery.trim() ? (
              <EmptyState contentType="search" />
            ) : showFavoritesOnly ? (
              <EmptyState contentType="favorites" />
            ) : (
              <EmptyState contentType="images" onAddPress={handleAddPress} />
            )
          )}
        </View>

        {/* Videos page */}
        <View key="videos" style={styles.page}>
          {activeTab === 'videos' && (
            filteredItems.length > 0 ? (
              viewMode === 'list' ? (
                <MediaList
                  items={filteredItems}
                  isLoading={isLoading}
                  onItemPress={handleItemPress}
                  onItemLongPress={handleItemLongPress}
                />
              ) : (
                <MediaGrid
                  items={filteredItems}
                  isLoading={isLoading}
                  onItemPress={handleItemPress}
                  onItemLongPress={handleItemLongPress}
                  numColumns={gridColumns}
                />
              )
            ) : searchQuery.trim() ? (
              <EmptyState contentType="search" />
            ) : showFavoritesOnly ? (
              <EmptyState contentType="favorites" />
            ) : (
              <EmptyState contentType="videos" onAddPress={handleAddPress} />
            )
          )}
        </View>

        {/* Audio page */}
        <View key="audio" style={styles.page}>
          {activeTab === 'audio' && (
            filteredItems.length > 0 ? (
              <AudioList
                items={filteredItems}
                isLoading={isLoading}
                onItemPress={handleItemPress}
                onItemLongPress={handleItemLongPress}
              />
            ) : searchQuery.trim() ? (
              <EmptyState contentType="search" />
            ) : showFavoritesOnly ? (
              <EmptyState contentType="favorites" />
            ) : (
              <EmptyState contentType="audio" onAddPress={handleAddPress} />
            )
          )}
        </View>

        {/* Documents page */}
        <View key="documents" style={styles.page}>
          {activeTab === 'documents' && (
            filteredItems.length > 0 ? (
              <DocumentList
                items={filteredItems}
                isLoading={isLoading}
                onItemPress={handleItemPress}
                onItemLongPress={handleItemLongPress}
              />
            ) : searchQuery.trim() ? (
              <EmptyState contentType="search" />
            ) : showFavoritesOnly ? (
              <EmptyState contentType="favorites" />
            ) : (
              <EmptyState contentType="documents" onAddPress={handleAddPress} />
            )
          )}
        </View>

        {/* Albums page */}
        <View key="albums" style={styles.page}>
          {activeTab === 'albums' && (
            albumsData.length > 0 ? (
              <AlbumList
                albums={albumsData}
                isLoading={albumsLoading}
                mediaCounts={mediaCounts}
                coverMediaMap={coverMediaMap}
                onAlbumPress={handleAlbumPress}
                onAlbumLongPress={handleAlbumLongPress}
              />
            ) : (
              <EmptyState contentType="albums" onAddPress={handleCreateAlbum} />
            )
          )}
        </View>

        {/* Notes page */}
        <View key="notes" style={styles.page}>
          {activeTab === 'notes' && (
            notesData.length > 0 ? (
              <NoteList
                notes={notesData}
                isLoading={notesLoading}
                onNotePress={handleNotePress}
                onNoteLongPress={handleNoteLongPress}
              />
            ) : (
              <EmptyState contentType="notes" onAddPress={handleCreateNote} />
            )
          )}
        </View>
      </PagerView>

      {/* Selection Bar or Floating Add Button */}
      {isSelectionMode ? (
        <SelectionBar
          selectedCount={selectedIds.size}
          onDelete={handleDelete}
          onClearSelection={clearSelection}
          onMore={activeTab !== 'albums' && activeTab !== 'notes' ? handleOverflowMore : undefined}
          onShare={activeTab !== 'albums' ? handleShare : undefined}
          onFavorite={activeTab === 'images' || activeTab === 'videos' || activeTab === 'documents' || activeTab === 'audio' ? handleFavorite : undefined}
          isDeleting={isDeleting}
          isSharing={isSharing}
        />
      ) : (
        <>
          <FloatingAddButton
            onPress={handleAddPress}
            label={isImporting ? 'Importing...' : activeTab === 'albums' ? '+ New Album' : activeTab === 'notes' ? '+ New Note' : '+ Add Files'}
            disabled={isImporting}
          />
        </>
      )}
      {/* Import Progress Overlay (FILE-010) */}
      {importProgress !== null && (
        <ImportProgressOverlay progress={importProgress} />
      )}

      {/* Create Album Sheet (ALBUM-001) */}
      <AppBottomSheet
        ref={createAlbumSheetRef}
        snapPoints={[240]}
        title="New Album"
        onDismiss={() => {
          pendingAddMediaIdsRef.current = null;
          setShowCreateAlbum(false);
          setNewAlbumName('');
        }}
      >
        <View style={styles.sheetContent}>
          <BottomSheetTextInput
            style={styles.sheetInput}
            placeholder="Album name"
            placeholderTextColor={themeColors.textSecondary}
            value={newAlbumName}
            onChangeText={setNewAlbumName}
            onSubmitEditing={handleConfirmCreateAlbum}
            returnKeyType="done"
            maxLength={100}
            autoFocus
          />
          <View style={styles.sheetButtons}>
            <Pressable
              style={styles.sheetButton}
              onPress={() => createAlbumSheetRef.current?.close()}
            >
              <Text style={styles.sheetButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetButton, styles.sheetButtonPrimary]}
              onPress={handleConfirmCreateAlbum}
            >
              <Text style={styles.sheetButtonPrimaryText}>Create</Text>
            </Pressable>
          </View>
        </View>
      </AppBottomSheet>

      {/* Add to Album Modal (ALBUM-003) */}
      <AddToAlbumModal
        visible={showAddToAlbum}
        albums={albumsData}
        isAdding={isAddingToAlbum}
        onSelectAlbum={handleSelectAlbumForAdd}
        onCreateNewAlbum={handleCreateNewAlbumForAdd}
        onClose={() => setShowAddToAlbum(false)}
      />

      {/* Rename Album Sheet (ALBUM-005) */}
      <AppBottomSheet
        ref={renameAlbumSheetRef}
        snapPoints={[240]}
        title="Rename Album"
        onDismiss={() => {
          setShowRenameAlbum(false);
          setRenameAlbumTarget(null);
          setRenameAlbumName('');
        }}
      >
        <View style={styles.sheetContent}>
          <BottomSheetTextInput
            style={styles.sheetInput}
            placeholder="Album name"
            placeholderTextColor={themeColors.textSecondary}
            value={renameAlbumName}
            onChangeText={setRenameAlbumName}
            onSubmitEditing={handleConfirmRenameAlbum}
            returnKeyType="done"
            maxLength={100}
            autoFocus
          />
          <View style={styles.sheetButtons}>
            <Pressable
              style={styles.sheetButton}
              onPress={() => renameAlbumSheetRef.current?.close()}
            >
              <Text style={styles.sheetButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetButton, styles.sheetButtonPrimary]}
              onPress={handleConfirmRenameAlbum}
            >
              <Text style={styles.sheetButtonPrimaryText}>Rename</Text>
            </Pressable>
          </View>
        </View>
      </AppBottomSheet>

      {/* Sort Options Sheet (ENH-003) */}
      <AppBottomSheet
        ref={sortSheetRef}
        snapPoints={[300]}
        title="Sort By"
        onDismiss={() => {}}
      >
        <View style={styles.sheetContent}>
          {(['date', 'name', 'size'] as const).map((field) => (
            <Pressable
              key={field}
              style={[styles.sortOption, sortBy === field && styles.sortOptionActive]}
              onPress={() => {
                setSortBy(field);
                sortSheetRef.current?.close();
              }}
            >
              <Text style={[styles.sortOptionText, sortBy === field && styles.sortOptionTextActive]}>
                {field === 'date' ? 'Date' : field === 'name' ? 'Name' : 'Size'}
              </Text>
              {sortBy === field && (
                <Icon name="check" size={18} color={themeColors.accent} />
              )}
            </Pressable>
          ))}
          <Pressable
            style={styles.sortDirectionRow}
            onPress={() => {
              toggleSortOrder();
              sortSheetRef.current?.close();
            }}
          >
            <Text style={styles.sortDirectionText}>
              {sortBy === 'date'
                ? (sortOrder === 'desc' ? 'Newest first' : 'Oldest first')
                : sortBy === 'name'
                  ? (sortOrder === 'asc' ? 'A \u2192 Z' : 'Z \u2192 A')
                  : (sortOrder === 'desc' ? 'Largest first' : 'Smallest first')}
            </Text>
            <Icon name="arrow-up-down" size={18} color={themeColors.accent} />
          </Pressable>
        </View>
      </AppBottomSheet>

      {/* Create Note Sheet (NOTES-001) */}
      <AppBottomSheet
        ref={createNoteSheetRef}
        snapPoints={[240]}
        title="New Note"
        onDismiss={() => {
          setShowCreateNote(false);
          setNewNoteTitle('');
        }}
      >
        <View style={styles.sheetContent}>
          <BottomSheetTextInput
            style={styles.sheetInput}
            placeholder="Note title"
            placeholderTextColor={themeColors.textSecondary}
            value={newNoteTitle}
            onChangeText={setNewNoteTitle}
            onSubmitEditing={handleConfirmCreateNote}
            returnKeyType="done"
            maxLength={100}
            autoFocus
          />
          <View style={styles.sheetButtons}>
            <Pressable
              style={styles.sheetButton}
              onPress={() => createNoteSheetRef.current?.close()}
            >
              <Text style={styles.sheetButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetButton, styles.sheetButtonPrimary]}
              onPress={handleConfirmCreateNote}
            >
              <Text style={styles.sheetButtonPrimaryText}>Create</Text>
            </Pressable>
          </View>
        </View>
      </AppBottomSheet>

      {/* Selection Overflow Menu */}
      <SelectionOverflowMenu
        visible={showOverflowMenu}
        onClose={() => setShowOverflowMenu(false)}
        onAddToAlbum={handleAddToAlbumPress}
        onUnhide={handleUnhide}
        onRename={selectedIds.size === 1 ? handleRenamePress : undefined}
        onProperties={selectedIds.size === 1 ? handlePropertiesPress : undefined}
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
  // ── Compact pill tabs ──
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
    backgroundColor: c.surface,
  },
  tabScrollContent: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: c.surfaceContainerHigh,
  },
  tabActive: {
    backgroundColor: c.accent,
  },
  tabText: {
    ...typography.labelLarge,
    color: c.textSecondary,
    fontSize: 13,
  },
  tabTextActive: {
    color: c.textOnAccent,
    fontWeight: '600',
  },
  // Trailing sort/fav/view buttons — inline with tab row
  tabTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    paddingRight: spacing.sm,
    gap: spacing.xxs,
  },
  tabTrailingBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  // ── Section header ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.labelLarge,
    color: c.textSecondary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    ...typography.labelLarge,
    color: c.textTertiary,
    fontSize: 13,
    marginLeft: spacing.xs,
  },
  content: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  // ── Bottom sheet styles ──
  sheetContent: {
    paddingHorizontal: spacing.lg,
  },
  sheetInput: {
    ...typography.bodyMedium,
    color: c.textPrimary,
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: spacing.lg,
  },
  sheetButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  sheetButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sheetButtonText: {
    ...typography.labelLarge,
    color: c.textSecondary,
  },
  sheetButtonPrimary: {
    backgroundColor: c.accent,
  },
  sheetButtonPrimaryText: {
    ...typography.labelLarge,
    color: c.textOnAccent,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sortOptionActive: {
    backgroundColor: c.surfaceContainerHigh,
  },
  sortOptionText: {
    ...typography.bodyLarge,
    color: c.textPrimary,
  },
  sortOptionTextActive: {
    color: c.accent,
  },
  sortOptionCheck: {
    fontSize: 16,
    color: c.accent,
  },
  sortDirectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  sortDirectionText: {
    ...typography.bodyMedium,
    color: c.textSecondary,
  },
  sortDirectionToggle: {
    fontSize: 16,
    color: c.textSecondary,
  },
});
