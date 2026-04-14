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
  StyleSheet,
} from 'react-native';
import type BottomSheetType from '@gorhom/bottom-sheet';
import { AppBottomSheet } from '@shared/components/AppBottomSheet';
import PagerView from 'react-native-pager-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VaultStackParamList } from '@typedefs/navigation';
import { VaultHeader, EmptyState, FloatingAddButton, MediaGrid, MediaList, DocumentList, AudioList, SelectionBar, ImportProgressOverlay, AlbumList, AddToAlbumModal, NoteList, SelectionOverflowMenu, RenameModal, InputDialog, PropertiesModal, SearchBar, SoftPremiumCard } from '../components';
import { FeatureDiscoveryCard } from '../components/FeatureDiscoveryCard';
import { ImportSuccessToast } from '../components/ImportSuccessToast';
import { useMediaQuery, useAlbumsQuery, useNotesQuery, type TabType } from '../hooks';
import { useActivityTracker } from '@features/auth';
import { useVaultStore } from '@store/vaultStore';
import { useAuthStore } from '@store/authStore';
import { useSettingsStore } from '@store/settingsStore';
import { useThemeColors, colors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
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
  const isDark = themeColors === colors.dark;
  const styles = useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);
  const navigation = useNavigation<NativeStackNavigationProp<VaultStackParamList>>();
  const { isLandscape } = useOrientation();
  const gridColumns = isLandscape ? 5 : layout.vaultGridColumns;
  const queryClient = useQueryClient();
  const tabScrollRef = useRef<RNScrollView>(null);
  const pagerRef = useRef<PagerView>(null);
  const sortSheetRef = useRef<BottomSheetType>(null);
  const [activeTab, setActiveTab] = useState<TabType>('images');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importSuccessCount, setImportSuccessCount] = useState(0);
  const [showImportSuccess, setShowImportSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showPropertiesModal, setShowPropertiesModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Soft premium card — shown once per session after 3+ interstitials
  const [showPremiumCard, setShowPremiumCard] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const { shouldShowSoftPremiumCard, isAdFree: checkAdFree } = require('@services/ads');
        const decoy = useAuthStore.getState().isDecoyMode;
        if (!checkAdFree() && !decoy && shouldShowSoftPremiumCard()) {
          setShowPremiumCard(true);
        }
      } catch {
        // Ad service may not be ready — skip
      }
    }, 30_000); // 30-second delay after entering vault
    return () => clearTimeout(timer);
  }, []);

  // Auto-show paywall when flagged — but only after the user has experienced
  // value (3+ vault unlocks). Before that, clear the flag silently.
  const paywallPending = useSettingsStore(s => s.paywallPending);
  const premiumStatus = useSettingsStore(s => s.premiumStatus);
  const vaultUnlockCount = useSettingsStore(s => s.vaultUnlockCount);
  useEffect(() => {
    if (!paywallPending || premiumStatus !== 'free') return;
    const threshold = useSettingsStore.getState().paywallUnlockThreshold;
    if (vaultUnlockCount < threshold) return; // A/B tested: 3 or 5 unlocks
    useSettingsStore.getState().setPaywallPending(false);
    const timer = setTimeout(() => navigation.navigate('Subscription'), 600);
    return () => clearTimeout(timer);
  }, [paywallPending, premiumStatus, vaultUnlockCount, navigation]);

  // Smart trigger: intruder detected → premium nudge (one-time per session)
  const intruderNudgeShown = useRef(false);
  useEffect(() => {
    if (premiumStatus !== 'free' || intruderNudgeShown.current) return;
    const timer = setTimeout(async () => {
      try {
        const { intruderLogs: logsDb } = require('@services/storage/database');
        const count = await logsDb.getCount();
        if (count > 0 && !intruderNudgeShown.current) {
          intruderNudgeShown.current = true;
          alert(
            'Someone tried to break in',
            `${count} intrusion ${count === 1 ? 'attempt' : 'attempts'} detected. Upgrade to Premium for advanced alerts with location tracking and detailed reports.`,
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'See details', onPress: () => navigation.navigate('Subscription') },
            ],
          );
        }
      } catch { /* non-critical */ }
    }, 2000);
    return () => clearTimeout(timer);
  }, [premiumStatus, navigation]);

  // Smart trigger: 3-day active user → engagement offer
  const engagementNudgeShown = useRef(false);
  useEffect(() => {
    if (premiumStatus !== 'free' || engagementNudgeShown.current) return;
    const { firstLaunchTimestamp, paywallDismissCount } = useSettingsStore.getState();
    if (!firstLaunchTimestamp) return;

    const daysSinceInstall = (Date.now() - firstLaunchTimestamp) / (24 * 60 * 60 * 1000);
    if (daysSinceInstall < 3) return;

    const timer = setTimeout(() => {
      if (engagementNudgeShown.current) return;
      engagementNudgeShown.current = true;

      // Dynamic offer: first-time → discount angle, returning → urgency angle
      const isReturning = paywallDismissCount >= 2;
      const title = isReturning
        ? 'Last chance for this offer'
        : 'You\'ve been protecting files for 3 days';
      const message = isReturning
        ? 'Upgrade now before the price goes up. Go ad-free and unlock all features.'
        : 'You\'re clearly serious about privacy. Unlock Premium and get the full experience.';

      alert(title, message, [
        {
          text: 'Maybe later',
          style: 'cancel',
          onPress: () => useSettingsStore.getState().incrementPaywallDismissCount(),
        },
        { text: 'See plans', onPress: () => navigation.navigate('Subscription') },
      ]);
    }, 5000);
    return () => clearTimeout(timer);
  }, [premiumStatus, navigation]);

  // Win-back offer: show 50% off after 30+ days of lapsed premium
  const winBackShown = useRef(false);
  useEffect(() => {
    if (premiumStatus !== 'free' || winBackShown.current) return;
    const { premiumLapsedAt, winBackShown: alreadyShown } = useSettingsStore.getState();
    if (!premiumLapsedAt || alreadyShown) return;

    const daysSinceLapse = (Date.now() - premiumLapsedAt) / (24 * 60 * 60 * 1000);
    if (daysSinceLapse < 30) return;

    const timer = setTimeout(() => {
      if (winBackShown.current) return;
      winBackShown.current = true;
      useSettingsStore.getState().markWinBackShown();

      alert(
        'We miss you!',
        'Your premium access expired 30+ days ago. Come back and get 50% off yearly — your files are still waiting.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'See offer', onPress: () => navigation.navigate('Subscription') },
        ],
      );
    }, 3000);
    return () => clearTimeout(timer);
  }, [premiumStatus, navigation]);

  // Track user activity to prevent auto-lock (AUTH-008)
  const { onActivity } = useActivityTracker();

  // Media query for active tab (VAULT-003)
  const { data: items, isLoading, fetchNextPage } = useMediaQuery(activeTab, showFavoritesOnly);
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
  const { data: albumsData = [], isLoading: albumsLoading } = useAlbumsQuery();

  // Notes state (NOTES-001)
  const { data: notesData = [], isLoading: notesLoading } = useNotesQuery();
  const [showCreateNote, setShowCreateNote] = useState(false);

  // Add to Album state (ALBUM-003)
  const [showAddToAlbum, setShowAddToAlbum] = useState(false);
  const [isAddingToAlbum, setIsAddingToAlbum] = useState(false);
  const pendingAddMediaIdsRef = useRef<string[] | null>(null);

  // Rename Album state (ALBUM-005)
  const [showRenameAlbum, setShowRenameAlbum] = useState(false);
  const [renameAlbumTarget, setRenameAlbumTarget] = useState<Album | null>(null);
  const [renameAlbumName, setRenameAlbumName] = useState('');

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



  useEffect(() => {
    if (showSortSheet) {
      setTimeout(() => sortSheetRef.current?.expand(), 50);
    }
  }, [showSortSheet]);

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
  const handleConfirmCreateAlbum = useCallback(async (name: string) => {
    const trimmed = sanitizeUserInput(name).trim();
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
      alert('Album created', `"${newAlbum.name}" is ready with ${added} ${added === 1 ? 'item' : 'items'} inside.`);
    } else {
      setShowCreateAlbum(false);
    }
  }, [isDecoyMode, queryClient, clearSelection]);

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
            'Remove this album?',
            `"${album.name}" will be removed, but your files stay safe in the vault.`,
            [
              { text: 'Keep it', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                  await albumsDb.deleteById(album.id);
                  await queryClient.invalidateQueries({ queryKey: ['albums'] });
                  await queryClient.invalidateQueries({ queryKey: ['albumMediaCounts', isDecoyMode] });
                  await queryClient.invalidateQueries({ queryKey: ['albumCoverMedia', isDecoyMode] });
                  alert('Album removed', `"${album.name}" is gone. Your files are still safe.`);
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
  const handleConfirmRenameAlbum = useCallback(async (name: string) => {
    const trimmed = sanitizeUserInput(name).trim();
    if (trimmed.length === 0 || renameAlbumTarget === null) return;

    await albumsDb.rename(renameAlbumTarget.id, trimmed);
    await queryClient.invalidateQueries({ queryKey: ['albums'] });
    setShowRenameAlbum(false);
    setRenameAlbumTarget(null);
    setRenameAlbumName('');
  }, [renameAlbumTarget, queryClient]);

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
  const handleConfirmCreateNote = useCallback(async (title: string) => {
    const trimmed = sanitizeUserInput(title).trim();
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
    navigation.navigate('NoteEditor', { noteId: id });
  }, [isDecoyMode, queryClient, navigation]);

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
          'Almost there',
          `${result.shared} shared successfully, but ${result.failed.length} couldn't be shared.\n\n${result.failed.map(f => f.name).join(', ')}`,
        );
      } else if (result.failed.length > 0) {
        alert('Couldn\'t share', `Something went wrong: ${result.failed[0]?.error ?? 'Please try again.'}`);
      }
      clearSelection();
    } catch (e) {
      alert('Something went wrong', e instanceof Error ? e.message : 'Sharing failed. Please try again.');
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
      alert('Moved to album', `${added} ${added === 1 ? 'file' : 'files'} added to "${album.name}".`);
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
      'Unhide and save?',
      `This will save ${selected.length} ${selected.length === 1 ? 'file' : 'files'} back to your gallery where anyone can see ${selected.length === 1 ? 'it' : 'them'}.`,
      [
        { text: 'Keep hidden', style: 'cancel' },
        {
          text: 'Save to gallery',
          onPress: async () => {
            setSuppressAutoLock(true);
            try {
              const result = await unhideMediaItems(selected);
              if (result.failed.length > 0 && result.saved > 0) {
                alert(
                  'Almost done',
                  `${result.saved} saved to gallery, but ${result.failed.length} couldn't be exported.\n\n${result.failed.map(f => f.name).join(', ')}`,
                );
              } else if (result.failed.length > 0) {
                alert('Couldn\'t export', `Something went wrong: ${result.failed[0]?.error ?? 'Please try again.'}`);
              } else {
                alert('Saved to gallery', `${result.saved} ${result.saved === 1 ? 'file is' : 'files are'} now visible in your gallery.`);
              }
            } catch (e) {
              alert('Something went wrong', e instanceof Error ? e.message : 'Export failed. Please try again.');
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

    // Optimistic cache update — useInfiniteQuery stores { pages, pageParams }
    if (mediaType !== null) {
      queryClient.setQueryData<{ pages: MediaItem[][]; pageParams: unknown[] }>(
        ['media', mediaType, isDecoyMode],
        (old) => old && {
          ...old,
          pages: old.pages.map(page =>
            page.map(i => i.id === id ? { ...i, name: newName, originalName: newName } : i)
          ),
        },
      );
    }

    try {
      await mediaItemsDb.rename(id, newName);

      if (mediaType !== null) {
        await queryClient.invalidateQueries({ queryKey: ['media', mediaType, isDecoyMode] });
      }
      await queryClient.invalidateQueries({ queryKey: ['albumMedia'] });

      setShowRenameModal(false);
      clearSelection();
    } catch (e) {
      // Rename touches the crypto layer (encryptField on original_name).
      // A silent failure here leaves the user seeing the old name with no
      // feedback about why. This was exactly the class of bug found in the
      // previous session's audit — capture it.
      Sentry.captureException(e, { tags: { area: 'rename' } });
      // Roll back the optimistic update by invalidating — forces a refetch.
      if (mediaType !== null) {
        queryClient.invalidateQueries({ queryKey: ['media', mediaType, isDecoyMode] });
      }
      alert('Rename failed', 'Please try again.');
    }
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

      // Try to show ad after import — await so dismissing ad doesn't pop navigation
      if (result.imported > 0) {
        try {
          const { tryShowInterstitial } = require('@services/ads');
          await tryShowInterstitial('VaultHome', 'post_import');
        } catch { /* ad service may not be ready */ }

        // Track imports — paywall only after substantial engagement (10+ files)
        const settings = useSettingsStore.getState();
        settings.incrementImportCount(result.imported);
        if (
          settings.premiumStatus === 'free' &&
          settings.totalImportCount >= 10 &&
          settings.vaultUnlockCount >= settings.paywallUnlockThreshold
        ) {
          // Delay paywall so the success feedback shows first
          setTimeout(() => {
            if (useSettingsStore.getState().premiumStatus === 'free') {
              navigation.navigate('Subscription');
            }
          }, 3000);
        }
      }

      if (result.failed.length === 0) {
        // Show animated success toast instead of a plain alert
        setImportSuccessCount(result.imported);
        setShowImportSuccess(true);

        // If originals were deleted, show a brief supplementary alert after the toast
        if (result.originalsDeleted > 0 || result.originalsDeleteFailed > 0) {
          setTimeout(() => {
            let originalsMsg = '';
            if (result.originalsDeleted > 0) {
              originalsMsg += `${result.originalsDeleted} ${result.originalsDeleted === 1 ? 'original' : 'originals'} removed from your gallery.`;
            }
            if (result.originalsDeleteFailed > 0) {
              originalsMsg += originalsMsg ? '\n' : '';
              originalsMsg += 'Some originals couldn\'t be removed automatically.';
            }
            alert('Originals cleaned up', originalsMsg);
          }, 2800);
        }

        // Positive moment — ask for review after the toast auto-dismisses
        setTimeout(() => {
          try { require('@services/review').triggerReviewPrompt(); } catch {}
        }, 4000);
      } else if (result.imported > 0) {
        alert(
          'Almost there',
          `${result.imported} imported successfully, but ${result.failed.length} couldn't be added.\n\n${result.failed.map(f => f.name).join(', ')}`,
        );
      } else {
        alert(
          'Couldn\'t import',
          `None of the ${result.total} ${result.total === 1 ? 'file' : 'files'} could be imported.\n\n${result.failed[0]?.error ?? 'Please try again.'}`,
        );
      }
    } catch (e) {
      // Import is the highest-volume write path in the app. Failures here
      // are the single most valuable production signal — catch ratio of
      // failed imports per device tells us whether the native pickFiles →
      // encrypt → store pipeline is healthy.
      Sentry.captureException(e, { tags: { area: 'import', tab: activeTab } });
      alert('Something went wrong', e instanceof Error ? e.message : 'Import failed. Please try again.');
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
  }, [isDeleting, onActivity, isSelectionMode, toggleSelection, navigation, activeTab, filteredItems]);

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
        'Delete forever?',
        `${selectedNoteIds.length === 1 ? 'This note' : `These ${selectedNoteIds.length} notes`} will be permanently deleted.`,
        [
          { text: 'Keep', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setIsDeleting(true);
              try {
                await notesDb.deleteByIds(selectedNoteIds);
                await queryClient.invalidateQueries({ queryKey: ['notes'] });
                clearSelection();
                alert('Gone for good', `${selectedNoteIds.length} ${selectedNoteIds.length === 1 ? 'note' : 'notes'} permanently deleted.`);
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
      'Delete forever?',
      `${selectedItems.length === 1 ? 'This file' : `These ${selectedItems.length} files`} will be gone permanently.`,
      [
        { text: 'Keep', style: 'cancel' },
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
                  'Almost done',
                  `${result.deleted} deleted, but ${result.failed.length} couldn't be removed.\n\n${result.failed.map(f => f.name).join(', ')}`,
                );
              } else {
                alert('Gone for good', `${result.deleted} ${result.deleted === 1 ? 'file' : 'files'} permanently deleted.`);
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
              onPress={() => setShowSortSheet(true)}
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

      {/* Soft premium card — shown once per session after ad fatigue */}
      {showPremiumCard && (
        <SoftPremiumCard
          onDismiss={() => {
            try { require('@services/ads').markSoftPremiumCardShown(); } catch {}
            setShowPremiumCard(false);
          }}
          onUpgrade={() => {
            try { require('@services/ads').markSoftPremiumCardShown(); } catch {}
            setShowPremiumCard(false);
            navigation.navigate('Subscription');
          }}
        />
      )}

      {/* Feature discovery — one untried feature tip per session */}
      {!showPremiumCard && !isSelectionMode && (
        <FeatureDiscoveryCard />
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
            filteredItems.length > 0 || isLoading ? (
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
                  onEndReached={fetchNextPage}
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
            filteredItems.length > 0 || isLoading ? (
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
                  onEndReached={fetchNextPage}
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
            filteredItems.length > 0 || isLoading ? (
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
            filteredItems.length > 0 || isLoading ? (
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
            albumsData.length > 0 || albumsLoading ? (
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
            notesData.length > 0 || notesLoading ? (
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

      {/* Import success animation toast */}
      <ImportSuccessToast
        count={importSuccessCount}
        visible={showImportSuccess}
        onDismiss={() => setShowImportSuccess(false)}
      />

      {/* Create Album Dialog (ALBUM-001) */}
      <InputDialog
        visible={showCreateAlbum}
        title="New Album"
        placeholder="Album name"
        confirmLabel="Create"
        onConfirm={handleConfirmCreateAlbum}
        onDismiss={() => {
          pendingAddMediaIdsRef.current = null;
          setShowCreateAlbum(false);
            }}
      />

      {/* Add to Album Modal (ALBUM-003) */}
      <AddToAlbumModal
        visible={showAddToAlbum}
        albums={albumsData}
        isAdding={isAddingToAlbum}
        onSelectAlbum={handleSelectAlbumForAdd}
        onCreateNewAlbum={handleCreateNewAlbumForAdd}
        onClose={() => setShowAddToAlbum(false)}
      />

      {/* Rename Album Dialog (ALBUM-005) */}
      <InputDialog
        visible={showRenameAlbum}
        title="Rename Album"
        placeholder="Album name"
        initialValue={renameAlbumName}
        confirmLabel="Rename"
        onConfirm={handleConfirmRenameAlbum}
        onDismiss={() => {
          setShowRenameAlbum(false);
          setRenameAlbumTarget(null);
          setRenameAlbumName('');
        }}
      />

      {/* Sort Options Sheet (ENH-003) */}
      {showSortSheet && (
      <AppBottomSheet
        ref={sortSheetRef}
        snapPoints={[300]}
        title="Sort By"
        onDismiss={() => setShowSortSheet(false)}
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
      )}

      {/* Create Note Dialog (NOTES-001) */}
      <InputDialog
        visible={showCreateNote}
        title="New Note"
        placeholder="Note title"
        confirmLabel="Create"
        onConfirm={handleConfirmCreateNote}
        onDismiss={() => {
          setShowCreateNote(false);
              }}
      />

      {/* Selection Overflow Menu */}
      <SelectionOverflowMenu
        visible={showOverflowMenu}
        onClose={() => setShowOverflowMenu(false)}
        onAddToAlbum={handleAddToAlbumPress}
        onUnhide={handleUnhide}
        onRename={selectedIds.size === 1 ? handleRenamePress : undefined}
        onProperties={selectedIds.size === 1 ? handlePropertiesPress : undefined}
      />

      {/* Rename Modal — conditional mount to prevent autoFocus keyboard grab */}
      {showRenameModal && (
        <RenameModal
          visible={showRenameModal}
          currentName={singleSelectedItem?.name ?? ''}
          onRename={handleRenameConfirm}
          onClose={() => setShowRenameModal(false)}
        />
      )}

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

const createStyles = (c: ColorTokens, isDark: boolean) => StyleSheet.create({
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
    height: 34,
    paddingHorizontal: spacing.base,
    borderRadius: 17,
    backgroundColor: isDark
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(0, 0, 0, 0.04)',
    borderWidth: 1,
    borderColor: isDark
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(0, 0, 0, 0.08)',
  },
  tabActive: {
    backgroundColor: c.accent,
    borderColor: c.accent,
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
