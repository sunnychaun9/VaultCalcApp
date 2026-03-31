/**
 * VaultCalc - Elevation System
 *
 * 3-level depth system for Material-inspired layered UI.
 * Each level defines Android elevation, iOS shadow, and border treatment.
 *
 * Level 0: Base surface — screen background, no depth
 * Level 1: Raised surface — cards, list sections, headers
 * Level 2: Floating — bottom sheets, FABs, dialogs, overlays
 *
 * Design principle: On dark themes, elevation = lighter surfaces.
 * On light themes, elevation = shadows. Borders provide edge
 * definition regardless of theme.
 */

import type { ViewStyle } from 'react-native';

// ── Shadow definitions ──────────────────────────────────────────

interface ElevationStyle {
  /** Android elevation */
  elevation: number;
  /** iOS shadow */
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
}

/** Level 0 — no shadow at all */
const shadow0: ElevationStyle = {
  elevation: 0,
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
};

/** Level 1 — subtle lift for cards */
const shadow1: ElevationStyle = {
  elevation: 2,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.08,
  shadowRadius: 3,
};

/** Level 2 — prominent float for sheets, FABs, dialogs */
const shadow2: ElevationStyle = {
  elevation: 8,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 12,
};

// ── Complete elevation levels ───────────────────────────────────

export interface ElevationLevel {
  shadow: ElevationStyle;
  /** Border width for edge definition (0 = none) */
  borderWidth: number;
}

export const elevationLevels = {
  /** Base surface — screen background */
  level0: {
    shadow: shadow0,
    borderWidth: 0,
  },
  /** Raised — cards, sections, list groups */
  level1: {
    shadow: shadow1,
    borderWidth: 1,
  },
  /** Floating — FABs, bottom sheets, dialogs */
  level2: {
    shadow: shadow2,
    borderWidth: 0,
  },
} as const;

// ── Theme-aware surface config ──────────────────────────────────

/**
 * Returns surface colors + shadow for a given elevation level and theme.
 * Dark mode: borders are more prominent, shadows are subtle.
 * Light mode: shadows are visible, borders are very faint.
 */
export function getSurfaceStyle(
  level: keyof typeof elevationLevels,
  themeColors: { surface: string; surfaceContainer: string; surfaceContainerHigh: string; border: string; borderSubtle: string },
  isDark: boolean,
): ViewStyle {
  const elev = elevationLevels[level];

  // Surface background per level
  const bg =
    level === 'level0' ? themeColors.surface
    : level === 'level1' ? themeColors.surfaceContainer
    : themeColors.surfaceContainerHigh;

  // Border — more visible in dark mode, very subtle in light
  const borderColor = isDark ? themeColors.border : themeColors.borderSubtle;

  return {
    backgroundColor: bg,
    ...elev.shadow,
    // Adjust shadow for dark mode — reduce since surfaces are already lighter
    ...(isDark && level !== 'level0' ? {
      shadowOpacity: elev.shadow.shadowOpacity * 0.5,
      elevation: Math.max(1, elev.shadow.elevation - 1),
    } : {}),
    ...(elev.borderWidth > 0 ? {
      borderWidth: elev.borderWidth,
      borderColor,
    } : {}),
  };
}
