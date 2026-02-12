/**
 * VaultCalc - Media Viewer Screen
 *
 * Full-screen viewer for decrypted media items.
 * Decrypts the encrypted file to a temp path and displays it.
 * Cleans up the temp file on unmount.
 *
 * @see FEATURE_INDEX.md VAULT-005
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
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video, { type VideoRef, type OnLoadData, type OnProgressData } from 'react-native-video';
import { useQueryClient } from '@tanstack/react-query';
import type { VaultStackScreenProps } from '@typedefs/navigation';
import { mediaItems, type MediaItem } from '@services/storage/database';
import { useAuthStore } from '@store/authStore';
import { decryptFile, decryptFileStreaming, getVaultDirectory } from '@services/crypto';
import { deleteFile } from '@services/media';
import { shareMediaItems } from '@services/share';
import { getPageCount, renderPage, type PdfPageResult } from '@services/pdf';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';

type Props = VaultStackScreenProps<'MediaViewer'>;

/** Format seconds to M:SS or H:MM:SS */
function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

/**
 * Full-screen media viewer.
 * Decrypts and displays the selected media item.
 */
export function MediaViewerScreen({ navigation, route }: Props): React.JSX.Element {
  const { mediaId } = route.params;
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const queryClient = useQueryClient();
  const isDecoyMode = useAuthStore(s => s.isDecoyMode);

  const [item, setItem] = useState<MediaItem | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [decryptedUri, setDecryptedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Track the temp file path for cleanup
  const [tempPath, setTempPath] = useState<string | null>(null);

  // Load and decrypt the media item
  useEffect(() => {
    let cancelled = false;
    let decryptedPath: string | null = null;

    async function loadMedia() {
      try {
        // 1. Fetch item from DB
        const mediaItem = await mediaItems.getById(mediaId);
        if (cancelled) return;
        if (!mediaItem) {
          setError('Media item not found.');
          setIsLoading(false);
          return;
        }
        setItem(mediaItem);
        setIsFavorite(mediaItem.isFavorite);

        // 2. Determine temp output path
        const vaultDirResult = await getVaultDirectory();
        if (!vaultDirResult.success || !vaultDirResult.data) {
          setError('Could not access vault directory.');
          setIsLoading(false);
          return;
        }

        const ext = getExtension(mediaItem.originalName);
        decryptedPath = `${vaultDirResult.data}/viewer_${mediaItem.id}${ext}`;

        // 3. Decrypt the file (streaming for videos, regular for photos/docs)
        const decryptFn = mediaItem.type === 'video' ? decryptFileStreaming : decryptFile;
        const decryptResult = await decryptFn(
          mediaItem.encryptedPath,
          decryptedPath,
          mediaItem.keyId,
        );
        if (cancelled) {
          // Clean up if we decrypted but component unmounted
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
      // Clean up temp decrypted file
      if (decryptedPath) {
        deleteFile(decryptedPath);
      }
    };
  }, [mediaId]);

  // Also clean up on unmount if tempPath was set after effect ran
  useEffect(() => {
    return () => {
      if (tempPath) {
        deleteFile(tempPath);
      }
    };
  }, [tempPath]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Share handler (ENH-001)
  const handleShare = useCallback(async () => {
    if (!item) return;
    await shareMediaItems([item]);
  }, [item]);

  // Favorite toggle handler (ENH-002)
  const handleToggleFavorite = useCallback(async () => {
    if (!item) return;
    const newValue = !isFavorite;

    // 1. Update local viewer UI immediately
    setIsFavorite(newValue);

    // 2. Optimistic cache update — grid sees the new state instantly on back-nav
    const mediaType = item.type;
    queryClient.setQueryData<MediaItem[]>(
      ['media', mediaType, isDecoyMode],
      (old) => old?.map(i => i.id === item.id ? { ...i, isFavorite: newValue } : i),
    );

    // 3. Persist to DB
    await mediaItems.toggleFavorite(item.id);

    // 4. Background refetch to reconcile cache with DB
    await queryClient.invalidateQueries({ queryKey: ['media', mediaType, isDecoyMode] });
  }, [item, isFavorite, queryClient, isDecoyMode]);

  // Video player state (VIDEO-005)
  const videoRef = useRef<VideoRef>(null);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekBarWidth, setSeekBarWidth] = useState(0);

  const handleVideoLoad = useCallback((data: OnLoadData) => {
    setDuration(data.duration);
  }, []);

  const handleVideoProgress = useCallback((data: OnProgressData) => {
    setCurrentTime(data.currentTime);
  }, []);

  const handleVideoEnd = useCallback(() => {
    setPaused(true);
  }, []);

  const handlePlayPause = useCallback(() => {
    setPaused(p => !p);
  }, []);

  const handleSeek = useCallback((e: GestureResponderEvent) => {
    if (seekBarWidth <= 0 || duration <= 0) return;
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / seekBarWidth));
    const seekTime = ratio * duration;
    videoRef.current?.seek(seekTime);
    setCurrentTime(seekTime);
  }, [seekBarWidth, duration]);

  const handleSeekBarLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    setSeekBarWidth(e.nativeEvent.layout.width);
  }, []);

  const progress = duration > 0 ? currentTime / duration : 0;

  // PDF viewer state (DOC-003)
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

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={themeColors.accent} />
        <Text style={styles.loadingText}>Decrypting...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={handleBack} style={styles.backButtonCenter}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header overlay */}
      <SafeAreaView edges={['top']} style={styles.headerOverlay}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backIcon}>{'\u2190'}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {item?.originalName ?? ''}
        </Text>
        {/* Favorite toggle (ENH-002) */}
        <Pressable
          onPress={handleToggleFavorite}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Text style={styles.favIcon}>{isFavorite ? '\u2605' : '\u2606'}</Text>
        </Pressable>
        {/* Share button */}
        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Share file"
        >
          <Text style={styles.shareIcon}>{'\u2B06'}</Text>
        </Pressable>
      </SafeAreaView>

      {/* Full-screen media */}
      {decryptedUri !== null && item?.type === 'video' ? (
        <>
          <Pressable style={styles.videoTouchArea} onPress={handlePlayPause}>
            <Video
              ref={videoRef}
              source={{ uri: decryptedUri }}
              style={styles.video}
              controls={false}
              resizeMode="contain"
              paused={paused}
              onLoad={handleVideoLoad}
              onProgress={handleVideoProgress}
              onEnd={handleVideoEnd}
              progressUpdateInterval={250}
            />
            {/* Play/pause overlay icon */}
            {paused && (
              <View style={styles.playOverlay}>
                <Text style={styles.playIcon}>{'\u25B6'}</Text>
              </View>
            )}
          </Pressable>

          {/* Controls bar (VIDEO-005) */}
          <SafeAreaView edges={['bottom']} style={styles.controlsBar}>
            {/* Play/Pause button */}
            <Pressable
              onPress={handlePlayPause}
              style={styles.controlButton}
              accessibilityRole="button"
              accessibilityLabel={paused ? 'Play' : 'Pause'}
            >
              <Text style={styles.controlIcon}>
                {paused ? '\u25B6' : '\u23F8'}
              </Text>
            </Pressable>

            {/* Current time */}
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>

            {/* Seek bar */}
            <Pressable
              style={styles.seekBar}
              onPress={handleSeek}
              onLayout={handleSeekBarLayout}
              accessibilityRole="adjustable"
              accessibilityLabel="Seek bar"
            >
              <View style={styles.seekTrack}>
                <View style={[styles.seekFill, { flex: progress }]} />
                <View style={styles.seekThumb} />
                <View style={{ flex: 1 - progress }} />
              </View>
            </Pressable>

            {/* Duration */}
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </SafeAreaView>
        </>
      ) : isPdf && tempPath && pdfPageCount > 0 ? (
        /* PDF page viewer (DOC-003) */
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
        /* Document info view (DOC-001) — non-PDF documents */
        <View style={styles.documentInfo}>
          <Text style={styles.documentIcon}>{'\u{1F4C4}'}</Text>
          <Text style={styles.documentName}>{item.originalName}</Text>
          <Text style={styles.documentMeta}>
            {item.mimeType} {'\u00B7'} {formatFileSize(item.sizeBytes)}
          </Text>
        </View>
      ) : decryptedUri !== null ? (
        <Image
          source={{ uri: decryptedUri }}
          style={styles.image}
          resizeMode="contain"
        />
      ) : null}
    </View>
  );
}

/**
 * Renders a single PDF page on demand (DOC-003).
 * Calls the native PdfModule to render the page to a temp JPEG,
 * then displays it as an Image.
 */
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
  loading: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  errorContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
  },
});

/** Format bytes to human-readable size (DOC-001) */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Extract file extension including the dot, e.g. ".jpg" */
function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.substring(dot) : '';
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  backButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  backIcon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  favIcon: {
    fontSize: 22,
    color: '#FFD700',
  },
  shareIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  headerTitle: {
    ...typography.titleMedium,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  videoTouchArea: {
    flex: 1,
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 56,
    color: 'rgba(255,255,255,0.8)',
  },
  controlsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  controlButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  timeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    marginHorizontal: spacing.xs,
    minWidth: 36,
    textAlign: 'center',
  },
  seekBar: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
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
    backgroundColor: '#FFFFFF',
  },
  seekThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    marginHorizontal: -7,
  },
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
  backButtonText: {
    ...typography.labelLarge,
    color: c.textOnAccent,
  },
  pdfList: {
    flex: 1,
  },
  pdfListContent: {
    paddingTop: 60,
  },
  documentInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  documentIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
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
