/**
 * VaultCalc - Note List Component
 *
 * FlashList-based list view for displaying vault notes.
 * Includes a search bar that filters notes by title (NOTES-004).
 *
 * @see FEATURE_INDEX.md NOTES-001, NOTES-004
 */

import React, { useCallback, useState, useMemo } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { Note } from '@services/storage/database';
import { useVaultStore } from '@store/vaultStore';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { NoteListItem } from './NoteListItem';
import { ListSkeleton, useDelayedLoading } from '@shared/components/Skeleton';

interface NoteListProps {
  notes: Note[];
  isLoading: boolean;
  onNotePress: (note: Note) => void;
  onNoteLongPress: (note: Note) => void;
}

export function NoteList({
  notes: noteItems,
  isLoading,
  onNotePress,
  onNoteLongPress,
}: NoteListProps): React.JSX.Element {
  const showSkeleton = useDelayedLoading(isLoading && noteItems.length === 0);
  if (showSkeleton) return <ListSkeleton count={6} />;
  const selectedIds = useVaultStore(s => s.selectedIds);
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  // Search state (NOTES-004)
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length === 0) return noteItems;
    return noteItems.filter(note => note.title.toLowerCase().includes(q));
  }, [noteItems, searchQuery]);

  const renderItem = useCallback(({ item, index }: { item: Note; index: number }) => (
    <NoteListItem
      note={item}
      index={index}
      isSelected={selectedIds.has(item.id)}
      onPress={onNotePress}
      onLongPress={onNoteLongPress}
    />
  ), [selectedIds, onNotePress, onNoteLongPress]);

  const keyExtractor = useCallback((item: Note) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Search bar (NOTES-004) */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search notes by title..."
          placeholderTextColor={themeColors.textSecondary}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <FlashList
        data={filteredNotes}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        overrideItemLayout={(itemLayout: { span?: number; size?: number }) => {
          itemLayout.size = layout.vaultListItemHeight;
        }}
      />
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  searchInput: {
    ...typography.bodyMedium,
    color: c.textPrimary,
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
