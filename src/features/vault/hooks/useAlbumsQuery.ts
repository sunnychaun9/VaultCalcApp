/**
 * VaultCalc - Albums Query Hook
 *
 * React Query hook for fetching albums by decoy mode.
 *
 * @see FEATURE_INDEX.md ALBUM-001
 */

import { useQuery } from '@tanstack/react-query';
import { albums } from '@services/storage/database';
import { useAuthStore } from '@store/authStore';

export function useAlbumsQuery() {
  const isDecoyMode = useAuthStore(s => s.isDecoyMode);

  return useQuery({
    queryKey: ['albums', isDecoyMode],
    queryFn: () => albums.getAll(isDecoyMode),
  });
}
