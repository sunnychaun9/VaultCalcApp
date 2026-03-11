/**
 * VaultCalc - Notification Privacy Screen
 *
 * Lists installed apps and lets the user toggle notification protection for each.
 * Manages notification listener service permission flow and masking options.
 *
 * @see Notification Privacy feature
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Switch,
  TextInput,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useActivityTracker } from '@features/auth';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { alert } from '@store/alertStore';
import {
  getInstalledApps,
  getProtectedApps,
  protectApp,
  unprotectApp,
  setEnabled,
  isEnabled,
  setHideContent,
  getHideContent,
  setHideSender,
  getHideSender,
  setBlockEntirely,
  getBlockEntirely,
  isListenerServiceEnabled,
  openListenerSettings,
  type AppInfo,
} from '@services/notificationPrivacy';

export function NotificationPrivacyScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation();
  const { onActivity } = useActivityTracker();

  const [apps, setApps] = useState<AppInfo[]>([]);
  const [protectedApps, setProtectedApps] = useState<Set<string>>(new Set());
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [serviceEnabled, setServiceEnabled] = useState(false);
  const [hideContentEnabled, setHideContentEnabled] = useState(true);
  const [hideSenderEnabled, setHideSenderEnabled] = useState(false);
  const [blockEntirelyEnabled, setBlockEntirelyEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // Re-check listener service when screen regains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      checkListenerService();
    });
    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [
        installedApps,
        protected_,
        enabled,
        listenerEnabled,
        hideContentVal,
        hideSenderVal,
        blockEntirelyVal,
      ] = await Promise.all([
        getInstalledApps(),
        getProtectedApps(),
        isEnabled(),
        isListenerServiceEnabled(),
        getHideContent(),
        getHideSender(),
        getBlockEntirely(),
      ]);

      const sorted = (installedApps as AppInfo[]).sort((a, b) =>
        a.appName.localeCompare(b.appName),
      );
      setApps(sorted);
      setProtectedApps(new Set(protected_ as string[]));
      setFeatureEnabled(enabled as boolean);
      setServiceEnabled(listenerEnabled as boolean);
      setHideContentEnabled(hideContentVal as boolean);
      setHideSenderEnabled(hideSenderVal as boolean);
      setBlockEntirelyEnabled(blockEntirelyVal as boolean);
    } catch (e) {
      alert('Error', 'Failed to load installed apps');
    } finally {
      setIsLoading(false);
    }
  };

  const checkListenerService = async () => {
    try {
      const enabled = await isListenerServiceEnabled();
      setServiceEnabled(enabled as boolean);
    } catch {
      // ignore
    }
  };

  const handleToggleEnabled = useCallback(async (value: boolean) => {
    onActivity();

    if (value && !serviceEnabled) {
      alert(
        'Notification Access Required',
        'Notification Privacy needs permission to read notifications.\n\nYou will be taken to Notification Access settings. Enable "VaultCalc".',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: async () => {
              await openListenerSettings();
            },
          },
        ],
      );
      return;
    }

    await setEnabled(value);
    setFeatureEnabled(value);
  }, [onActivity, serviceEnabled]);

  const handleToggleProtection = useCallback(async (packageName: string, protect: boolean) => {
    onActivity();

    if (protect) {
      await protectApp(packageName);
      setProtectedApps(prev => new Set([...prev, packageName]));
    } else {
      await unprotectApp(packageName);
      setProtectedApps(prev => {
        const next = new Set(prev);
        next.delete(packageName);
        return next;
      });
    }
  }, [onActivity]);

  const handleToggleHideContent = useCallback(async (value: boolean) => {
    onActivity();
    await setHideContent(value);
    setHideContentEnabled(value);
  }, [onActivity]);

  const handleToggleHideSender = useCallback(async (value: boolean) => {
    onActivity();
    await setHideSender(value);
    setHideSenderEnabled(value);
  }, [onActivity]);

  const handleToggleBlockEntirely = useCallback(async (value: boolean) => {
    onActivity();
    await setBlockEntirely(value);
    setBlockEntirelyEnabled(value);
  }, [onActivity]);

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return apps;
    const q = searchQuery.toLowerCase();
    return apps.filter(app =>
      app.appName.toLowerCase().includes(q) ||
      app.packageName.toLowerCase().includes(q),
    );
  }, [apps, searchQuery]);

  const renderApp = useCallback(({ item }: { item: AppInfo }) => {
    const isProtected = protectedApps.has(item.packageName);
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
        <Text style={styles.appName} numberOfLines={1}>
          {item.appName}
        </Text>
        <Switch
          value={isProtected}
          onValueChange={(value) => handleToggleProtection(item.packageName, value)}
          trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
          thumbColor={themeColors.surface}
          disabled={!featureEnabled}
        />
      </View>
    );
  }, [protectedApps, featureEnabled, styles, themeColors, handleToggleProtection]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Notification Privacy</Text>
        <View style={styles.backButton} />
      </View>

      {/* Enable toggle */}
      <View style={styles.enableRow}>
        <View style={styles.enableTextContainer}>
          <Text style={styles.enableLabel}>Enable Notification Privacy</Text>
          <Text style={styles.enableDesc}>
            {serviceEnabled
              ? 'Mask notification content from selected apps.'
              : 'Notification listener not enabled.'}
          </Text>
        </View>
        <Switch
          value={featureEnabled}
          onValueChange={handleToggleEnabled}
          trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
          thumbColor={themeColors.surface}
        />
      </View>

      {!serviceEnabled && featureEnabled && (
        <Pressable
          style={styles.serviceWarning}
          onPress={() => openListenerSettings()}
        >
          <Text style={styles.serviceWarningText}>
            Tap to enable Notification Access
          </Text>
        </Pressable>
      )}

      {/* Masking options */}
      {featureEnabled && (
        <View style={styles.optionsContainer}>
          <Text style={styles.optionsTitle}>Privacy Options</Text>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Hide message content</Text>
            <Switch
              value={hideContentEnabled}
              onValueChange={handleToggleHideContent}
              trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
              thumbColor={themeColors.surface}
              disabled={blockEntirelyEnabled}
            />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Hide sender name</Text>
            <Switch
              value={hideSenderEnabled}
              onValueChange={handleToggleHideSender}
              trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
              thumbColor={themeColors.surface}
              disabled={blockEntirelyEnabled}
            />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Block notifications completely</Text>
            <Switch
              value={blockEntirelyEnabled}
              onValueChange={handleToggleBlockEntirely}
              trackColor={{ false: themeColors.surfaceContainerHigh, true: themeColors.accent }}
              thumbColor={themeColors.surface}
            />
          </View>
        </View>
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
          {protectedApps.size} app{protectedApps.size !== 1 ? 's' : ''} protected
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
  optionsContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: c.surfaceContainer,
    borderRadius: 12,
    padding: spacing.md,
  },
  optionsTitle: {
    ...typography.labelMedium,
    color: c.textTertiary,
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  optionLabel: {
    ...typography.bodyMedium,
    color: c.textPrimary,
    flex: 1,
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
  appName: {
    ...typography.bodyMedium,
    color: c.textPrimary,
    flex: 1,
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
