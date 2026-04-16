/**
 * VaultCalc - Add to Album Bottom Sheet
 *
 * Bottom sheet allowing users to pick an existing album or create a new one
 * for adding selected media items.
 *
 * @see FEATURE_INDEX.md ALBUM-003
 */

import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import type BottomSheetType from '@gorhom/bottom-sheet';
import type { Album } from '@services/storage/database';
import { useTranslation } from 'react-i18next';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { AppBottomSheet } from '@shared/components/AppBottomSheet';
import { Icon } from '@shared/components/Icon';

interface AddToAlbumModalProps {
  visible: boolean;
  albums: Album[];
  isAdding: boolean;
  onSelectAlbum: (album: Album) => void;
  onCreateNewAlbum: () => void;
  onClose: () => void;
}

export function AddToAlbumModal({
  visible,
  albums,
  isAdding,
  onSelectAlbum,
  onCreateNewAlbum,
  onClose,
}: AddToAlbumModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const sheetRef = useRef<BottomSheetType>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const renderAlbumItem = ({ item }: { item: Album }) => (
    <Pressable
      style={({ pressed }) => [styles.albumRow, pressed && styles.albumRowPressed]}
      onPress={() => onSelectAlbum(item)}
      disabled={isAdding}
      accessibilityRole="button"
      accessibilityLabel={`Add to ${item.name}`}
    >
      <Icon name="folder" size={20} color={themeColors.vaultFolderIcon} />
      <Text style={styles.albumName} numberOfLines={1}>{item.name}</Text>
    </Pressable>
  );

  // Dynamic snap: compact (header + 3 albums) → expanded (all albums)
  const compactHeight = Math.min(180 + Math.min(albums.length, 3) * 52, 340);
  const expandedHeight = albums.length > 3 ? '70%' : compactHeight;
  const snapPointsMemo = useMemo(
    () => albums.length > 3 ? [compactHeight, expandedHeight] : [compactHeight],
    [compactHeight, expandedHeight, albums.length],
  );

  return (
    <AppBottomSheet
      ref={sheetRef}
      snapPoints={snapPointsMemo}
      title={t('vault.add_to_album')}
      onDismiss={onClose}
      backdropDismiss={!isAdding}
    >
      {isAdding ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={themeColors.accent} />
          <Text style={styles.loadingText}>{t('vault.adding_to_album')}</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* New Album row */}
          <Pressable
            style={({ pressed }) => [styles.newAlbumRow, pressed && styles.albumRowPressed]}
            onPress={onCreateNewAlbum}
            accessibilityRole="button"
            accessibilityLabel="Create new album"
          >
            <View style={styles.newAlbumIcon}>
              <Text style={styles.newAlbumPlus}>+</Text>
            </View>
            <Text style={styles.newAlbumText}>{t('vault.new_album')}</Text>
          </Pressable>

          {/* Divider (only if albums exist) */}
          {albums.length > 0 && <View style={styles.divider} />}

          {/* Album list */}
          {albums.length > 0 && (
            <FlatList
              data={albums}
              keyExtractor={item => item.id}
              renderItem={renderAlbumItem}
              style={styles.list}
            />
          )}
        </View>
      )}
    </AppBottomSheet>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.sm,
  },
  newAlbumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
  },
  newAlbumIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  newAlbumPlus: {
    fontSize: 18,
    color: c.textOnAccent,
    fontWeight: '600',
    lineHeight: 20,
  },
  newAlbumText: {
    ...typography.bodyMedium,
    color: c.accent,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.md,
  },
  list: {
    maxHeight: 260,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    gap: spacing.md,
  },
  albumRowPressed: {
    backgroundColor: c.surfaceContainerHigh,
  },
  albumName: {
    ...typography.bodyMedium,
    color: c.textPrimary,
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.bodyMedium,
    color: c.textSecondary,
  },
});
