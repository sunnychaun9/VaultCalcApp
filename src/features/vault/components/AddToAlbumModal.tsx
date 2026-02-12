/**
 * VaultCalc - Add to Album Modal
 *
 * Modal allowing users to pick an existing album or create a new one
 * for adding selected media items.
 *
 * @see FEATURE_INDEX.md ALBUM-003
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import type { Album } from '@services/storage/database';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';

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
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const renderAlbumItem = ({ item }: { item: Album }) => (
    <Pressable
      style={({ pressed }) => [styles.albumRow, pressed && styles.albumRowPressed]}
      onPress={() => onSelectAlbum(item)}
      disabled={isAdding}
      accessibilityRole="button"
      accessibilityLabel={`Add to ${item.name}`}
    >
      <Text style={styles.albumIcon}>{'\u{1F4C1}'}</Text>
      <Text style={styles.albumName} numberOfLines={1}>{item.name}</Text>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={isAdding ? undefined : onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Add to Album</Text>

          {isAdding ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={themeColors.accent} />
              <Text style={styles.loadingText}>Adding...</Text>
            </View>
          ) : (
            <>
              {/* New Album row */}
              <Pressable
                style={({ pressed }) => [styles.newAlbumRow, pressed && styles.albumRowPressed]}
                onPress={onCreateNewAlbum}
                accessibilityRole="button"
                accessibilityLabel="Create new album"
              >
                <Text style={styles.newAlbumIcon}>+</Text>
                <Text style={styles.newAlbumText}>New Album</Text>
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

              {/* Cancel */}
              <Pressable style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 340,
  },
  title: {
    ...typography.titleLarge,
    color: c.textPrimary,
    marginBottom: spacing.base,
    textAlign: 'center',
  },
  newAlbumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },
  newAlbumIcon: {
    fontSize: 20,
    color: c.accent,
    fontWeight: '600',
    width: 32,
    textAlign: 'center',
  },
  newAlbumText: {
    ...typography.bodyMedium,
    color: c.accent,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    marginVertical: spacing.sm,
  },
  list: {
    maxHeight: 240,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },
  albumRowPressed: {
    opacity: 0.7,
  },
  albumIcon: {
    fontSize: 20,
    width: 32,
    textAlign: 'center',
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
  cancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  cancelText: {
    ...typography.labelLarge,
    color: c.textSecondary,
  },
});
