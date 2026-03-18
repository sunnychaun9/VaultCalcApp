/**
 * VaultCalc - Media Viewer Screen
 *
 * Full-screen viewer for decrypted media items.
 * Decrypts the encrypted file to a temp path and displays it.
 * Cleans up the temp file on unmount.
 *
 * Video player features:
 * - Play/pause with tap overlay
 * - Seek bar with scrubbing
 * - Forward 10s / backward 10s
 * - Double-tap left/right to seek
 * - Playback speed (0.5x – 2x)
 * - Volume / mute toggle
 * - Buffering indicator
 * - Error handling with retry
 * - Auto-hide controls
 * - Screen kept awake during playback
 * - Pause on background / incoming call
 *
 * @see FEATURE_INDEX.md VAULT-005, VIDEO-005
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
  Dimensions,
  Animated,
  AppState,
  type GestureResponderEvent,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video, { type VideoRef, type OnLoadData, type OnProgressData, type OnVideoErrorData, type OnBufferData } from 'react-native-video';
import { useQueryClient } from '@tanstack/react-query';
import type { VaultStackScreenProps } from '@typedefs/navigation';
import { mediaItems, type MediaItem } from '@services/storage/database';
import { useAuthStore } from '@store/authStore';
import { decryptFile, decryptFileStreaming, getVaultDirectory } from '@services/crypto';
import { deleteFile } from '@services/media';
import { shareMediaItems } from '@services/share';
import { getPageCount, renderPage, type PdfPageResult } from '@services/pdf';
import { ZoomableImage } from '../components/ZoomableImage';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';

type Props = VaultStackScreenProps<'MediaViewer'>;

// ─── Constants ───────────────────────────────────────────────────────
const CONTROLS_HIDE_DELAY = 4000;
const SEEK_SECONDS = 10;
const DOUBLE_TAP_DELAY = 300;
const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// ─── Helpers ─────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.substring(dot) : '';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ─── Main Component ──────────────────────────────────────────────────

export function MediaViewerScreen({ navigation, route }: Props): React.JSX.Element {
  const { mediaId } = route.params;
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const queryClient = useQueryClient();
  const isDecoyMode = useAuthStore(s => s.isDecoyMode);

  // Media loading state
  const [item, setItem] = useState<MediaItem | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [decryptedUri, setDecryptedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tempPath, setTempPath] = useState<string | null>(null);

  // ── Video player state ──
  const videoRef = useRef<VideoRef>(null);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekBarWidth, setSeekBarWidth] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // ── Controls visibility with auto-hide ──
  const [showControls, setShowControls] = useState(true);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fadeControls = useCallback((show: boolean) => {
    Animated.timing(controlsOpacity, {
      toValue: show ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      if (!show) setShowControls(false);
    });
    if (show) setShowControls(true);
  }, [controlsOpacity]);

  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!paused) {
      hideTimer.current = setTimeout(() => fadeControls(false), CONTROLS_HIDE_DELAY);
    }
  }, [paused, fadeControls]);

  const toggleControls = useCallback(() => {
    if (showControls) {
      fadeControls(false);
    } else {
      fadeControls(true);
      resetHideTimer();
    }
  }, [showControls, fadeControls, resetHideTimer]);

  // Show controls when paused, auto-hide when playing
  useEffect(() => {
    if (paused) {
      fadeControls(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else {
      resetHideTimer();
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [paused, fadeControls, resetHideTimer]);

  // ── Double-tap to seek ──
  const lastTap = useRef<{ time: number; x: number } | null>(null);

  const handleVideoAreaPress = useCallback((e: GestureResponderEvent) => {
    const { locationX } = e.nativeEvent;
    const now = Date.now();
    const screenW = Dimensions.get('window').width;

    if (lastTap.current && now - lastTap.current.time < DOUBLE_TAP_DELAY) {
      // Double tap detected
      const isLeftSide = locationX < screenW / 2;
      const seekTo = isLeftSide
        ? Math.max(0, currentTime - SEEK_SECONDS)
        : Math.min(duration, currentTime + SEEK_SECONDS);
      videoRef.current?.seek(seekTo);
      setCurrentTime(seekTo);
      lastTap.current = null;
      // Show controls briefly
      fadeControls(true);
      resetHideTimer();
    } else {
      lastTap.current = { time: now, x: locationX };
      // Single tap — toggle controls after delay
      setTimeout(() => {
        if (lastTap.current && now === lastTap.current.time) {
          toggleControls();
          lastTap.current = null;
        }
      }, DOUBLE_TAP_DELAY);
    }
  }, [currentTime, duration, fadeControls, resetHideTimer, toggleControls]);

  // ── Pause on background ──
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state !== 'active' && item?.type === 'video') {
        setPaused(true);
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [item?.type]);

  // ── Load and decrypt media ──
  useEffect(() => {
    let cancelled = false;
    let decryptedPath: string | null = null;

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
        decryptedPath = `${vaultDirResult.data}/viewer_${mediaItem.id}${ext}`;

        const decryptFn = mediaItem.type === 'video' ? decryptFileStreaming : decryptFile;
        const decryptResult = await decryptFn(
          mediaItem.encryptedPath,
          decryptedPath,
          mediaItem.keyId,
        );
        if (cancelled) {
          deleteFile(decryptedPath);
          return;
        }

        if (!decryptResult.success) {
          setError('Failed to decrypt file.');
          setIsLoading(false);
          return;
        }

        setTempPath(decryptedPath);
        setDecryptedUri(`file://${decryptedPath}`);
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
      if (decryptedPath) deleteFile(decryptedPath);
    };
  }, [mediaId]);

  // Cleanup temp on unmount
  useEffect(() => {
    return () => { if (tempPath) deleteFile(tempPath); };
  }, [tempPath]);

  // ── Handlers ──
  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

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

  // Video callbacks
  const handleVideoLoad = useCallback((data: OnLoadData) => {
    setDuration(data.duration);
    setVideoError(null);
  }, []);

  const handleVideoProgress = useCallback((data: OnProgressData) => {
    setCurrentTime(data.currentTime);
  }, []);

  const handleVideoEnd = useCallback(() => {
    setPaused(true);
    fadeControls(true);
  }, [fadeControls]);

  const handleVideoError = useCallback((e: OnVideoErrorData) => {
    const msg = e.error?.errorString || e.error?.errorException || 'Unable to play this video';
    setVideoError(msg);
    setPaused(true);
  }, []);

  const handleBuffer = useCallback((data: OnBufferData) => {
    setIsBuffering(data.isBuffering);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (videoError) return;
    setPaused(p => !p);
    resetHideTimer();
  }, [videoError, resetHideTimer]);

  const handleSeekBackward = useCallback(() => {
    const t = Math.max(0, currentTime - SEEK_SECONDS);
    videoRef.current?.seek(t);
    setCurrentTime(t);
    resetHideTimer();
  }, [currentTime, resetHideTimer]);

  const handleSeekForward = useCallback(() => {
    const t = Math.min(duration, currentTime + SEEK_SECONDS);
    videoRef.current?.seek(t);
    setCurrentTime(t);
    resetHideTimer();
  }, [currentTime, duration, resetHideTimer]);

  const handleSeek = useCallback((e: GestureResponderEvent) => {
    if (seekBarWidth <= 0 || duration <= 0) return;
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / seekBarWidth));
    const seekTime = ratio * duration;
    videoRef.current?.seek(seekTime);
    setCurrentTime(seekTime);
    resetHideTimer();
  }, [seekBarWidth, duration, resetHideTimer]);

  const handleSeekBarLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    setSeekBarWidth(e.nativeEvent.layout.width);
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted(m => !m);
    resetHideTimer();
  }, [resetHideTimer]);

  const handleSpeedSelect = useCallback((speed: number) => {
    setPlaybackRate(speed);
    setShowSpeedMenu(false);
    resetHideTimer();
  }, [resetHideTimer]);

  const handleToggleSpeedMenu = useCallback(() => {
    setShowSpeedMenu(s => !s);
    resetHideTimer();
  }, [resetHideTimer]);

  const handleRetry = useCallback(() => {
    setVideoError(null);
    setPaused(false);
  }, []);

  const progress = duration > 0 ? currentTime / duration : 0;

  // PDF viewer state
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const isPdf = item?.mimeType === 'application/pdf';

  useEffect(() => {
    if (!isPdf || !tempPath) return;
    let cancelled = false;
    async function loadPdfInfo() {
      const result = await getPageCount(tempPath!);
      if (!cancelled && result.success && result.data !== undefined) {
        setPdfPageCount(result.data);
      }
    }
    loadPdfInfo();
    return () => { cancelled = true; };
  }, [isPdf, tempPath]);

  // ── Loading state ──
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={themeColors.accent} />
        <Text style={styles.loadingText}>Decrypting...</Text>
      </View>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={handleBack} style={styles.backButtonCenter}>
          <Text style={styles.backButtonCenterText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Video render ──
  if (decryptedUri !== null && item?.type === 'video') {
    return (
      <View style={styles.container}>
        {/* Video */}
        <Pressable style={styles.videoTouchArea} onPress={handleVideoAreaPress}>
          <Video
            ref={videoRef}
            source={{ uri: decryptedUri }}
            style={styles.video}
            controls={false}
            resizeMode="contain"
            paused={paused}
            rate={playbackRate}
            volume={volume}
            muted={isMuted}
            repeat={false}
            onLoad={handleVideoLoad}
            onProgress={handleVideoProgress}
            onEnd={handleVideoEnd}
            onError={handleVideoError}
            onBuffer={handleBuffer}
            progressUpdateInterval={250}
            preventsDisplaySleepDuringVideoPlayback={true}
            playInBackground={false}
          />

          {/* Buffering spinner */}
          {isBuffering && !paused && (
            <View style={styles.bufferingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}

          {/* Video error overlay */}
          {videoError && (
            <View style={styles.videoErrorOverlay}>
              <Text style={styles.videoErrorIcon}>{'\u26A0'}</Text>
              <Text style={styles.videoErrorText}>Unable to play this video</Text>
              <Text style={styles.videoErrorDetail}>{videoError}</Text>
              <Pressable onPress={handleRetry} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          )}
        </Pressable>

        {/* Controls overlay — animated opacity */}
        {showControls && (
          <Animated.View style={[styles.controlsOverlay, { opacity: controlsOpacity }]} pointerEvents="box-none">
            {/* Top bar */}
            <SafeAreaView edges={['top']} style={styles.topBar}>
              <Pressable onPress={handleBack} style={styles.iconButton}>
                <Text style={styles.iconText}>{'\u2190'}</Text>
              </Pressable>
              <Text style={styles.headerTitle} numberOfLines={1}>{item.originalName}</Text>
              <Pressable onPress={handleToggleFavorite} style={styles.iconButton}>
                <Text style={styles.favIconText}>{isFavorite ? '\u2605' : '\u2606'}</Text>
              </Pressable>
              <Pressable onPress={handleShare} style={styles.iconButton}>
                <Text style={styles.iconText}>{'\u2B06'}</Text>
              </Pressable>
            </SafeAreaView>

            {/* Center play/pause */}
            {paused && !videoError && (
              <Pressable style={styles.centerPlayButton} onPress={handlePlayPause}>
                <View style={styles.centerPlayCircle}>
                  <Text style={styles.centerPlayIcon}>{'\u25B6'}</Text>
                </View>
              </Pressable>
            )}

            {/* Bottom controls */}
            <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
              {/* Seek bar */}
              <Pressable
                style={styles.seekBarRow}
                onPress={handleSeek}
                onLayout={handleSeekBarLayout}
              >
                <View style={styles.seekTrack}>
                  <View style={[styles.seekFill, { flex: progress }]} />
                  <View style={styles.seekThumb} />
                  <View style={{ flex: Math.max(0.001, 1 - progress) }} />
                </View>
              </Pressable>

              {/* Controls row */}
              <View style={styles.controlsRow}>
                {/* Time */}
                <Text style={styles.timeText}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Text>

                <View style={styles.controlsSpacer} />

                {/* Rewind 10s */}
                <Pressable onPress={handleSeekBackward} style={styles.iconButton}>
                  <Text style={styles.seekIconText}>{'\u23EA'}</Text>
                </Pressable>

                {/* Play/Pause */}
                <Pressable onPress={handlePlayPause} style={styles.iconButton}>
                  <Text style={styles.controlIconText}>
                    {paused ? '\u25B6' : '\u23F8'}
                  </Text>
                </Pressable>

                {/* Forward 10s */}
                <Pressable onPress={handleSeekForward} style={styles.iconButton}>
                  <Text style={styles.seekIconText}>{'\u23E9'}</Text>
                </Pressable>

                <View style={styles.controlsSpacer} />

                {/* Mute */}
                <Pressable onPress={handleToggleMute} style={styles.iconButton}>
                  <Text style={styles.smallIconText}>
                    {isMuted ? '\u{1F507}' : '\u{1F50A}'}
                  </Text>
                </Pressable>

                {/* Speed */}
                <Pressable onPress={handleToggleSpeedMenu} style={styles.speedButton}>
                  <Text style={styles.speedText}>{playbackRate}x</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </Animated.View>
        )}

        {/* Speed selection menu */}
        {showSpeedMenu && (
          <View style={styles.speedMenu}>
            <Text style={styles.speedMenuTitle}>Playback Speed</Text>
            {PLAYBACK_SPEEDS.map(speed => (
              <Pressable
                key={speed}
                onPress={() => handleSpeedSelect(speed)}
                style={({ pressed }) => [
                  styles.speedMenuItem,
                  speed === playbackRate && styles.speedMenuItemActive,
                  pressed && styles.speedMenuItemPressed,
                ]}
              >
                <Text style={[
                  styles.speedMenuItemText,
                  speed === playbackRate && styles.speedMenuItemTextActive,
                ]}>
                  {speed}x
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  }

  // ── Photo / PDF / Document render ──
  return (
    <View style={styles.container}>
      {/* Header overlay */}
      <SafeAreaView edges={['top']} style={styles.headerOverlay}>
        <Pressable onPress={handleBack} style={styles.iconButton}>
          <Text style={styles.iconText}>{'\u2190'}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {item?.originalName ?? ''}
        </Text>
        <Pressable onPress={handleToggleFavorite} style={styles.iconButton}>
          <Text style={styles.favIconText}>{isFavorite ? '\u2605' : '\u2606'}</Text>
        </Pressable>
        <Pressable onPress={handleShare} style={styles.iconButton}>
          <Text style={styles.iconText}>{'\u2B06'}</Text>
        </Pressable>
      </SafeAreaView>

      {isPdf && tempPath && pdfPageCount > 0 ? (
        <FlatList
          data={Array.from({ length: pdfPageCount }, (_, i) => i)}
          keyExtractor={(i) => `page-${i}`}
          renderItem={({ item: pageIndex }) => (
            <PdfPageItem
              filePath={tempPath}
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
          <Text style={styles.documentIcon}>{'\u{1F4C4}'}</Text>
          <Text style={styles.documentName}>{item.originalName}</Text>
          <Text style={styles.documentMeta}>
            {item.mimeType} {'\u00B7'} {formatFileSize(item.sizeBytes)}
          </Text>
        </View>
      ) : decryptedUri !== null ? (
        <ZoomableImage
          source={{ uri: decryptedUri }}
          style={styles.image}
        />
      ) : null}
    </View>
  );
}

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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ACCENT = '#3B82F6';

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
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
  smallIconText: { fontSize: 18, color: '#FFFFFF' },
  headerTitle: {
    ...typography.titleMedium,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },

  // ── Photo ──
  image: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },

  // ── Video ──
  videoTouchArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: { width: '100%', height: '100%' },

  // ── Buffering ──
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Video error ──
  videoErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: spacing.xl,
  },
  videoErrorIcon: { fontSize: 48, marginBottom: spacing.md },
  videoErrorText: {
    ...typography.titleMedium,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  videoErrorDetail: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: ACCENT,
  },
  retryButtonText: { ...typography.labelLarge, color: '#FFFFFF' },

  // ── Controls overlay (video) ──
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  bottomBar: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },

  // ── Center play button ──
  centerPlayButton: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -32,
  },
  centerPlayCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPlayIcon: { fontSize: 28, color: '#FFFFFF', marginLeft: 4 },

  // ── Seek bar ──
  seekBarRow: {
    height: 28,
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  seekTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  seekFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT,
  },
  seekThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    marginHorizontal: -7,
    elevation: 2,
  },

  // ── Controls row ──
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.xxs,
  },
  controlsSpacer: { flex: 1 },
  timeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  seekIconText: { fontSize: 18, color: '#FFFFFF' },
  controlIconText: { fontSize: 22, color: '#FFFFFF' },

  // ── Speed button ──
  speedButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  speedText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // ── Speed menu ──
  speedMenu: {
    position: 'absolute',
    bottom: 100,
    right: spacing.md,
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderRadius: 12,
    paddingVertical: spacing.sm,
    minWidth: 140,
    elevation: 10,
  },
  speedMenuTitle: {
    ...typography.labelMedium,
    color: 'rgba(255,255,255,0.5)',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  speedMenuItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  speedMenuItemActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  speedMenuItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  speedMenuItemText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  speedMenuItemTextActive: {
    color: ACCENT,
    fontWeight: '600',
  },

  // ── Loading / Error states ──
  loadingText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.bodyMedium,
    color: '#FF6B6B',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  backButtonCenter: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: c.accent,
  },
  backButtonCenterText: {
    ...typography.labelLarge,
    color: c.textOnAccent,
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
});
