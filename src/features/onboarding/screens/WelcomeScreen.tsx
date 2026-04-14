/**
 * VaultCalc - Welcome / Onboarding Screen (ONB-01)
 *
 * Premium 4-slide swipeable onboarding that builds urgency, curiosity,
 * and trust. Full-screen dark aesthetic with custom SVG illustrations,
 * smooth page transitions, and animated page indicators.
 *
 * Flow: Fear -> Curiosity -> Safety -> Action
 *
 * @see 02-UX-Design.md Section 3, ONB-01
 * @see FEATURE_INDEX.md ONBOARD-001
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ScrollView,
  StatusBar,
  BackHandler,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@typedefs/navigation';
import { useSettingsStore } from '@store/settingsStore';
import { trackEvent } from '@services/analytics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import {
  ExposedPhoneIllustration,
  CalculatorDisguiseIllustration,
  IntruderCameraIllustration,
  ShieldCTAIllustration,
} from '../components/OnboardingIllustrations';

// ── Constants ─────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_SLIDES = 4;

const BG_COLOR = '#0A0F1A';
const TEXT_WHITE = '#F1F5F9';
const TEXT_MUTED = '#94A3B8';
const ACCENT = '#3B82F6';
const ACCENT_PRESSED = '#2563EB';
interface SlideData {
  title: string;
  subtitle: string;
  illustration: React.JSX.Element;
}

const SLIDES: SlideData[] = [
  {
    title: 'Your privacy\nis not safe',
    subtitle: 'Anyone who picks up your phone can see your private photos, videos, and files.',
    illustration: <ExposedPhoneIllustration size={220} />,
  },
  {
    title: 'Hide everything\nbehind a calculator',
    subtitle: 'VaultCalc looks and works like a real calculator. Enter your secret PIN and press = to unlock your vault.',
    illustration: <CalculatorDisguiseIllustration size={220} />,
  },
  {
    title: 'Intruder alert\nprotects you',
    subtitle: 'Wrong PIN? The front camera silently captures a photo. You will know exactly who tried to break in.',
    illustration: <IntruderCameraIllustration size={220} />,
  },
  {
    title: 'Your files deserve\nreal protection',
    subtitle: 'Military-grade encryption. No cloud. No tracking. Everything stays on your device.',
    illustration: <ShieldCTAIllustration size={220} />,
  },
];

// ── Animated Slide ────────────────────────────────────────────

interface SlideProps {
  data: SlideData;
  index: number;
  scrollX: SharedValue<number>;
}

function Slide({ data, index, scrollX }: SlideProps): React.JSX.Element {
  const offset = index * SCREEN_WIDTH;

  const illustrationStyle = useAnimatedStyle(() => {
    const inputRange = [offset - SCREEN_WIDTH, offset, offset + SCREEN_WIDTH];
    return {
      opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(scrollX.value, inputRange, [0.7, 1, 0.7], Extrapolation.CLAMP) },
        { translateY: interpolate(scrollX.value, inputRange, [30, 0, 30], Extrapolation.CLAMP) },
      ],
    };
  });

  const textStyle = useAnimatedStyle(() => {
    const inputRange = [offset - SCREEN_WIDTH, offset, offset + SCREEN_WIDTH];
    return {
      opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(scrollX.value, inputRange, [40, 0, -40], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      {/* Illustration */}
      <Animated.View style={[styles.illustrationContainer, illustrationStyle]}>
        {data.illustration}
      </Animated.View>

      {/* Text content */}
      <Animated.View style={[styles.textContainer, textStyle]}>
        <Text style={styles.slideTitle}>{data.title}</Text>
        <Text style={styles.slideSubtitle}>{data.subtitle}</Text>
      </Animated.View>
    </View>
  );
}

// ── Page Indicator ────────────────────────────────────────────

interface DotProps {
  index: number;
  scrollX: SharedValue<number>;
}

function Dot({ index, scrollX }: DotProps): React.JSX.Element {
  const offset = index * SCREEN_WIDTH;

  const dotStyle = useAnimatedStyle(() => {
    const inputRange = [offset - SCREEN_WIDTH, offset, offset + SCREEN_WIDTH];
    return {
      width: interpolate(scrollX.value, inputRange, [8, 28, 8], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], Extrapolation.CLAMP),
      backgroundColor: ACCENT,
    };
  });

  return <Animated.View style={[styles.dot, dotStyle]} />;
}

// ── Main Component ────────────────────────────────────────────

export function WelcomeScreen(): React.JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'Onboarding'>>();
  const completeFirstLaunch = useSettingsStore(s => s.completeFirstLaunch);
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollX = useSharedValue(0);

  // Entrance animations
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(30);

  useEffect(() => {
    contentOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    contentTranslateY.value = withDelay(200, withSpring(0, { damping: 15, stiffness: 100 }));
    trackEvent('onboarding_started');
  }, [contentOpacity, contentTranslateY]);

  // Hardware back button: go to previous slide, or do nothing on first slide
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentPage > 0) {
        const prevPage = currentPage - 1;
        scrollViewRef.current?.scrollTo({ x: prevPage * SCREEN_WIDTH, animated: true });
        return true; // handled
      }
      return true; // block exit on first slide (onboarding is mandatory)
    });
    return () => handler.remove();
  }, [currentPage]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  // CTA button animation (only visible on last slide)
  const ctaStyle = useAnimatedStyle(() => {
    const lastSlideOffset = (TOTAL_SLIDES - 1) * SCREEN_WIDTH;
    const inputRange = [lastSlideOffset - SCREEN_WIDTH, lastSlideOffset];
    return {
      opacity: interpolate(scrollX.value, inputRange, [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(scrollX.value, inputRange, [20, 0], Extrapolation.CLAMP) },
      ],
    };
  });

  // "Next" button animation (hidden on last slide)
  const nextStyle = useAnimatedStyle(() => {
    const lastSlideOffset = (TOTAL_SLIDES - 1) * SCREEN_WIDTH;
    const inputRange = [lastSlideOffset - SCREEN_WIDTH, lastSlideOffset];
    return {
      opacity: interpolate(scrollX.value, inputRange, [1, 0], Extrapolation.CLAMP),
    };
  });

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      scrollX.value = offsetX;
      const page = Math.round(offsetX / SCREEN_WIDTH);
      if (page !== currentPage) {
        runOnJS(setCurrentPage)(page);
      }
    },
    [scrollX, currentPage],
  );

  const handleNext = useCallback(() => {
    const nextPage = Math.min(currentPage + 1, TOTAL_SLIDES - 1);
    scrollViewRef.current?.scrollTo({ x: nextPage * SCREEN_WIDTH, animated: true });
  }, [currentPage]);

  const handleGetStarted = useCallback(() => {
    trackEvent('onboarding_completed');
    completeFirstLaunch();
    // Record install timestamp for engagement triggers
    useSettingsStore.getState().recordFirstLaunchTimestamp();
    // Mark paywall pending so subscription screen shows on first vault open
    useSettingsStore.getState().setPaywallPending(true);
    // Schedule re-engagement notifications (Day 1, 3, 7, 14, 30)
    import('@services/notifications/reengagementService')
      .then(({ scheduleReengagementNotifications }) => scheduleReengagementNotifications())
      .catch(() => {});
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Calculator' },
        { name: 'PinSetup', params: { isInitialSetup: true } },
      ],
    });
  }, [completeFirstLaunch, navigation]);

  const handleSkip = useCallback(() => {
    scrollViewRef.current?.scrollTo({
      x: (TOTAL_SLIDES - 1) * SCREEN_WIDTH,
      animated: true,
    });
  }, []);

  const isLastSlide = currentPage === TOTAL_SLIDES - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} translucent={false} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Animated.View style={[styles.fullFlex, entranceStyle]}>
          {/* Skip button (top-right) */}
          {!isLastSlide && (
            <Animated.View style={[styles.skipContainer, nextStyle]}>
              <Pressable onPress={handleSkip} style={styles.skipButton} accessibilityRole="button" accessibilityLabel="Skip onboarding">
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Slides */}
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            bounces={false}
            decelerationRate="fast"
            style={styles.fullFlex}
          >
            {SLIDES.map((slide, index) => (
              <Slide key={index} data={slide} index={index} scrollX={scrollX} />
            ))}
          </ScrollView>

          {/* Bottom section: indicators + buttons */}
          <View style={styles.bottomSection}>
            {/* Page indicators */}
            <View style={styles.pagination}>
              {SLIDES.map((_, index) => (
                <Dot key={index} index={index} scrollX={scrollX} />
              ))}
            </View>

            {/* Button area — fixed height container with stacked buttons */}
            <View style={styles.buttonArea}>
              {/* CTA button (last slide) */}
              <Animated.View style={[styles.buttonWrapper, ctaStyle]} pointerEvents={isLastSlide ? 'auto' : 'none'}>
                <Pressable
                  onPress={handleGetStarted}
                  style={({ pressed }) => [
                    styles.ctaButton,
                    pressed && styles.ctaButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Secure my files"
                >
                  <Text style={styles.ctaText}>Secure My Files</Text>
                </Pressable>
              </Animated.View>

              {/* Next button (non-last slides) */}
              <Animated.View style={[styles.buttonWrapper, styles.buttonAbsolute, nextStyle]} pointerEvents={isLastSlide ? 'none' : 'auto'}>
                <Pressable
                  onPress={handleNext}
                  style={({ pressed }) => [
                    styles.nextButton,
                    pressed && styles.nextButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Next slide"
                >
                  <Text style={styles.nextText}>Next</Text>
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  safeArea: {
    flex: 1,
  },
  fullFlex: {
    flex: 1,
  },

  // Skip
  skipContainer: {
    position: 'absolute',
    top: 8,
    right: 16,
    zIndex: 10,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_MUTED,
    letterSpacing: 0.3,
  },

  // Slide
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  illustrationContainer: {
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  slideTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: TEXT_WHITE,
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  slideSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.2,
    maxWidth: 300,
  },

  // Bottom
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  // Button area — contains both buttons stacked, only one visible at a time
  buttonArea: {
    width: '100%',
    height: 56,
  },
  buttonWrapper: {
    width: '100%',
  },
  buttonAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },

  // CTA (last slide)
  ctaButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaButtonPressed: {
    backgroundColor: ACCENT_PRESSED,
    transform: [{ scale: 0.97 }],
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Next (non-last slides)
  nextButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonPressed: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    transform: [{ scale: 0.97 }],
  },
  nextText: {
    fontSize: 17,
    fontWeight: '600',
    color: ACCENT,
    letterSpacing: 0.3,
  },
});
