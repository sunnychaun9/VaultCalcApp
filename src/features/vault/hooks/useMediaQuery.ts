/**
 * VaultCalc - Media Query Hook
 *
 * React Query hook for fetching media items by tab type.
 * Maps UI tab types to database MediaType and sorts results
 * client-side using vault store preferences.
 *
 * @see FEATURE_INDEX.md VAULT-003
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mediaItems, type MediaType } from '@services/storage/database';
import { useVaultStore } from '@store/vaultStore';
import { useAuthStore } from '@store/authStore';

/** UI tab types */
export type TabType = 'images' | 'videos' | 'documents' | 'albums' | 'notes';

/** Map UI tab type → database MediaType (null = unsupported) */
const TAB_TO_MEDIA_TYPE: Record<TabType, MediaType | null> = {
  images: 'photo',
  videos: 'video',
  documents: 'document',
  albums: null,
  notes: null,
};

/**
 * Fetch and sort media items for a given tab.
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

  const query = useQuery({
    queryKey: ['media', mediaType, isDecoyMode],
    queryFn: () => mediaItems.getByType(mediaType!, isDecoyMode),
    enabled: mediaType !== null,
  });

  const sortedData = useMemo(() => {
    let items = query.data ?? [];
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

  return {
    data: sortedData,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
