/**
 * VaultCalc - Empty State Component
 *
 * Displayed when vault has no files.
 * Provides guidance and CTA to add files.
 *
 * @see FEATURE_INDEX.md VAULT-007
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';

interface EmptyStateProps {
  /** Type of content (images, videos, docs, albums, notes, favorites, search) */
  contentType: 'images' | 'videos' | 'documents' | 'albums' | 'notes' | 'favorites' | 'search';
  /** Handler for add button press */
  onAddPress?: () => void;
}

const EMPTY_STATE_CONFIG = {
  images: {
    icon: '🖼',
    title: 'No images yet',
    description: 'Tap the + button below or share images from other apps',
    buttonText: '+ Add Images',
  },
  videos: {
    icon: '🎬',
    title: 'No videos yet',
    description: 'Tap the + button below or share videos from other apps',
    buttonText: '+ Add Videos',
  },
  documents: {
    icon: '📄',
    title: 'No documents yet',
    description: 'Tap the + button below or share documents from other apps',
    buttonText: '+ Add Documents',
  },
  albums: {
    icon: '📁',
    title: 'No albums yet',
    description: 'Create an album to organize your media',
    buttonText: '+ Create Album',
  },
  notes: {
    icon: '📝',
    title: 'No notes yet',
    description: 'Create a note to store text securely',
    buttonText: '+ Create Note',
  },
  favorites: {
    icon: '\u2B50',
    title: 'No favorites yet',
    description: 'Star items to find them quickly',
    buttonText: '',
  },
  search: {
    icon: '\u{1F50D}',
    title: 'No results found',
    description: 'Try a different search term',
    buttonText: '',
  },
} as const;

/**
 * Empty state component for vault tabs
 */
export function EmptyState({
  contentType,
  onAddPress,
}: EmptyStateProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const config = EMPTY_STATE_CONFIG[contentType];

  return (
    <View style={styles.container}>
      {/* Icon */}
      <Text style={styles.icon}>{config.icon}</Text>

      {/* Title */}
      <Text style={styles.title}>{config.title}</Text>

      {/* Description */}
      <Text style={styles.description}>{config.description}</Text>

      {/* Add Button */}
      {onAddPress && (
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
      )}
    </View>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing.lg,
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
    marginBottom: spacing.xl,
    maxWidth: 280,
  },
  button: {
    backgroundColor: c.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: layout.buttonBorderRadius,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    ...typography.labelLarge,
    color: c.textOnAccent,
  },
});
