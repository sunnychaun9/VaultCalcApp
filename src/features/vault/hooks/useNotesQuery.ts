/**
 * VaultCalc - Notes Query Hook
 *
 * React Query hook for fetching notes by decoy mode.
 *
 * @see FEATURE_INDEX.md NOTES-001
 */

import { useQuery } from '@tanstack/react-query';
import { notes } from '@services/storage/database';
import { useAuthStore } from '@store/authStore';

export function useNotesQuery() {
  const isDecoyMode = useAuthStore(s => s.isDecoyMode);

  return useQuery({
    queryKey: ['notes', isDecoyMode],
    queryFn: () => notes.getAll(isDecoyMode),
  });
}
