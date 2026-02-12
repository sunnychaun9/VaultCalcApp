/**
 * VaultCalc - Vault UI Store
 *
 * Manages vault interface state including:
 * - Selection state
 * - View mode (grid/list)
 * - Sort preferences
 *
 * @see 04-Technical-Architecture.md Section 4.2
 */

import { create } from 'zustand';

/**
 * Supported sort fields
 */
type SortField = 'date' | 'name' | 'size';

/**
 * Sort order
 */
type SortOrder = 'asc' | 'desc';

/**
 * View mode
 */
type ViewMode = 'grid' | 'list';

/**
 * Vault UI state interface
 */
interface VaultState {
  /** Currently selected item IDs */
  selectedIds: Set<string>;

  /** Whether selection mode is active */
  isSelectionMode: boolean;

  /** Current view mode */
  viewMode: ViewMode;

  /** Current sort field */
  sortBy: SortField;

  /** Current sort order */
  sortOrder: SortOrder;
}

/**
 * Vault UI actions interface
 */
interface VaultActions {
  /** Toggle selection of an item */
  toggleSelection: (id: string) => void;

  /** Select all items from provided IDs */
  selectAll: (ids: string[]) => void;

  /** Clear all selections */
  clearSelection: () => void;

  /** Set view mode */
  setViewMode: (mode: ViewMode) => void;

  /** Set sort field */
  setSortBy: (field: SortField) => void;

  /** Toggle sort order */
  toggleSortOrder: () => void;

  /** Reset vault UI state */
  reset: () => void;
}

/**
 * Initial vault state
 */
const initialState: VaultState = {
  selectedIds: new Set(),
  isSelectionMode: false,
  viewMode: 'grid',
  sortBy: 'date',
  sortOrder: 'desc',
};

/**
 * Vault UI store
 *
 * Note: This store is NOT persisted. UI state resets
 * when returning to calculator for security.
 *
 * Used by VAULT-003, FILE-007 and related features.
 */
export const useVaultStore = create<VaultState & VaultActions>()((set) => ({
  ...initialState,

  toggleSelection: (id) => {
    set((state) => {
      const newSelected = new Set(state.selectedIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return {
        selectedIds: newSelected,
        isSelectionMode: newSelected.size > 0,
      };
    });
  },

  selectAll: (ids) => {
    set({
      selectedIds: new Set(ids),
      isSelectionMode: ids.length > 0,
    });
  },

  clearSelection: () => {
    set({
      selectedIds: new Set(),
      isSelectionMode: false,
    });
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
  },

  setSortBy: (field) => {
    set({ sortBy: field });
  },

  toggleSortOrder: () => {
    set((state) => ({
      sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  },

  reset: () => {
    set(initialState);
  },
}));
