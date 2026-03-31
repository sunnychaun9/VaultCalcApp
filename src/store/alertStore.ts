/**
 * VaultCalc - Alert Store
 *
 * Global state for the custom alert modal, replacing React Native's Alert.alert().
 * Provides a theme-aware, consistent alert experience across the app.
 *
 * Usage:
 *   import { alert } from '@store/alertStore';
 *   alert('Title', 'Message', [{ text: 'OK' }]);
 */

import { create } from 'zustand';

/**
 * Alert button style (mirrors RN AlertButton)
 */
export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

/** Visual variant — auto-detected from buttons or set explicitly */
export type AlertVariant = 'info' | 'destructive';

/**
 * Alert state when visible
 */
interface AlertData {
  title: string;
  message?: string;
  buttons: AlertButton[];
  /** Visual variant — 'destructive' shows red accent + warning icon + shake */
  variant: AlertVariant;
}

interface AlertState {
  visible: boolean;
  data: AlertData | null;
  show: (title: string, message?: string, buttons?: AlertButton[]) => void;
  dismiss: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  visible: false,
  data: null,

  show: (title, message, buttons) => {
    const resolvedButtons = buttons ?? [{ text: 'OK' }];
    // Auto-detect destructive variant from button styles
    const hasDestructive = resolvedButtons.some((b) => b.style === 'destructive');
    set({
      visible: true,
      data: {
        title,
        message,
        buttons: resolvedButtons,
        variant: hasDestructive ? 'destructive' : 'info',
      },
    });
  },

  dismiss: () => {
    set({ visible: false, data: null });
  },
}));

/**
 * Drop-in replacement for Alert.alert().
 * Same signature: alert(title, message?, buttons?)
 */
export function alert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  useAlertStore.getState().show(title, message, buttons);
}
