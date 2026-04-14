/**
 * VaultCalc - Media Viewer Screen
 *
 * Full-screen viewer for decrypted media items.
 * Video: Native Media3 ExoPlayer with gesture controls, speed popup,
 *        prev/next navigation, and file management (detail/rename/move/delete).
 * Photo: ZoomableImage with pinch-to-zoom.
 * PDF: Page-by-page rendered viewer.
 *
 * @see FEATURE_INDEX.md VAULT-005, VIDEO-010
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Image,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  Modal,
  TextInput,
  Alert,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { VaultStackScreenProps } from '@typedefs/navigation';
import { mediaItems, albums, albumMedia, type MediaItem, type Album } from '@services/storage/database';
import { useAuthStore } from '@store/authStore';
import { useActivityTracker } from '@features/auth';
import { decryptFile, decryptFileStreaming, getVaultDirectory } from '@services/crypto';
import { deleteFile } from '@services/media';
import { shareMediaItems } from '@services/share';
import { getPageCount, renderPage, type PdfPageResult } from '@services/pdf';
import { ZoomableImage } from '../components/ZoomableImage';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { trackEvent, type MediaTypeParam } from '@services/analytics';
import { Icon, IconButton } from '@shared/components/Icon';
import { HeroTransition } from '@shared/components/HeroTransition';
import {
  NativeVideoPlayerView,
  loadVideo,
  pauseVideo,
  enterFullscreen,
  exitFullscreen,
  releasePlayer,
  setPlaylist,
  setShuffle,
  setRepeat,
  getVideoDetails,
  type VideoDetails,
} from '@services/videoPlayer/nativeVideoPlayer';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { unlockOrientation, lockPortrait } from '@services/orientation';
import { formatDateTime } from '@shared/utils/formatters';

type Props = VaultStackScreenProps<'MediaViewer'>;

// ─── Constants ───────────────────────────────────────────────────────
const ACCENT = '#3B82F6';

// ─── Helpers ─────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.substring(dot) : '';
}

// ─── Main Component ──────────────────────────────────────────────────

// ─── Image Pager Item ──────────────────────────────────────────────
// Each page in the horizontal pager decrypts and displays one image.

function ImagePagerItem({ itemId, width, onSingleTap }: { itemId: string; width: number; onSingleTap?: () => void }): React.JSX.Element {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let tempPath: string | null = null;

    async function decrypt() {
      try {
        const mediaItem = await mediaItems.getById(itemId);
        if (cancelled || !mediaItem) return;

        const vaultDirResult = await getVaultDirectory();
        if (cancelled || !vaultDirResult.success || !vaultDirResult.data) return;

        const ext = getExtension(mediaItem.originalName);
        tempPath = `${vaultDirResult.data}/pager_${mediaItem.id}${ext}`;

        const result = await decryptFile(mediaItem.encryptedPath, tempPath, mediaItem.keyId);
        if (cancelled) { if (tempPath) deleteFile(tempPath); return; }

        if (result.success) {
          setUri(`file://${tempPath}`);
        }
      } catch (e) {
        // Decryption failure in the pager produces a silent black screen —
        // the user just sees a loading spinner disappear with no content.
        // This is the exact failure mode that looks "sketchy" to users.
        Sentry.captureException(e, { tags: { area: 'decrypt_image' } });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    decrypt();
    return () => {
      cancelled = true;
      if (tempPath) deleteFile(tempPath);
    };
  }, [itemId]);

  return (
    <View style={{ width, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" />
      ) : uri ? (
        <ZoomableImage source={{ uri }} style={{ width, flex: 1 }} onSingleTap={onSingleTap} />
      ) : null}
    </View>
  );
}

export function MediaViewerScreen({ navigation, route }: Props): React.JSX.Element {
  const { mediaId, mediaIds, originRect, shuffle: initShuffle, repeat: initRepeat } = route.params;
  const themeColors = useThemeColors();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const styles = useMemo(() => createStyles(themeColors, SCREEN_WIDTH, SCREEN_HEIGHT), [themeColors, SCREEN_WIDTH, SCREEN_HEIGHT]);
  const queryClient = useQueryClient();
  const isDecoyMode = useAuthStore(s => s.isDecoyMode);
  const setSuppressAutoLock = useAuthStore(s => s.setSuppressAutoLock);
  const { onActivity } = useActivityTracker();

  // Keep session alive while viewing media — touch activity on mount + periodically during playback
  useEffect(() => {
    onActivity();
    const interval = setInterval(onActivity, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [onActivity]);

  // Allow landscape rotation in media viewer
  useEffect(() => {
    unlockOrientation();
    return () => { lockPortrait(); };
  }, []);

  // Suppress auto-lock while video is playing
  const handlePlaybackStateChange = useCallback((event: { nativeEvent: { isPlaying: boolean } }) => {
    setSuppressAutoLock(event.nativeEvent.isPlaying);
  }, [setSuppressAutoLock]);

  // Ensure auto-lock suppression is cleared on unmount
  useEffect(() => {
    return () => { setSuppressAutoLock(false); };
  }, [setSuppressAutoLock]);

  // Fire media_viewed once per unique item opened (viewer supports pager swiping)
  const lastTrackedItemId = useRef<string | null>(null);

  // Media loading state
  const [item, setItem] = useState<MediaItem | null>(null);
  // Fire a media_viewed event per unique item loaded in the pager.
  useEffect(() => {
    if (!item || lastTrackedItemId.current === item.id) return;
    lastTrackedItemId.current = item.id;
    const type: MediaTypeParam =
      item.type === 'photo' ? 'image' :
      item.type === 'video' ? 'video' :
      item.type === 'audio' ? 'audio' :
      'document';
    trackEvent('media_viewed', { type });
  }, [item]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [decryptedUri, setDecryptedUri] = useState<string | null>(null);
  const [decryptedPath, setDecryptedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Pager state for swipe navigation (images only — videos use native player nav) ──
  const pagerRef = useRef<FlatList>(null);
  const [currentPagerIndex, setCurrentPagerIndex] = useState(0);
  const [imageSiblingIds, setImageSiblingIds] = useState<string[]>([]);

  useEffect(() => {
    if (!mediaIds || mediaIds.length === 0) return;
    const ids = mediaIds;
    let cancelled = false;
    async function filterSiblings() {
      // Look up the opened item's type so we filter siblings to the same type
      const openedItem = await mediaItems.getById(mediaId);
      if (cancelled || !openedItem) return;
      // Only build pager for photos — videos use native ExoPlayer nav
      if (openedItem.type !== 'photo') {
        setImageSiblingIds([]);
        return;
      }
      const allItems = await Promise.all(ids.map(id => mediaItems.getById(id)));
      if (cancelled) return;
      const siblingIds = allItems
        .filter((m): m is MediaItem => m !== null && m.type === openedItem.type)
        .map(m => m.id);
      setImageSiblingIds(siblingIds);
      const idx = siblingIds.indexOf(mediaId);
      if (idx >= 0) setCurrentPagerIndex(idx);
    }
    filterSiblings();
    return () => { cancelled = true; };
  }, [mediaIds, mediaId]);

  // Update header when pager index changes
  useEffect(() => {
    if (imageSiblingIds.length === 0) return;
    const currentId = imageSiblingIds[currentPagerIndex];
    if (!currentId || currentId === item?.id) return;
    let cancelled = false;
    async function loadCurrent() {
      const mediaItem = await mediaItems.getById(currentId);
      if (cancelled || !mediaItem) return;
      setItem(mediaItem);
      setIsFavorite(mediaItem.isFavorite);
    }
    loadCurrent();
    return () => { cancelled = true; };
  }, [currentPagerIndex, imageSiblingIds]);

  // Video player ref
  const videoPlayerRef = useRef<any>(null);
  const [resumePosition, setResumePosition] = useState<number | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const lastSavedPositionRef = useRef(0);

  // Video playlist (all videos in same query)
  const { data: allVideos } = useMediaQuery('videos');
  // Shuffle/repeat state — persisted across video navigations via route params
  const [isShuffleOn, setIsShuffleOn] = useState(initShuffle ?? false);
  const [isRepeatOn, setIsRepeatOn] = useState(initRepeat ?? false);
  // ── Menu state ──
  const [showMenu, setShowMenu] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showMoveToAlbum, setShowMoveToAlbum] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [videoDetailInfo, setVideoDetailInfo] = useState<VideoDetails | null>(null);
  const [albumList, setAlbumList] = useState<Album[]>([]);

  // Header auto-hide state
  const [headerVisible, setHeaderVisible] = useState(true);
  const headerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHeaderTimer = useCallback(() => {
    if (headerTimerRef.current) clearTimeout(headerTimerRef.current);
    headerTimerRef.current = setTimeout(() => setHeaderVisible(false), 3000);
  }, []);

  // Start auto-hide timer on mount and when header becomes visible
  useEffect(() => {
    if (headerVisible) {
      resetHeaderTimer();
    }
    return () => {
      if (headerTimerRef.current) clearTimeout(headerTimerRef.current);
    };
  }, [headerVisible, resetHeaderTimer]);

  const toggleHeader = useCallback(() => {
    setHeaderVisible(prev => !prev);
  }, []);

  // PDF viewer state
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const isPdf = item?.mimeType === 'application/pdf';

  // ── Load and decrypt media ──
  useEffect(() => {
    let cancelled = false;
    let tempFilePath: string | null = null;

    async function loadMedia() {
      try {
        const mediaItem = await mediaItems.getById(mediaId);
        if (cancelled) return;
        if (!mediaItem) {
          setError('Media item not found.');
          setIsLoading(false);
          return;
        }
        setItem(mediaItem);
        setIsFavorite(mediaItem.isFavorite);

        const vaultDirResult = await getVaultDirectory();
        if (!vaultDirResult.success || !vaultDirResult.data) {
          setError('Could not access vault directory.');
          setIsLoading(false);
          return;
        }

        const ext = getExtension(mediaItem.originalName);
        tempFilePath = `${vaultDirResult.data}/viewer_${mediaItem.id}${ext}`;

        const decryptFn = mediaItem.type === 'video' ? decryptFileStreaming : decryptFile;
        const decryptResult = await decryptFn(
          mediaItem.encryptedPath,
          tempFilePath,
          mediaItem.keyId,
        );
        if (cancelled) {
          if (tempFilePath) deleteFile(tempFilePath);
          return;
        }

        if (!decryptResult.success) {
          setError('Failed to decrypt file.');
          setIsLoading(false);
          return;
        }

        setDecryptedPath(tempFilePath);
        setDecryptedUri(`file://${tempFilePath}`);
        setIsLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'An error occurred.');
          setIsLoading(false);
        }
      }
    }

    loadMedia();
    return () => {
      cancelled = true;
      if (tempFilePath) deleteFile(tempFilePath);
    };
  }, [mediaId]);

  // Cleanup temp on unmount
  useEffect(() => {
    return () => {
      if (decryptedPath) deleteFile(decryptedPath);
    };
  }, [decryptedPath]);

  // Pause video when app goes to background
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state !== 'active' && item?.type === 'video' && videoPlayerRef.current) {
        pauseVideo(videoPlayerRef);
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [item?.type]);

  // Enter fullscreen when video loads
  useEffect(() => {
    if (decryptedUri && item?.type === 'video' && videoPlayerRef.current) {
      enterFullscreen(videoPlayerRef);
    }
    return () => {
      if (item?.type === 'video' && videoPlayerRef.current) {
        exitFullscreen(videoPlayerRef);
      }
    };
  }, [decryptedUri, item?.type]);

  // Set playlist on native player so prev/next buttons are enabled
  // Runs when decryptedUri is set (meaning native player is mounted and video is loaded)
  useEffect(() => {
    if (!allVideos || allVideos.length === 0 || item?.type !== 'video' || !decryptedUri || !videoPlayerRef.current) return;
    const currentIdx = allVideos.findIndex(v => v.id === mediaId);
    if (currentIdx < 0) return;
    // Native side only needs paths for count/index — navigation is handled via onNavigate in JS
    const placeholderPaths = allVideos.map(v => v.id);
    setPlaylist(videoPlayerRef, placeholderPaths, currentIdx);
    // Restore shuffle/repeat state that was carried over from the previous screen
    if (isShuffleOn) setShuffle(videoPlayerRef, true);
    if (isRepeatOn) setRepeat(videoPlayerRef, true);
  }, [allVideos, mediaId, item?.type, decryptedUri]);

  // Load video into native player once decrypted — check for saved position
  useEffect(() => {
    if (!decryptedPath || item?.type !== 'video' || !videoPlayerRef.current) return;

    let cancelled = false;
    async function loadWithResume() {
      const savedPos = await mediaItems.getPlaybackPosition(item!.id);
      if (cancelled) return;

      if (savedPos !== null && item!.durationMs !== null && savedPos < item!.durationMs - 5000) {
        // Has a meaningful saved position — show resume prompt
        setResumePosition(savedPos);
        setShowResumePrompt(true);
      } else {
        // No saved position or near the end — start from beginning
        loadVideo(videoPlayerRef, `file://${decryptedPath}`);
      }
    }
    loadWithResume();
    return () => { cancelled = true; };
  }, [decryptedPath, item?.type, item?.id, item?.durationMs]);

  // PDF page count
  useEffect(() => {
    if (!isPdf || !decryptedPath) return;
    let cancelled = false;
    async function loadPdfInfo() {
      const result = await getPageCount(decryptedPath!);
      if (!cancelled && result.success && result.data !== undefined) {
        setPdfPageCount(result.data);
      }
    }
    loadPdfInfo();
    return () => { cancelled = true; };
  }, [isPdf, decryptedPath]);

  // ── Handlers ──

  // Resume prompt handlers
  const handleResume = useCallback(() => {
    setShowResumePrompt(false);
    if (decryptedPath && resumePosition !== null) {
      loadVideo(videoPlayerRef, `file://${decryptedPath}`, resumePosition);
    }
  }, [decryptedPath, resumePosition]);

  const handleStartOver = useCallback(() => {
    setShowResumePrompt(false);
    setResumePosition(null);
    if (decryptedPath) {
      loadVideo(videoPlayerRef, `file://${decryptedPath}`);
    }
    // Clear saved position
    if (item?.id) {
      mediaItems.savePlaybackPosition(item.id, null).catch(() => {});
    }
  }, [decryptedPath, item?.id]);

  // Save playback position periodically (every ~5s via onProgress at 250ms intervals)
  const handleVideoProgress = useCallback((event: { nativeEvent: { currentTime: number; duration: number } }) => {
    if (!item?.id) return;
    const { currentTime } = event.nativeEvent;
    const currentMs = Math.round(currentTime);
    // Only save every 5 seconds of real playback to avoid excessive writes
    if (Math.abs(currentMs - lastSavedPositionRef.current) >= 5000) {
      lastSavedPositionRef.current = currentMs;
      mediaItems.savePlaybackPosition(item.id, currentMs).catch(() => {});
    }
  }, [item?.id]);

  // When video ends, clear saved position and auto-play next video
  const handleVideoEnd = useCallback(() => {
    if (item?.id) {
      mediaItems.savePlaybackPosition(item.id, null).catch(() => {});
      lastSavedPositionRef.current = 0;
    }
    // Auto-advance to next video in playlist
    if (allVideos && allVideos.length > 0) {
      const currentIdx = allVideos.findIndex(v => v.id === item?.id);
      const nextIdx = currentIdx + 1;
      if (nextIdx < allVideos.length) {
        const nextVideo = allVideos[nextIdx];
        navigation.replace('MediaViewer', { mediaId: nextVideo.id, mediaIds, shuffle: isShuffleOn, repeat: isRepeatOn });
      }
    }
  }, [item?.id, allVideos, navigation, mediaIds, isShuffleOn, isRepeatOn]);

  const handleBack = useCallback(async () => {
    if (videoPlayerRef.current) {
      exitFullscreen(videoPlayerRef);
      releasePlayer(videoPlayerRef);
    }
    // Natural transition — try interstitial when returning to vault
    try {
      const { tryShowInterstitial } = require('@services/ads');
      await tryShowInterstitial('VaultHome', 'media_close');
    } catch { /* non-critical */ }
    navigation.goBack();
  }, [navigation]);

  const handleShare = useCallback(async () => {
    if (!item) return;
    await shareMediaItems([item]);
  }, [item]);

  const handleToggleFavorite = useCallback(async () => {
    if (!item) return;
    const newValue = !isFavorite;
    setIsFavorite(newValue);
    queryClient.setQueryData<MediaItem[]>(
      ['media', item.type, isDecoyMode],
      (old) => old?.map(i => i.id === item.id ? { ...i, isFavorite: newValue } : i),
    );
    await mediaItems.toggleFavorite(item.id);
  }, [item, isFavorite, queryClient, isDecoyMode]);

  // ── Video events ──

  const handleVideoBackPress = useCallback(() => {
    handleBack();
  }, [handleBack]);

  const handleVideoMenuPress = useCallback(() => {
    setShowMenu(true);
  }, []);

  const handleVideoNavigate = useCallback(async (event: { nativeEvent: { direction: string; index: number } }) => {
    const { index } = event.nativeEvent;
    if (!allVideos || index < 0 || index >= allVideos.length) return;
    const nextVideo = allVideos[index];
    // Navigate to the next/previous video, preserving shuffle/repeat and sibling IDs
    navigation.replace('MediaViewer', { mediaId: nextVideo.id, mediaIds, shuffle: isShuffleOn, repeat: isRepeatOn });
  }, [allVideos, navigation, mediaIds, isShuffleOn, isRepeatOn]);

  const handleVideoError = useCallback((event: { nativeEvent: { error: string; errorCode: number } }) => {
    setError(event.nativeEvent.error);
  }, []);

  // Track shuffle/repeat changes from native player so we can preserve across navigations
  const handleShuffleChange = useCallback((event: { nativeEvent: { enabled: boolean } }) => {
    setIsShuffleOn(event.nativeEvent.enabled);
  }, []);

  const handleRepeatChange = useCallback((event: { nativeEvent: { enabled: boolean } }) => {
    setIsRepeatOn(event.nativeEvent.enabled);
  }, []);

  // ── Menu actions ──

  const handleShowDetails = useCallback(async () => {
    setShowMenu(false);
    if (decryptedPath) {
      try {
        const details = await getVideoDetails(decryptedPath);
        setVideoDetailInfo(details);
      } catch {
        // Fallback to basic item info
        setVideoDetailInfo(null);
      }
    }
    setShowDetails(true);
  }, [decryptedPath]);

  const handleShowRename = useCallback(() => {
    setShowMenu(false);
    setRenameValue(item?.name ?? '');
    setShowRename(true);
  }, [item]);

  const handleRename = useCallback(async () => {
    if (!item || !renameValue.trim()) return;
    const newName = renameValue.trim();
    await mediaItems.rename(item.id, newName);
    setItem(prev => prev ? { ...prev, name: newName } : null);
    queryClient.invalidateQueries({ queryKey: ['media'] });
    queryClient.invalidateQueries({ queryKey: ['albumMedia'] });
    setShowRename(false);
  }, [item, renameValue, queryClient]);

  const handleShowMoveToAlbum = useCallback(async () => {
    setShowMenu(false);
    const allAlbums = await albums.getAll(isDecoyMode);
    setAlbumList(allAlbums);
    setShowMoveToAlbum(true);
  }, [isDecoyMode]);

  const handleMoveToAlbum = useCallback(async (albumId: string) => {
    if (!item) return;
    await albumMedia.add(albumId, item.id);
    queryClient.invalidateQueries({ queryKey: ['albumMedia', albumId] });
    queryClient.invalidateQueries({ queryKey: ['albums'] });
    setShowMoveToAlbum(false);
    Alert.alert('Moved', `Video moved to album successfully.`);
  }, [item, queryClient]);

  const handleDelete = useCallback(() => {
    setShowMenu(false);
    if (!item) return;
    Alert.alert(
      'Delete Video',
      'This will permanently delete this video from your vault. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete encrypted file
              if (item.encryptedPath) deleteFile(item.encryptedPath);
              if (item.thumbnailPath) deleteFile(item.thumbnailPath);
              // Delete from database
              await mediaItems.deleteByIds([item.id]);
              queryClient.invalidateQueries({ queryKey: ['media'] });
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Failed to delete video.');
            }
          },
        },
      ],
    );
  }, [item, queryClient, navigation]);

  // ── Loading state — hero transition plays during decryption ──
  if (isLoading) {
    return (
      <HeroTransition originRect={originRect}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={themeColors.accent} />
          <Text style={styles.loadingText}>Decrypting...</Text>
        </View>
      </HeroTransition>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorIcon}>{'\u26A0'}</Text>
        <Text style={styles.errorText}>Unable to play this video</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <Pressable onPress={handleBack} style={styles.backButtonCenter}>
          <Text style={styles.backButtonCenterText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Video render (Native ExoPlayer) ──
  if (decryptedUri !== null && item?.type === 'video') {
    return (
      <View style={styles.container}>
        <NativeVideoPlayerView
          ref={videoPlayerRef}
          style={styles.videoPlayer}
          title={item.originalName}
          onBackPress={handleVideoBackPress}
          onMenuPress={handleVideoMenuPress}
          onNavigate={handleVideoNavigate}
          onError={handleVideoError}
          onPlaybackStateChange={handlePlaybackStateChange}
          onProgress={handleVideoProgress}
          onEnd={handleVideoEnd}
          onShuffleChange={handleShuffleChange}
          onRepeatChange={handleRepeatChange}
        />

        {/* Resume prompt overlay */}
        {showResumePrompt && resumePosition !== null && (
          <View style={styles.resumeOverlay}>
            <View style={styles.resumeCard}>
              <Text style={styles.resumeTitle}>Resume playback?</Text>
              <Text style={styles.resumeSubtitle}>
                Continue from {formatDuration(resumePosition)}
              </Text>
              <View style={styles.resumeButtons}>
                <Pressable onPress={handleStartOver} style={styles.resumeBtn}>
                  <Text style={styles.resumeBtnText}>Start over</Text>
                </Pressable>
                <Pressable onPress={handleResume} style={[styles.resumeBtn, styles.resumeBtnPrimary]}>
                  <Text style={[styles.resumeBtnText, styles.resumeBtnPrimaryText]}>Resume</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Video Menu Modal */}
        <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowMenu(false)}>
            <View style={styles.menuContainer}>
              <Text style={styles.menuTitle}>Video Options</Text>
              <Pressable style={styles.menuItem} onPress={handleShowDetails}>
                <Icon name="file-text" size={20} color={themeColors.textPrimary} />
                <Text style={styles.menuItemText}>Details</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={handleShowMoveToAlbum}>
                <Icon name="folder" size={20} color={themeColors.textPrimary} />
                <Text style={styles.menuItemText}>Move to Album</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={handleShowRename}>
                <Icon name="pencil" size={20} color={themeColors.textPrimary} />
                <Text style={styles.menuItemText}>Rename</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={handleShare}>
                <Icon name="share" size={20} color={themeColors.textPrimary} />
                <Text style={styles.menuItemText}>Share</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuItem} onPress={handleDelete}>
                <Icon name="trash" size={20} color={themeColors.error} />
                <Text style={[styles.menuItemText, styles.dangerText]}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Details Modal */}
        <Modal visible={showDetails} transparent animationType="slide" onRequestClose={() => setShowDetails(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowDetails(false)}>
            <View style={styles.detailsContainer}>
              <Text style={styles.detailsTitle}>Video Details</Text>
              <DetailRow label="Name" value={item.originalName} />
              <DetailRow label="Size" value={formatFileSize(
                videoDetailInfo?.size ?? item.sizeBytes
              )} />
              <DetailRow label="Duration" value={
                videoDetailInfo?.duration
                  ? formatDuration(videoDetailInfo.duration)
                  : item.durationMs ? formatDuration(item.durationMs) : 'Unknown'
              } />
              <DetailRow label="Resolution" value={
                videoDetailInfo?.resolution
                  ?? (item.width && item.height ? `${item.width}x${item.height}` : 'Unknown')
              } />
              {videoDetailInfo?.bitrate ? (
                <DetailRow label="Bitrate" value={`${Math.round(videoDetailInfo.bitrate / 1000)} kbps`} />
              ) : null}
              <DetailRow label="Last modified" value={formatDateTime(item.createdAt)} />
              {item.metadata?.originalUri ? (
                <DetailRow label="Original path" value={
                  decodeURIComponent(String(item.metadata.originalUri).replace(/^content:\/\/[^/]+\//, '/'))
                } />
              ) : null}
              <DetailRow label="Current path" value={item.encryptedPath} />
              <Pressable style={styles.detailsCloseBtn} onPress={() => setShowDetails(false)}>
                <Text style={styles.detailsCloseBtnText}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Rename Modal */}
        <Modal visible={showRename} transparent animationType="fade" onRequestClose={() => setShowRename(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowRename(false)}>
            <View style={styles.renameContainer}>
              <Text style={styles.renameTitle}>Rename Video</Text>
              <TextInput
                style={styles.renameInput}
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="Enter new name"
                placeholderTextColor="#888"
                autoFocus
                selectTextOnFocus
              />
              <View style={styles.renameButtons}>
                <Pressable style={styles.renameCancelBtn} onPress={() => setShowRename(false)}>
                  <Text style={styles.renameCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.renameSaveBtn} onPress={handleRename}>
                  <Text style={styles.renameSaveText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* Move to Album Modal */}
        <Modal visible={showMoveToAlbum} transparent animationType="slide" onRequestClose={() => setShowMoveToAlbum(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowMoveToAlbum(false)}>
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
                      <Icon name="folder-open" size={20} color={themeColors.vaultFolderIcon} />
                      <Text style={styles.albumPickerItemText}>{album.name}</Text>
                    </Pressable>
                  )}
                  style={styles.albumPickerList}
                />
              )}
              <Pressable style={styles.detailsCloseBtn} onPress={() => setShowMoveToAlbum(false)}>
                <Text style={styles.detailsCloseBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  // ── Photo / PDF / Document render ──
  return (
    <View style={styles.container}>
      {/* Header overlay — auto-hides after 3s, toggles on single tap */}
      {headerVisible && (
        <SafeAreaView edges={['top']} style={styles.headerOverlay}>
          <IconButton name="arrow-left" onPress={handleBack} color="#FFFFFF" accessibilityLabel="Go back" />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {item?.originalName ?? ''}
          </Text>
          <IconButton
            name="star"
            onPress={handleToggleFavorite}
            color={isFavorite ? '#FFD700' : '#FFFFFF'}
            fill={isFavorite ? '#FFD700' : 'none'}
            accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          />
          <IconButton name="share" onPress={handleShare} color="#FFFFFF" accessibilityLabel="Share" />
        </SafeAreaView>
      )}

      {isPdf && decryptedPath && pdfPageCount > 0 ? (
        <FlatList
          data={Array.from({ length: pdfPageCount }, (_, i) => i)}
          keyExtractor={(i) => `page-${i}`}
          renderItem={({ item: pageIndex }) => (
            <PdfPageItem
              filePath={decryptedPath}
              pageIndex={pageIndex}
              renderWidth={SCREEN_WIDTH}
            />
          )}
          style={styles.pdfList}
          contentContainerStyle={styles.pdfListContent}
          showsVerticalScrollIndicator
        />
      ) : item?.type === 'document' ? (
        <View style={styles.documentInfo}>
          <Icon name="file-text" size={48} color={themeColors.textTertiary} />
          <Text style={styles.documentName}>{item.originalName}</Text>
          <Text style={styles.documentMeta}>
            {item.mimeType} {'\u00B7'} {formatFileSize(item.sizeBytes)}
          </Text>
        </View>
      ) : imageSiblingIds.length > 1 ? (
        <FlatList
          ref={pagerRef}
          data={imageSiblingIds}
          keyExtractor={id => id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={currentPagerIndex > 0 ? currentPagerIndex : undefined}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setCurrentPagerIndex(idx);
          }}
          renderItem={({ item: itemId }) => (
            <ImagePagerItem itemId={itemId} width={SCREEN_WIDTH} onSingleTap={toggleHeader} />
          )}
          style={{ flex: 1 }}
        />
      ) : decryptedUri !== null ? (
        <ZoomableImage
          source={{ uri: decryptedUri }}
          style={styles.image}
          onSingleTap={toggleHeader}
        />
      ) : null}
    </View>
  );
}

// ─── Detail Row Component ─────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  value: { color: '#FFFFFF', fontSize: 14, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
});

// ─── PDF Page Item ───────────────────────────────────────────────────

function PdfPageItem({
  filePath,
  pageIndex,
  renderWidth,
}: {
  filePath: string;
  pageIndex: number;
  renderWidth: number;
}): React.JSX.Element {
  const [pageData, setPageData] = useState<PdfPageResult | null>(null);
  const [pageError, setPageError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const outputPath = `${filePath}_page${pageIndex}.jpg`;
      const result = await renderPage(filePath, pageIndex, outputPath, renderWidth);
      if (cancelled) return;
      if (result.success && result.data) {
        setPageData(result.data);
      } else {
        setPageError(true);
      }
    }
    render();
    return () => { cancelled = true; };
  }, [filePath, pageIndex, renderWidth]);

  if (pageError) {
    return (
      <View style={pdfPageStyles.errorContainer}>
        <Text style={pdfPageStyles.errorText}>Failed to render page {pageIndex + 1}</Text>
      </View>
    );
  }
  if (!pageData) {
    return (
      <View style={[pdfPageStyles.loading, { width: renderWidth, height: renderWidth * 1.414 }]}>
        <ActivityIndicator size="small" color="#FFFFFF" />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: `file://${pageData.path}` }}
      style={{ width: pageData.width, height: pageData.height }}
      resizeMode="contain"
    />
  );
}

const pdfPageStyles = StyleSheet.create({
  loading: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A' },
  errorContainer: { height: 80, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#FF6B6B', fontSize: 14 },
});

// ─── Styles ──────────────────────────────────────────────────────────

const createStyles = (_c: ColorTokens, SCREEN_WIDTH: number, SCREEN_HEIGHT: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Video player ──
  videoPlayer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  // ── Header (photo/pdf) ──
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },

  // ── Shared buttons ──
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  iconText: { fontSize: 24, color: '#FFFFFF' },
  favIconText: { fontSize: 22, color: '#FFD700' },
  headerTitle: {
    ...typography.titleMedium,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },

  // ── Photo ──
  image: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },

  // ── Loading / Error states ──
  loadingText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginTop: spacing.md,
  },
  errorIcon: { fontSize: 48, marginBottom: spacing.md },
  errorText: {
    ...typography.titleMedium,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  errorDetail: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  backButtonCenter: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: ACCENT,
  },
  backButtonCenterText: {
    ...typography.labelLarge,
    color: '#FFFFFF',
  },

  // ── Modal backdrop ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },

  // ── Video menu ──
  menuContainer: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  menuTitle: {
    ...typography.titleMedium,
    color: '#FFFFFF',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
  },
  menuItemIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    width: 32,
    textAlign: 'center',
  },
  menuItemText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 8,
  },
  dangerText: { color: '#EF4444' },

  // ── Details modal ──
  detailsContainer: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  detailsTitle: {
    ...typography.titleMedium,
    color: '#FFFFFF',
    marginBottom: spacing.md,
  },
  detailsCloseBtn: {
    marginTop: spacing.lg,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  detailsCloseBtnText: {
    ...typography.labelLarge,
    color: '#FFFFFF',
  },

  // ── Rename modal ──
  renameContainer: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  renameTitle: {
    ...typography.titleMedium,
    color: '#FFFFFF',
    marginBottom: spacing.md,
  },
  renameInput: {
    backgroundColor: '#2A2A2A',
    color: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  renameButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
    gap: 12,
  },
  renameCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  renameCancelText: { ...typography.labelLarge, color: '#FFFFFF' },
  renameSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: ACCENT,
  },
  renameSaveText: { ...typography.labelLarge, color: '#FFFFFF' },

  // ── Move to album ──
  albumPickerContainer: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    maxHeight: SCREEN_HEIGHT * 0.5,
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
  albumPickerList: { maxHeight: 300 },
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

  // ── PDF ──
  pdfList: { flex: 1 },
  pdfListContent: { paddingTop: 60 },
  documentInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  documentIcon: { fontSize: 64, marginBottom: spacing.lg },
  documentName: {
    ...typography.titleMedium,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  documentMeta: {
    ...typography.bodyMedium,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },

  // ── Resume prompt ──
  resumeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  resumeCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
    minWidth: 260,
  },
  resumeTitle: {
    ...typography.titleLarge,
    color: '#F1F5F9',
    marginBottom: spacing.xs,
  },
  resumeSubtitle: {
    ...typography.bodyMedium,
    color: '#94A3B8',
    marginBottom: spacing.lg,
  },
  resumeButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  resumeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
  },
  resumeBtnPrimary: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  resumeBtnText: {
    ...typography.labelLarge,
    color: '#94A3B8',
  },
  resumeBtnPrimaryText: {
    color: '#FFFFFF',
  },
});
