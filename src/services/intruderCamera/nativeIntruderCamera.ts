/**
 * VaultCalc - Native Intruder Camera Module Interface
 *
 * TypeScript interface for the native IntruderCameraModule.
 * Provides type-safe access to user-consented front camera capture.
 *
 * @see FEATURE_INDEX.md SEC-001
 */

import { NativeModules, Platform } from 'react-native';

/**
 * Result of a photo capture attempt
 */
export interface CaptureResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * Native IntruderCameraModule interface
 */
interface IntruderCameraModuleInterface {
  /**
   * Check if camera permission is granted.
   */
  hasPermission(): Promise<boolean>;

  /**
   * Capture a photo from the front camera.
   * @param destPath Absolute path where the JPEG should be written
   */
  capturePhoto(destPath: string): Promise<CaptureResult>;
}

/**
 * Get the native IntruderCameraModule (lazy — resolved on first access)
 */
let cachedModule: IntruderCameraModuleInterface | null = null;

function getIntruderCameraModule(): IntruderCameraModuleInterface {
  if (cachedModule) {
    return cachedModule;
  }

  if (Platform.OS !== 'android') {
    throw new Error('IntruderCameraModule is only available on Android');
  }

  const { IntruderCameraModule } = NativeModules;

  if (!IntruderCameraModule) {
    throw new Error(
      'IntruderCameraModule is not available. Make sure the native module is properly linked.',
    );
  }

  cachedModule = IntruderCameraModule as IntruderCameraModuleInterface;
  return cachedModule;
}

/**
 * Native intruder camera module proxy — lazily resolves the native module on first method call.
 */
export const NativeIntruderCamera: IntruderCameraModuleInterface = new Proxy(
  {} as IntruderCameraModuleInterface,
  {
    get(_target, prop: string) {
      const module = getIntruderCameraModule();
      return module[prop as keyof IntruderCameraModuleInterface];
    },
  },
);
