/**
 * VaultCalc - Media List Item Component
 *
 * File-manager style row for images/videos in list view mode.
 * Shows thumbnail, filename, size, date, and duration badge for videos.
 *
 * @see VAULT-003
 */

import React, { useMemo, useRef } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { MediaItem } from '@services/storage/database';
import { useDecryptedThumbnail } from '../hooks';
import { useVaultStore } from '@store/vaultStore';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';

interface MediaListItemProps {
  item: MediaItem;
  onPress: (item: MediaItem) => void;
  onLongPress: (item: MediaItem) => void;
}

const TYPE_ICONS: Record<string, string> = {
  photo: '\u{1F5BC}',
  video: '\u{1F3AC}',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(timestamp: number): string {
  const now = new Date();
  const d = new Date(timestamp);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${month}/${day}/${d.getFullYear()}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function arePropsEqual(prev: MediaListItemProps, next: MediaListItemProps): boolean {
  return (
    prev.item.id === next.item.id &&
    prev.item.thumbnailPath === next.item.thumbnailPath &&
    prev.item.keyId === next.item.keyId &&
    prev.item.isFavorite === next.item.isFavorite &&
    prev.item.originalName === next.item.originalName &&
    prev.item.sizeBytes === next.item.sizeBytes &&
    prev.item.durationMs === next.item.durationMs &&
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress
  );
}

export const MediaListItem = React.memo(function MediaListItem({
  item,
  onPress,
  onLongPress,
}: MediaListItemProps): React.JSX.Element {
  const isSelected = useVaultStore(s => s.selectedIds.has(item.id));
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const { uri: thumbnailUri } = useDecryptedThumbnail(
    item.thumbnailPath,
    item.id,
    item.keyId,
  );

  const lastSource = useRef<{ uri: string } | null>(null);
  const imageSource = useMemo(() => {
    if (thumbnailUri !== null) {
      const src = { uri: thumbnailUri };
      lastSource.current = src;
      return src;
    }
    return null;
  }, [thumbnailUri]);
  const displaySource = imageSource ?? lastSource.current;

  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      style={({ pressed }) => [
        styles.container,
        isSelected && styles.containerSelected,
        pressed && styles.containerPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={item.originalName}
      accessibilityState={{ selected: isSelected }}
    >
      {/* Thumbnail */}
      <View style={[styles.thumbBox, isSelected && styles.thumbBoxSelected]}>
        {isSelected ? (
          <Text style={styles.checkmark}>{'\u2713'}</Text>
        ) : displaySource !== null ? (
          <Image
            source={displaySource}
            style={styles.thumbImage}
            resizeMode="cover"
            fadeDuration={0}
          />
        ) : (
          <Text style={styles.thumbIcon}>{TYPE_ICONS[item.type] ?? '\u{1F4C4}'}</Text>
        )}
        {/* Duration badge for videos */}
        {item.type === 'video' && item.durationMs !== null && !isSelected && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(item.durationMs)}</Text>
          </View>
        )}
      </View>

      {/* File info */}
      <View style={styles.textContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {item.originalName}
          {item.isFavorite && !isSelected && (
            <Text style={styles.favStar}>{' \u2605'}</Text>
          )}
        </Text>
        <Text style={styles.meta}>
          {formatFileSize(item.sizeBytes)} {'\u00B7'} {formatDate(item.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}, arePropsEqual);

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.vaultListItemHeight,
    paddingHorizontal: spacing.md,
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  containerSelected: {
    backgroundColor: c.surfaceContainerHigh,
  },
  containerPressed: {
    opacity: 0.7,
  },
  thumbBox: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: c.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbBoxSelected: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  thumbIcon: {
    fontSize: 24,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '700',
    color: c.textOnAccent,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    ...typography.bodyMedium,
    color: c.textPrimary,
  },
  favStar: {
    color: '#FFD700',
    fontSize: 14,
  },
  meta: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: 2,
  },
});
