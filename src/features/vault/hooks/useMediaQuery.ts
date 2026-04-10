/**
 * VaultCalc - Media Query Hook
 *
 * React Query hook for fetching media items by tab type.
 * Uses useInfiniteQuery for paginated loading — fetches PAGE_SIZE
 * items at a time and appends more as the user scrolls.
 *
 * @see FEATURE_INDEX.md VAULT-003
 */

import { useMemo, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { mediaItems, type MediaType } from '@services/storage/database';
import { useVaultStore } from '@store/vaultStore';
import { useAuthStore } from '@store/authStore';

/** UI tab types */
export type TabType = 'images' | 'videos' | 'documents' | 'audio' | 'albums' | 'notes';

/** Map UI tab type → database MediaType (null = unsupported) */
const TAB_TO_MEDIA_TYPE: Record<TabType, MediaType | null> = {
  images: 'photo',
  videos: 'video',
  documents: 'document',
  audio: 'audio',
  albums: null,
  notes: null,
};

const PAGE_SIZE = 100;

/**
 * Fetch and sort media items for a given tab with infinite scroll.
 *
 * - Audio tab returns empty array (no DB MediaType yet)
 * - Sorting applied client-side from vaultStore preferences
 * - Optional favorites filter applied client-side before sorting
 */
export function useMediaQuery(tab: TabType, showFavoritesOnly = false) {
  const sortBy = useVaultStore(s => s.sortBy);
  const sortOrder = useVaultStore(s => s.sortOrder);
  const isDecoyMode = useAuthStore(s => s.isDecoyMode);
  const mediaType = TAB_TO_MEDIA_TYPE[tab];

  const query = useInfiniteQuery({
    queryKey: ['media', mediaType, isDecoyMode],
    queryFn: ({ pageParam = 0 }) =>
      mediaItems.getByTypePaginated(mediaType!, isDecoyMode, PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // If the last page returned fewer than PAGE_SIZE, we've reached the end
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.reduce((total, page) => total + page.length, 0);
    },
    enabled: mediaType !== null,
  });

  // Flatten all pages into a single sorted array
  const sortedData = useMemo(() => {
    const pages = query.data?.pages;
    if (!pages || pages.length === 0) return [];

    let items: typeof pages[0] = pages.flat();

    if (items.length === 0) return items;

    if (showFavoritesOnly) {
      items = items.filter(i => i.isFavorite);
      if (items.length === 0) return items;
    }

    return [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'date':
          cmp = a.createdAt - b.createdAt;
          break;
        case 'name':
          cmp = a.originalName.localeCompare(b.originalName);
          break;
        case 'size':
          cmp = a.sizeBytes - b.sizeBytes;
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [query.data, sortBy, sortOrder, showFavoritesOnly]);

  const fetchNextPage = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [query]);

  return {
    data: sortedData,
    isLoading: query.isLoading,
    refetch: query.refetch,
    fetchNextPage,
    hasNextPage: query.hasNextPage ?? false,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
