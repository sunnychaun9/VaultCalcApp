/**
 * VaultCalc - Notification Privacy Service
 *
 * Bridge to the NotificationPrivacyModule native module.
 * Manages protected apps and masking configuration.
 *
 * @see Notification Privacy feature
 */

import { NativeModules } from 'react-native';

const { NotificationPrivacyModule } = NativeModules;

export interface AppInfo {
  packageName: string;
  appName: string;
  icon: string; // base64 PNG
}

export async function getInstalledApps(): Promise<AppInfo[]> {
  return NotificationPrivacyModule.getInstalledApps();
}

export async function getProtectedApps(): Promise<string[]> {
  return NotificationPrivacyModule.getProtectedApps();
}

export async function protectApp(packageName: string): Promise<boolean> {
  return NotificationPrivacyModule.protectApp(packageName);
}

export async function unprotectApp(packageName: string): Promise<boolean> {
  return NotificationPrivacyModule.unprotectApp(packageName);
}

export async function setEnabled(enabled: boolean): Promise<boolean> {
  return NotificationPrivacyModule.setEnabled(enabled);
}

export async function isEnabled(): Promise<boolean> {
  return NotificationPrivacyModule.isEnabled();
}

export async function setHideContent(enabled: boolean): Promise<boolean> {
  return NotificationPrivacyModule.setHideContent(enabled);
}

export async function getHideContent(): Promise<boolean> {
  return NotificationPrivacyModule.getHideContent();
}

export async function setHideSender(enabled: boolean): Promise<boolean> {
  return NotificationPrivacyModule.setHideSender(enabled);
}

export async function getHideSender(): Promise<boolean> {
  return NotificationPrivacyModule.getHideSender();
}

export async function setBlockEntirely(enabled: boolean): Promise<boolean> {
  return NotificationPrivacyModule.setBlockEntirely(enabled);
}

export async function getBlockEntirely(): Promise<boolean> {
  return NotificationPrivacyModule.getBlockEntirely();
}

export async function isListenerServiceEnabled(): Promise<boolean> {
  return NotificationPrivacyModule.isListenerServiceEnabled();
}

export async function openListenerSettings(): Promise<boolean> {
  return NotificationPrivacyModule.openListenerSettings();
}
