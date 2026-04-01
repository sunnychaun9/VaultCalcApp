/**
 * VaultCalc - Panic Mode Hook
 *
 * Manages the native PanicModule for volume-down and power-button
 * triple-press triggers. When any trigger fires, the vault is
 * locked immediately.
 *
 * If panicAction is 'fakeCrash', triggers the decoy exit overlay
 * via authStore. If 'lock' (default), simply returns to calculator.
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
 * On panic event, calls logout() — and optionally shows fake crash.
 */
export function usePanicMode(): void {
  const panicButtonEnabled = useSettingsStore((s) => s.panicButtonEnabled);
  const panicTriggerVolume = useSettingsStore((s) => s.panicTriggerVolume);
  const panicTriggerPower = useSettingsStore((s) => s.panicTriggerPower);
  const panicAction = useSettingsStore((s) => s.panicAction);
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
      const auth = useAuthStore.getState();
      auth.logout();

      // Show decoy exit overlay if configured
      if (panicAction === 'fakeCrash') {
        auth.triggerDecoyExit();
      }
    });

    return () => {
      PanicModule?.disablePanicMode();
      subscription.remove();
    };
  }, [panicButtonEnabled, panicTriggerVolume, panicTriggerPower, panicAction, isAuthenticated]);
}
