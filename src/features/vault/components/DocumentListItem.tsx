/**
 * VaultCalc - Document List Item Component
 *
 * Row-based list item for the documents tab.
 * Shows MIME-specific icon, filename, size, and date.
 *
 * @see FEATURE_INDEX.md DOC-002
 */

import React, { useMemo } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { MediaItem } from '@services/storage/database';
import { useDecryptedThumbnail } from '../hooks';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';

interface DocumentListItemProps {
  item: MediaItem;
  isSelected: boolean;
  onPress: (item: MediaItem) => void;
  onLongPress: (item: MediaItem) => void;
}

/** Map MIME type to document-specific emoji */
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

/** Format bytes to human-readable size */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Format timestamp to short date string */
function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

export const DocumentListItem = React.memo(function DocumentListItem({
  item,
  isSelected,
  onPress,
  onLongPress,
}: DocumentListItemProps): React.JSX.Element {
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
      style={({ pressed }) => [
        styles.container,
        isSelected && styles.containerSelected,
        pressed && styles.containerPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={item.originalName}
      accessibilityState={{ selected: isSelected }}
    >
      {/* Thumbnail or Icon (DOC-004) */}
      <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
        {isSelected ? (
          <Text style={styles.checkmark}>{'\u2713'}</Text>
        ) : thumbnailUri !== null ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.icon}>{getDocumentIcon(item.mimeType)}</Text>
        )}
      </View>

      {/* Name + meta */}
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
});

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
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: c.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconBoxSelected: {
    backgroundColor: c.accent,
  },
  icon: {
    fontSize: 24,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '700',
    color: c.textOnAccent,
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
    color: c.accent,
    fontSize: 14,
  },
  meta: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: 2,
  },
});
