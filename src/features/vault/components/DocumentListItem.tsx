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
import Animated from 'react-native-reanimated';
import { useListItemAnimation, usePressAnimation } from '@shared/hooks/useAnimations';
import type { MediaItem } from '@services/storage/database';
import { useDecryptedThumbnail } from '../hooks';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { Icon, type IconName } from '@shared/components/Icon';

interface DocumentListItemProps {
  item: MediaItem;
  index?: number;
  isSelected: boolean;
  onPress: (item: MediaItem) => void;
  onLongPress: (item: MediaItem) => void;
}

/** Map MIME type to document-specific icon */
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
  index = 0,
  isSelected,
  onPress,
  onLongPress,
}: DocumentListItemProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const entryStyle = useListItemAnimation({ index });
  const { animatedStyle: pressStyle, onPressIn, onPressOut } = usePressAnimation({ scaleDown: 0.98, opacityDown: 0.9 });
  const { uri: thumbnailUri } = useDecryptedThumbnail(
    item.thumbnailPath,
    item.id,
    item.keyId,
  );

  return (
    <Animated.View style={entryStyle}>
    <Animated.View style={pressStyle}>
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.container, isSelected && styles.containerSelected]}
      accessibilityRole="button"
      accessibilityLabel={item.originalName}
      accessibilityState={{ selected: isSelected }}
    >
      {/* Thumbnail or Icon (DOC-004) */}
      <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
        {isSelected ? (
          <Icon name="check" size={18} color={themeColors.textOnAccent} strokeWidth={3} />
        ) : thumbnailUri !== null ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <Icon name={getDocumentIcon(item.mimeType)} size={24} color={themeColors.textTertiary} />
        )}
      </View>

      {/* Name + meta */}
      <View style={styles.textContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {item.originalName}
          {item.isFavorite && !isSelected && (
            <Text style={styles.favStar}>{' '}<Icon name="star" size={14} color={themeColors.accent} fill={themeColors.accent} /></Text>
          )}
        </Text>
        <Text style={styles.meta}>
          {formatFileSize(item.sizeBytes)} {'\u00B7'} {formatDate(item.createdAt)}
        </Text>
      </View>
    </Pressable>
    </Animated.View>
    </Animated.View>
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
