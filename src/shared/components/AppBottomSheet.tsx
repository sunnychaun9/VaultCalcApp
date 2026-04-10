/**
 * VaultCalc - AppBottomSheet (Premium)
 *
 * Production-grade bottom sheet wrapper around @gorhom/bottom-sheet v5.
 *
 * Features:
 * - Tuned spring animation (fast open, damped close)
 * - Animated backdrop dim with configurable opacity
 * - Styled drag handle with expanded touch area
 * - Top-edge highlight border for depth separation
 * - Multi-snap point support (30% → 60% → full)
 * - Swipe down to dismiss + tap outside to close
 * - Keyboard-aware content offset
 *
 * Usage:
 *   const sheetRef = useRef<BottomSheetRef>(null);
 *   <AppBottomSheet ref={sheetRef} snapPoints={['30%', '60%']} title="Options">
 *     <Content />
 *   </AppBottomSheet>
 *
 * Open / close:
 *   sheetRef.current?.snapToIndex(0);  // first snap
 *   sheetRef.current?.expand();        // last snap
 *   sheetRef.current?.close();         // dismiss
 */

import React, { useCallback, useMemo, forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useThemeColors, colors, type ColorTokens, typography, spacing, getSurfaceStyle } from '@shared/theme';

export type BottomSheetRef = BottomSheet;

interface AppBottomSheetProps {
  /** Snap points — e.g. ['30%', '60%'] or [280, '50%', '90%'] */
  snapPoints: (string | number)[];
  /** Optional title shown at the top */
  title?: string;
  /** Called when the sheet is fully dismissed */
  onDismiss?: () => void;
  /** Called when snap index changes (-1 = closed) */
  onChange?: (index: number) => void;
  /** Whether backdrop dismisses on tap (default: true) */
  backdropDismiss?: boolean;
  /** Whether to enable dynamic sizing instead of snap points */
  enableDynamicSizing?: boolean;
  /** Backdrop maximum opacity — default 0.5 */
  backdropOpacity?: number;
  children: React.ReactNode;
}

// ── Spring configs ──────────────────────────────────────────────
// Opening: fast & responsive — stiff spring with controlled overshoot
const SPRING_OPEN = {
  damping: 20,
  stiffness: 360,
  mass: 0.6,
  overshootClamping: false,
};


export const AppBottomSheet = forwardRef<BottomSheet, AppBottomSheetProps>(
  function AppBottomSheet(
    {
      snapPoints,
      title,
      onDismiss,
      onChange,
      backdropDismiss = true,
      enableDynamicSizing = false,
      backdropOpacity = 0.5,
      children,
    },
    ref,
  ) {
    const themeColors = useThemeColors();
    const isDark = themeColors === colors.dark;
    const styles = useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);

    // ── Animated backdrop with configurable dim ──
    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={backdropOpacity}
          pressBehavior={backdropDismiss ? 'close' : 'none'}
          style={[props.style, styles.backdrop]}
        />
      ),
      [backdropDismiss, backdropOpacity, styles.backdrop],
    );

    // ── Custom handle with animated width ──
    const renderHandle = useCallback(
      () => (
        <View style={styles.handleContainer}>
          <View style={styles.handleBar} />
        </View>
      ),
      [styles],
    );

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={enableDynamicSizing ? undefined : snapPoints}
        enableDynamicSizing={enableDynamicSizing}
        enablePanDownToClose
        onClose={onDismiss}
        onChange={onChange}
        backdropComponent={renderBackdrop}
        handleComponent={renderHandle}
        backgroundStyle={styles.background}
        // Differentiated spring: fast open, clean close
        animationConfigs={SPRING_OPEN}
        // Keyboard behavior: pan keeps input above keyboard on Android
        android_keyboardInputMode="adjustPan"
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetView style={styles.contentContainer}>
          {/* Top edge highlight — subtle light border inside the radius */}
          <View style={styles.topEdge} />

          {/* Optional title */}
          {title != null && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
            </View>
          )}

          {children}
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

// ── Styles ──────────────────────────────────────────────────────

const createStyles = (c: ColorTokens, isDark: boolean) =>
  StyleSheet.create({
    // Sheet background — elevated surface with top radius
    background: {
      ...getSurfaceStyle('level2', c, isDark),
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },

    // Backdrop — dark overlay
    backdrop: {
      backgroundColor: '#000000',
    },

    // Handle container — expanded touch area (24dp tall)
    handleContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 10,
      paddingBottom: 6,
    },

    // Handle bar — wider, more visible, subtle color
    handleBar: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.2)'
        : 'rgba(0, 0, 0, 0.15)',
    },

    // Top edge highlight — 1px bright line at the very top inside the radius
    // Creates a subtle "catch light" effect that separates the sheet from backdrop
    topEdge: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.06)'
        : 'rgba(255, 255, 255, 0.8)',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },

    // Content wrapper
    contentContainer: {
      paddingBottom: spacing.xl,
    },

    // Title header
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xxs,
      paddingBottom: spacing.md,
    },

    title: {
      ...typography.titleLarge,
      color: c.textPrimary,
    },
  });
