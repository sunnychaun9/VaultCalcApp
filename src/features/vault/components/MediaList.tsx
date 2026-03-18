/**
 * VaultCalc - Media List Component
 *
 * FlashList-based list view for displaying vault media items
 * in file-manager style (rows with thumbnail, name, size, date).
 *
 * @see VAULT-003
 */

import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { MediaItem } from '@services/storage/database';
import { layout } from '@shared/theme';
import { MediaListItem } from './MediaListItem';

interface MediaListProps {
  items: MediaItem[];
  isLoading: boolean;
  onItemPress: (item: MediaItem) => void;
  onItemLongPress: (item: MediaItem) => void;
}

export function MediaList({
  items,
  isLoading: _isLoading,
  onItemPress,
  onItemLongPress,
}: MediaListProps): React.JSX.Element {
  const renderItem = useCallback(({ item }: { item: MediaItem }) => (
    <MediaListItem
      item={item}
      onPress={onItemPress}
      onLongPress={onItemLongPress}
    />
  ), [onItemPress, onItemLongPress]);

  const keyExtractor = useCallback((item: MediaItem) => item.id, []);

  return (
    <View style={styles.container}>
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        overrideItemLayout={(itemLayout: { span?: number; size?: number }) => {
          itemLayout.size = layout.vaultListItemHeight;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
