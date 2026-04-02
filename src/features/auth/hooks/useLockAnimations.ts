/**
 * VaultCalc - Lock Screen Animation Hooks (Premium Redesign)
 *
 * Smooth 60fps animations for the premium lock screen:
 * - Shake animation on wrong input (decaying horizontal oscillation)
 * - Dot scale + glow animation on fill
 * - Fade-out + scale animation on success
 * - Lock icon pulse animation
 * - Keypad button press spring
 *
 * Uses React Native's Animated API with native driver.
 *
 * @see AUTH-010 Premium Lock UI
 */

import { useRef, useCallback, useEffect } from 'react';
import { Animated, Vibration, Easing } from 'react-native';
import { useSettingsStore } from '@store/settingsStore';

/**
 * Horizontal shake animation for wrong PIN/Pattern.
 */
export function useShakeAnimation() {
  const shakeValue = useRef(new Animated.Value(0)).current;
  const hapticEnabled = useSettingsStore(s => s.hapticEnabled);

  const triggerShake = useCallback(() => {
    if (hapticEnabled) {
      Vibration.vibrate(100);
    }

    shakeValue.setValue(0);
    Animated.sequence([
      Animated.timing(shakeValue, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: 5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: -3, duration: 30, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: 0, duration: 30, useNativeDriver: true }),
    ]).start();
  }, [shakeValue, hapticEnabled]);

  return { shakeValue, triggerShake };
}

/**
 * Scale + glow animation for PIN dots filling.
 * Each dot springs from 0 → 1 on fill, with an accompanying
 * glow opacity pulse (0 → 0.8 → 0.4) for the halo effect.
 */
export function useDotScaleAnimations(maxDots: number) {
  const scales = useRef(
    Array.from({ length: maxDots }, () => new Animated.Value(0))
  ).current;

  const glows = useRef(
    Array.from({ length: maxDots }, () => new Animated.Value(0))
  ).current;

  const animateDotIn = useCallback((index: number) => {
    scales[index].setValue(0);
    glows[index].setValue(0);

    Animated.parallel([
      // Dot scale: overshoot spring
      Animated.spring(scales[index], {
        toValue: 1,
        friction: 4,
        tension: 200,
        useNativeDriver: true,
      }),
      // Glow pulse: quick flash then settle
      Animated.sequence([
        Animated.timing(glows[index], {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glows[index], {
          toValue: 0.3,
          duration: 300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [scales, glows]);

  const animateDotOut = useCallback((index: number) => {
    Animated.parallel([
      Animated.timing(scales[index], {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(glows[index], {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scales, glows]);

  const resetAll = useCallback(() => {
    scales.forEach(s => s.setValue(0));
    glows.forEach(g => g.setValue(0));
  }, [scales, glows]);

  return { scales, glows, animateDotIn, animateDotOut, resetAll };
}

/**
 * Fade + scale animation for success unlock.
 * Entire screen zooms out slightly and fades away.
 */
export function useSuccessAnimation() {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const triggerSuccess = useCallback((onComplete?: () => void) => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 0.88,
        friction: 10,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onComplete?.();
      opacity.setValue(1);
      scale.setValue(1);
    });
  }, [opacity, scale]);

  return { opacity, scale, triggerSuccess };
}

/**
 * Subtle breathing pulse for the lock icon.
 * Runs continuously, scaling 1.0 → 1.06 → 1.0 on a slow loop.
 */
export function useLockIconPulse() {
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const scaleAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: 1.06,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const opacityAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0.9,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    scaleAnim.start();
    opacityAnim.start();

    return () => {
      scaleAnim.stop();
      opacityAnim.stop();
    };
  }, [pulseScale, pulseOpacity]);

  return { pulseScale, pulseOpacity };
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
