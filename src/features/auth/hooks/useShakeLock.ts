/**
 * VaultCalc - Shake Lock Hook
 *
 * Wires native shake detection to vault logout for the panic button feature.
 * When enabled and authenticated, shaking the phone instantly locks the vault
 * and returns to the calculator screen.
 *
 * @see FEATURE_INDEX.md ENH-005
 */

import { useEffect } from 'react';
import { NativeModules, DeviceEventEmitter } from 'react-native';
import { useSettingsStore } from '@store/settingsStore';
import { useAuthStore } from '@store/authStore';

const { ShakeDetectorModule } = NativeModules;

/**
 * Activates shake-to-lock when panicButtonEnabled is on and user is authenticated.
 * On shake event, calls logout() — AuthGuard handles navigation reset automatically.
 */
export function useShakeLock(): void {
  const panicButtonEnabled = useSettingsStore((s) => s.panicButtonEnabled);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!panicButtonEnabled || !isAuthenticated) return;

    ShakeDetectorModule.startListening();

    const subscription = DeviceEventEmitter.addListener('onShakeDetected', () => {
      useAuthStore.getState().logout();
    });

    return () => {
      ShakeDetectorModule.stopListening();
      subscription.remove();
    };
  }, [panicButtonEnabled, isAuthenticated]);
}
