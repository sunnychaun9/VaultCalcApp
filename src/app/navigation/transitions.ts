/**
 * VaultCalc - Navigation Transition Presets
 *
 * Centralized animation config for react-navigation native-stack.
 * Uses native Fragment transitions on Android via react-native-screens.
 *
 * Preset philosophy:
 * - Push screens: slide from right with parallax (iOS-style)
 * - Modal screens: slide up from bottom
 * - Overlay screens: fade in (MediaViewer, vault entry)
 * - Security screens: instant (no animation leaks state)
 */

import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

/**
 * Standard push transition.
 * iOS-style parallax slide — the incoming screen slides in from
 * the right while the outgoing screen shifts left with a subtle fade.
 * More polished than the default Android slide_from_right.
 */
export const pushTransition: NativeStackNavigationOptions = {
  animation: 'ios_from_right',
  animationDuration: 280,
};

/**
 * Fade-from-bottom transition.
 * Screen fades in while sliding slightly upward — Material 3
 * "container transform" feel. Used for immersive content.
 */
export const fadeUpTransition: NativeStackNavigationOptions = {
  animation: 'fade_from_bottom',
  animationDuration: 280,
};

/**
 * Modal slide-up transition.
 * Full-screen modal that slides up from the bottom edge.
 * Used for picker sheets, audio player, gallery import.
 */
export const modalTransition: NativeStackNavigationOptions = {
  animation: 'slide_from_bottom',
  animationDuration: 300,
  presentation: 'fullScreenModal',
};

/**
 * Fade-only transition.
 * Quick crossfade — used for vault entry and the media viewer
 * where content appears "in place" rather than sliding in.
 * Kept fast (150ms) so vault entry feels instant after PIN check.
 */
export const fadeTransition: NativeStackNavigationOptions = {
  animation: 'fade',
  animationDuration: 150,
};

/**
 * No animation — instant swap.
 * Used for security-critical transitions (Calculator ↔ Vault lock)
 * where animation would leak information about app state.
 */
export const noTransition: NativeStackNavigationOptions = {
  animation: 'none',
};
