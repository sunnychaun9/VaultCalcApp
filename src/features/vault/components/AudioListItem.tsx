/**
 * VaultCalc - Audio List Item Component
 *
 * Row-based list item for the audio tab.
 * Shows music note icon, filename, duration, and size.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { MediaItem } from '@services/storage/database';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';

interface AudioListItemProps {
  item: MediaItem;
  isSelected: boolean;
  onPress: (item: MediaItem) => void;
  onLongPress: (item: MediaItem) => void;
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export const AudioListItem = React.memo(function AudioListItem({
  item,
  isSelected,
  onPress,
  onLongPress,
}: AudioListItemProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      style={({ pressed }) => [
        styles.container,
        isSelected && styles.containerSelected,
        pressed && styles.containerPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={item.originalName}
      accessibilityState={{ selected: isSelected }}
    >
      {/* Icon */}
      <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
        {isSelected ? (
          <Text style={styles.checkmark}>{'\u2713'}</Text>
        ) : (
          <Text style={styles.icon}>{'\u{1F3B5}'}</Text>
        )}
      </View>

      {/* Name + meta */}
      <View style={styles.textContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {item.originalName}
          {item.isFavorite && !isSelected && (
            <Text style={styles.favStar}>{' \u2605'}</Text>
          )}
        </Text>
        <Text style={styles.meta}>
          {formatDuration(item.durationMs)} {'\u00B7'} {formatFileSize(item.sizeBytes)}
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
    fontSize: 22,
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
  name: {
    ...typography.bodyMedium,
    color: c.textPrimary,
  },
  favStar: {
    color: c.accent,
    fontSize: 14,
  },
  meta: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: 2,
  },
});
