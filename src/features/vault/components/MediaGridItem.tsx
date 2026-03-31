/**
 * VaultCalc - Media Grid Item Component
 *
 * Square thumbnail cell for the vault grid.
 * Decrypts and displays encrypted thumbnails (VAULT-004).
 * Falls back to a placeholder emoji when no thumbnail is available.
 *
 * The thumbnail Image is isolated from re-renders caused by favorite
 * toggles or selection changes: `fadeDuration={0}` prevents the Fresco
 * decode flash, and the source object is memoised on the URI string.
 *
 * @see FEATURE_INDEX.md VAULT-003, VAULT-004
 */

import React, { useMemo, useRef, useCallback } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { MediaItem } from '@services/storage/database';
import { useDecryptedThumbnail } from '../hooks';
import { useVaultStore } from '@store/vaultStore';
import { useThemeColors, type ColorTokens, typography, spacing, elevationLevels } from '@shared/theme';
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

  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const { uri: thumbnailUri } = useDecryptedThumbnail(
    item.thumbnailPath,
    item.id,
    item.keyId,
  );

  // Stabilize the Image source object so Fresco doesn't re-load the same
  // URI on parent re-renders (e.g. after toggling favorite).
  // Also keep a ref to the last valid source: if thumbnailUri momentarily
  // becomes null during a FlashList recycle for the SAME item id, we keep
  // showing the old image instead of flashing the placeholder.
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
  // for this same item (prevents brief black flash during cell recycle).
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

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={() => onLongPress(item)}
      accessibilityRole="button"
      accessibilityLabel={item.originalName}
      accessibilityState={{ selected: isSelected }}
    >
      {/* Thumbnail area — border is always present (transparent when
          not selected) so toggling selection never changes the container
          layout, which would cause the Image to blank on Android. */}
      <View
        ref={thumbRef}
        style={[
          styles.thumbnail,
          { width: size, height: size },
          { borderColor: isSelected ? themeColors.accent : 'transparent' },
        ]}
      >
        {displaySource !== null ? (
          <Image
            source={displaySource}
            style={styles.thumbnailImage}
            resizeMode="cover"
            // Disable Fresco's fade-in animation — prevents the black flash
            // when the Image component re-renders with the same source
            // (e.g. after toggling favorite or selection state).
            fadeDuration={0}
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

        {/* Duration badge for videos (VIDEO-003) */}
        {item.type === 'video' && item.durationMs !== null && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {formatDuration(item.durationMs)}
            </Text>
          </View>
        )}

        {/* Favorite star badge (ENH-002) */}
        {item.isFavorite && !isSelected && (
          <View style={styles.favBadge}>
            <Icon name="star" size={12} color="#FFD700" fill="#FFD700" />
          </View>
        )}

        {/* Selection overlay */}
        {isSelected && (
          <View style={styles.checkmark}>
            <Icon name="check" size={14} color={themeColors.textOnAccent} strokeWidth={3} />
          </View>
        )}
      </View>

      {/* Filename */}
      <Text style={[styles.filename, { width: size }]} numberOfLines={1}>
        {item.originalName}
      </Text>
    </Pressable>
  );
}, arePropsEqual);

const createStyles = (c: ColorTokens) => StyleSheet.create({
  thumbnail: {
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...elevationLevels.level1.shadow,
    // Always have borderWidth so toggling selection never changes layout.
    // Color is set inline (transparent when not selected, accent when selected).
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  typeIcon: {
    fontSize: 32,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  favBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  favBadgeText: {
    color: '#FFD700',
    fontSize: 12,
  },
  checkmark: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: c.textOnAccent,
    fontSize: 14,
    fontWeight: '700',
  },
  filename: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: spacing.xxs,
    paddingHorizontal: spacing.xxs,
  },
});
