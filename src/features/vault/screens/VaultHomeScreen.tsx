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
  PanResponder,
  Modal,
  TextInput,
  StyleSheet,
} from 'react-native';
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
  const [activeTab, setActiveTab] = useState<TabType>('images');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
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
  }, [onActivity]);

  // Auto-scroll tab bar to keep active tab visible
  useEffect(() => {
    const idx = TABS.findIndex(t => t.key === activeTab);
    // Approximate: each tab ~70px wide, scroll to center it
    const scrollX = Math.max(0, idx * 70 - 100);
    tabScrollRef.current?.scrollTo({ x: scrollX, animated: true });
  }, [activeTab]);

  // Swipe between tabs
  const swipeTab = useCallback((direction: 'left' | 'right') => {
    setActiveTab(prev => {
      const tabKeys = TABS.map(t => t.key);
      const idx = tabKeys.indexOf(prev);
      const nextIdx = direction === 'left' ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= tabKeys.length) return prev;
      setShowFavoritesOnly(false);
      setSearchQuery('');
      setShowSearch(false);
      return tabKeys[nextIdx];
    });
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_evt, gs) => {
      // Only claim horizontal swipes (dx > 30px and mostly horizontal)
      return Math.abs(gs.dx) > 30 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.8;
    },
    onPanResponderRelease: (_evt, gs) => {
      if (Math.abs(gs.dx) > 50 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5) {
        swipeTab(gs.dx < 0 ? 'left' : 'right');
      }
    },
  }), [swipeTab]);

  /**
   * Handle grid item press
   */
  const handleItemPress = useCallback((item: MediaItem) => {
    if (isDeleting) return;
    onActivity();
    if (isSelectionMode) {
      toggleSelection(item.id);
    } else if (activeTab === 'audio') {
      // Open audio player for audio items
      const siblingIds = filteredItems.map(i => i.id);
      navigation.navigate('AudioPlayer', { mediaId: item.id, mediaIds: siblingIds });
    } else {
      // Pass sibling IDs for swipe navigation between items
      const siblingIds = filteredItems.map(i => i.id);
      navigation.navigate('MediaViewer', { mediaId: item.id, mediaIds: siblingIds });
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <VaultHeader
        title="Private Storage"
        showSettings={true}
        onSettingsPress={handleSettingsPress}
        isSelectionMode={isSelectionMode}
        selectedCount={selectedIds.size}
        totalCount={filteredItems.length}
        onClearSelection={clearSelection}
        onSelectAll={handleSelectAll}
      />

      {/* Tab Bar — horizontally scrollable so tabs never wrap */}
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
              {activeTab === tab.key && <View style={styles.tabIndicator} />}
            </Pressable>
          ))}
        </RNScrollView>
      </View>

      {/* Action bar — search, view toggle, sort, favorites (media tabs only) */}
      {(activeTab === 'images' || activeTab === 'videos' || activeTab === 'documents' || activeTab === 'audio') && (
        <View style={styles.actionBar}>
          <Pressable
            onPress={() => { setShowSearch(s => !s); if (showSearch) setSearchQuery(''); }}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Text style={[styles.actionIcon, showSearch && styles.actionIconActive]}>
              {'\u{1F50D}'}
            </Text>
          </Pressable>
          {(activeTab === 'images' || activeTab === 'videos') && (
            <Pressable
              onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
            >
              <Text style={styles.actionIcon}>
                {viewMode === 'grid' ? '\u2630' : '\u2637'}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setShowSortModal(true)}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel="Sort options"
          >
            <Text style={[
              styles.actionIcon,
              (sortBy !== 'date' || sortOrder !== 'desc') && styles.actionIconActive,
            ]}>
              {'\u2195'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowFavoritesOnly(prev => !prev)}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel={showFavoritesOnly ? 'Show all items' : 'Show favorites only'}
          >
            <Text style={[styles.actionIcon, showFavoritesOnly && styles.actionIconFav]}>
              {showFavoritesOnly ? '\u2605' : '\u2606'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Search bar — shown for media tabs when search is active */}
      {showSearch && (activeTab === 'images' || activeTab === 'videos' || activeTab === 'documents') && (
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={`Search ${activeTab}...`}
        />
      )}

      {/* Content Area — swipeable between tabs */}
      <View style={styles.content} {...panResponder.panHandlers}>
        {activeTab === 'albums' ? (
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
        ) : activeTab === 'notes' ? (
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
        ) : filteredItems.length > 0 ? (
          activeTab === 'documents' ? (
            <DocumentList
              items={filteredItems}
              isLoading={isLoading}
              onItemPress={handleItemPress}
              onItemLongPress={handleItemLongPress}
            />
          ) : activeTab === 'audio' ? (
            <AudioList
              items={filteredItems}
              isLoading={isLoading}
              onItemPress={handleItemPress}
              onItemLongPress={handleItemLongPress}
            />
          ) : viewMode === 'list' ? (
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
          <EmptyState
            contentType={activeTab}
            onAddPress={handleAddPress}
          />
        )}
      </View>

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

      {/* Create Album Modal (ALBUM-001) */}
      <Modal
        visible={showCreateAlbum}
        transparent
        animationType="fade"
        onRequestClose={() => {
          pendingAddMediaIdsRef.current = null;
          setShowCreateAlbum(false);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCreateAlbum(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>New Album</Text>
            <TextInput
              ref={albumNameInputRef}
              style={styles.modalInput}
              placeholder="Album name"
              placeholderTextColor={themeColors.textSecondary}
              value={newAlbumName}
              onChangeText={setNewAlbumName}
              onSubmitEditing={handleConfirmCreateAlbum}
              returnKeyType="done"
              maxLength={100}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalButton}
                onPress={() => {
                  pendingAddMediaIdsRef.current = null;
                  setShowCreateAlbum(false);
                  setNewAlbumName('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConfirmCreateAlbum}
              >
                <Text style={styles.modalButtonPrimaryText}>Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add to Album Modal (ALBUM-003) */}
      <AddToAlbumModal
        visible={showAddToAlbum}
        albums={albumsData}
        isAdding={isAddingToAlbum}
        onSelectAlbum={handleSelectAlbumForAdd}
        onCreateNewAlbum={handleCreateNewAlbumForAdd}
        onClose={() => setShowAddToAlbum(false)}
      />

      {/* Rename Album Modal (ALBUM-005) */}
      <Modal
        visible={showRenameAlbum}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowRenameAlbum(false);
          setRenameAlbumTarget(null);
          setRenameAlbumName('');
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowRenameAlbum(false);
            setRenameAlbumTarget(null);
            setRenameAlbumName('');
          }}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Rename Album</Text>
            <TextInput
              ref={renameInputRef}
              style={styles.modalInput}
              placeholder="Album name"
              placeholderTextColor={themeColors.textSecondary}
              value={renameAlbumName}
              onChangeText={setRenameAlbumName}
              onSubmitEditing={handleConfirmRenameAlbum}
              returnKeyType="done"
              maxLength={100}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalButton}
                onPress={() => {
                  setShowRenameAlbum(false);
                  setRenameAlbumTarget(null);
                  setRenameAlbumName('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConfirmRenameAlbum}
              >
                <Text style={styles.modalButtonPrimaryText}>Rename</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sort Options Modal (ENH-003) */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSortModal(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Sort By</Text>
            {(['date', 'name', 'size'] as const).map((field) => (
              <Pressable
                key={field}
                style={[styles.sortOption, sortBy === field && styles.sortOptionActive]}
                onPress={() => {
                  setSortBy(field);
                  setShowSortModal(false);
                }}
              >
                <Text style={[styles.sortOptionText, sortBy === field && styles.sortOptionTextActive]}>
                  {field === 'date' ? 'Date' : field === 'name' ? 'Name' : 'Size'}
                </Text>
                {sortBy === field && (
                  <Text style={styles.sortOptionCheck}>{'\u2713'}</Text>
                )}
              </Pressable>
            ))}
            <Pressable
              style={styles.sortDirectionRow}
              onPress={() => {
                toggleSortOrder();
                setShowSortModal(false);
              }}
            >
              <Text style={styles.sortDirectionText}>
                {sortBy === 'date'
                  ? (sortOrder === 'desc' ? 'Newest first' : 'Oldest first')
                  : sortBy === 'name'
                    ? (sortOrder === 'asc' ? 'A \u2192 Z' : 'Z \u2192 A')
                    : (sortOrder === 'desc' ? 'Largest first' : 'Smallest first')}
              </Text>
              <Text style={styles.sortDirectionToggle}>{'\u21C5'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create Note Modal (NOTES-001) */}
      <Modal
        visible={showCreateNote}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateNote(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCreateNote(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>New Note</Text>
            <TextInput
              ref={noteNameInputRef}
              style={styles.modalInput}
              placeholder="Note title"
              placeholderTextColor={themeColors.textSecondary}
              value={newNoteTitle}
              onChangeText={setNewNoteTitle}
              onSubmitEditing={handleConfirmCreateNote}
              returnKeyType="done"
              maxLength={100}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalButton}
                onPress={() => {
                  setShowCreateNote(false);
                  setNewNoteTitle('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConfirmCreateNote}
              >
                <Text style={styles.modalButtonPrimaryText}>Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  tabBar: {
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  tabScrollContent: {
    paddingHorizontal: spacing.sm,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    height: layout.tabBarHeight,
    paddingHorizontal: spacing.md,
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    ...typography.labelLarge,
    color: c.textSecondary,
  },
  tabTextActive: {
    color: c.accent,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: spacing.md,
    right: spacing.md,
    height: 3,
    backgroundColor: c.accent,
    borderRadius: 1.5,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    height: 36,
    backgroundColor: c.surface,
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 16,
    color: c.textTertiary,
  },
  actionIconActive: {
    color: c.accent,
  },
  actionIconFav: {
    color: '#FFD700',
  },
  content: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 340,
  },
  modalTitle: {
    ...typography.titleLarge,
    color: c.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    ...typography.bodyMedium,
    color: c.textPrimary,
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalButtonText: {
    ...typography.labelLarge,
    color: c.textSecondary,
  },
  modalButtonPrimary: {
    backgroundColor: c.accent,
  },
  modalButtonPrimaryText: {
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
