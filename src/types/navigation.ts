/**
 * VaultCalc - Navigation Type Definitions
 *
 * Type-safe navigation for the entire application.
 * @see 04-Technical-Architecture.md Section 7
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GalleryMediaType } from '@services/gallery';

/**
 * Root Stack Parameter List
 * Defines all screens at the root level of navigation
 */
export type RootStackParamList = {
  /** Calculator screen - primary app interface */
  Calculator: undefined;
  /** Vault navigator - nested navigation for vault screens */
  Vault: undefined;
  /** Onboarding flow - shown on first launch */
  Onboarding: undefined;
  /** PIN setup screen - for initial setup or change PIN */
  PinSetup: { isInitialSetup?: boolean } | undefined;
  /** How It Works tutorial - shown after initial PIN setup */
  HowItWorks: undefined;
  /** First Import prompt - shown after tutorial (ONBOARD-005/006) */
  FirstImport: undefined;
  /** Pattern unlock screen (AUTH-009) */
  PatternUnlock: undefined;
};

/**
 * Vault Stack Parameter List
 * Defines screens within the vault navigator
 */
export type VaultStackParamList = {
  /** Vault home with tabs (Photos/Videos/Docs) */
  VaultHome: undefined;
  /** Full-screen media viewer */
  MediaViewer: { mediaId: string };
  /** Album detail view */
  AlbumView: { albumId: string };
  /** Settings screen */
  Settings: undefined;
  /** Security settings */
  SecuritySettings: undefined;
  /** Storage settings */
  StorageSettings: undefined;
  /** Subscription management */
  Subscription: undefined;
  /** Change PIN flow */
  ChangePin: undefined;
  /** Decoy PIN setup flow */
  DecoyPinSetup: undefined;
  /** About screen */
  About: undefined;
  /** Intruder logs viewer */
  IntruderLogs: undefined;
  /** Intruder detail report */
  IntruderDetail: { logId: string };
  /** Note editor (NOTES-002) */
  NoteEditor: { noteId: string };
  /** Gallery album list — in-app media picker (GALLERY-001) */
  GalleryAlbumList: { mediaType: GalleryMediaType };
  /** Gallery media selection grid (GALLERY-001) */
  GalleryMediaSelect: { bucketId: string; bucketName: string; mediaType: GalleryMediaType };
  /** Private vault camera */
  Camera: undefined;
  /** App Lock settings */
  AppLock: undefined;
  /** Notification Privacy settings */
  NotificationPrivacy: undefined;
  /** Pattern setup screen (AUTH-009) */
  PatternSetup: undefined;
  /** Change pattern screen (AUTH-009) */
  ChangePattern: undefined;
};

/**
 * Screen props type helpers
 * Use these to type your screen components
 */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type VaultStackScreenProps<T extends keyof VaultStackParamList> =
  NativeStackScreenProps<VaultStackParamList, T>;

/**
 * Declaration merge for useNavigation hook type safety
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
