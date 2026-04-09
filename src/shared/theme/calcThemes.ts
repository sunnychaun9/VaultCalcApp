/**
 * VaultCalc - Calculator Themes
 *
 * Calculator-specific color overrides for each theme.
 * These override the calc* tokens from the base light/dark palette.
 * Non-calc tokens (text, surface, etc.) are also overridden as needed
 * to keep the calculator UI cohesive.
 */

import type { CalcTheme } from '@store/settingsStore';

/** Subset of ColorTokens that calculator themes can override */
export interface CalcThemeColors {
  calcBackground: string;
  calcBackgroundGradientEnd: string;
  calcDisplay: string;
  calcDisplayGlass: string;
  calcDisplayGlassBorder: string;
  calcButtonPrimary: string;
  calcButtonOperator: string;
  calcButtonOperatorText: string;
  calcButtonEquals: string;
  calcButtonEqualsPressed: string;
  calcButtonEqualsGlow: string;
  calcButtonEqualsText: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  surfaceContainerHigh: string;
  border: string;
  accent: string;
}

type CalcThemeSet = {
  light: CalcThemeColors;
  dark: CalcThemeColors;
  label: string;
  preview: { light: string; dark: string }; // preview dot color
};

export const calcThemes: Record<CalcTheme, CalcThemeSet> = {
  default: {
    label: 'Default',
    preview: { light: '#22C55E', dark: '#22C55E' },
    light: {
      calcBackground: '#FAFAFA',
      calcBackgroundGradientEnd: '#F5F5F5',
      calcDisplay: '#FFFFFF',
      calcDisplayGlass: 'rgba(0, 0, 0, 0.02)',
      calcDisplayGlassBorder: 'rgba(0, 0, 0, 0.06)',
      calcButtonPrimary: '#F5F5F5',
      calcButtonOperator: '#F5F5F5',
      calcButtonOperatorText: '#16A34A',
      calcButtonEquals: '#22C55E',
      calcButtonEqualsPressed: '#16A34A',
      calcButtonEqualsGlow: 'rgba(34, 197, 94, 0.15)',
      calcButtonEqualsText: '#FFFFFF',
      textPrimary: '#1A1A1A',
      textSecondary: '#6B6B6B',
      textTertiary: '#9E9E9E',
      surfaceContainerHigh: '#EBEBEB',
      border: '#E5E5E5',
      accent: '#2563EB',
    },
    dark: {
      calcBackground: '#0D0D0D',
      calcBackgroundGradientEnd: '#111116',
      calcDisplay: '#151518',
      calcDisplayGlass: 'rgba(255, 255, 255, 0.04)',
      calcDisplayGlassBorder: 'rgba(255, 255, 255, 0.08)',
      calcButtonPrimary: '#1C1C1E',
      calcButtonOperator: '#1C1C1E',
      calcButtonOperatorText: '#4ADE80',
      calcButtonEquals: '#22C55E',
      calcButtonEqualsPressed: '#16A34A',
      calcButtonEqualsGlow: 'rgba(34, 197, 94, 0.25)',
      calcButtonEqualsText: '#FFFFFF',
      textPrimary: '#F5F5F5',
      textSecondary: '#A3A3A3',
      textTertiary: '#737373',
      surfaceContainerHigh: '#2A2A2A',
      border: '#2A2A2A',
      accent: '#3B82F6',
    },
  },

  rose: {
    label: 'Rose',
    preview: { light: '#6B6A2A', dark: '#D4CE8E' },
    light: {
      calcBackground: '#FDE8E4',
      calcBackgroundGradientEnd: '#FADDD7',
      calcDisplay: '#FDE8E4',
      calcDisplayGlass: 'rgba(120, 60, 40, 0.04)',
      calcDisplayGlassBorder: 'rgba(120, 60, 40, 0.08)',
      calcButtonPrimary: '#F5CCC6',
      calcButtonOperator: '#F0BEB6',
      calcButtonOperatorText: '#3D2B1F',
      calcButtonEquals: '#6B6A2A',
      calcButtonEqualsPressed: '#565520',
      calcButtonEqualsGlow: 'rgba(107, 106, 42, 0.2)',
      calcButtonEqualsText: '#FFFFFF',
      textPrimary: '#3D2B1F',
      textSecondary: '#7A5C4F',
      textTertiary: '#A08578',
      surfaceContainerHigh: '#F0C5BD',
      border: '#E8B5AC',
      accent: '#6B6A2A',
    },
    dark: {
      calcBackground: '#1E1412',
      calcBackgroundGradientEnd: '#1A1110',
      calcDisplay: '#241A17',
      calcDisplayGlass: 'rgba(232, 213, 202, 0.05)',
      calcDisplayGlassBorder: 'rgba(232, 213, 202, 0.08)',
      calcButtonPrimary: '#3D2E26',
      calcButtonOperator: '#4A3830',
      calcButtonOperatorText: '#E8D5CA',
      calcButtonEquals: '#D4CE8E',
      calcButtonEqualsPressed: '#BFB870',
      calcButtonEqualsGlow: 'rgba(212, 206, 142, 0.2)',
      calcButtonEqualsText: '#2C1F1A',
      textPrimary: '#E8D5CA',
      textSecondary: '#A08578',
      textTertiary: '#6B5548',
      surfaceContainerHigh: '#352722',
      border: '#3D2E26',
      accent: '#D4CE8E',
    },
  },

  ocean: {
    label: 'Ocean',
    preview: { light: '#0369A1', dark: '#38BDF8' },
    light: {
      calcBackground: '#E0F2FE',
      calcBackgroundGradientEnd: '#D4EDFC',
      calcDisplay: '#E0F2FE',
      calcDisplayGlass: 'rgba(3, 105, 161, 0.04)',
      calcDisplayGlassBorder: 'rgba(3, 105, 161, 0.08)',
      calcButtonPrimary: '#BAE6FD',
      calcButtonOperator: '#A5DDFB',
      calcButtonOperatorText: '#0C4A6E',
      calcButtonEquals: '#0369A1',
      calcButtonEqualsPressed: '#075985',
      calcButtonEqualsGlow: 'rgba(3, 105, 161, 0.2)',
      calcButtonEqualsText: '#FFFFFF',
      textPrimary: '#0C4A6E',
      textSecondary: '#3B7A9E',
      textTertiary: '#6BA3C0',
      surfaceContainerHigh: '#A5DDFB',
      border: '#93D3F8',
      accent: '#0369A1',
    },
    dark: {
      calcBackground: '#0C1B2A',
      calcBackgroundGradientEnd: '#0A1622',
      calcDisplay: '#112233',
      calcDisplayGlass: 'rgba(56, 189, 248, 0.05)',
      calcDisplayGlassBorder: 'rgba(56, 189, 248, 0.08)',
      calcButtonPrimary: '#1A3044',
      calcButtonOperator: '#1E3A52',
      calcButtonOperatorText: '#7DD3FC',
      calcButtonEquals: '#0284C7',
      calcButtonEqualsPressed: '#0369A1',
      calcButtonEqualsGlow: 'rgba(56, 189, 248, 0.2)',
      calcButtonEqualsText: '#FFFFFF',
      textPrimary: '#E0F2FE',
      textSecondary: '#7DD3FC',
      textTertiary: '#3B7A9E',
      surfaceContainerHigh: '#1A3044',
      border: '#1E3A52',
      accent: '#38BDF8',
    },
  },

  monokai: {
    label: 'Monokai',
    preview: { light: '#7C3AED', dark: '#A78BFA' },
    light: {
      calcBackground: '#F3F0FF',
      calcBackgroundGradientEnd: '#ECE8FC',
      calcDisplay: '#F3F0FF',
      calcDisplayGlass: 'rgba(124, 58, 237, 0.04)',
      calcDisplayGlassBorder: 'rgba(124, 58, 237, 0.08)',
      calcButtonPrimary: '#E2DDFA',
      calcButtonOperator: '#D4CCFA',
      calcButtonOperatorText: '#4C1D95',
      calcButtonEquals: '#7C3AED',
      calcButtonEqualsPressed: '#6D28D9',
      calcButtonEqualsGlow: 'rgba(124, 58, 237, 0.2)',
      calcButtonEqualsText: '#FFFFFF',
      textPrimary: '#2E1065',
      textSecondary: '#6B4EA0',
      textTertiary: '#9B8AC4',
      surfaceContainerHigh: '#D4CCFA',
      border: '#C4B5FC',
      accent: '#7C3AED',
    },
    dark: {
      calcBackground: '#13111C',
      calcBackgroundGradientEnd: '#100E18',
      calcDisplay: '#1A1726',
      calcDisplayGlass: 'rgba(167, 139, 250, 0.05)',
      calcDisplayGlassBorder: 'rgba(167, 139, 250, 0.08)',
      calcButtonPrimary: '#272040',
      calcButtonOperator: '#302850',
      calcButtonOperatorText: '#C4B5FC',
      calcButtonEquals: '#7C3AED',
      calcButtonEqualsPressed: '#6D28D9',
      calcButtonEqualsGlow: 'rgba(124, 58, 237, 0.25)',
      calcButtonEqualsText: '#FFFFFF',
      textPrimary: '#EDE9FE',
      textSecondary: '#A78BFA',
      textTertiary: '#6B4EA0',
      surfaceContainerHigh: '#272040',
      border: '#302850',
      accent: '#A78BFA',
    },
  },
};
