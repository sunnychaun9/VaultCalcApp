/**
 * VaultCalc - Native Biometric Module Interface
 *
 * TypeScript interface for the native BiometricModule.
 * Provides type-safe access to biometric authentication operations.
 *
 * @see FEATURE_INDEX.md BIO-001
 */

import { NativeModules, Platform } from 'react-native';

/**
 * Biometric availability status
 */
export type BiometricStatus =
  | 'available'
  | 'no_hardware'
  | 'unavailable'
  | 'none_enrolled'
  | 'security_update_required'
  | 'unknown';

/**
 * Result of biometric availability check
 */
export interface BiometricAvailability {
  /** Whether strong biometrics can be used right now */
  available: boolean;
  /** Detailed status code */
  status: BiometricStatus;
}

/**
 * Result of biometric authentication prompt (BIO-003)
 */
export interface BiometricAuthResult {
  /** Whether authentication succeeded */
  success: boolean;
  /** Error message (when success is false) */
  error?: string;
  /** Android BiometricPrompt error code (when success is false) */
  errorCode?: number;
}

/**
 * Native BiometricModule interface
 */
interface BiometricModuleInterface {
  /**
   * Check whether biometric authentication is available on this device.
   * @returns Availability status
   */
  checkAvailability(): Promise<BiometricAvailability>;

  /**
   * Show the system biometric authentication prompt (BIO-003).
   * @param title Prompt title text
   * @param subtitle Prompt subtitle text
   * @param cancelText Negative/cancel button text
   * @returns Authentication result
   */
  authenticate(
    title: string,
    subtitle: string,
    cancelText: string,
  ): Promise<BiometricAuthResult>;
}

/**
 * Get the native BiometricModule (lazy — resolved on first access)
 */
let cachedModule: BiometricModuleInterface | null = null;

function getBiometricModule(): BiometricModuleInterface {
  if (cachedModule) {
    return cachedModule;
  }

  if (Platform.OS !== 'android') {
    throw new Error('BiometricModule is only available on Android');
  }

  const { BiometricModule } = NativeModules;

  if (!BiometricModule) {
    throw new Error(
      'BiometricModule is not available. Make sure the native module is properly linked.',
    );
  }

  cachedModule = BiometricModule as BiometricModuleInterface;
  return cachedModule;
}

/**
 * Native biometric module proxy — lazily resolves the native module on first method call.
 */
export const NativeBiometric: BiometricModuleInterface = new Proxy(
  {} as BiometricModuleInterface,
  {
    get(_target, prop: string) {
      const module = getBiometricModule();
      return module[prop as keyof BiometricModuleInterface];
    },
  },
);
