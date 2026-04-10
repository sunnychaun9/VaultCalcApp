/**
 * VaultCalc - Vault Data Prefetch
 *
 * Warms the React Query cache with vault data during the
 * navigation transition so the VaultHomeScreen renders
 * instantly with data already available.
 *
 * Called from usePinAuth immediately after successful
 * authentication, BEFORE navigation.navigate('Vault').
 * The queries run concurrently with the fade transition (~150ms),
 * so by the time VaultHomeScreen mounts, the cache is hot.
 */

import { QueryClient } from '@tanstack/react-query';
import { mediaItems, albums, notes } from '@services/storage/database';

// Lazily resolved — avoids circular import with React Query provider
let _queryClient: QueryClient | null = null;

function getQueryClient(): QueryClient {
  if (!_queryClient) {
    // Access the singleton from the module that creates it
    try {
      _queryClient = require('@app/queryClient').queryClient;
    } catch {
      // Fallback: create a throwaway client (cache won't be shared)
      _queryClient = new QueryClient();
    }
  }
  return _queryClient!;
}

/**
 * Prefetch the three primary queries that VaultHomeScreen fires on mount.
 * Runs all three in parallel. Failures are silently ignored — the screen
 * will re-fetch on mount via its own useQuery hooks.
 */
export function prefetchVaultData(isDecoyMode: boolean): void {
  const qc = getQueryClient();

  // Prefetch first page of images — matches useInfiniteQuery in useMediaQuery
  qc.prefetchInfiniteQuery({
    queryKey: ['media', 'photo', isDecoyMode],
    queryFn: () => mediaItems.getByTypePaginated('photo', isDecoyMode, 100, 0),
    initialPageParam: 0,
    staleTime: 5000,
  });

  qc.prefetchQuery({
    queryKey: ['albums', isDecoyMode],
    queryFn: () => albums.getAll(isDecoyMode),
    staleTime: 5000,
  });

  qc.prefetchQuery({
    queryKey: ['notes', isDecoyMode],
    queryFn: () => notes.getAll(isDecoyMode),
    staleTime: 5000,
  });
}
