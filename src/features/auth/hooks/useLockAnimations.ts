/**
 * VaultCalc - Lock Screen Animation Hooks
 *
 * Provides smooth 60fps animations for the premium lock screen:
 * - Shake animation on wrong input (horizontal oscillation)
 * - Dot scale animation on fill
 * - Fade-out animation on success
 *
 * Uses React Native's Animated API with native driver for performance.
 *
 * @see AUTH-010 Premium Lock UI
 */

import { useRef, useCallback } from 'react';
import { Animated, Vibration } from 'react-native';
import { useSettingsStore } from '@store/settingsStore';

/**
 * Horizontal shake animation for wrong PIN/Pattern.
 * Returns the animated value and a trigger function.
 */
export function useShakeAnimation() {
  const shakeValue = useRef(new Animated.Value(0)).current;
  const hapticEnabled = useSettingsStore(s => s.hapticEnabled);

  const triggerShake = useCallback(() => {
    // Strong vibration on error
    if (hapticEnabled) {
      Vibration.vibrate(100);
    }

    shakeValue.setValue(0);
    Animated.sequence([
      Animated.timing(shakeValue, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: 4, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [shakeValue, hapticEnabled]);

  return { shakeValue, triggerShake };
}

/**
 * Scale spring animation for PIN dots filling.
 * Creates an array of animated values for each dot position.
 */
export function useDotScaleAnimations(maxDots: number) {
  const scales = useRef(
    Array.from({ length: maxDots }, () => new Animated.Value(0))
  ).current;

  const animateDotIn = useCallback((index: number) => {
    scales[index].setValue(0);
    Animated.spring(scales[index], {
      toValue: 1,
      friction: 4,
      tension: 200,
      useNativeDriver: true,
    }).start();
  }, [scales]);

  const animateDotOut = useCallback((index: number) => {
    Animated.timing(scales[index], {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [scales]);

  const resetAll = useCallback(() => {
    scales.forEach(s => s.setValue(0));
  }, [scales]);

  return { scales, animateDotIn, animateDotOut, resetAll };
}

/**
 * Fade + scale animation for success unlock.
 */
export function useSuccessAnimation() {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const triggerSuccess = useCallback((onComplete?: () => void) => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 0.9,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onComplete?.();
      // Reset for next use
      opacity.setValue(1);
      scale.setValue(1);
    });
  }, [opacity, scale]);

  return { opacity, scale, triggerSuccess };
}

/**
 * Light tap haptic for key presses.
 */
export function useTapHaptic() {
  const hapticEnabled = useSettingsStore(s => s.hapticEnabled);

  const tap = useCallback(() => {
    if (hapticEnabled) {
      Vibration.vibrate(5);
    }
  }, [hapticEnabled]);

  return tap;
}
