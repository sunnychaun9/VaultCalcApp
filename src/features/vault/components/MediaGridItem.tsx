/**
 * VaultCalc - Media Grid Item Component
 *
 * Premium square thumbnail cell for the vault grid.
 * Decrypts and displays encrypted thumbnails (VAULT-004).
 * Falls back to a type icon when no thumbnail is available.
 *
 * The thumbnail Image is isolated from re-renders caused by favorite
 * toggles or selection changes: `fadeDuration={0}` prevents the Fresco
 * decode flash, and the source object is memoised on the URI string.
 *
 * Selection state animates with a spring-physics checkmark and subtle
 * scrim overlay for a premium gallery feel.
 *
 * @see FEATURE_INDEX.md VAULT-003, VAULT-004
 */

import React, { useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { MediaItem } from '@services/storage/database';
import { useDecryptedThumbnail } from '../hooks';
import { useVaultStore } from '@store/vaultStore';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { Icon, type IconName } from '@shared/components/Icon';

/** Origin rect for hero transition — screen coordinates */
export interface ThumbnailOriginRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MediaGridItemProps {
  item: MediaItem;
  size: number;
  onPress: (item: MediaItem, originRect?: ThumbnailOriginRect) => void;
  onLongPress: (item: MediaItem) => void;
}

/** Map media type to icon name */
const TYPE_ICONS: Record<string, IconName> = {
  photo: 'image',
  video: 'film',
  document: 'file-text',
};

/** Map MIME type to document-specific icon (DOC-001) */
function getDocumentIcon(mimeType: string): IconName {
  if (mimeType === 'application/pdf') return 'file-text';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv')
    return 'file-spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return 'file-spreadsheet';
  if (mimeType === 'text/plain') return 'pencil';
  if (mimeType === 'application/json') return 'file-json';
  if (mimeType === 'application/zip') return 'archive';
  return 'file-text';
}

/** Format milliseconds to MM:SS or H:MM:SS */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

// ── Spring presets ──────────────────────────────────────────────
const SPRING_SNAPPY = { damping: 14, stiffness: 350, mass: 0.6 };

/**
 * Custom memo comparator: only re-render when visually relevant fields change.
 * Prevents unnecessary re-renders (and Fresco image reload flashes) when
 * React Query creates new item object references with the same data.
 */
function arePropsEqual(prev: MediaGridItemProps, next: MediaGridItemProps): boolean {
  return (
    prev.item.id === next.item.id &&
    prev.item.thumbnailPath === next.item.thumbnailPath &&
    prev.item.keyId === next.item.keyId &&
    prev.item.isFavorite === next.item.isFavorite &&
    prev.item.type === next.item.type &&
    prev.item.durationMs === next.item.durationMs &&
    prev.item.originalName === next.item.originalName &&
    prev.item.mimeType === next.item.mimeType &&
    prev.size === next.size &&
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress
  );
}

export const MediaGridItem = React.memo(function MediaGridItem({
  item,
  size,
  onPress,
  onLongPress,
}: MediaGridItemProps): React.JSX.Element {
  // Subscribe to just this item's selection state — only re-renders when
  // THIS item's boolean flips, not when any other item is toggled.
  const isSelected = useVaultStore(s => s.selectedIds.has(item.id));
  const isSelectionMode = useVaultStore(s => s.isSelectionMode);

  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const { uri: thumbnailUri, isLoading: thumbnailLoading } = useDecryptedThumbnail(
    item.thumbnailPath,
    item.id,
    item.keyId,
  );
  // Track whether this cell's thumbnail was resolved from cache (instant) or async (first load).
  // Cache hits get fadeDuration=0 (no flash on cell recycle), async loads get 200ms fade-in.
  const wasCacheHit = useRef(!thumbnailLoading && thumbnailUri !== null);
  const thumbnailFadeDuration = wasCacheHit.current ? 0 : 200;

  // ── Selection animation ──
  const selectionProgress = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    selectionProgress.value = withSpring(isSelected ? 1 : 0, SPRING_SNAPPY);
  }, [isSelected, selectionProgress]);

  // Thumbnail scales slightly when selected for visual feedback
  const thumbnailAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(selectionProgress.value, [0, 1], [1, 0.92], Extrapolation.CLAMP) },
    ],
    borderRadius: interpolate(selectionProgress.value, [0, 1], [14, 16], Extrapolation.CLAMP),
  }));

  // Checkmark badge scales in with spring
  const checkmarkAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: selectionProgress.value },
    ],
    opacity: selectionProgress.value,
  }));

  // Selection scrim overlay
  const scrimAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(selectionProgress.value, [0, 1], [0, 0.15], Extrapolation.CLAMP),
  }));

  // Press feedback
  const pressScale = useSharedValue(1);
  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  // Stabilize the Image source object so Fresco doesn't re-load the same
  // URI on parent re-renders (e.g. after toggling favorite).
  const lastSource = useRef<{ uri: string } | null>(null);

  const imageSource = useMemo(() => {
    if (thumbnailUri !== null) {
      const src = { uri: thumbnailUri };
      lastSource.current = src;
      return src;
    }
    return null;
  }, [thumbnailUri]);

  // Use the last known-good source if current is null but we had one before
  const displaySource = imageSource ?? lastSource.current;

  // Ref for measuring thumbnail position (hero transition)
  const thumbRef = useRef<View>(null);

  const handlePress = useCallback(() => {
    if (thumbRef.current) {
      thumbRef.current.measureInWindow((x, y, w, h) => {
        onPress(item, { x, y, width: w, height: h });
      });
    } else {
      onPress(item);
    }
  }, [item, onPress]);

  const handlePressIn = useCallback(() => {
    pressScale.value = withSpring(0.96, { damping: 20, stiffness: 400 });
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [pressScale]);

  return (
    <Animated.View style={pressAnimStyle}>
      <Pressable
        onPress={handlePress}
        onLongPress={() => onLongPress(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={item.originalName}
        accessibilityState={{ selected: isSelected }}
      >
        <Animated.View
          ref={thumbRef}
          style={[
            styles.thumbnail,
            { width: size, height: size },
            thumbnailAnimStyle,
          ]}
        >
          {displaySource !== null ? (
            <Image
              source={displaySource}
              style={styles.thumbnailImage}
              resizeMode="cover"
              fadeDuration={thumbnailFadeDuration}
            />
          ) : (
            <Icon
              name={item.type === 'document'
                ? getDocumentIcon(item.mimeType)
                : (TYPE_ICONS[item.type] ?? 'file-text')}
              size={32}
              color={themeColors.textTertiary}
            />
          )}

          {/* Selection scrim overlay */}
          <Animated.View style={[styles.selectionScrim, scrimAnimStyle]} pointerEvents="none" />

          {/* Duration badge for videos */}
          {item.type === 'video' && item.durationMs !== null && (
            <View style={styles.durationBadge}>
              <Icon name="play" size={8} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.durationText}>
                {formatDuration(item.durationMs)}
              </Text>
            </View>
          )}

          {/* Favorite star badge */}
          {item.isFavorite && !isSelected && (
            <View style={styles.favBadge}>
              <Icon name="star" size={11} color="#FFD700" fill="#FFD700" />
            </View>
          )}

          {/* Selection checkmark — animated spring entrance */}
          {isSelectionMode && (
            <Animated.View style={[styles.checkmark, checkmarkAnimStyle]}>
              <Icon name="check" size={12} color={themeColors.textOnAccent} strokeWidth={3} />
            </Animated.View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}, arePropsEqual);

const THUMB_RADIUS = 14;

const createStyles = (c: ColorTokens) => StyleSheet.create({
  thumbnail: {
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: THUMB_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  selectionScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.accent,
    borderRadius: THUMB_RADIUS,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  favBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  filename: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: spacing.xxs,
    paddingHorizontal: spacing.xxs,
  },
});
