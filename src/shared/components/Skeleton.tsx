/**
 * VaultCalc - Skeleton Loading System
 *
 * Lightweight shimmer skeleton placeholders using Reanimated.
 * No external native dependencies — uses animated opacity pulse
 * for the shimmer effect, which is more performant than gradient-
 * based shimmer on Android (no overdraw).
 *
 * Components:
 * - SkeletonBone: single shimmer rectangle/circle
 * - SkeletonGroup: wrapper that coordinates shimmer timing
 * - useDelayedLoading: shows skeleton only after 300ms threshold
 *
 * Usage:
 *   const showSkeleton = useDelayedLoading(isLoading);
 *   if (showSkeleton) return <GridSkeleton />;
 */

import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useThemeColors, type ColorTokens, spacing, layout } from '@shared/theme';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Delayed loading hook — prevents skeleton flash for fast loads
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Returns true only after `isLoading` has been true for >= `delayMs`.
 * Prevents skeleton flash when data loads quickly (<300ms).
 */
export function useDelayedLoading(isLoading: boolean, delayMs: number = 300): boolean {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowSkeleton(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowSkeleton(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [isLoading, delayMs]);

  return showSkeleton;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SkeletonBone — single shimmer element
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SkeletonBoneProps {
  /** Width — number or '100%' */
  width: number | string;
  /** Height */
  height: number;
  /** Border radius — default 6 */
  borderRadius?: number;
  /** Whether to render as a circle */
  circle?: boolean;
  /** Stagger delay in ms — for cascading shimmer */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonBone({
  width,
  height,
  borderRadius = 6,
  circle = false,
  delay = 0,
  style,
}: SkeletonBoneProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0.7, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1, // infinite
        true, // reverse
      ),
    );
  }, [opacity, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const resolvedRadius = circle ? (typeof height === 'number' ? height / 2 : 999) : borderRadius;

  const baseStyle = useMemo(() => ({
    width: width as ViewStyle['width'],
    height,
    borderRadius: resolvedRadius,
    backgroundColor: themeColors.surfaceContainerHigh,
  }), [width, height, resolvedRadius, themeColors.surfaceContainerHigh]);

  return (
    <Animated.View
      style={[baseStyle, animatedStyle, style]}
    />
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pre-built skeletons matching real layout
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Grid Skeleton ──

interface GridSkeletonProps {
  columns?: number;
  rows?: number;
}

/**
 * Skeleton for the vault media grid.
 * Matches MediaGrid cell sizes and gap.
 */
export function GridSkeleton({
  columns = layout.vaultGridColumns,
  rows = 4,
}: GridSkeletonProps): React.JSX.Element {
  const { width: screenWidth } = useWindowDimensions();
  const gap = layout.vaultGridGap;
  const cellSize = (screenWidth - gap * 2 - (columns - 1) * gap) / columns;

  const cells = Array.from({ length: columns * rows }, (_, i) => i);

  return (
    <View style={[gridStyles.container, { padding: gap, gap }]}>
      {cells.map((i) => (
        <SkeletonBone
          key={i}
          width={cellSize}
          height={cellSize}
          borderRadius={10}
          delay={i * 40}
        />
      ))}
    </View>
  );
}

const gridStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

// ── List Item Skeleton ──

interface ListSkeletonProps {
  /** Number of placeholder rows */
  count?: number;
}

/**
 * Skeleton for vault list items (MediaListItem, DocumentListItem, AudioListItem).
 * Matches: 52px thumbnail + text column (2 lines) + border.
 */
export function ListSkeleton({ count = 8 }: ListSkeletonProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => listStyles(themeColors), [themeColors]);
  const rows = Array.from({ length: count }, (_, i) => i);

  return (
    <View>
      {rows.map((i) => (
        <View key={i} style={styles.row}>
          {/* Thumbnail placeholder */}
          <SkeletonBone width={52} height={52} borderRadius={10} delay={i * 30} />
          {/* Text column */}
          <View style={styles.textCol}>
            <SkeletonBone width="75%" height={14} delay={i * 30 + 60} />
            <SkeletonBone width="50%" height={11} delay={i * 30 + 120} style={styles.metaLine} />
          </View>
        </View>
      ))}
    </View>
  );
}

const listStyles = (c: ColorTokens) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: layout.vaultListItemHeight,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  textCol: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },
  metaLine: {
    marginTop: 8,
  },
});

// ── Settings Section Skeleton ──

interface SettingsSkeletonProps {
  /** Number of sections to show */
  sections?: number;
  /** Rows per section */
  rowsPerSection?: number;
}

/**
 * Skeleton for the settings screen.
 * Matches SettingsSection + SettingsRow layout.
 */
export function SettingsSkeleton({
  sections = 3,
  rowsPerSection = 4,
}: SettingsSkeletonProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => settingsStyles(themeColors), [themeColors]);

  return (
    <View style={styles.container}>
      {Array.from({ length: sections }, (_, s) => (
        <View key={s} style={styles.section}>
          {/* Section header */}
          <SkeletonBone
            width={90}
            height={12}
            delay={s * 100}
            style={styles.sectionTitle}
          />
          {/* Card */}
          <View style={styles.card}>
            {Array.from({ length: rowsPerSection }, (_, r) => {
              const delay = s * 100 + r * 30;
              return (
                <View key={r} style={styles.row}>
                  {/* Icon box */}
                  <SkeletonBone width={36} height={36} borderRadius={10} delay={delay} />
                  {/* Text */}
                  <View style={styles.textCol}>
                    <SkeletonBone width="60%" height={14} delay={delay + 50} />
                    <SkeletonBone width="40%" height={10} delay={delay + 100} style={styles.subtitle} />
                  </View>
                  {/* Toggle placeholder */}
                  <SkeletonBone width={52} height={30} borderRadius={15} delay={delay + 80} />
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const settingsStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: c.surfaceContainer,
    borderRadius: layout.cardBorderRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  textCol: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  subtitle: {
    marginTop: 6,
  },
});
