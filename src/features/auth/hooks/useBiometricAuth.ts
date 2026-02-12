/**
 * VaultCalc - Biometric Authentication Hook
 *
 * Auto-triggers the system biometric prompt when biometric unlock is enabled.
 * On success, authenticates the user and navigates to the vault.
 * On failure or cancel, does nothing — the user can always enter their PIN.
 *
 * Handles Android biometric lockout (ERROR_LOCKOUT = 7, ERROR_LOCKOUT_PERMANENT = 9)
 * by disabling re-trigger until the component remounts.
 *
 * @see FEATURE_INDEX.md BIO-003, BIO-004
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@typedefs/navigation';
import { useAuthStore } from '@store/authStore';
import { useSettingsStore } from '@store/settingsStore';
import { promptBiometricAuth } from '@services/biometric';
import { isPinConfigured } from '../services/pinStorage';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/** Android BiometricPrompt error codes for lockout */
const ERROR_LOCKOUT = 7;
const ERROR_LOCKOUT_PERMANENT = 9;

/**
 * Hook that manages biometric authentication on the calculator screen.
 *
 * Auto-triggers the system biometric prompt when:
 * - biometricEnabled is true in settings
 * - A PIN has been configured
 * - User is not already authenticated
 * - User is not locked out (PIN lockout)
 * - Biometric is not in Android-side lockout
 *
 * Returns `triggerBiometric` for manual re-trigger (fingerprint button)
 * and `showBiometricButton` to control UI visibility.
 */
export function useBiometricAuth() {
  const navigation = useNavigation<NavigationProp>();
  const authenticate = useAuthStore(s => s.authenticate);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isLockedOut = useAuthStore(s => s.isLockedOut);
  const biometricEnabled = useSettingsStore(s => s.biometricEnabled);

  const isPrompting = useRef(false);
  const [biometricLockedOut, setBiometricLockedOut] = useState(false);

  // Show the fingerprint button when biometric is enabled, user not authenticated,
  // and not in biometric lockout
  const showBiometricButton =
    biometricEnabled && !isAuthenticated && !biometricLockedOut && isPinConfigured();

  const triggerBiometric = useCallback(async () => {
    // Guard conditions
    if (isPrompting.current) return;
    if (!biometricEnabled) return;
    if (isAuthenticated) return;
    if (isLockedOut) return;
    if (biometricLockedOut) return;
    if (!isPinConfigured()) return;

    isPrompting.current = true;
    try {
      const result = await promptBiometricAuth();
      if (result.success) {
        authenticate(false);
        setTimeout(() => {
          try {
            navigation.navigate('Vault');
          } catch {
            // Component may have unmounted — safe to ignore
          }
        }, 50);
      } else if (
        result.errorCode === ERROR_LOCKOUT ||
        result.errorCode === ERROR_LOCKOUT_PERMANENT
      ) {
        // Android has locked out biometric — don't re-trigger
        setBiometricLockedOut(true);
      }
      // On cancel/fail: do nothing, user can enter PIN (BIO-004)
    } finally {
      isPrompting.current = false;
    }
  }, [biometricEnabled, isAuthenticated, isLockedOut, biometricLockedOut, authenticate, navigation]);

  // Auto-trigger on mount when conditions are met
  useEffect(() => {
    if (isAuthenticated || !biometricEnabled) return;
    const timer = setTimeout(() => {
      triggerBiometric();
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricEnabled, isAuthenticated]);

  return { triggerBiometric, showBiometricButton };
}
