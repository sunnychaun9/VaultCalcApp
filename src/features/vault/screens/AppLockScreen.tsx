/**
 * VaultCalc - App Lock Screen
 *
 * Lists installed apps and lets the user toggle locking for each.
 * Manages accessibility service permission flow.
 *
 * @see App Lock feature
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeModules } from 'react-native';
import { useActivityTracker } from '@features/auth';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { PremiumSwitch } from '@shared/components/PremiumSwitch';
import { alert } from '@store/alertStore';

const { AppLockModule } = NativeModules;

interface AppInfo {
  packageName: string;
  appName: string;
  icon: string; // base64 PNG
}

export function AppLockScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation();
  const { onActivity } = useActivityTracker();

  const [apps, setApps] = useState<AppInfo[]>([]);
  const [lockedApps, setLockedApps] = useState<Set<string>>(new Set());
  const [appMethods, setAppMethods] = useState<Record<string, string>>({});
  const [isEnabled, setIsEnabled] = useState(false);
  const [isServiceEnabled, setIsServiceEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Re-check accessibility service when screen regains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      checkAccessibilityService();
    });
    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [installedApps, locked, enabled, serviceEnabled, methods] = await Promise.all([
        AppLockModule.getInstalledApps(),
        AppLockModule.getLockedApps(),
        AppLockModule.isEnabled(),
        AppLockModule.isAccessibilityServiceEnabled(),
        AppLockModule.getAppUnlockMethods(),
      ]);

      // Sort alphabetically
      const sorted = (installedApps as AppInfo[]).sort((a, b) =>
        a.appName.localeCompare(b.appName),
      );
      setApps(sorted);
      setLockedApps(new Set(locked as string[]));
      setIsEnabled(enabled as boolean);
      setIsServiceEnabled(serviceEnabled as boolean);
      setAppMethods((methods ?? {}) as Record<string, string>);
    } catch (e) {
      alert('Error', 'Failed to load installed apps');
    } finally {
      setIsLoading(false);
    }
  };

  const checkAccessibilityService = async () => {
    try {
      const enabled = await AppLockModule.isAccessibilityServiceEnabled();
      setIsServiceEnabled(enabled as boolean);
    } catch {
      // ignore
    }
  };

  const handleToggleEnabled = useCallback(async (value: boolean) => {
    onActivity();

    if (value && !isServiceEnabled) {
      alert(
        'Accessibility Service Required',
        'App Lock needs the Accessibility Service to detect when locked apps open.\n\nYou will be taken to Accessibility settings. Enable "VaultCalc App Lock".',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: async () => {
              await AppLockModule.openAccessibilitySettings();
            },
          },
        ],
      );
      return;
    }

    await AppLockModule.setEnabled(value);
    setIsEnabled(value);
  }, [onActivity, isServiceEnabled]);

  const handleToggleLock = useCallback(async (packageName: string, lock: boolean) => {
    onActivity();

    if (lock) {
      await AppLockModule.lockApp(packageName);
      setLockedApps(prev => new Set([...prev, packageName]));
    } else {
      await AppLockModule.unlockApp(packageName);
      setLockedApps(prev => {
        const next = new Set(prev);
        next.delete(packageName);
        return next;
      });
    }
  }, [onActivity]);

  const handleToggleMethod = useCallback(async (packageName: string, appName: string) => {
    onActivity();
    const current = appMethods[packageName] ?? 'pin';
    alert(
      `Unlock method for ${appName}`,
      `Currently: ${current === 'pattern' ? 'Pattern' : 'PIN'}`,
      [
        {
          text: 'PIN',
          onPress: async () => {
            await AppLockModule.setAppUnlockMethod(packageName, 'pin');
            setAppMethods(prev => ({ ...prev, [packageName]: 'pin' }));
          },
        },
        {
          text: 'Pattern',
          onPress: async () => {
            await AppLockModule.setAppUnlockMethod(packageName, 'pattern');
            setAppMethods(prev => ({ ...prev, [packageName]: 'pattern' }));
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [onActivity, appMethods]);

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return apps;
    const q = searchQuery.toLowerCase();
    return apps.filter(app =>
      app.appName.toLowerCase().includes(q) ||
      app.packageName.toLowerCase().includes(q),
    );
  }, [apps, searchQuery]);

  const renderApp = useCallback(({ item }: { item: AppInfo }) => {
    const isLocked = lockedApps.has(item.packageName);
    const method = appMethods[item.packageName] ?? 'pin';
    return (
      <View style={styles.appRow}>
        {item.icon ? (
          <Image
            source={{ uri: `data:image/png;base64,${item.icon}` }}
            style={styles.appIcon}
          />
        ) : (
          <View style={[styles.appIcon, styles.appIconPlaceholder]} />
        )}
        <View style={styles.appInfo}>
          <Text style={styles.appName} numberOfLines={1}>
            {item.appName}
          </Text>
          {isLocked && (
            <Pressable onPress={() => handleToggleMethod(item.packageName, item.appName)}>
              <Text style={styles.methodLabel}>
                {method === 'pattern' ? 'Pattern' : 'PIN'} {'\u25BE'}
              </Text>
            </Pressable>
          )}
        </View>
        <PremiumSwitch
          value={isLocked}
          onValueChange={(value) => handleToggleLock(item.packageName, value)}
          trackColorOff={themeColors.surfaceContainerHigh}
          trackColorOn={themeColors.accent}
          thumbColor={themeColors.surface}
          disabled={!isEnabled}
        />
      </View>
    );
  }, [lockedApps, appMethods, isEnabled, styles, themeColors, handleToggleLock, handleToggleMethod]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>App Lock</Text>
        <View style={styles.backButton} />
      </View>

      {/* Enable toggle */}
      <View style={styles.enableRow}>
        <View style={styles.enableTextContainer}>
          <Text style={styles.enableLabel}>Enable App Lock</Text>
          <Text style={styles.enableDesc}>
            {isServiceEnabled
              ? 'Lock apps to require authentication.'
              : 'Accessibility service not enabled.'}
          </Text>
        </View>
        <PremiumSwitch
          value={isEnabled}
          onValueChange={handleToggleEnabled}
          trackColorOff={themeColors.surfaceContainerHigh}
          trackColorOn={themeColors.accent}
          thumbColor={themeColors.surface}
        />
      </View>

      {!isServiceEnabled && isEnabled && (
        <Pressable
          style={styles.serviceWarning}
          onPress={() => AppLockModule.openAccessibilitySettings()}
        >
          <Text style={styles.serviceWarningText}>
            Tap to enable Accessibility Service
          </Text>
        </Pressable>
      )}

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search apps..."
          placeholderTextColor={themeColors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* App list */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={themeColors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredApps}
          keyExtractor={(item) => item.packageName}
          renderItem={renderApp}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {lockedApps.size} app{lockedApps.size !== 1 ? 's' : ''} locked
        </Text>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 60,
  },
  backText: {
    ...typography.labelLarge,
    color: c.accent,
  },
  title: {
    ...typography.titleMedium,
    color: c.textPrimary,
  },
  enableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: c.surfaceContainer,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: 12,
  },
  enableTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  enableLabel: {
    ...typography.labelLarge,
    color: c.textPrimary,
  },
  enableDesc: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: 2,
  },
  serviceWarning: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#FF3B3020',
    borderRadius: 8,
    alignItems: 'center',
  },
  serviceWarningText: {
    ...typography.labelMedium,
    color: '#FF3B30',
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    backgroundColor: c.surfaceContainer,
    color: c.textPrimary,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.bodyMedium,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  appIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: spacing.md,
  },
  appIconPlaceholder: {
    backgroundColor: c.surfaceContainerHigh,
  },
  appInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  appName: {
    ...typography.bodyMedium,
    color: c.textPrimary,
  },
  methodLabel: {
    ...typography.labelSmall,
    color: c.accent,
    marginTop: 2,
  },
  footer: {
    padding: spacing.md,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  footerText: {
    ...typography.bodySmall,
    color: c.textTertiary,
  },
});
