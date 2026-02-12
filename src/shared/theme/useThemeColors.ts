/**
 * VaultCalc - Theme Colors Hook
 *
 * Resolves the active color tokens based on themeMode setting
 * and system preference.
 *
 * @see FEATURE_INDEX.md CALC-008
 */

import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@store/settingsStore';
import { colors, type ColorTokens } from './colors';

export function useThemeColors(): ColorTokens {
  const themeMode = useSettingsStore(state => state.themeMode);
  const systemScheme = useColorScheme();

  if (themeMode === 'system') {
    return systemScheme === 'dark' ? colors.dark : colors.light;
  }
  return colors[themeMode];
}
