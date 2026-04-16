/**
 * VaultCalc - Gallery Media Select Screen
 *
 * Grid of photos/videos within an album for multi-select import.
 * After selection, imports into the vault and optionally deletes originals.
 *
 * @see FEATURE_INDEX.md GALLERY-001
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VaultStackParamList } from '@typedefs/navigation';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { Icon } from '@shared/components/Icon';
import { useOrientation } from '@shared/hooks';
import { useAuthStore } from '@store/authStore';
import { useSettingsStore } from '@store/settingsStore';
import {
  getMediaInAlbum,
  deleteOriginals,
  type GalleryMediaItem,
} from '@services/gallery';
import { importFiles, type ImportProgress } from '@services/import';
import type { PickedFile } from '@services/filePicker';
import { ImportProgressOverlay } from '../components';
import { alert } from '@store/alertStore';
import { useTranslation } from 'react-i18next';

type NavigationProp = NativeStackNavigationProp<VaultStackParamList, 'GalleryMediaSelect'>;
type ScreenRoute = RouteProp<VaultStackParamList, 'GalleryMediaSelect'>;

const GAP = layout.vaultGridGap;

/** Format milliseconds to mm:ss */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function GalleryMediaSelectScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation<NavigationProp>();
  const { isLandscape } = useOrientation();
  const numColumns = isLandscape ? 5 : layout.vaultGridColumns;
  const route = useRoute<ScreenRoute>();
  const queryClient = useQueryClient();
  const { bucketId, bucketName, mediaType } = route.params;

  const isDecoyMode = useAuthStore(s => s.isDecoyMode);
  const deleteOriginalsAfterImport = useSettingsStore(s => s.deleteOriginalsAfterImport);

  const [items, setItems] = useState<GalleryMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  // Container width for computing cell size
  const [containerWidth, setContainerWidth] = useState(0);
  const itemSize = useMemo(() => {
    if (containerWidth === 0) return 0;
    return (containerWidth - GAP * 2 - (numColumns - 1) * GAP) / numColumns;
  }, [containerWidth, numColumns]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const data = await getMediaInAlbum(bucketId, mediaType);
        if (!cancelled) setItems(data);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bucketId, mediaType]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleImport = useCallback(async () => {
    const selected = items.filter(item => selectedIds.has(item.id));
    if (selected.length === 0) return;

    const dbMediaType = mediaType === 'video' ? 'video' : 'photo';

    // Convert to PickedFile format for importFiles
    const pickedFiles: PickedFile[] = selected.map(item => ({
      uri: item.uri,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
    }));

    setIsImporting(true);
    setImportProgress({ current: 0, total: pickedFiles.length, currentFileName: pickedFiles[0].name });

    try {
      // Import without per-file deletion — we handle deletion separately as a batch
      const result = await importFiles(pickedFiles, dbMediaType, {
        deleteOriginals: false,
        onProgress: setImportProgress,
        isDecoy: isDecoyMode,
      });

      // Invalidate vault queries so new items appear
      await queryClient.invalidateQueries({ queryKey: ['media', dbMediaType, isDecoyMode] });

      // Batch delete originals if setting is enabled and import succeeded
      let deletedOriginals = false;
      if (deleteOriginalsAfterImport && result.imported > 0) {
        const importedUris = selected
          .filter(item => !result.failed.some(f => f.name === item.name))
          .map(item => item.uri);

        if (importedUris.length > 0) {
          try {
            deletedOriginals = await deleteOriginals(importedUris);
          } catch {
            // Delete failed — not critical, user can delete manually
          }
        }
      }

      // Show result
      if (result.failed.length === 0) {
        let msg = t(result.imported === 1 ? 'vault.import_gallery_success_one' : 'vault.import_gallery_success_other', { count: result.imported });
        if (deletedOriginals) {
          msg += `\n${t('vault.import_gallery_originals_removed')}`;
        }
        alert(t('vault.import_gallery_success_title'), msg);
      } else if (result.imported > 0) {
        alert(
          t('vault.import_gallery_partial_title'),
          t('vault.import_gallery_partial_body', { imported: result.imported, failed: result.failed.length }),
        );
      } else {
        alert(
          t('vault.import_gallery_error_title'),
          t('vault.import_gallery_error_body'),
        );
      }

      // Navigate back to vault
      navigation.popTo('VaultHome');
    } catch (e) {
      alert(t('common.error'), e instanceof Error ? e.message : t('common.error_generic'));
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  }, [items, selectedIds, mediaType, isDecoyMode, deleteOriginalsAfterImport, queryClient, navigation]);

  const handleLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  const renderItem = useCallback(({ item }: { item: GalleryMediaItem }) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <Pressable
        onPress={() => toggleSelection(item.id)}
        style={[styles.gridCell, { width: itemSize, height: itemSize }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={item.name}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        {/* Selection overlay */}
        {isSelected && <View style={styles.selectionOverlay} />}
        {/* Checkbox */}
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} />}
        </View>
        {/* Duration badge for videos */}
        {item.durationMs != null && item.durationMs > 0 && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(item.durationMs)}</Text>
          </View>
        )}
      </Pressable>
    );
  }, [selectedIds, toggleSelection, itemSize, styles]);

  const keyExtractor = useCallback((item: GalleryMediaItem) => item.id, []);

  const selectedCount = selectedIds.size;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={24} color={themeColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{bucketName}</Text>
        <Pressable
          onPress={handleImport}
          disabled={selectedCount === 0 || isImporting}
          style={({ pressed }) => [
            styles.importButton,
            selectedCount === 0 && styles.importButtonDisabled,
            pressed && selectedCount > 0 && styles.importButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Import ${selectedCount} items`}
        >
          <Text style={[
            styles.importButtonText,
            selectedCount === 0 && styles.importButtonTextDisabled,
          ]}>
            {selectedCount > 0 ? t('gallery_import.import_count', { count: selectedCount }) : t('gallery_import.import_button')}
          </Text>
        </Pressable>
      </View>

      {/* Loading */}
      {isLoading && (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={themeColors.accent} />
        </View>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <View style={styles.centerContent}>
          <Text style={styles.emptyTitle}>{t('gallery_import.no_items_title')}</Text>
          <Text style={styles.emptySubtitle}>{t('gallery_import.album_empty')}</Text>
        </View>
      )}

      {/* Grid */}
      {!isLoading && items.length > 0 && (
        <View style={styles.gridContainer} onLayout={handleLayout}>
          {containerWidth > 0 && (
            <FlashList
              data={items}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              numColumns={numColumns}
              ItemSeparatorComponent={ItemSeparator}
              contentContainerStyle={styles.gridContent}
              extraData={selectedIds}
            />
          )}
        </View>
      )}

      {/* Import progress overlay */}
      {isImporting && importProgress && (
        <ImportProgressOverlay progress={importProgress} />
      )}
    </SafeAreaView>
  );
}

/** Stable separator */
function ItemSeparator() {
  return <View style={separatorStyle} />;
}
const separatorStyle = { height: GAP };

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: layout.topBarHeight,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerTitle: {
    ...typography.titleLarge,
    color: c.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  headerButtonPressed: {
    backgroundColor: c.overlay,
  },
  headerButtonText: {
    fontSize: 24,
    color: c.textPrimary,
  },
  importButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: layout.buttonBorderRadius,
    backgroundColor: c.accent,
  },
  importButtonPressed: {
    opacity: 0.8,
  },
  importButtonDisabled: {
    backgroundColor: c.surfaceContainerHigh,
  },
  importButtonText: {
    ...typography.labelLarge,
    color: c.textOnAccent,
  },
  importButtonTextDisabled: {
    color: c.textTertiary,
  },
  gridContainer: {
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: GAP,
    paddingVertical: GAP,
  },
  gridCell: {
    marginRight: GAP,
    borderRadius: 4,
    overflow: 'hidden',
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.surfaceContainerHigh,
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  checkbox: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.titleMedium,
    color: c.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.bodyMedium,
    color: c.textSecondary,
    textAlign: 'center',
  },
});
