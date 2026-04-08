/**
 * VaultCalc - Re-engagement Notification Service
 *
 * Schedules local notifications at key retention milestones after install.
 * All notifications are local (no server, no FCM). Uses AlarmManager via
 * the native LocalNotifModule.
 *
 * Schedule:
 * - Day 1: "Your vault is ready"
 * - Day 3: "You have unprotected photos"
 * - Day 7: "Did you know? Disguise the app icon"
 * - Day 14: "Your gallery photos are still exposed"
 * - Day 30: "We miss you"
 *
 * Called once after onboarding completes. Cancels all on vault lock
 * (privacy — no notifications should reveal the app's nature).
 */

import { NativeModules } from 'react-native';
import { storage } from '@services/storage/mmkv';

const { LocalNotifModule } = NativeModules;

const SCHEDULED_KEY = 'reengagement_notifications_scheduled';

interface NotifSchedule {
  id: number;
  delayMs: number;
  title: string;
  body: string;
}

const SCHEDULE: NotifSchedule[] = [
  {
    id: 1001,
    delayMs: 24 * 60 * 60 * 1000, // 1 day
    title: 'Your vault is ready',
    body: 'Import your first photos to keep them safe. Only you can access them.',
  },
  {
    id: 1002,
    delayMs: 3 * 24 * 60 * 60 * 1000, // 3 days
    title: 'Photos still unprotected',
    body: 'Your gallery photos are visible to anyone who picks up your phone. Tap to hide them.',
  },
  {
    id: 1003,
    delayMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    title: 'Did you know?',
    body: 'You can change the app icon to look like Weather or Notes. No one will suspect a thing.',
  },
  {
    id: 1004,
    delayMs: 14 * 24 * 60 * 60 * 1000, // 14 days
    title: 'Your private files miss you',
    body: 'Your encrypted vault is waiting. Tap to check in on your hidden photos.',
  },
  {
    id: 1005,
    delayMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    title: 'Still protecting your privacy?',
    body: 'VaultCalc keeps your files encrypted and hidden. Open the calculator to access your vault.',
  },
];

/**
 * Schedule all re-engagement notifications.
 * Call once after onboarding completes (first PIN setup).
 * No-op if already scheduled.
 */
export async function scheduleReengagementNotifications(): Promise<void> {
  if (!LocalNotifModule) return;

  // Don't schedule twice
  if (storage.getBoolean(SCHEDULED_KEY)) return;

  try {
    for (const notif of SCHEDULE) {
      await LocalNotifModule.schedule(
        notif.id,
        notif.title,
        notif.body,
        notif.delayMs,
      );
    }
    storage.set(SCHEDULED_KEY, true);
  } catch {
    // Non-critical — re-engagement is best-effort
  }
}

/**
 * Cancel all re-engagement notifications.
 * Call on app uninstall prep or if user opts out.
 */
export async function cancelReengagementNotifications(): Promise<void> {
  if (!LocalNotifModule) return;
  try {
    await LocalNotifModule.cancelAll();
    storage.set(SCHEDULED_KEY, false);
  } catch {
    // Non-critical
  }
}
