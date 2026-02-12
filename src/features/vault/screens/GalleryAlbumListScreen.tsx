/**
 * VaultCalc - Gallery Album List Screen
 *
 * Shows local media albums (buckets) from MediaStore.
 * User taps an album to see its photos/videos for selection.
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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VaultStackParamList } from '@typedefs/navigation';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import {
  getAlbums,
  requestGalleryPermissions,
  hasGalleryPermissions,
  type GalleryAlbum,
} from '@services/gallery';

type NavigationProp = NativeStackNavigationProp<VaultStackParamList, 'GalleryAlbumList'>;
type ScreenRoute = RouteProp<VaultStackParamList, 'GalleryAlbumList'>;

const THUMBNAIL_SIZE = 64;

export function GalleryAlbumListScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRoute>();
  const { mediaType } = route.params;

  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const loadAlbums = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAlbums(mediaType);
      setAlbums(data);
    } catch {
      setAlbums([]);
    } finally {
      setIsLoading(false);
    }
  }, [mediaType]);

  const checkAndLoad = useCallback(async () => {
    const granted = await hasGalleryPermissions(mediaType);
    setHasPermission(granted);
    if (granted) {
      await loadAlbums();
    } else {
      setIsLoading(false);
    }
  }, [mediaType, loadAlbums]);

  useEffect(() => {
    checkAndLoad();
  }, [checkAndLoad]);

  const handleRequestPermission = useCallback(async () => {
    const granted = await requestGalleryPermissions(mediaType);
    setHasPermission(granted);
    if (granted) {
      await loadAlbums();
    }
  }, [mediaType, loadAlbums]);

  const handleAlbumPress = useCallback((album: GalleryAlbum) => {
    navigation.navigate('GalleryMediaSelect', {
      bucketId: album.bucketId,
      bucketName: album.bucketName,
      mediaType,
    });
  }, [navigation, mediaType]);

  const renderAlbumItem = useCallback(({ item }: { item: GalleryAlbum }) => (
    <Pressable
      onPress={() => handleAlbumPress(item)}
      style={({ pressed }) => [styles.albumRow, pressed && styles.albumRowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${item.bucketName}, ${item.itemCount} items`}
    >
      <Image
        source={{ uri: item.coverUri }}
        style={styles.coverThumb}
        resizeMode="cover"
      />
      <View style={styles.albumInfo}>
        <Text style={styles.albumName} numberOfLines={1}>{item.bucketName}</Text>
        <Text style={styles.albumCount}>{item.itemCount}</Text>
      </View>
      <Text style={styles.chevron}>{'\u203A'}</Text>
    </Pressable>
  ), [handleAlbumPress, styles]);

  const keyExtractor = useCallback((item: GalleryAlbum) => item.bucketId, []);

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
          <Text style={styles.headerButtonText}>{'\u2190'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Select Album</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Permission prompt */}
      {hasPermission === false && (
        <View style={styles.centerContent}>
          <Text style={styles.emptyTitle}>Permission Required</Text>
          <Text style={styles.emptySubtitle}>
            Grant access to your {mediaType === 'video' ? 'videos' : 'photos'} to import them into the vault.
          </Text>
          <Pressable
            onPress={handleRequestPermission}
            style={({ pressed }) => [styles.permissionButton, pressed && styles.permissionButtonPressed]}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>
        </View>
      )}

      {/* Loading */}
      {isLoading && (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={themeColors.accent} />
        </View>
      )}

      {/* Empty state */}
      {!isLoading && hasPermission && albums.length === 0 && (
        <View style={styles.centerContent}>
          <Text style={styles.emptyTitle}>No {mediaType === 'video' ? 'Videos' : 'Photos'} Found</Text>
          <Text style={styles.emptySubtitle}>
            There are no local {mediaType === 'video' ? 'videos' : 'photos'} on this device.
          </Text>
        </View>
      )}

      {/* Album list */}
      {!isLoading && hasPermission && albums.length > 0 && (
        <FlashList
          data={albums}
          renderItem={renderAlbumItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

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
  listContent: {
    paddingVertical: spacing.sm,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  albumRowPressed: {
    backgroundColor: c.overlay,
  },
  coverThumb: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    backgroundColor: c.surfaceContainerHigh,
  },
  albumInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  albumName: {
    ...typography.titleMedium,
    color: c.textPrimary,
  },
  albumCount: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: spacing.xxs,
  },
  chevron: {
    fontSize: 28,
    color: c.textTertiary,
    marginLeft: spacing.sm,
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
  permissionButton: {
    marginTop: spacing.lg,
    backgroundColor: c.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: layout.buttonBorderRadius,
  },
  permissionButtonPressed: {
    opacity: 0.8,
  },
  permissionButtonText: {
    ...typography.labelLarge,
    color: c.textOnAccent,
  },
});
