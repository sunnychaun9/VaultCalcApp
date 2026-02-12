/**
 * VaultCalc - React Query Client Configuration
 *
 * Configures the QueryClient for async state management.
 * Used for media queries, file operations, and other async data.
 *
 * @see 04-Technical-Architecture.md Section 4.3
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Default query client configuration
 *
 * Settings optimized for:
 * - Local-first data (no network requests in MVP)
 * - Quick stale times for encrypted content
 * - Minimal retries (data is local)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 seconds
      staleTime: 30 * 1000,

      // Cache data for 5 minutes
      gcTime: 5 * 60 * 1000,

      // Don't retry local operations
      retry: false,

      // Don't refetch on window focus (not relevant for mobile)
      refetchOnWindowFocus: false,

      // Don't refetch on reconnect (local data)
      refetchOnReconnect: false,
    },
    mutations: {
      // Don't retry failed mutations
      retry: false,
    },
  },
});
