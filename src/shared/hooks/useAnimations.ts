/**
 * VaultCalc - Micro-interaction Animation Hooks
 *
 * Reusable Reanimated hooks for consistent press feedback,
 * list item entrance, and success/error feedback across the app.
 *
 * All animations run on the UI thread via useNativeDriver.
 */

import { useCallback, useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  type AnimatedStyle,
} from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

// ── Spring presets ─────────────────────────────────────────────

/** Snappy spring — fast settle, minimal overshoot */
const SPRING_SNAPPY = { damping: 15, stiffness: 400, mass: 0.6 };

/** Gentle spring — visible bounce, natural feel */
const SPRING_GENTLE = { damping: 12, stiffness: 200, mass: 0.8 };

/** Stiff spring — almost no overshoot, very responsive */
const SPRING_STIFF = { damping: 20, stiffness: 500, mass: 0.5 };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. PRESS ANIMATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PressAnimationConfig {
  /** Scale when pressed — default 0.96 */
  scaleDown?: number;
  /** Opacity when pressed — default 0.85 */
  opacityDown?: number;
}

interface PressAnimationResult {
  /** Animated style to spread onto the Animated.View */
  animatedStyle: AnimatedStyle<ViewStyle>;
  /** Call on pressIn */
  onPressIn: () => void;
  /** Call on pressOut */
  onPressOut: () => void;
}

/**
 * Spring-physics press feedback.
 *
 * Usage:
 *   const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();
 *   <Animated.View style={animatedStyle}>
 *     <Pressable onPressIn={onPressIn} onPressOut={onPressOut} ... />
 *   </Animated.View>
 */
export function usePressAnimation(
  config: PressAnimationConfig = {},
): PressAnimationResult {
  const { scaleDown = 0.96, opacityDown = 0.85 } = config;

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const onPressIn = useCallback(() => {
    'worklet';
    scale.value = withSpring(scaleDown, SPRING_STIFF);
    opacity.value = withTiming(opacityDown, { duration: 80 });
  }, [scale, opacity, scaleDown, opacityDown]);

  const onPressOut = useCallback(() => {
    'worklet';
    scale.value = withSpring(1, SPRING_SNAPPY);
    opacity.value = withSpring(1, SPRING_SNAPPY);
  }, [scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return { animatedStyle, onPressIn, onPressOut };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. CARD PRESS ANIMATION (scale + shadow lift)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CardPressResult {
  animatedStyle: AnimatedStyle<ViewStyle>;
  onPressIn: () => void;
  onPressOut: () => void;
}

/**
 * Press animation for cards — slight scale + elevation lift.
 *
 * Usage:
 *   const { animatedStyle, onPressIn, onPressOut } = useCardPressAnimation();
 */
export function useCardPressAnimation(): CardPressResult {
  const scale = useSharedValue(1);
  const elevation = useSharedValue(1);

  const onPressIn = useCallback(() => {
    'worklet';
    scale.value = withSpring(0.98, SPRING_STIFF);
    elevation.value = withTiming(6, { duration: 100 });
  }, [scale, elevation]);

  const onPressOut = useCallback(() => {
    'worklet';
    scale.value = withSpring(1, SPRING_SNAPPY);
    elevation.value = withTiming(1, { duration: 200 });
  }, [scale, elevation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    elevation: elevation.value,
    shadowOpacity: elevation.value * 0.04,
    shadowRadius: elevation.value,
  }));

  return { animatedStyle, onPressIn, onPressOut };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. LIST ITEM ENTRANCE ANIMATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ListItemAnimConfig {
  /** Index of this item in the list — drives stagger delay */
  index: number;
  /** Per-item stagger delay in ms — default 30 */
  stagger?: number;
  /** Max items to animate (avoids animating 1000 items) — default 15 */
  maxAnimated?: number;
  /** Slide direction: 'up' slides from below, 'right' slides from left */
  direction?: 'up' | 'right';
}

/**
 * Staggered fade + slide entrance for list/grid items.
 * Items beyond `maxAnimated` appear instantly (no delay).
 *
 * Usage inside a renderItem:
 *   const entryStyle = useListItemAnimation({ index });
 *   <Animated.View style={entryStyle}>
 *     <MyListItem ... />
 *   </Animated.View>
 */
export function useListItemAnimation({
  index,
  stagger = 30,
  maxAnimated = 15,
  direction = 'up',
}: ListItemAnimConfig): AnimatedStyle<ViewStyle> {
  const opacity = useSharedValue(index < maxAnimated ? 0 : 1);
  const translate = useSharedValue(index < maxAnimated ? (direction === 'up' ? 16 : -16) : 0);

  useEffect(() => {
    if (index >= maxAnimated) return;

    const delay = index * stagger;

    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    translate.value = withDelay(
      delay,
      withSpring(0, SPRING_GENTLE),
    );
  }, [index, stagger, maxAnimated, opacity, translate]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      direction === 'up'
        ? { translateY: translate.value }
        : { translateX: translate.value },
    ],
  }));

  return animatedStyle;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. FEEDBACK ANIMATIONS (success bounce, error shake)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface FeedbackResult {
  animatedStyle: AnimatedStyle<ViewStyle>;
  /** Trigger a success bounce */
  triggerSuccess: () => void;
  /** Trigger an error shake */
  triggerError: () => void;
}

/**
 * Success bounce + error shake feedback animations.
 *
 * Usage:
 *   const { animatedStyle, triggerSuccess, triggerError } = useFeedbackAnimation();
 *   <Animated.View style={animatedStyle}>
 *     <MyComponent />
 *   </Animated.View>
 *
 *   // On success:
 *   triggerSuccess();
 *
 *   // On error:
 *   triggerError();
 */
export function useFeedbackAnimation(): FeedbackResult {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);

  const triggerSuccess = useCallback(() => {
    'worklet';
    scale.value = withSequence(
      withSpring(1.08, { damping: 8, stiffness: 400, mass: 0.5 }),
      withSpring(1, { damping: 10, stiffness: 300, mass: 0.6 }),
    );
  }, [scale]);

  const triggerError = useCallback(() => {
    'worklet';
    translateX.value = withSequence(
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(-4, { duration: 50 }),
      withTiming(4, { duration: 50 }),
      withTiming(-2, { duration: 40 }),
      withSpring(0, SPRING_STIFF),
    );
  }, [translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
    ],
  }));

  return { animatedStyle, triggerSuccess, triggerError };
}
