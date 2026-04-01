/**
 * VaultCalc - Spacing & Layout Constants
 *
 * Consistent spacing scale and layout measurements.
 *
 * @see 03-Design-System.md Section 3
 */

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const layout = {
  // Screen padding
  screenPaddingHorizontal: spacing.base,
  screenPaddingVertical: spacing.base,

  // Calculator
  calcButtonGap: spacing.sm,
  calcButtonHeight: 64,
  calcButtonHeightCompact: 56,
  calcDisplayPadding: spacing.xl,
  calcDisplayMinHeight: 120,

  // Vault grid
  vaultGridColumns: 3,
  vaultGridGap: 6, // 6dp — tight gallery grid, premium feel
  vaultThumbnailAspectRatio: 1,
  vaultListItemHeight: 72,

  // Cards
  cardPadding: spacing.base,
  cardBorderRadius: 16,

  // Buttons
  buttonHeight: 48,
  buttonHeightSmall: 36,
  buttonBorderRadius: 24,

  // Touch targets
  minTouchTarget: 48,

  // Bottom sheet
  bottomSheetRadius: 28,
  bottomSheetHandleWidth: 32,
  bottomSheetHandleHeight: 4,

  // Navigation
  topBarHeight: 56,
  bottomBarHeight: 64,
  tabBarHeight: 48,
} as const;
