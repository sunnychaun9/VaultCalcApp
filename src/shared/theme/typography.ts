/**
 * VaultCalc - Typography System
 *
 * Font stack and type scale based on Material Design 3.
 *
 * @see 03-Design-System.md Section 2
 */

import { Platform, TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  mono: Platform.select({
    android: 'monospace',
    default: 'monospace',
  }),
  monoMedium: Platform.select({
    android: 'monospace',
    default: 'monospace',
  }),
};

export const typography = {
  // Calculator Display
  calcDisplayLarge: {
    fontFamily: fontFamily.mono,
    fontSize: 56,
    lineHeight: 64,
    fontWeight: '300',
    letterSpacing: -1.5,
  } as TextStyle,

  calcDisplayMedium: {
    fontFamily: fontFamily.mono,
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '300',
    letterSpacing: -1,
  } as TextStyle,

  calcDisplaySmall: {
    fontFamily: fontFamily.mono,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '300',
    letterSpacing: -0.5,
  } as TextStyle,

  calcButton: {
    fontFamily: fontFamily.regular,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '500',
    letterSpacing: 0,
  } as TextStyle,

  calcButtonSmall: {
    fontFamily: fontFamily.regular,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: 0,
  } as TextStyle,

  // App UI
  headlineLarge: {
    fontFamily: fontFamily.regular,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '400',
    letterSpacing: 0,
  } as TextStyle,

  headlineMedium: {
    fontFamily: fontFamily.regular,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '400',
    letterSpacing: 0,
  } as TextStyle,

  titleLarge: {
    fontFamily: fontFamily.medium,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '500',
    letterSpacing: 0,
  } as TextStyle,

  titleMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: 0.15,
  } as TextStyle,

  titleSmall: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0.1,
  } as TextStyle,

  bodyLarge: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0.5,
  } as TextStyle,

  bodyMedium: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: 0.25,
  } as TextStyle,

  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0.4,
  } as TextStyle,

  labelLarge: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0.1,
  } as TextStyle,

  labelMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  } as TextStyle,

  labelSmall: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  } as TextStyle,
} as const;

/**
 * Get calculator display style based on digit count
 * Display text scales down as more digits are entered
 */
export function getCalcDisplayStyle(digitCount: number): TextStyle {
  if (digitCount <= 8) return typography.calcDisplayLarge;
  if (digitCount <= 12) return typography.calcDisplayMedium;
  return typography.calcDisplaySmall;
}
