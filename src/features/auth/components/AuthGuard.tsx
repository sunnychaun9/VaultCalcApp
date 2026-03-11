/**
 * VaultCalc - Auth Guard Component
 *
 * Protects vault screens from unauthorized access.
 * Redirects to calculator if not authenticated.
 *
 * @see FEATURE_INDEX.md AUTH-008
 */

import React, { useEffect, ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@store/authStore';
import { useAuthSession } from '../hooks/useAuthSession';
import { useShakeLock } from '../hooks/useShakeLock';
import { usePanicMode } from '../hooks/usePanicMode';

interface AuthGuardProps {
  /** Child components to render when authenticated */
  children: ReactNode;
}

/**
 * Auth Guard Component
 *
 * Wraps vault screens to ensure user is authenticated.
 * Features:
 * - Redirects to calculator if not authenticated
 * - Sets up session timeout monitoring
 * - Handles app background locking
 */
export function AuthGuard({ children }: AuthGuardProps): React.JSX.Element | null {
  const navigation = useNavigation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Initialize session management (auto-lock on timeout/background)
  useAuthSession();

  // Initialize shake-to-lock panic button (ENH-005)
  useShakeLock();

  // Initialize volume/power button panic triggers
  usePanicMode();

  // Redirect to calculator if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      // Use reset to prevent back navigation to vault
      navigation.reset({
        index: 0,
        routes: [{ name: 'Calculator' as never }],
      });
    }
  }, [isAuthenticated, navigation]);

  // Don't render children if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
