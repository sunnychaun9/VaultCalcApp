/**
 * VaultCalc - Vault Feature Module
 *
 * Public exports for the vault feature.
 */

// Screens
export { VaultHomeScreen, AlbumViewScreen, NoteEditorScreen } from './screens';

// Components
export { VaultHeader, EmptyState, FloatingAddButton, MediaGrid, MediaGridItem, AlbumList, AlbumListItem, NoteList, NoteListItem } from './components';

// Hooks
export { useMediaQuery, useAlbumsQuery, useAlbumMediaQuery, useNotesQuery, type TabType } from './hooks';
