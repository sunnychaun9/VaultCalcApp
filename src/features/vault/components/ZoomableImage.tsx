/**
 * VaultCalc - Zoomable Image Component
 *
 * High-performance pinch-to-zoom + double-tap-to-zoom image viewer.
 * Uses React Native Animated API with native driver for 60fps.
 *
 * Features:
 * - Pinch to zoom (1x → 5x)
 * - Double tap to zoom (toggles 1x ↔ 2.5x)
 * - Pan / drag when zoomed
 * - Bounce back when dragged beyond bounds
 * - Smooth spring animations
 *
 * @see VAULT-005
 */

import React, { useRef, useMemo, useCallback } from 'react';
import {
  View,
  Image,
  Animated,
  PanResponder,
  StyleSheet,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from 'react-native';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_DELAY = 300;

interface ZoomableImageProps {
  source: ImageSourcePropType;
  style?: object;
}

export function ZoomableImage({ source, style }: ZoomableImageProps): React.JSX.Element {
  // Layout
  const containerSize = useRef({ width: 0, height: 0 });

  // Animated values
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Tracking refs
  const baseScale = useRef(1);
  const baseTranslateX = useRef(0);
  const baseTranslateY = useRef(0);
  const currentScale = useRef(1);
  const pinchStartDistance = useRef(0);
  const pinchStartScale = useRef(1);
  const lastTapTime = useRef(0);
  const isPinching = useRef(false);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    containerSize.current = {
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    };
  }, []);

  /**
   * Animate scale and translation back to valid bounds.
   */
  const snapToBounds = useCallback((newScale: number) => {
    const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    currentScale.current = s;

    if (s <= 1) {
      // Reset to center
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 7, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 0, friction: 7, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 7, useNativeDriver: true }),
      ]).start(() => {
        baseScale.current = 1;
        baseTranslateX.current = 0;
        baseTranslateY.current = 0;
      });
    } else {
      // Clamp translation to keep image within bounds
      const { width, height } = containerSize.current;
      const maxTx = (width * (s - 1)) / 2;
      const maxTy = (height * (s - 1)) / 2;
      const clampedTx = Math.max(-maxTx, Math.min(maxTx, baseTranslateX.current));
      const clampedTy = Math.max(-maxTy, Math.min(maxTy, baseTranslateY.current));

      Animated.parallel([
        Animated.spring(scale, { toValue: s, friction: 7, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: clampedTx, friction: 7, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: clampedTy, friction: 7, useNativeDriver: true }),
      ]).start(() => {
        baseScale.current = s;
        baseTranslateX.current = clampedTx;
        baseTranslateY.current = clampedTy;
      });
    }
  }, [scale, translateX, translateY]);

  /**
   * Double-tap zoom toggle.
   */
  const handleDoubleTap = useCallback(() => {
    if (currentScale.current > 1.1) {
      // Zoomed in → zoom out to 1x
      baseTranslateX.current = 0;
      baseTranslateY.current = 0;
      snapToBounds(1);
    } else {
      // At 1x → zoom to 2.5x
      snapToBounds(DOUBLE_TAP_SCALE);
    }
  }, [snapToBounds]);

  /**
   * Calculate distance between two touch points.
   */
  const getDistance = (touches: { pageX: number; pageY: number }[]) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;

        // Detect double tap
        if (touches.length === 1) {
          const now = Date.now();
          if (now - lastTapTime.current < DOUBLE_TAP_DELAY) {
            handleDoubleTap();
            lastTapTime.current = 0;
            return;
          }
          lastTapTime.current = now;
        }

        // Start pinch tracking
        if (touches.length === 2) {
          isPinching.current = true;
          pinchStartDistance.current = getDistance(touches as unknown as { pageX: number; pageY: number }[]);
          pinchStartScale.current = currentScale.current;
        }

        // Record base for pan
        baseTranslateX.current = (translateX as any)._value ?? 0;
        baseTranslateY.current = (translateY as any)._value ?? 0;
      },

      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length === 2 && isPinching.current) {
          // Pinch zoom
          const dist = getDistance(touches as unknown as { pageX: number; pageY: number }[]);
          const newScale = Math.max(
            MIN_SCALE * 0.5,
            Math.min(MAX_SCALE * 1.2, pinchStartScale.current * (dist / pinchStartDistance.current))
          );
          scale.setValue(newScale);
          currentScale.current = newScale;
        } else if (currentScale.current > 1 && !isPinching.current) {
          // Pan when zoomed
          const newTx = baseTranslateX.current + gestureState.dx;
          const newTy = baseTranslateY.current + gestureState.dy;
          translateX.setValue(newTx);
          translateY.setValue(newTy);
        }
      },

      onPanResponderRelease: () => {
        if (isPinching.current) {
          isPinching.current = false;
          baseScale.current = currentScale.current;
          snapToBounds(currentScale.current);
        } else if (currentScale.current > 1) {
          // Snap translation to bounds after pan
          baseTranslateX.current = (translateX as any)._value ?? 0;
          baseTranslateY.current = (translateY as any)._value ?? 0;
          snapToBounds(currentScale.current);
        }
      },

      onPanResponderTerminate: () => {
        isPinching.current = false;
      },
    }),
    [scale, translateX, translateY, handleDoubleTap, snapToBounds]
  );

  return (
    <View
      style={[styles.container, style]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={[
          styles.imageWrapper,
          {
            transform: [
              { scale },
              { translateX },
              { translateY },
            ],
          },
        ]}
      >
        <Image
          source={source}
          style={styles.image}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
