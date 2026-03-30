/**
 * VaultCalc - Color Tokens
 *
 * Semantic color system based on Material Design 3.
 * Always use tokens, never raw hex values.
 *
 * @see 03-Design-System.md Section 1
 */

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
    calcButtonEquals: '#3B82F6',
    calcButtonEqualsPressed: '#2563EB',
    calcButtonEqualsText: '#FFFFFF',

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
    accent: '#2563EB',
    success: '#16A34A',
    warning: '#CA8A04',
    error: '#DC2626',

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
    calcButtonEquals: '#3B82F6',
    calcButtonEqualsPressed: '#2563EB',
    calcButtonEqualsText: '#FFFFFF',

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
} as const;

export type ColorTheme = keyof typeof colors;
export type ColorTokens = { [K in keyof typeof colors.light]: string };
