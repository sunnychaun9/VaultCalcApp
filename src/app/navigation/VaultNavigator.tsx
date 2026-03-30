/**
 * VaultCalc - Vault Navigator
 *
 * Navigation stack for vault screens.
 * Nested within the root navigator.
 * Protected by AuthGuard to ensure authentication.
 *
 * @see 04-Technical-Architecture.md Section 7.1
 * @see FEATURE_INDEX.md VAULT-001, AUTH-008
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { VaultStackParamList } from '@typedefs/navigation';
import { AuthGuard, ChangePinScreen, DecoyPinSetupScreen, PatternSetupScreen, ChangePatternScreen } from '@features/auth';
import { VaultHomeScreen } from '@features/vault';
import { MediaViewerScreen, AlbumViewScreen, NoteEditorScreen, GalleryAlbumListScreen, GalleryMediaSelectScreen, AudioPlayerScreen, AppLockScreen } from '@features/vault/screens';
import { SettingsScreen, AboutScreen, IntruderLogsScreen, IntruderDetailScreen, SubscriptionScreen, NotificationPrivacyScreen, UninstallProtectionScreen } from '@features/settings';

const Stack = createNativeStackNavigator<VaultStackParamList>();

/**
 * Vault Navigator Component
 *
 * Navigation structure for vault:
 * - VaultHome: Main vault with tabs
 * - MediaViewer: Full-screen media view (VAULT-005)
 * - Settings: Vault settings (SETTINGS-001)
 *
 * Wrapped in AuthGuard to:
 * - Prevent unauthorized access
 * - Enable session timeout monitoring
 * - Handle auto-lock on background
 */
export function VaultNavigator(): React.JSX.Element {
  return (
    <AuthGuard>
      <Stack.Navigator
        initialRouteName="VaultHome"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        {/* Vault Home Screen */}
        <Stack.Screen
          name="VaultHome"
          component={VaultHomeScreen}
        />

        {/* Change PIN Screen - AUTH-005 */}
        <Stack.Screen
          name="ChangePin"
          component={ChangePinScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Decoy PIN Setup - DECOY-001 */}
        <Stack.Screen
          name="DecoyPinSetup"
          component={DecoyPinSetupScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Media Viewer - VAULT-005 */}
        <Stack.Screen
          name="MediaViewer"
          component={MediaViewerScreen}
          options={{
            animation: 'fade',
            presentation: 'fullScreenModal',
          }}
        />

        {/* Audio Player */}
        <Stack.Screen
          name="AudioPlayer"
          component={AudioPlayerScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'fullScreenModal',
          }}
        />

        {/* Album View - ALBUM-001 */}
        <Stack.Screen
          name="AlbumView"
          component={AlbumViewScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Note Editor - NOTES-002 */}
        <Stack.Screen
          name="NoteEditor"
          component={NoteEditorScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Gallery Album List - GALLERY-001 */}
        <Stack.Screen
          name="GalleryAlbumList"
          component={GalleryAlbumListScreen}
          options={{
            animation: 'slide_from_bottom',
          }}
        />

        {/* Gallery Media Select - GALLERY-001 */}
        <Stack.Screen
          name="GalleryMediaSelect"
          component={GalleryMediaSelectScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* App Lock */}
        <Stack.Screen
          name="AppLock"
          component={AppLockScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Notification Privacy */}
        <Stack.Screen
          name="NotificationPrivacy"
          component={NotificationPrivacyScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Pattern Setup - AUTH-009 */}
        <Stack.Screen
          name="PatternSetup"
          component={PatternSetupScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Change Pattern - AUTH-009 */}
        <Stack.Screen
          name="ChangePattern"
          component={ChangePatternScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Settings - SETTINGS-001 */}
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* About - SETTINGS-006 */}
        <Stack.Screen
          name="About"
          component={AboutScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Intruder Reports Dashboard - SEC-003/SEC-005 */}
        <Stack.Screen
          name="IntruderLogs"
          component={IntruderLogsScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Intruder Detail Report - SEC-005 */}
        <Stack.Screen
          name="IntruderDetail"
          component={IntruderDetailScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Subscription - PREMIUM-001 */}
        <Stack.Screen
          name="Subscription"
          component={SubscriptionScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        {/* Uninstall Protection */}
        <Stack.Screen
          name="UninstallProtection"
          component={UninstallProtectionScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
      </Stack.Navigator>
    </AuthGuard>
  );
}
