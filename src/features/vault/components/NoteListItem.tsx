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
import Animated from 'react-native-reanimated';
import { useListItemAnimation, usePressAnimation } from '@shared/hooks/useAnimations';
import type { Note } from '@services/storage/database';
import { useTranslation } from 'react-i18next';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { Icon } from '@shared/components/Icon';

interface NoteListItemProps {
  note: Note;
  index?: number;
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
  index = 0,
  isSelected,
  onPress,
  onLongPress,
}: NoteListItemProps): React.JSX.Element {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const entryStyle = useListItemAnimation({ index });
  const { animatedStyle: pressStyle, onPressIn, onPressOut } = usePressAnimation({ scaleDown: 0.98, opacityDown: 0.9 });

  const preview = note.isEncrypted
    ? t('vault.note_encrypted_preview')
    : note.content.length > 50
      ? note.content.slice(0, 50) + '...'
      : note.content;

  return (
    <Animated.View style={entryStyle}>
    <Animated.View style={pressStyle}>
    <Pressable
      onPress={() => onPress(note)}
      onLongPress={() => onLongPress(note)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.container, isSelected && styles.containerSelected]}
      accessibilityRole="button"
      accessibilityLabel={note.title}
      accessibilityState={{ selected: isSelected }}
    >
      {/* Icon */}
      <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
        {isSelected ? (
          <Icon name="check" size={18} color={themeColors.textOnAccent} strokeWidth={3} />
        ) : (
          <Icon name={note.isEncrypted ? 'lock' : 'pencil'} size={22} color={themeColors.textTertiary} />
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
    </Animated.View>
    </Animated.View>
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
