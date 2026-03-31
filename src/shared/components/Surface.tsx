/**
 * VaultCalc - Surface Component
 *
 * Themed container with elevation-based depth.
 * Replaces plain Views for cards, sections, and floating elements.
 *
 * Usage:
 *   <Surface level="level1" borderRadius={16}>
 *     <Text>Card content</Text>
 *   </Surface>
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useThemeColors, colors } from '@shared/theme';
import { getSurfaceStyle, elevationLevels } from '@shared/theme/elevation';

interface SurfaceProps {
  /** Elevation level — level0 (flat), level1 (card), level2 (floating) */
  level?: keyof typeof elevationLevels;
  /** Border radius override */
  borderRadius?: number;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function Surface({
  level = 'level1',
  borderRadius = 16,
  style,
  children,
}: SurfaceProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const isDark = themeColors === colors.dark;

  const surfaceStyle = useMemo(
    () => getSurfaceStyle(level, themeColors, isDark),
    [level, themeColors, isDark],
  );

  return (
    <View style={[surfaceStyle, { borderRadius }, styles.base, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
