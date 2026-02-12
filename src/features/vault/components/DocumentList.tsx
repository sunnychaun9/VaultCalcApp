/**
 * VaultCalc - Document List Component
 *
 * FlashList-based list view for displaying vault documents.
 * Uses single-column rows instead of the grid used for photos/videos.
 *
 * @see FEATURE_INDEX.md DOC-002
 */

import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { MediaItem } from '@services/storage/database';
import { useVaultStore } from '@store/vaultStore';
import { DocumentListItem } from './DocumentListItem';

interface DocumentListProps {
  items: MediaItem[];
  isLoading: boolean;
  onItemPress: (item: MediaItem) => void;
  onItemLongPress: (item: MediaItem) => void;
}

export function DocumentList({
  items,
  isLoading: _isLoading,
  onItemPress,
  onItemLongPress,
}: DocumentListProps): React.JSX.Element {
  const selectedIds = useVaultStore(s => s.selectedIds);

  const renderItem = useCallback(({ item }: { item: MediaItem }) => (
    <DocumentListItem
      item={item}
      isSelected={selectedIds.has(item.id)}
      onPress={onItemPress}
      onLongPress={onItemLongPress}
    />
  ), [selectedIds, onItemPress, onItemLongPress]);

  const keyExtractor = useCallback((item: MediaItem) => item.id, []);

  return (
    <View style={styles.container}>
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={selectedIds}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
