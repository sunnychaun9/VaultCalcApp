/**
 * VaultCalc - Root Navigator
 *
 * Main navigation structure for the application.
 * Controls flow between Calculator, Vault, and Onboarding.
 *
 * @see 04-Technical-Architecture.md Section 7.1
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@typedefs/navigation';

// Feature screens
import { CalculatorScreen } from '@features/calculator/screens';
import { PinSetupScreen } from '@features/auth';
import { WelcomeScreen, HowItWorksScreen, FirstImportScreen } from '@features/onboarding';
import { VaultNavigator } from './VaultNavigator';
import { useSettingsStore } from '@store/settingsStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root Navigator Component
 *
 * Navigation structure:
 * - Calculator: Primary screen (always accessible)
 * - Vault: Shown after successful PIN authentication (VAULT-001)
 * - PinSetup: Shown for initial PIN setup or change PIN (AUTH-004)
 * - Onboarding: Shown on first launch (ONBOARD-001)
 */
export function RootNavigator(): React.JSX.Element {
  const isFirstLaunch = useSettingsStore(s => s.isFirstLaunch);

  return (
    <Stack.Navigator
      initialRouteName={isFirstLaunch ? 'Onboarding' : 'Calculator'}
      screenOptions={{
        headerShown: false,
        animation: 'none', // No animation between calc <-> vault per UX spec
        gestureEnabled: false, // Prevent swipe back for security
      }}
    >
      {/* Calculator Screen - Primary interface (CALC-001) */}
      <Stack.Screen
        name="Calculator"
        component={CalculatorScreen}
        options={{
          // Prevent going back from calculator
          gestureEnabled: false,
        }}
      />

      {/* Vault Navigator (VAULT-001) */}
      <Stack.Screen
        name="Vault"
        component={VaultNavigator}
        options={{
          animation: 'fade',
        }}
      />

      {/* PIN Setup Screen (AUTH-004) */}
      <Stack.Screen
        name="PinSetup"
        component={PinSetupScreen}
        options={{
          animation: 'slide_from_bottom',
          presentation: 'modal',
        }}
      />

      {/* Onboarding Flow (ONBOARD-001) */}
      <Stack.Screen
        name="Onboarding"
        component={WelcomeScreen}
        options={{ animation: 'none' }}
      />

      {/* How It Works Tutorial (ONBOARD-004) */}
      <Stack.Screen
        name="HowItWorks"
        component={HowItWorksScreen}
        options={{ animation: 'slide_from_right' }}
      />

      {/* First Import Prompt (ONBOARD-005/006) */}
      <Stack.Screen
        name="FirstImport"
        component={FirstImportScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
