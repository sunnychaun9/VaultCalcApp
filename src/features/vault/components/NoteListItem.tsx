/**
 * VaultCalc - Note List Item Component
 *
 * Row-based list item for the notes tab.
 * Shows note icon, title, content preview, and date.
 *
 * @see FEATURE_INDEX.md NOTES-001
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Note } from '@services/storage/database';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';

interface NoteListItemProps {
  note: Note;
  isSelected: boolean;
  onPress: (note: Note) => void;
  onLongPress: (note: Note) => void;
}

/** Format timestamp to short date string */
function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

export const NoteListItem = React.memo(function NoteListItem({
  note,
  isSelected,
  onPress,
  onLongPress,
}: NoteListItemProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const preview = note.isEncrypted
    ? '\u{1F512} Encrypted'
    : note.content.length > 50
      ? note.content.slice(0, 50) + '...'
      : note.content;

  return (
    <Pressable
      onPress={() => onPress(note)}
      onLongPress={() => onLongPress(note)}
      style={({ pressed }) => [
        styles.container,
        isSelected && styles.containerSelected,
        pressed && styles.containerPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={note.title}
      accessibilityState={{ selected: isSelected }}
    >
      {/* Icon */}
      <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
        {isSelected ? (
          <Text style={styles.checkmark}>{'\u2713'}</Text>
        ) : (
          <Text style={styles.icon}>{note.isEncrypted ? '\u{1F512}' : '\u{1F4DD}'}</Text>
        )}
      </View>

      {/* Title + preview + date */}
      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {note.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {preview.length > 0 ? `${preview} \u00B7 ` : ''}{formatDate(note.updatedAt)}
        </Text>
      </View>
    </Pressable>
  );
});

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.vaultListItemHeight,
    paddingHorizontal: spacing.md,
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  containerSelected: {
    backgroundColor: c.surfaceContainerHigh,
  },
  containerPressed: {
    opacity: 0.7,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: c.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconBoxSelected: {
    backgroundColor: c.accent,
  },
  icon: {
    fontSize: 24,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '700',
    color: c.textOnAccent,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...typography.bodyMedium,
    color: c.textPrimary,
  },
  meta: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: 2,
  },
});
