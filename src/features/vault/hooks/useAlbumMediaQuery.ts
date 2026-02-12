/**
 * VaultCalc - Album Media Query Hook
 *
 * React Query hook for fetching media items within an album.
 *
 * @see FEATURE_INDEX.md ALBUM-002
 */

import { useQuery } from '@tanstack/react-query';
import { albumMedia } from '@services/storage/database';

export function useAlbumMediaQuery(albumId: string) {
  return useQuery({
    queryKey: ['albumMedia', albumId],
    queryFn: () => albumMedia.getMediaItems(albumId),
  });
}
