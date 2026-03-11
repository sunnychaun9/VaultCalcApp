/**
 * VaultCalc - App Icon Service
 *
 * Controls the disguised launcher icon via the native AppIconModule.
 * Available disguises: default, calculator, weather, notes.
 *
 * @see Disguised App Icons feature
 */

import { NativeModules, Platform } from 'react-native';

export type AppIconAlias = 'default' | 'calculator' | 'weather' | 'notes';

interface AppIconModuleInterface {
  setIcon(aliasName: string): Promise<boolean>;
  getCurrentIcon(): Promise<string>;
}

function getModule(): AppIconModuleInterface {
  if (Platform.OS !== 'android') {
    throw new Error('AppIconModule is only available on Android');
  }
  const { AppIconModule } = NativeModules;
  if (!AppIconModule) {
    throw new Error('AppIconModule is not available.');
  }
  return AppIconModule as AppIconModuleInterface;
}

/**
 * Change the launcher icon and label to the given disguise.
 */
export async function setAppIcon(
  alias: AppIconAlias,
): Promise<{ success: boolean; error?: string }> {
  try {
    await getModule().setIcon(alias);
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/**
 * Get the currently active icon alias name.
 */
export async function getCurrentAppIcon(): Promise<AppIconAlias> {
  try {
    const alias = await getModule().getCurrentIcon();
    return alias as AppIconAlias;
  } catch {
    return 'default';
  }
}
