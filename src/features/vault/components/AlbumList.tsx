/**
 * VaultCalc - Album List Component
 *
 * FlashList-based list view for displaying albums.
 * Uses single-column rows following DocumentList pattern.
 *
 * @see FEATURE_INDEX.md ALBUM-001
 */

import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { Album, CoverMediaInfo } from '@services/storage/database';
import { AlbumListItem } from './AlbumListItem';

interface AlbumListProps {
  albums: Album[];
  isLoading: boolean;
  mediaCounts?: Record<string, number>;
  coverMediaMap?: Record<string, CoverMediaInfo>;
  onAlbumPress: (album: Album) => void;
  onAlbumLongPress: (album: Album) => void;
}

export function AlbumList({
  albums: albumsData,
  isLoading: _isLoading,
  mediaCounts,
  coverMediaMap,
  onAlbumPress,
  onAlbumLongPress,
}: AlbumListProps): React.JSX.Element {
  const renderItem = useCallback(({ item }: { item: Album }) => (
    <AlbumListItem
      album={item}
      mediaCount={mediaCounts?.[item.id]}
      coverMedia={coverMediaMap?.[item.id]}
      onPress={onAlbumPress}
      onLongPress={onAlbumLongPress}
    />
  ), [mediaCounts, coverMediaMap, onAlbumPress, onAlbumLongPress]);

  const keyExtractor = useCallback((item: Album) => item.id, []);

  return (
    <View style={styles.container}>
      <FlashList
        data={albumsData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
