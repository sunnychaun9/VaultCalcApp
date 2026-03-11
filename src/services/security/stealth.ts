/**
 * VaultCalc - Stealth Mode Service
 *
 * Controls app launcher icon visibility via native StealthModule.
 * When stealth mode is enabled, the app icon disappears from the
 * launcher and can only be opened by dialing *#*#9876#*#*.
 *
 * @see STEALTH-001 in FEATURE_INDEX.md
 */

import { NativeModules, Platform } from 'react-native';

interface StealthModuleInterface {
  enableStealth(): Promise<boolean>;
  disableStealth(): Promise<boolean>;
  isStealthEnabled(): Promise<boolean>;
}

function getModule(): StealthModuleInterface {
  if (Platform.OS !== 'android') {
    throw new Error('StealthModule is only available on Android');
  }
  const { StealthModule } = NativeModules;
  if (!StealthModule) {
    throw new Error('StealthModule is not available.');
  }
  return StealthModule as StealthModuleInterface;
}

/**
 * Enable stealth mode — hides the app icon from the launcher.
 * The app can still be opened via the secret dialer code *#*#9876#*#*.
 * Returns `{ success: true }` or `{ success: false, error: string }`.
 */
export async function enableStealth(): Promise<{ success: boolean; error?: string }> {
  try {
    await getModule().enableStealth();
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/**
 * Disable stealth mode — restores the app icon in the launcher.
 * Returns `{ success: true }` or `{ success: false, error: string }`.
 */
export async function disableStealth(): Promise<{ success: boolean; error?: string }> {
  try {
    await getModule().disableStealth();
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/**
 * Check whether stealth mode is currently active.
 */
export async function isStealthEnabled(): Promise<boolean> {
  try {
    return await getModule().isStealthEnabled();
  } catch {
    return false;
  }
}
