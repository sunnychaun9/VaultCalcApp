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
import { SettingsScreen, AboutScreen, IntruderLogsScreen, IntruderDetailScreen, SubscriptionScreen, NotificationPrivacyScreen, UninstallProtectionScreen, PrivacyPolicyScreen, LanguageScreen } from '@features/settings';
import {
  pushTransition,
  fadeUpTransition,
  fadeTransition,
  modalTransition,
} from './transitions';

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
          ...fadeTransition,
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
          options={pushTransition}
        />

        {/* Decoy PIN Setup - DECOY-001 */}
        <Stack.Screen
          name="DecoyPinSetup"
          component={DecoyPinSetupScreen}
          options={pushTransition}
        />

        {/* Media Viewer - VAULT-005 */}
        <Stack.Screen
          name="MediaViewer"
          component={MediaViewerScreen}
          options={{
            ...fadeUpTransition,
            presentation: 'fullScreenModal',
          }}
        />

        {/* Audio Player */}
        <Stack.Screen
          name="AudioPlayer"
          component={AudioPlayerScreen}
          options={modalTransition}
        />

        {/* Album View - ALBUM-001 */}
        <Stack.Screen
          name="AlbumView"
          component={AlbumViewScreen}
          options={pushTransition}
        />

        {/* Note Editor - NOTES-002 */}
        <Stack.Screen
          name="NoteEditor"
          component={NoteEditorScreen}
          options={pushTransition}
        />

        {/* Gallery Album List - GALLERY-001 */}
        <Stack.Screen
          name="GalleryAlbumList"
          component={GalleryAlbumListScreen}
          options={modalTransition}
        />

        {/* Gallery Media Select - GALLERY-001 */}
        <Stack.Screen
          name="GalleryMediaSelect"
          component={GalleryMediaSelectScreen}
          options={pushTransition}
        />

        {/* App Lock */}
        <Stack.Screen
          name="AppLock"
          component={AppLockScreen}
          options={pushTransition}
        />

        {/* Notification Privacy */}
        <Stack.Screen
          name="NotificationPrivacy"
          component={NotificationPrivacyScreen}
          options={pushTransition}
        />

        {/* Pattern Setup - AUTH-009 */}
        <Stack.Screen
          name="PatternSetup"
          component={PatternSetupScreen}
          options={pushTransition}
        />

        {/* Change Pattern - AUTH-009 */}
        <Stack.Screen
          name="ChangePattern"
          component={ChangePatternScreen}
          options={pushTransition}
        />

        {/* Settings - SETTINGS-001 */}
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={pushTransition}
        />

        {/* About - SETTINGS-006 */}
        <Stack.Screen
          name="About"
          component={AboutScreen}
          options={pushTransition}
        />

        {/* Intruder Reports Dashboard - SEC-003/SEC-005 */}
        <Stack.Screen
          name="IntruderLogs"
          component={IntruderLogsScreen}
          options={pushTransition}
        />

        {/* Intruder Detail Report - SEC-005 */}
        <Stack.Screen
          name="IntruderDetail"
          component={IntruderDetailScreen}
          options={pushTransition}
        />

        {/* Subscription - PREMIUM-001 */}
        <Stack.Screen
          name="Subscription"
          component={SubscriptionScreen}
          options={pushTransition}
        />
        {/* Uninstall Protection */}
        <Stack.Screen
          name="UninstallProtection"
          component={UninstallProtectionScreen}
          options={pushTransition}
        />

        {/* Privacy Policy */}
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={pushTransition}
        />

        {/* Language selector (LOCALE-001) */}
        <Stack.Screen
          name="Language"
          component={LanguageScreen}
          options={pushTransition}
        />
      </Stack.Navigator>
    </AuthGuard>
  );
}
