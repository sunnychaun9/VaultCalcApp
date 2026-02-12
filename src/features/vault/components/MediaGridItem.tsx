/**
 * VaultCalc - Media Grid Item Component
 *
 * Square thumbnail cell for the vault grid.
 * Decrypts and displays encrypted thumbnails (VAULT-004).
 * Falls back to a placeholder emoji when no thumbnail is available.
 *
 * @see FEATURE_INDEX.md VAULT-003, VAULT-004
 */

import React, { useMemo } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { MediaItem } from '@services/storage/database';
import { useDecryptedThumbnail } from '../hooks';
import { useVaultStore } from '@store/vaultStore';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';

interface MediaGridItemProps {
  item: MediaItem;
  size: number;
  onPress: (item: MediaItem) => void;
  onLongPress: (item: MediaItem) => void;
}

/** Map media type to placeholder emoji */
const TYPE_ICONS: Record<string, string> = {
  photo: '\u{1F5BC}',   // 🖼
  video: '\u{1F3AC}',   // 🎬
  document: '\u{1F4C4}', // 📄
};

/** Map MIME type prefix to document-specific emoji (DOC-001) */
function getDocumentIcon(mimeType: string): string {
  if (mimeType === 'application/pdf') return '\u{1F4D5}'; // 📕
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv')
    return '\u{1F4CA}'; // 📊
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return '\u{1F4CA}'; // 📊
  if (mimeType === 'text/plain') return '\u{1F4DD}'; // 📝
  if (mimeType === 'application/json') return '\u{1F4CB}'; // 📋
  if (mimeType === 'application/zip') return '\u{1F4E6}'; // 📦
  return '\u{1F4C4}'; // 📄
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

  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      accessibilityRole="button"
      accessibilityLabel={item.originalName}
      accessibilityState={{ selected: isSelected }}
    >
      {/* Thumbnail area */}
      <View
        style={[
          styles.thumbnail,
          { width: size, height: size },
          isSelected && styles.thumbnailSelected,
        ]}
      >
        {thumbnailUri !== null ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.typeIcon}>
            {item.type === 'document'
              ? getDocumentIcon(item.mimeType)
              : (TYPE_ICONS[item.type] ?? '\u{1F4C4}')}
          </Text>
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
            <Text style={styles.favBadgeText}>{'\u2605'}</Text>
          </View>
        )}

        {/* Selection overlay */}
        {isSelected && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>{'\u2713'}</Text>
          </View>
        )}
      </View>

      {/* Filename */}
      <Text style={[styles.filename, { width: size }]} numberOfLines={1}>
        {item.originalName}
      </Text>
    </Pressable>
  );
});

const createStyles = (c: ColorTokens) => StyleSheet.create({
  thumbnail: {
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailSelected: {
    borderWidth: 2,
    borderColor: c.accent,
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
