/**
 * VaultCalc - Smart Notification Service
 *
 * Adaptive, behavior-based local notification scheduler.
 * Replaces the static day-1/3/7/14/30 schedule with intelligent
 * decisions based on actual user activity.
 *
 * Smart features:
 * - Cancels pending notifications if user already opened the app
 * - Behavior-based: import reminders vs unlock reminders vs feature tips
 * - Max 1 notification per day (enforced both here and in native receiver)
 * - Personalized messages that reference user activity stats
 *
 * All notifications are local (no server, no FCM). Uses AlarmManager via
 * the native LocalNotifModule.
 */

import { NativeModules } from 'react-native';
import { storage } from '@services/storage/mmkv';
import { useSettingsStore } from '@store/settingsStore';

const { LocalNotifModule } = NativeModules;

// ── Storage keys ───────────────────────────────────────────────────────
const SCHEDULED_KEY = 'reengagement_notifications_scheduled';
const SMART_NOTIF_LAST_SCHEDULED = 'smart_notif_last_scheduled_at';

// ── Notification IDs ───────────────────────────────────────────────────
// Legacy IDs 1001-1005 are still cancelled for migration.
// Smart notifications use 2001-2010 range.
const SMART_NOTIF_ID = 2001;

// ── Timing constants ───────────────────────────────────────────────────
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const TWO_DAYS = 2 * ONE_DAY;
const FIVE_DAYS = 5 * ONE_DAY;

// ── Notification categories ────────────────────────────────────────────

type NotifCategory = 'import_reminder' | 'unlock_reminder' | 'feature_tip' | 'winback';

interface SmartNotif {
  category: NotifCategory;
  title: string;
  body: string;
  delayMs: number;
}

/**
 * Evaluate user activity and decide which notification to schedule next.
 * Returns null if no notification is appropriate right now.
 */
function pickSmartNotification(): SmartNotif | null {
  const state = useSettingsStore.getState();
  const now = Date.now();
  const daysSinceInstall = state.firstLaunchTimestamp
    ? (now - state.firstLaunchTimestamp) / ONE_DAY
    : 0;

  // ── 1. Import reminder: user hasn't imported any files ──────────
  if (state.totalImportCount === 0) {
    if (daysSinceInstall < 1) {
      // Too early — let them explore first
      return {
        category: 'import_reminder',
        title: 'Your vault is ready',
        body: 'Import your first photos to keep them safe. Only you can access them.',
        delayMs: ONE_DAY,
      };
    }
    return {
      category: 'import_reminder',
      title: 'Photos still unprotected',
      body: 'Your gallery photos are visible to anyone who picks up your phone. Tap to hide them.',
      delayMs: ONE_DAY,
    };
  }

  // ── 2. Unlock reminder: user has files but hasn't opened vault recently ──
  // vaultUnlockCount tracks cumulative unlocks. Low count relative to days
  // since install means the user isn't visiting their vault.
  const unlocksPerDay = daysSinceInstall > 0
    ? state.vaultUnlockCount / daysSinceInstall
    : state.vaultUnlockCount;

  if (unlocksPerDay < 0.2 && daysSinceInstall > 3) {
    const itemWord = state.totalImportCount === 1 ? 'file' : 'files';
    return {
      category: 'unlock_reminder',
      title: 'Your private files miss you',
      body: `You have ${state.totalImportCount} encrypted ${itemWord} waiting in your vault. Tap to check in.`,
      delayMs: TWO_DAYS,
    };
  }

  // ── 3. Feature tips: suggest features the user hasn't tried ─────
  if (!state.biometricEnabled && daysSinceInstall > 2) {
    return {
      category: 'feature_tip',
      title: 'Unlock faster',
      body: 'Enable fingerprint unlock for quicker access to your vault.',
      delayMs: TWO_DAYS,
    };
  }

  if (state.appIcon === 'default' && daysSinceInstall > 5) {
    return {
      category: 'feature_tip',
      title: 'Did you know?',
      body: 'You can change the app icon to look like Weather or Notes. No one will suspect a thing.',
      delayMs: TWO_DAYS,
    };
  }

  if (!state.intruderDetectionEnabled && state.totalImportCount >= 5 && daysSinceInstall > 7) {
    return {
      category: 'feature_tip',
      title: 'Catch snoopers',
      body: `You're protecting ${state.totalImportCount} files. Enable intruder detection to snap photos of anyone who tries to break in.`,
      delayMs: TWO_DAYS,
    };
  }

  if (!state.googleDriveEmail && state.totalImportCount >= 10 && daysSinceInstall > 10) {
    return {
      category: 'feature_tip',
      title: 'Back up your vault',
      body: `You have ${state.totalImportCount} encrypted files. Connect Google Drive to keep them safe if you switch phones.`,
      delayMs: TWO_DAYS,
    };
  }

  // ── 4. Win-back: user has been away for a while ─────────────────
  if (daysSinceInstall > 14 && unlocksPerDay < 0.1) {
    return {
      category: 'winback',
      title: 'Still protecting your privacy?',
      body: 'VaultCalc keeps your files encrypted and hidden. Open the calculator to access your vault.',
      delayMs: FIVE_DAYS,
    };
  }

  return null;
}

/**
 * Record that the user opened the app. Tells native layer so the
 * receiver can suppress pending notifications for active users.
 */
export async function recordAppOpen(): Promise<void> {
  if (!LocalNotifModule) return;
  try {
    await LocalNotifModule.recordAppOpen();
  } catch {
    // Non-critical
  }
}

/**
 * Cancel all pending smart notifications. Called when user is active
 * (opens vault) so they don't get a stale reminder later.
 */
export async function cancelPendingNotifications(): Promise<void> {
  if (!LocalNotifModule) return;
  try {
    await LocalNotifModule.cancel(SMART_NOTIF_ID);
  } catch {
    // Non-critical
  }
}

/**
 * Evaluate user behavior and schedule the next smart notification.
 *
 * Call after vault unlock or app foreground. Cancels any existing
 * smart notification and schedules a new one based on current activity.
 *
 * Throttle: won't reschedule if we already scheduled within the last
 * 12 hours (prevents churn from frequent app opens).
 */
export async function scheduleSmartNotification(): Promise<void> {
  if (!LocalNotifModule) return;

  // Throttle: don't reschedule too frequently
  const lastScheduled = storage.getNumber(SMART_NOTIF_LAST_SCHEDULED) ?? 0;
  const now = Date.now();
  if (lastScheduled > 0 && (now - lastScheduled) < 12 * ONE_HOUR) {
    return;
  }

  try {
    // Cancel previous smart notification before scheduling new one
    await LocalNotifModule.cancel(SMART_NOTIF_ID);

    const notif = pickSmartNotification();
    if (!notif) return;

    await LocalNotifModule.schedule(
      SMART_NOTIF_ID,
      notif.title,
      notif.body,
      notif.delayMs,
    );

    storage.set(SMART_NOTIF_LAST_SCHEDULED, now);
  } catch {
    // Non-critical — notifications are best-effort
  }
}

/**
 * Initial schedule after onboarding. Replaces the legacy static schedule.
 * Schedules a Day-1 import reminder (the first smart notification).
 * No-op if already scheduled.
 */
export async function scheduleReengagementNotifications(): Promise<void> {
  if (!LocalNotifModule) return;

  // Don't schedule twice
  if (storage.getBoolean(SCHEDULED_KEY)) return;

  try {
    await LocalNotifModule.schedule(
      SMART_NOTIF_ID,
      'Your vault is ready',
      'Import your first photos to keep them safe. Only you can access them.',
      ONE_DAY,
    );
    storage.set(SCHEDULED_KEY, true);
    storage.set(SMART_NOTIF_LAST_SCHEDULED, Date.now());
  } catch {
    // Non-critical
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
