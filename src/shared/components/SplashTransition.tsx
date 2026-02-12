import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useColorScheme, View } from 'react-native';
import { useSettingsStore } from '@store/settingsStore';

// Must match native splash colors exactly (values/colors.xml & values-night/colors.xml)
const SPLASH = {
  light: { bg: '#F9F9FB', icon: '#3A3A3C' },
  dark: { bg: '#1C1C1E', icon: '#E5E5EA' },
};

// Icon geometry derived from ic_splash_foreground.xml (108dp, 512 viewport)
const ICON = 108;
const S = ICON / 512;
const BAR_X = 102 * S;
const BAR_W = 308 * S;
const BAR_H = 41 * S;
const BAR_R = 12 * S;
const TOP_Y = 194 * S;
const BOT_Y = 277 * S;
const DIAMOND = (62 / Math.SQRT2) * S;
const DIAMOND_XY = (ICON - DIAMOND) / 2;

interface Props {
  isReady: boolean;
  onComplete: () => void;
}

function useSplashColors() {
  const themeMode = useSettingsStore(s => s.themeMode);
  const scheme = useColorScheme();
  if (themeMode === 'system') {
    return scheme === 'dark' ? SPLASH.dark : SPLASH.light;
  }
  return SPLASH[themeMode];
}

function SplashIcon({ color }: { color: string }) {
  return (
    <View style={styles.icon}>
      <View style={[styles.bar, styles.topBar, { backgroundColor: color }]} />
      <View style={[styles.diamond, { backgroundColor: color }]} />
      <View style={[styles.bar, styles.botBar, { backgroundColor: color }]} />
    </View>
  );
}

export function SplashTransition({ isReady, onComplete }: Props) {
  const { bg, icon } = useSplashColors();
  const bgOpacity = useRef(new Animated.Value(1)).current;
  const iconAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isReady) return;

    // No artificial delay — animate out immediately when ready.
    // Both tracks run in parallel, completing in 200ms total.
    Animated.parallel([
      Animated.timing(bgOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(iconAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onComplete();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  const iconOpacity = iconAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const iconTranslateY = iconAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  const iconScale = iconAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.97],
  });

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View style={[styles.fill, { backgroundColor: bg, opacity: bgOpacity }]} />
      <Animated.View
        style={[
          styles.center,
          {
            opacity: iconOpacity,
            transform: [{ translateY: iconTranslateY }, { scale: iconScale }],
          },
        ]}>
        <SplashIcon color={icon} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: ICON,
    height: ICON,
  },
  bar: {
    position: 'absolute',
    left: BAR_X,
    width: BAR_W,
    height: BAR_H,
    borderRadius: BAR_R,
  },
  topBar: {
    top: TOP_Y,
  },
  botBar: {
    top: BOT_Y,
  },
  diamond: {
    position: 'absolute',
    left: DIAMOND_XY,
    top: DIAMOND_XY,
    width: DIAMOND,
    height: DIAMOND,
    transform: [{ rotate: '45deg' }],
  },
});
