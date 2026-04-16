/**
 * VaultCalc - Album List Item Component
 *
 * Row-based list item for the albums tab.
 * Shows folder icon, album name, and creation date.
 *
 * @see FEATURE_INDEX.md ALBUM-001
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import type { Album, CoverMediaInfo } from '@services/storage/database';
import { useTranslation } from 'react-i18next';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { useDecryptedThumbnail } from '../hooks';
import { Icon } from '@shared/components/Icon';
import { useListItemAnimation, usePressAnimation } from '@shared/hooks/useAnimations';

interface AlbumListItemProps {
  album: Album;
  mediaCount?: number;
  coverMedia?: CoverMediaInfo;
  onPress: (album: Album) => void;
  onLongPress: (album: Album) => void;
  /** List index for staggered entry animation */
  index?: number;
}

/** Format timestamp to short date string */
function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

export const AlbumListItem = React.memo(function AlbumListItem({
  album,
  mediaCount,
  coverMedia,
  onPress,
  onLongPress,
  index = 0,
}: AlbumListItemProps): React.JSX.Element {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const { uri: coverUri } = useDecryptedThumbnail(
    coverMedia?.thumbnailPath ?? null,
    coverMedia?.id ?? '',
    coverMedia?.keyId ?? '',
  );

  const count = mediaCount ?? 0;
  const countLabel = t('vault.items_count', { count });

  const entryStyle = useListItemAnimation({ index });
  const { animatedStyle: pressStyle, onPressIn, onPressOut } = usePressAnimation({ scaleDown: 0.98, opacityDown: 0.9 });

  return (
    <Animated.View style={entryStyle}>
    <Animated.View style={pressStyle}>
    <Pressable
      onPress={() => onPress(album)}
      onLongPress={() => onLongPress(album)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={album.name}
    >
      {/* Album Cover or Folder Icon */}
      <View style={styles.iconBox}>
        {coverUri !== null ? (
          <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <Icon name="folder" size={24} color={themeColors.vaultFolderIcon} />
        )}
      </View>

      {/* Name + meta */}
      <View style={styles.textContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {album.name}
        </Text>
        <Text style={styles.meta}>
          {countLabel} {'\u00B7'} {formatDate(album.createdAt)}
        </Text>
      </View>

      {/* Chevron */}
      <Icon name="chevron-right" size={20} color={themeColors.textSecondary} />
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
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: c.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  icon: {
    fontSize: 24,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    ...typography.bodyMedium,
    color: c.textPrimary,
  },
  meta: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: c.textSecondary,
    marginLeft: spacing.sm,
  },
});
