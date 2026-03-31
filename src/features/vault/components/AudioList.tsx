/**
 * VaultCalc - Audio List Component
 *
 * FlashList-based list view for displaying vault audio files.
 */

import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { MediaItem } from '@services/storage/database';
import { useVaultStore } from '@store/vaultStore';
import { AudioListItem } from './AudioListItem';
import { ListSkeleton, useDelayedLoading } from '@shared/components/Skeleton';

interface AudioListProps {
  items: MediaItem[];
  isLoading: boolean;
  onItemPress: (item: MediaItem) => void;
  onItemLongPress: (item: MediaItem) => void;
}

export function AudioList({
  items,
  isLoading,
  onItemPress,
  onItemLongPress,
}: AudioListProps): React.JSX.Element {
  const showSkeleton = useDelayedLoading(isLoading && items.length === 0);
  if (showSkeleton) return <ListSkeleton />;
  const selectedIds = useVaultStore(s => s.selectedIds);

  const renderItem = useCallback(({ item, index }: { item: MediaItem; index: number }) => (
    <AudioListItem
      item={item}
      index={index}
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
