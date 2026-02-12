/**
 * VaultCalc - App Security Service
 *
 * Controls app visibility in Android recents.
 * Used during vault lock to hide the app from the task switcher.
 *
 * @see AUTH-010 in FEATURE_INDEX.md
 */

import { NativeModules, Platform } from 'react-native';

interface AppSecurityModuleInterface {
  removeFromRecents(): Promise<boolean>;
  excludeFromRecents(exclude: boolean): Promise<boolean>;
}

function getModule(): AppSecurityModuleInterface {
  if (Platform.OS !== 'android') {
    throw new Error('AppSecurityModule is only available on Android');
  }
  const { AppSecurityModule } = NativeModules;
  if (!AppSecurityModule) {
    throw new Error('AppSecurityModule is not available.');
  }
  return AppSecurityModule as AppSecurityModuleInterface;
}

/**
 * Hide the app from the Android recents screen without finishing the Activity.
 * The app keeps running (showing the calculator) but is invisible in recents.
 * Call with `false` to make it visible again when the user re-authenticates.
 */
export async function excludeFromRecents(exclude: boolean): Promise<boolean> {
  try {
    return await getModule().excludeFromRecents(exclude);
  } catch {
    return false;
  }
}

/**
 * Finish the Activity and remove the app from recents entirely.
 * Use this for the strongest "disappear" behavior.
 * The next launch starts fresh from the calculator.
 */
export async function removeFromRecents(): Promise<boolean> {
  try {
    return await getModule().removeFromRecents();
  } catch {
    return false;
  }
}
