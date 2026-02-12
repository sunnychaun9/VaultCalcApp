# VaultCalc Design System

**Version:** 1.0
**Platform:** Android (React Native)
**Base:** Material Design 3
**Last Updated:** February 2026

---

## 1. Color Palette

### 1.1 Semantic Color Tokens

All colors defined as tokens. Use tokens, never raw hex values.

```typescript
// colors.ts

export const colors = {
  light: {
    // Surfaces
    surface: '#FFFFFF',
    surfaceContainer: '#F3F3F3',
    surfaceContainerHigh: '#EBEBEB',
    surfaceContainerLow: '#F9F9F9',

    // Calculator specific
    calcBackground: '#FAFAFA',
    calcDisplay: '#FFFFFF',
    calcButtonPrimary: '#F5F5F5',
    calcButtonOperator: '#E8E8E8',
    calcButtonEquals: '#1A1A1A',
    calcButtonEqualsPressed: '#333333',

    // Text
    textPrimary: '#1A1A1A',
    textSecondary: '#6B6B6B',
    textTertiary: '#9E9E9E',
    textOnDark: '#FFFFFF',
    textOnAccent: '#FFFFFF',

    // Vault specific
    vaultBackground: '#FAFAFA',
    vaultCardBackground: '#FFFFFF',
    vaultFolderIcon: '#5C5C5C',

    // Semantic
    accent: '#2563EB',          // Blue - links, selection
    success: '#16A34A',         // Green - confirmations
    warning: '#CA8A04',         // Amber - warnings
    error: '#DC2626',           // Red - destructive

    // Borders & Dividers
    border: '#E5E5E5',
    borderSubtle: '#F0F0F0',
    divider: '#EEEEEE',

    // Overlays
    scrim: 'rgba(0, 0, 0, 0.5)',
    overlay: 'rgba(0, 0, 0, 0.04)',
  },

  dark: {
    // Surfaces
    surface: '#121212',
    surfaceContainer: '#1E1E1E',
    surfaceContainerHigh: '#2A2A2A',
    surfaceContainerLow: '#171717',

    // Calculator specific
    calcBackground: '#121212',
    calcDisplay: '#1A1A1A',
    calcButtonPrimary: '#2A2A2A',
    calcButtonOperator: '#333333',
    calcButtonEquals: '#FFFFFF',
    calcButtonEqualsPressed: '#E0E0E0',

    // Text
    textPrimary: '#F5F5F5',
    textSecondary: '#A3A3A3',
    textTertiary: '#737373',
    textOnDark: '#FFFFFF',
    textOnAccent: '#FFFFFF',

    // Vault specific
    vaultBackground: '#121212',
    vaultCardBackground: '#1E1E1E',
    vaultFolderIcon: '#A3A3A3',

    // Semantic
    accent: '#3B82F6',
    success: '#22C55E',
    warning: '#EAB308',
    error: '#EF4444',

    // Borders & Dividers
    border: '#2A2A2A',
    borderSubtle: '#1F1F1F',
    divider: '#262626',

    // Overlays
    scrim: 'rgba(0, 0, 0, 0.7)',
    overlay: 'rgba(255, 255, 255, 0.04)',
  },

  amoled: {
    // Surfaces - true black for OLED power saving
    surface: '#000000',
    surfaceContainer: '#0A0A0A',
    surfaceContainerHigh: '#141414',
    surfaceContainerLow: '#050505',

    // Calculator specific
    calcBackground: '#000000',
    calcDisplay: '#000000',
    calcButtonPrimary: '#1A1A1A',
    calcButtonOperator: '#242424',
    calcButtonEquals: '#FFFFFF',
    calcButtonEqualsPressed: '#E0E0E0',

    // Text
    textPrimary: '#FFFFFF',
    textSecondary: '#A3A3A3',
    textTertiary: '#6B6B6B',
    textOnDark: '#FFFFFF',
    textOnAccent: '#FFFFFF',

    // Vault specific
    vaultBackground: '#000000',
    vaultCardBackground: '#0A0A0A',
    vaultFolderIcon: '#A3A3A3',

    // Semantic - slightly brighter for contrast on black
    accent: '#60A5FA',
    success: '#4ADE80',
    warning: '#FACC15',
    error: '#F87171',

    // Borders & Dividers
    border: '#1A1A1A',
    borderSubtle: '#0F0F0F',
    divider: '#141414',

    // Overlays
    scrim: 'rgba(0, 0, 0, 0.85)',
    overlay: 'rgba(255, 255, 255, 0.03)',
  },
} as const;
```

### 1.2 Material You Dynamic Color (Optional)

When user enables system dynamic colors:

```typescript
// dynamicColors.ts

import { useMaterial3Theme } from '@pchmn/expo-material3-theme';

export function useDynamicColors() {
  const { theme } = useMaterial3Theme();

  // Only apply dynamic colors to accent elements
  return {
    accent: theme?.primary || colors.light.accent,
    accentContainer: theme?.primaryContainer || colors.light.surfaceContainer,
    // Keep calculator neutrals static for consistency
  };
}
```

**Rule:** Dynamic colors apply ONLY to:
- Selection highlights
- Active tab indicators
- Primary buttons (non-calculator)
- Links

**Never apply to:**
- Calculator buttons
- Vault backgrounds
- Text colors

---

## 2. Typography System

### 2.1 Font Stack

```typescript
// typography.ts

export const fontFamily = {
  // Primary: System default for performance
  regular: 'System',
  medium: 'System',
  semibold: 'System',

  // Calculator display: Monospace for number alignment
  mono: Platform.select({
    android: 'RobotoMono-Regular',
    default: 'monospace',
  }),
  monoMedium: Platform.select({
    android: 'RobotoMono-Medium',
    default: 'monospace',
  }),
};
```

### 2.2 Type Scale

```typescript
export const typography = {
  // Calculator Display
  calcDisplayLarge: {
    fontFamily: fontFamily.mono,
    fontSize: 56,
    lineHeight: 64,
    fontWeight: '400',
    letterSpacing: -1,
  },
  calcDisplayMedium: {
    fontFamily: fontFamily.mono,
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '400',
    letterSpacing: -0.5,
  },
  calcDisplaySmall: {
    fontFamily: fontFamily.mono,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '400',
    letterSpacing: 0,
  },
  calcButton: {
    fontFamily: fontFamily.regular,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: 0,
  },
  calcButtonSmall: {
    fontFamily: fontFamily.regular,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: 0.15,
  },

  // App UI
  headlineLarge: {
    fontFamily: fontFamily.regular,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '400',
    letterSpacing: 0,
  },
  headlineMedium: {
    fontFamily: fontFamily.regular,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '400',
    letterSpacing: 0,
  },
  titleLarge: {
    fontFamily: fontFamily.medium,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '500',
    letterSpacing: 0,
  },
  titleMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: 0.15,
  },
  titleSmall: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  bodyLarge: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  bodyMedium: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: 0.25,
  },
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0.4,
  },
  labelLarge: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
} as const;
```

### 2.3 Calculator Display Scaling

Display text scales based on digit count:

```typescript
export function getCalcDisplayStyle(digitCount: number) {
  if (digitCount <= 8) return typography.calcDisplayLarge;
  if (digitCount <= 12) return typography.calcDisplayMedium;
  return typography.calcDisplaySmall;
}
```

---

## 3. Spacing & Layout

### 3.1 Spacing Scale

```typescript
// spacing.ts

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
```

### 3.2 Layout Constants

```typescript
export const layout = {
  // Screen padding
  screenPaddingHorizontal: spacing.base,  // 16
  screenPaddingVertical: spacing.base,    // 16

  // Calculator
  calcButtonGap: spacing.sm,              // 8
  calcButtonHeight: 64,
  calcButtonHeightCompact: 56,
  calcDisplayPadding: spacing.xl,         // 24
  calcDisplayMinHeight: 120,

  // Vault grid
  vaultGridColumns: 3,
  vaultGridGap: spacing.xs,               // 4
  vaultThumbnailAspectRatio: 1,           // Square
  vaultListItemHeight: 72,

  // Cards
  cardPadding: spacing.base,              // 16
  cardBorderRadius: 16,

  // Buttons
  buttonHeight: 48,
  buttonHeightSmall: 36,
  buttonBorderRadius: 24,                 // Pill shape

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
```

### 3.3 Calculator Layout Grid

```
┌─────────────────────────────────────────────────────────────┐
│                    STATUS BAR (system)                      │
├─────────────────────────────────────────────────────────────┤
│  16dp padding                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │                  DISPLAY AREA                       │   │  flex: 1
│  │                  (min 120dp)                        │   │  (expands)
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│  8dp gap                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  MC  │  MR  │  M+  │  M-  │  C   │  ⌫  │           │   │  64dp row
│  ├──────┼──────┼──────┼──────┼──────┼──────┤           │   │
│  │  7   │  8   │  9   │  ÷   │                        │   │  64dp row
│  ├──────┼──────┼──────┼──────┤                        │   │
│  │  4   │  5   │  6   │  ×   │                        │   │  64dp row
│  ├──────┼──────┼──────┼──────┤                        │   │
│  │  1   │  2   │  3   │  −   │                        │   │  64dp row
│  ├──────┼──────┼──────┼──────┤                        │   │
│  │  %   │  0   │  .   │  +   │                        │   │  64dp row
│  ├──────┴──────┴──────┴──────┤                        │   │
│  │            =              │                        │   │  64dp row
│  └───────────────────────────┘                        │   │
│  NAV BAR SAFE AREA                                         │
└─────────────────────────────────────────────────────────────┘

Button grid: 4 columns, 8dp gap
Each button: (screenWidth - 32dp padding - 24dp gaps) / 4
```

---

## 4. Iconography

### 4.1 Icon Library

Use **Material Symbols Rounded** (variable font) at weight 400.

```typescript
// icons.ts

export const iconConfig = {
  family: 'MaterialSymbolsRounded',
  defaultSize: 24,
  defaultWeight: 400,
  fill: 0,  // Outlined by default
};

export const iconSizes = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
  xxl: 48,
} as const;
```

### 4.2 Icon Usage Map

| Context | Icon | Size | Fill |
|---------|------|------|------|
| Calculator back to vault | `calculate` | 24 | 0 |
| Vault home | `folder` | 24 | 0 |
| Settings | `settings` | 24 | 0 |
| Add/Import | `add` | 24 | 0 |
| Share | `share` | 24 | 0 |
| Delete | `delete` | 24 | 0 |
| More options | `more_vert` | 24 | 0 |
| Back | `arrow_back` | 24 | 0 |
| Close | `close` | 24 | 0 |
| Check/Select | `check_circle` | 24 | 1 |
| Unselected | `radio_button_unchecked` | 24 | 0 |
| Lock | `lock` | 24 | 0 |
| Fingerprint | `fingerprint` | 48 | 0 |
| Image file | `image` | 24 | 0 |
| Video file | `videocam` | 24 | 0 |
| Document file | `description` | 24 | 0 |
| Audio file | `audio_file` | 24 | 0 |
| Folder | `folder` | 24 | 1 |
| Premium/Star | `workspace_premium` | 24 | 0 |

---

## 5. Motion & Animation

### 5.1 Timing Functions

```typescript
// motion.ts
import { Easing } from 'react-native-reanimated';

export const easing = {
  // Standard easing for most animations
  standard: Easing.bezier(0.2, 0.0, 0.0, 1.0),

  // Decelerate - elements entering screen
  decelerate: Easing.bezier(0.0, 0.0, 0.0, 1.0),

  // Accelerate - elements leaving screen
  accelerate: Easing.bezier(0.3, 0.0, 1.0, 1.0),

  // Linear - progress indicators
  linear: Easing.linear,
};
```

### 5.2 Duration Scale

```typescript
export const duration = {
  instant: 0,
  fastest: 100,    // Button press feedback
  fast: 150,       // Small UI changes
  normal: 200,     // Standard transitions
  slow: 300,       // Screen transitions
  slower: 400,     // Complex animations
  slowest: 500,    // Emphasized animations
} as const;
```

### 5.3 Animation Specifications

#### Calculator Button Press

```typescript
const calcButtonPress = {
  scale: {
    from: 1,
    to: 0.95,
    duration: duration.fastest,
    easing: easing.standard,
  },
  backgroundColor: {
    // Darken by overlay
    duration: duration.instant,
  },
};
```

#### Vault Unlock Transition

```typescript
// CRITICAL: No revealing animation
const vaultUnlock = {
  type: 'crossFade',
  duration: duration.fast,
  // Calculator fades out while vault fades in simultaneously
  // No slide, no zoom, no direction indicator
};
```

### 5.4 Haptic Feedback

```typescript
import * as Haptics from 'expo-haptics';

export const haptics = {
  buttonPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  operatorPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  equalsPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  selection: () => Haptics.selectionAsync(),
};
```

### 5.5 Forbidden Animations

| Animation | Reason |
|-----------|--------|
| Vault door opening | Suggests "hidden" content |
| Lock unlocking | Draws attention to security |
| Slide reveal | Indicates transition direction |
| Bounce effects | Not premium aesthetic |
| Skeleton loaders in vault | Implies decryption happening |

---

## 6. Calculator UI Realism Rules

### 6.1 Display Behavior

```typescript
const calcDisplayRules = {
  // Number formatting
  maxDigits: 15,
  maxDisplayDigits: 12,  // Before scientific notation
  decimalSeparator: '.',  // Localize as needed
  thousandsSeparator: ',',

  // Display states
  states: {
    empty: '0',
    error: 'Error',
    infinity: '∞',
    negativeInfinity: '-∞',
  },

  // Expression display (above result)
  expressionMaxLength: 50,
  expressionOpacity: 0.6,
};
```

### 6.2 Button States

| State | Visual Treatment |
|-------|------------------|
| Default | Flat background, full opacity text |
| Pressed | 4% darker background, scale 0.95 |
| Disabled | 38% opacity (memory buttons when empty) |
| Active | Accent color (for toggles like DEG/RAD) |

### 6.3 Button Grid Rules

```typescript
const calcButtonGrid = {
  // Standard portrait
  columns: 4,
  rows: 6,  // Including memory row
  gap: spacing.sm,

  // Button proportions
  aspectRatio: 1.2,  // Width : Height = 1 : 1.2
  equalsSpan: 4,     // Full width

  // Typography
  numbers: typography.calcButton,
  operators: typography.calcButton,
  functions: typography.calcButtonSmall,

  // Colors per button type
  types: {
    number: 'calcButtonPrimary',
    operator: 'calcButtonOperator',
    equals: 'calcButtonEquals',
    function: 'calcButtonPrimary',  // MC, MR, etc.
    clear: 'calcButtonPrimary',
  },
};
```

---

## 7. Vault UI Visual Hierarchy

### 7.1 Information Hierarchy

```
LEVEL 1 (Most prominent)
├── File thumbnails
├── Folder icons
└── Primary action button (+ Add)

LEVEL 2 (Secondary)
├── Tab bar (Images/Videos/Docs/Audio)
├── File names
└── Selection checkmarks

LEVEL 3 (Tertiary)
├── File metadata (size, date)
├── Storage indicator
└── Navigation icons

LEVEL 4 (Ambient)
├── Background surfaces
├── Dividers
└── Empty state illustrations
```

### 7.2 Thumbnail Grid

```typescript
const vaultGrid = {
  columns: 3,
  gap: spacing.xs,  // 4dp - tight grid

  thumbnail: {
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: 'surfaceContainer',

    // Overlay gradient for filename legibility
    labelGradient: {
      colors: ['transparent', 'rgba(0,0,0,0.6)'],
      start: { x: 0, y: 0.6 },
      end: { x: 0, y: 1 },
    },
  },

  folder: {
    iconSize: iconSizes.xxl,  // 48dp
    iconColor: 'vaultFolderIcon',
    backgroundColor: 'surfaceContainerHigh',
  },

  label: {
    ...typography.labelSmall,
    numberOfLines: 1,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
};
```

### 7.3 Selection Mode

```typescript
const selectionMode = {
  // Checkmark overlay
  checkmark: {
    size: 24,
    backgroundColor: 'accent',
    iconColor: 'textOnAccent',
    position: { top: 8, right: 8 },
    borderRadius: 12,
  },

  // Selected item treatment
  selectedOverlay: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',  // accent at 10%
    borderWidth: 2,
    borderColor: 'accent',
  },

  // Action bar
  actionBar: {
    height: layout.bottomBarHeight,
    backgroundColor: 'surfaceContainer',
    actions: ['Share', 'Move', 'Delete'],
  },
};
```

---

## 8. Component Specifications

### 8.1 Primary Button

```typescript
const primaryButton = {
  height: layout.buttonHeight,
  borderRadius: layout.buttonBorderRadius,
  paddingHorizontal: spacing.xl,

  backgroundColor: 'accent',

  text: {
    ...typography.labelLarge,
    color: 'textOnAccent',
  },

  states: {
    pressed: {
      backgroundColor: 'accentDark',  // 10% darker
    },
    disabled: {
      opacity: 0.38,
    },
  },
};
```

### 8.2 Settings Row

```typescript
const settingsRow = {
  minHeight: 56,
  paddingHorizontal: spacing.base,
  paddingVertical: spacing.md,

  label: {
    ...typography.bodyLarge,
    color: 'textPrimary',
  },

  description: {
    ...typography.bodySmall,
    color: 'textSecondary',
    marginTop: spacing.xxs,
  },

  chevron: {
    icon: 'chevron_right',
    size: iconSizes.md,
    color: 'textTertiary',
  },

  toggle: {
    // Use system Switch component
    trackColorOff: 'border',
    trackColorOn: 'accent',
    thumbColor: 'surface',
  },
};
```

### 8.3 Tab Bar

```typescript
const tabBar = {
  height: layout.tabBarHeight,
  backgroundColor: 'surface',
  borderBottomWidth: 1,
  borderBottomColor: 'border',

  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  label: {
    ...typography.labelLarge,
    colorInactive: 'textSecondary',
    colorActive: 'textPrimary',
  },

  indicator: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'accent',
  },
};
```

### 8.4 Bottom Sheet

```typescript
const bottomSheet = {
  borderTopLeftRadius: layout.bottomSheetRadius,
  borderTopRightRadius: layout.bottomSheetRadius,
  backgroundColor: 'surface',

  handle: {
    width: layout.bottomSheetHandleWidth,
    height: layout.bottomSheetHandleHeight,
    borderRadius: 2,
    backgroundColor: 'textTertiary',
    marginTop: spacing.sm,
    marginBottom: spacing.base,
    alignSelf: 'center',
  },

  scrim: {
    backgroundColor: 'scrim',
  },
};
```

---

## 9. Accessibility

### 9.1 Minimum Requirements

```typescript
const accessibility = {
  // Touch targets
  minTouchTarget: 48,

  // Contrast ratios (WCAG AA)
  contrastRatio: {
    normalText: 4.5,
    largeText: 3.0,
    uiComponents: 3.0,
  },

  // Focus indicators
  focusRing: {
    width: 2,
    color: 'accent',
    offset: 2,
  },

  // Reduced motion
  reducedMotion: {
    // Replace animations with instant changes
    duration: duration.instant,
  },
};
```

### 9.2 Semantic Labels

```typescript
const semanticLabels = {
  calculator: {
    display: 'Calculator display, showing {value}',
    button: '{label} button',
    clear: 'Clear',
    backspace: 'Delete last digit',
  },
  vault: {
    grid: 'File grid, {count} items',
    thumbnail: '{filename}, {type}, {size}',
    folder: '{name} folder, {count} items',
    selectAll: 'Select all files',
  },
};
```

---

## Quick Reference Card

### Colors (Light)
| Token | Hex | Usage |
|-------|-----|-------|
| `surface` | `#FFFFFF` | Main backgrounds |
| `textPrimary` | `#1A1A1A` | Primary text |
| `accent` | `#2563EB` | Interactive elements |
| `calcButtonEquals` | `#1A1A1A` | Equals button |

### Typography
| Style | Size/Weight | Usage |
|-------|-------------|-------|
| `calcDisplayLarge` | 56/400 | Calculator result |
| `calcButton` | 24/400 | Calculator buttons |
| `titleMedium` | 16/500 | Section headers |
| `bodyMedium` | 14/400 | Body text |

### Spacing
| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 8dp | Tight gaps |
| `base` | 16dp | Standard padding |
| `xl` | 24dp | Section spacing |

### Animation
| Type | Duration | Easing |
|------|----------|--------|
| Button press | 100ms | Standard |
| Screen transition | 300ms | Decelerate |
| Vault unlock | 150ms | Crossfade only |

---

*Design system complete. Ready for implementation.*
