/**
 * VaultCalc - Panic Mode Hook
 *
 * Manages the native PanicModule for volume-down and power-button
 * triple-press triggers. When any trigger fires, the vault is
 * locked immediately and the calculator screen is shown.
 *
 * Shake detection is handled separately by useShakeLock.
 *
 * @see Panic Mode feature
 */

import { useEffect } from 'react';
import { NativeModules, DeviceEventEmitter } from 'react-native';
import { useSettingsStore } from '@store/settingsStore';
import { useAuthStore } from '@store/authStore';

const { PanicModule } = NativeModules;

/**
 * Activates volume-down and power-button panic triggers when
 * panicButtonEnabled is on and user is authenticated.
 * On panic event, calls logout() — AuthGuard handles navigation reset.
 */
export function usePanicMode(): void {
  const panicButtonEnabled = useSettingsStore((s) => s.panicButtonEnabled);
  const panicTriggerVolume = useSettingsStore((s) => s.panicTriggerVolume);
  const panicTriggerPower = useSettingsStore((s) => s.panicTriggerPower);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    // Only activate when panic is enabled and user is in the vault
    const shouldActivate = panicButtonEnabled && isAuthenticated &&
      (panicTriggerVolume || panicTriggerPower);

    if (!shouldActivate) {
      PanicModule?.disablePanicMode();
      return;
    }

    PanicModule?.enablePanicMode({
      volumeDown: panicTriggerVolume,
      powerButton: panicTriggerPower,
    });

    const subscription = DeviceEventEmitter.addListener('onPanicTriggered', () => {
      useAuthStore.getState().logout();
    });

    return () => {
      PanicModule?.disablePanicMode();
      subscription.remove();
    };
  }, [panicButtonEnabled, panicTriggerVolume, panicTriggerPower, isAuthenticated]);
}
