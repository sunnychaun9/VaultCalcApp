/**
 * VaultCalc - Calculator Theme Colors Hook
 *
 * Returns theme colors with calculator-specific overrides applied
 * based on the user's selected calcTheme.
 */

import { useMemo } from 'react';
import { useThemeColors, colors } from './index';
import { useSettingsStore } from '@store/settingsStore';
import { calcThemes, type CalcThemeColors } from './calcThemes';
import type { ColorTokens } from './index';

/**
 * Returns the full ColorTokens with calculator theme overrides merged in.
 * Use this instead of useThemeColors() in calculator components.
 */
export function useCalcThemeColors(): ColorTokens {
  const baseColors = useThemeColors();
  const calcTheme = useSettingsStore(s => s.calcTheme);
  const isDark = baseColors === colors.dark;

  return useMemo(() => {
    if (calcTheme === 'default') return baseColors;

    const themeSet = calcThemes[calcTheme];
    const overrides: CalcThemeColors = isDark ? themeSet.dark : themeSet.light;

    return { ...baseColors, ...overrides };
  }, [baseColors, calcTheme, isDark]);
}
