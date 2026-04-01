/**
 * VaultCalc - Media Grid Component
 *
 * FlashList-based grid for displaying vault media items.
 * Dynamically calculates cell size from container width.
 * Tight 6dp gaps for a premium gallery aesthetic.
 *
 * @see FEATURE_INDEX.md VAULT-003
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { MediaItem } from '@services/storage/database';
import { layout } from '@shared/theme';
import { MediaGridItem, type ThumbnailOriginRect } from './MediaGridItem';
import { GridSkeleton, useDelayedLoading } from '@shared/components/Skeleton';

interface MediaGridProps {
  items: MediaItem[];
  isLoading: boolean;
  onItemPress: (item: MediaItem, originRect?: ThumbnailOriginRect) => void;
  onItemLongPress: (item: MediaItem) => void;
  numColumns?: number;
}

const GAP = layout.vaultGridGap;

/** Stable separator — avoids new component reference on every render */
function ItemSeparator() {
  return <View style={separatorStyle} />;
}
const separatorStyle = { height: GAP };

export function MediaGrid({
  items,
  isLoading,
  onItemPress,
  onItemLongPress,
  numColumns = layout.vaultGridColumns,
}: MediaGridProps): React.JSX.Element {
  const showSkeleton = useDelayedLoading(isLoading && items.length === 0);
  const [containerWidth, setContainerWidth] = useState(0);

  const itemSize = useMemo(() => {
    if (containerWidth === 0) return 0;
    // Edge padding (GAP on each side) + inter-column gaps
    return (containerWidth - GAP * 2 - (numColumns - 1) * GAP) / numColumns;
  }, [containerWidth, numColumns]);

  const handleLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  // Selection state is read inside MediaGridItem via useVaultStore,
  // so renderItem stays stable across selection changes — no cell recycling.
  const renderItem = useCallback(({ item }: { item: MediaItem }) => (
    <MediaGridItem
      item={item}
      size={itemSize}
      onPress={onItemPress}
      onLongPress={onItemLongPress}
    />
  ), [itemSize, onItemPress, onItemLongPress]);

  const keyExtractor = useCallback((item: MediaItem) => item.id, []);

  // Provide overrideItemLayout to give FlashList deterministic item sizes,
  // reducing unnecessary cell recycling when data updates (e.g. favorite toggle).
  const overrideItemLayout = useCallback(
    (l: { span?: number; size?: number }, _item: MediaItem) => {
      if (itemSize > 0) {
        l.size = itemSize + GAP; // item height + separator
      }
    },
    [itemSize],
  );

  if (showSkeleton) {
    return <GridSkeleton columns={numColumns} />;
  }

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {containerWidth > 0 && itemSize > 0 && (
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={numColumns}
          overrideItemLayout={overrideItemLayout}
          contentContainerStyle={{ padding: GAP }}
          ItemSeparatorComponent={ItemSeparator}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
