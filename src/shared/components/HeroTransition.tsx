/**
 * VaultCalc - Hero Transition Overlay
 *
 * Simulates a shared element transition by animating a thumbnail
 * from its grid position to full-screen. Used when opening
 * MediaViewerScreen from the photo/video grid.
 *
 * How it works:
 * 1. Receives the origin rect (x, y, width, height) of the tapped thumbnail
 * 2. Renders a backdrop + a clone view at the origin position
 * 3. Animates the clone to fill the screen with spring physics
 * 4. Fades out once the real content underneath is ready
 *
 * Usage in MediaViewerScreen:
 *   <HeroTransition originRect={route.params.originRect} thumbnailUri={uri}>
 *     <ActualContent />
 *   </HeroTransition>
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

interface OriginRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HeroTransitionProps {
  /** Thumbnail origin rectangle (screen coordinates) */
  originRect?: OriginRect;
  /** Decrypted thumbnail URI to show during the transition */
  thumbnailUri?: string | null;
  /** Called when the enter animation completes */
  onTransitionEnd?: () => void;
  children: React.ReactNode;
}

export function HeroTransition({
  originRect,
  thumbnailUri,
  onTransitionEnd,
  children,
}: HeroTransitionProps): React.JSX.Element {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [finished, setFinished] = useState(false);

  // Animation progress: 0 = at thumbnail position, 1 = full screen
  const progress = useRef(new Animated.Value(0)).current;
  // Backdrop opacity fades in, then the whole overlay fades out
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  const hasOrigin = originRect != null && originRect.width > 0;

  useEffect(() => {
    if (!hasOrigin) {
      // No origin rect — skip hero animation, just show children
      setFinished(true);
      return;
    }

    // Phase 1: Expand thumbnail to full screen (with backdrop)
    Animated.parallel([
      Animated.spring(progress, {
        toValue: 1,
        stiffness: 260,
        damping: 24,
        mass: 0.9,
        useNativeDriver: false, // need layout interpolation
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Phase 2: Fade out the overlay to reveal real content underneath
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setFinished(true);
        onTransitionEnd?.();
      });
    });
  }, [hasOrigin, progress, backdropOpacity, overlayOpacity, onTransitionEnd]);

  // If no origin rect or animation finished, just render children
  if (!hasOrigin || finished) {
    return <>{children}</>;
  }

  const { x, y, width, height } = originRect!;

  // Interpolate from thumbnail rect to full screen
  const animLeft = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [x, 0],
  });
  const animTop = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [y, 0],
  });
  const animWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [width, screenW],
  });
  const animHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [height, screenH],
  });
  const animBorderRadius = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  return (
    <View style={styles.container}>
      {/* Real content renders behind the overlay from frame 1 */}
      {children}

      {/* Hero overlay — sits on top during animation */}
      <Animated.View
        style={[styles.overlay, { opacity: overlayOpacity }]}
        pointerEvents="none"
      >
        {/* Dark backdrop fades in */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />

        {/* Animating thumbnail */}
        <Animated.View
          style={{
            position: 'absolute',
            left: animLeft,
            top: animTop,
            width: animWidth,
            height: animHeight,
            borderRadius: animBorderRadius,
            overflow: 'hidden',
          }}
        >
          {thumbnailUri ? (
            <Image
              source={{ uri: thumbnailUri }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroPlaceholder} />
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1A1A1A',
  },
});
