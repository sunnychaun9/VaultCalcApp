/**
 * VaultCalc - AnimatedPressable
 *
 * Drop-in replacement for React Native's Pressable with spring-physics
 * press feedback. Wraps children in an Animated.View that scales
 * and fades on press, then springs back on release.
 *
 * Usage (identical to Pressable):
 *   <AnimatedPressable onPress={handlePress} style={styles.button}>
 *     <Text>Tap me</Text>
 *   </AnimatedPressable>
 *
 * Variants:
 *   <AnimatedPressable variant="card" ...>  → scale 0.98, shadow lift
 *   <AnimatedPressable variant="subtle" ...> → scale 0.99, gentle
 */

import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressAnimation, useCardPressAnimation } from '@shared/hooks/useAnimations';

type Variant = 'default' | 'card' | 'subtle';

interface AnimatedPressableProps extends PressableProps {
  /** Animation preset — default: scale 0.96 + opacity */
  variant?: Variant;
  children: React.ReactNode;
}

/**
 * Pressable with spring-physics press feedback.
 */
export function AnimatedPressable({
  variant = 'default',
  children,
  onPressIn: externalPressIn,
  onPressOut: externalPressOut,
  style,
  ...pressableProps
}: AnimatedPressableProps): React.JSX.Element {
  const defaultAnim = usePressAnimation(
    variant === 'subtle'
      ? { scaleDown: 0.99, opacityDown: 0.9 }
      : { scaleDown: 0.96, opacityDown: 0.85 },
  );
  const cardAnim = useCardPressAnimation();

  const isCard = variant === 'card';
  const { animatedStyle, onPressIn, onPressOut } = isCard ? cardAnim : defaultAnim;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        {...pressableProps}
        onPressIn={(e) => {
          onPressIn();
          externalPressIn?.(e);
        }}
        onPressOut={(e) => {
          onPressOut();
          externalPressOut?.(e);
        }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
