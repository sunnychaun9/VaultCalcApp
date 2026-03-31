/**
 * VaultCalc - Premium Empty State Component
 *
 * Shown when vault tabs have no content. Features:
 * - Custom SVG illustrations (themed, not emoji)
 * - Animated entry (fade-up with spring)
 * - Title + subtitle + optional CTA button
 *
 * @see FEATURE_INDEX.md VAULT-007
 */

import React, { useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import {
  ImagesIllustration,
  VideosIllustration,
  AudioIllustration,
  DocumentsIllustration,
  AlbumsIllustration,
  NotesIllustration,
  FavoritesIllustration,
  SearchIllustration,
} from '@shared/illustrations/EmptyStateIllustrations';

interface EmptyStateProps {
  /** Type of content (images, videos, docs, albums, notes, favorites, search) */
  contentType: 'images' | 'videos' | 'documents' | 'audio' | 'albums' | 'notes' | 'favorites' | 'search';
  /** Handler for add button press */
  onAddPress?: () => void;
}

interface EmptyConfig {
  title: string;
  description: string;
  buttonText: string;
}

const EMPTY_STATE_CONFIG: Record<string, EmptyConfig> = {
  images: {
    title: 'No images yet',
    description: 'Import photos from your gallery or share them from other apps to keep them safe.',
    buttonText: 'Add Images',
  },
  videos: {
    title: 'No videos yet',
    description: 'Import videos from your gallery or share them from other apps.',
    buttonText: 'Add Videos',
  },
  documents: {
    title: 'No documents yet',
    description: 'Import PDFs, spreadsheets, and other files to encrypt them.',
    buttonText: 'Add Documents',
  },
  audio: {
    title: 'No audio files yet',
    description: 'Import music or voice recordings to keep them private.',
    buttonText: 'Add Audio',
  },
  albums: {
    title: 'No albums yet',
    description: 'Create albums to organize your photos and videos into collections.',
    buttonText: 'Create Album',
  },
  notes: {
    title: 'No notes yet',
    description: 'Write encrypted notes that only you can read.',
    buttonText: 'Create Note',
  },
  favorites: {
    title: 'No favorites yet',
    description: 'Tap the star on any item to mark it as a favorite for quick access.',
    buttonText: '',
  },
  search: {
    title: 'No results found',
    description: 'Try a different search term or check the spelling.',
    buttonText: '',
  },
};

/** Map content type → illustration component */
function renderIllustration(
  contentType: string,
  color: string,
  accent: string,
): React.JSX.Element {
  const props = { size: 140, color, accent };
  switch (contentType) {
    case 'images': return <ImagesIllustration {...props} />;
    case 'videos': return <VideosIllustration {...props} />;
    case 'audio': return <AudioIllustration {...props} />;
    case 'documents': return <DocumentsIllustration {...props} />;
    case 'albums': return <AlbumsIllustration {...props} />;
    case 'notes': return <NotesIllustration {...props} />;
    case 'favorites': return <FavoritesIllustration {...props} />;
    case 'search': return <SearchIllustration {...props} />;
    default: return <ImagesIllustration {...props} />;
  }
}

/**
 * Premium empty state component for vault tabs
 */
export function EmptyState({
  contentType,
  onAddPress,
}: EmptyStateProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const config = EMPTY_STATE_CONFIG[contentType];

  // ── Entry animation ──
  const illustrationTranslateY = useSharedValue(20);
  const illustrationOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(12);
  const textOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.9);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    // Phase 1: Illustration floats up
    illustrationTranslateY.value = withSpring(0, { damping: 18, stiffness: 160, mass: 0.8 });
    illustrationOpacity.value = withTiming(1, { duration: 400 });

    // Phase 2: Text fades in (staggered)
    textTranslateY.value = withDelay(150, withSpring(0, { damping: 20, stiffness: 200 }));
    textOpacity.value = withDelay(150, withTiming(1, { duration: 350 }));

    // Phase 3: Button pops in
    buttonScale.value = withDelay(300, withSpring(1, { damping: 14, stiffness: 200 }));
    buttonOpacity.value = withDelay(300, withTiming(1, { duration: 300 }));
  }, [contentType]);

  const illustrationAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: illustrationTranslateY.value }],
    opacity: illustrationOpacity.value,
  }));

  const textAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: textTranslateY.value }],
    opacity: textOpacity.value,
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    opacity: buttonOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Illustration */}
      <Animated.View style={[styles.illustrationWrapper, illustrationAnimStyle]}>
        {renderIllustration(contentType, themeColors.textTertiary, themeColors.accent)}
      </Animated.View>

      {/* Text */}
      <Animated.View style={[styles.textWrapper, textAnimStyle]}>
        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.description}>{config.description}</Text>
      </Animated.View>

      {/* CTA Button */}
      {onAddPress && config.buttonText.length > 0 && (
        <Animated.View style={buttonAnimStyle}>
          <Pressable
            onPress={onAddPress}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={config.buttonText}
          >
            <Text style={styles.buttonText}>{config.buttonText}</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  illustrationWrapper: {
    marginBottom: spacing.xl,
  },
  textWrapper: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.headlineMedium,
    color: c.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  description: {
    ...typography.bodyMedium,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  button: {
    backgroundColor: c.accent,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md + 2,
    borderRadius: layout.buttonBorderRadius,
    elevation: 2,
    shadowColor: c.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  buttonText: {
    ...typography.labelLarge,
    color: c.textOnAccent,
    letterSpacing: 0.3,
  },
});
