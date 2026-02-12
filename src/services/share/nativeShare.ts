/**
 * VaultCalc - Native Share Module Interface
 *
 * TypeScript interface for the native ShareModule.
 * Provides type-safe access to Android share operations.
 *
 * @see FEATURE_INDEX.md ENH-001
 */

import { NativeModules, Platform } from 'react-native';

/**
 * Native ShareModule interface
 */
interface ShareModuleInterface {
  /** Share a single file via Android share sheet */
  shareFile(filePath: string, mimeType: string, title: string): Promise<boolean>;

  /** Share multiple files via Android share sheet */
  shareFiles(filePaths: string[], mimeTypes: string[], title: string): Promise<boolean>;

  /** Share text content via Android share sheet */
  shareText(text: string, title: string): Promise<boolean>;
}

/**
 * Get the native ShareModule (lazy — resolved on first access)
 */
let cachedModule: ShareModuleInterface | null = null;

function getShareModule(): ShareModuleInterface {
  if (cachedModule) {
    return cachedModule;
  }

  if (Platform.OS !== 'android') {
    throw new Error('ShareModule is only available on Android');
  }

  const { VaultShareModule } = NativeModules;

  if (!VaultShareModule) {
    throw new Error(
      'VaultShareModule is not available. Make sure the native module is properly linked.',
    );
  }

  cachedModule = VaultShareModule as ShareModuleInterface;
  return cachedModule;
}

/**
 * Native share module proxy — lazily resolves the native module on first method call.
 */
export const NativeShare: ShareModuleInterface = new Proxy(
  {} as ShareModuleInterface,
  {
    get(_target, prop: string) {
      const module = getShareModule();
      return module[prop as keyof ShareModuleInterface];
    },
  },
);
