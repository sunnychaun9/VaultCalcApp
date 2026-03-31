/**
 * VaultCalc - PremiumSwitch
 *
 * Custom animated toggle using Reanimated for UI-thread spring physics
 * and smooth color transitions. Features:
 * - Spring-physics thumb slide
 * - Interpolated track color (OFF gray → ON accent)
 * - Subtle glow halo when active
 * - Bounce micro-interaction on press
 *
 * Drop-in replacement: same `value`/`onValueChange`/`disabled` API.
 */

import React, { useCallback, useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  interpolateColor,
} from 'react-native-reanimated';

// ── Dimensions ──────────────────────────────────────────────────
const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 30;
const TRACK_RADIUS = TRACK_HEIGHT / 2;
const THUMB_SIZE = 24;
const THUMB_MARGIN = (TRACK_HEIGHT - THUMB_SIZE) / 2;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_MARGIN * 2;

// ── Spring configs ──────────────────────────────────────────────
const SLIDE_SPRING = { damping: 18, stiffness: 280, mass: 0.7 };
const BOUNCE_DOWN = { damping: 12, stiffness: 500, mass: 0.4 };
const BOUNCE_UP = { damping: 10, stiffness: 300, mass: 0.5 };

interface PremiumSwitchProps {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  /** OFF track color — defaults to gray */
  trackColorOff?: string;
  /** ON track color — defaults to accent blue */
  trackColorOn?: string;
  /** Thumb color */
  thumbColor?: string;
  /** Glow color when ON — defaults to trackColorOn with transparency */
  glowColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function PremiumSwitch({
  value,
  onValueChange,
  disabled = false,
  trackColorOff = '#78788029',
  trackColorOn = '#3B82F6',
  thumbColor = '#FFFFFF',
  glowColor,
  style,
}: PremiumSwitchProps): React.JSX.Element {
  // ── Shared values (all UI-thread) ──────────────────────────
  const progress = useSharedValue(value ? 1 : 0);
  const thumbScale = useSharedValue(1);

  // Animate on value change
  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, SLIDE_SPRING);
  }, [value, progress]);

  // ── Press handler with bounce micro-interaction ────────────
  const handlePress = useCallback(() => {
    if (disabled || !onValueChange) return;

    // Bounce: scale 1 → 0.82 → 1.06 → 1
    thumbScale.value = withSequence(
      withSpring(0.82, BOUNCE_DOWN),
      withSpring(1.06, BOUNCE_UP),
      withSpring(1, { damping: 14, stiffness: 250, mass: 0.5 }),
    );

    onValueChange(!value);
  }, [disabled, onValueChange, value, thumbScale]);

  // ── Animated styles (all on UI thread) ─────────────────────
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [trackColorOff, trackColorOn],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => {
    const translateX = THUMB_MARGIN + progress.value * THUMB_TRAVEL;
    return {
      transform: [
        { translateX },
        { scale: thumbScale.value },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const translateX = THUMB_MARGIN + progress.value * THUMB_TRAVEL;
    // Glow fades in during the second half of the transition
    const opacity = progress.value > 0.5 ? (progress.value - 0.5) * 0.7 : 0;
    return {
      opacity,
      transform: [{ translateX }],
    };
  });

  const resolvedGlow = glowColor ?? trackColorOn;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={[disabled && styles.disabled, style]}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      {/* Track */}
      <Animated.View style={[styles.track, trackStyle]}>
        {/* Glow halo behind thumb when ON */}
        <Animated.View
          style={[
            styles.glow,
            { backgroundColor: resolvedGlow },
            glowStyle,
          ]}
        />

        {/* Thumb */}
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: thumbColor },
            thumbStyle,
          ]}
        >
          {/* Inner highlight — subtle specular reflection */}
          <View style={styles.thumbHighlight} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
    justifyContent: 'center',
    overflow: 'visible',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.5,
  },
  thumbHighlight: {
    position: 'absolute',
    top: 2,
    left: 3,
    width: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  glow: {
    position: 'absolute',
    width: THUMB_SIZE + 12,
    height: THUMB_SIZE + 12,
    borderRadius: (THUMB_SIZE + 12) / 2,
    marginLeft: -6,
    marginTop: -6,
    top: THUMB_MARGIN,
  },
  disabled: {
    opacity: 0.4,
  },
});
