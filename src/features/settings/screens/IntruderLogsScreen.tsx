/**
 * VaultCalc - Intruder Dashboard Screen
 *
 * Premium Intruder Intelligence dashboard with card-based timeline UI.
 * Groups intruder reports by Today / Yesterday / Older.
 * Each card shows photo, time, location, risk badge, and attempt count.
 *
 * @see FEATURE_INDEX.md SEC-003, SEC-005
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  SectionList,
  Image,
  StyleSheet,
  type SectionListRenderItemInfo,
  type SectionListData,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VaultStackParamList } from '@typedefs/navigation';
import { useActivityTracker } from '@features/auth';
import { intruderLogs, type IntruderLog, type RiskLevel } from '@services/storage';
import { decryptFile, getVaultDirectory } from '@services/crypto';
import { deleteFile } from '@services/media';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { alert } from '@store/alertStore';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ShieldIllustration } from '@shared/illustrations/EmptyStateIllustrations';
import { useTranslation } from '@shared/i18n';

type NavProp = NativeStackNavigationProp<VaultStackParamList>;

// ── Helpers ──────────────────────────────────────────────────────────────

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'HIGH': return '#EF4444';
    case 'MEDIUM': return '#EAB308';
    case 'LOW': return '#22C55E';
  }
}

function getRiskIndicator(_level: RiskLevel): string {
  return '\u25CF';
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isToday(ms: number): boolean {
  const now = new Date();
  const date = new Date(ms);
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

function isYesterday(ms: number): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = new Date(ms);
  return date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
}

type GroupedSection = {
  title: string;
  data: IntruderLog[];
};

function groupLogs(logs: IntruderLog[]): GroupedSection[] {
  const today: IntruderLog[] = [];
  const yesterday: IntruderLog[] = [];
  const older: IntruderLog[] = [];

  for (const log of logs) {
    if (isToday(log.timestamp)) today.push(log);
    else if (isYesterday(log.timestamp)) yesterday.push(log);
    else older.push(log);
  }

  const sections: GroupedSection[] = [];
  if (today.length > 0) sections.push({ title: 'today', data: today });
  if (yesterday.length > 0) sections.push({ title: 'yesterday', data: yesterday });
  if (older.length > 0) sections.push({ title: 'older', data: older });
  return sections;
}

// ── Intruder Card Component ─────────────────────────────────────────────

function IntruderCard({
  log,
  themeColors,
  onPress,
}: {
  log: IntruderLog;
  themeColors: ColorTokens;
  onPress: (log: IntruderLog) => void;
}): React.JSX.Element {
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const { t } = useTranslation();
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let tempPath: string | null = null;

    async function decryptThumbnail() {
      if (!log.photoPath) return;
      const vaultDirResult = await getVaultDirectory();
      if (!vaultDirResult.success || !vaultDirResult.data || cancelled) return;
      tempPath = `${vaultDirResult.data}/temp_intruder_${log.id}.jpg`;
      const result = await decryptFile(log.photoPath, tempPath, log.id);
      if (!cancelled && result.success) {
        setThumbnailUri(`file://${tempPath}`);
      }
    }
    decryptThumbnail();

    return () => {
      cancelled = true;
      if (tempPath) deleteFile(tempPath);
    };
  }, [log.photoPath, log.id]);

  const riskColor = getRiskColor(log.riskLevel);

  return (
    <Pressable
      onPress={() => onPress(log)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Photo area */}
      <View style={styles.cardImageContainer}>
        {thumbnailUri ? (
          <Image source={{ uri: thumbnailUri }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={styles.cardImagePlaceholderText}>
              {log.photoPath ? '...' : t('intruder_logs.no_photo')}
            </Text>
          </View>
        )}
        {/* Risk badge overlay */}
        <View style={[styles.riskBadge, { backgroundColor: riskColor }]}>
          <Text style={styles.riskBadgeText}>{log.riskLevel}</Text>
        </View>
      </View>

      {/* Info area */}
      <View style={styles.cardInfo}>
        <View style={styles.cardInfoRow}>
          <Text style={styles.cardInfoLabel}>{t('intruder_logs.column_time')}</Text>
          <Text style={styles.cardInfoValue}>{formatTime(log.timestamp)}</Text>
        </View>
        <View style={styles.cardInfoRow}>
          <Text style={styles.cardInfoLabel}>{t('intruder_logs.column_location')}</Text>
          <Text style={styles.cardInfoValue} numberOfLines={1}>
            {log.cityName || t('common.unknown')}
          </Text>
        </View>
        <View style={styles.cardInfoRow}>
          <Text style={styles.cardInfoLabel}>{t('intruder_logs.column_risk')}</Text>
          <Text style={[styles.cardInfoValue, { color: riskColor }]}>
            {log.riskLevel} {getRiskIndicator(log.riskLevel)}
          </Text>
        </View>
        <View style={styles.cardInfoRow}>
          <Text style={styles.cardInfoLabel}>{t('intruder_logs.column_attempts')}</Text>
          <Text style={styles.cardInfoValue}>{log.failedAttempts}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ── Stats Header ────────────────────────────────────────────────────────

function StatsHeader({
  logs,
  themeColors,
}: {
  logs: IntruderLog[];
  themeColors: ColorTokens;
}): React.JSX.Element {
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const { t } = useTranslation();

  const highRisk = logs.filter(l => l.riskLevel === 'HIGH').length;
  const medRisk = logs.filter(l => l.riskLevel === 'MEDIUM').length;
  const todayCount = logs.filter(l => isToday(l.timestamp)).length;

  return (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <Text style={styles.statNumber}>{logs.length}</Text>
        <Text style={styles.statLabel}>{t('intruder_logs.stat_total')}</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statNumber}>{todayCount}</Text>
        <Text style={styles.statLabel}>{t('intruder_logs.stat_today')}</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statNumber, { color: '#EF4444' }]}>{highRisk}</Text>
        <Text style={styles.statLabel}>{t('intruder_logs.stat_high_risk')}</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statNumber, { color: '#EAB308' }]}>{medRisk}</Text>
        <Text style={styles.statLabel}>{t('intruder_logs.stat_medium')}</Text>
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────

export function IntruderLogsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation<NavProp>();
  const { onActivity } = useActivityTracker();

  const [logs, setLogs] = useState<IntruderLog[]>([]);
  const sections = useMemo(() => groupLogs(logs), [logs]);

  const loadLogs = useCallback(async () => {
    const allLogs = await intruderLogs.getAll();
    setLogs(allLogs);
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleBack = useCallback(() => {
    onActivity();
    navigation.goBack();
  }, [onActivity, navigation]);

  const handleClearAll = useCallback(() => {
    onActivity();
    alert(
      t('intruder_logs.clear_title'),
      t('intruder_logs.clear_body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('intruder_logs.clear_all'),
          style: 'destructive',
          onPress: async () => {
            for (const log of logs) {
              if (log.photoPath) await deleteFile(log.photoPath);
            }
            await intruderLogs.deleteAll();
            setLogs([]);
          },
        },
      ],
    );
  }, [onActivity, logs]);

  const handleCardPress = useCallback((log: IntruderLog) => {
    onActivity();
    navigation.navigate('IntruderDetail', { logId: log.id });
  }, [onActivity, navigation]);

  const renderItem = useCallback(({ item }: SectionListRenderItemInfo<IntruderLog>) => (
    <IntruderCard log={item} themeColors={themeColors} onPress={handleCardPress} />
  ), [themeColors, handleCardPress]);

  const sectionTitleMap: Record<string, string> = {
    today: t('common.today'),
    yesterday: t('intruder_logs.section_yesterday'),
    older: t('intruder_logs.section_older'),
  };

  const renderSectionHeader = useCallback(({ section }: {
    section: SectionListData<IntruderLog, GroupedSection>;
  }) => (
    <Text style={styles.sectionHeader}>{sectionTitleMap[section.title] ?? section.title}</Text>
  ), [styles.sectionHeader, sectionTitleMap]);

  const keyExtractor = useCallback((item: IntruderLog) => item.id, []);

  const renderEmpty = useCallback(() => (
    <Animated.View entering={FadeInUp.springify().damping(18).stiffness(160)} style={styles.emptyContainer}>
      <ShieldIllustration size={140} color={themeColors.textTertiary} accent={themeColors.accent} />
      <Text style={styles.emptyTitle}>{t('intruder_logs.empty_title')}</Text>
      <Text style={styles.emptyText}>
        {t('intruder_logs.empty_body')}
      </Text>
    </Animated.View>
  ), [styles, themeColors]);

  const renderListHeader = useCallback(() => {
    if (logs.length === 0) return null;
    return <StatsHeader logs={logs} themeColors={themeColors} />;
  }, [logs, themeColors]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>&#x2190;</Text>
        </Pressable>
        <Text style={styles.title}>{t('intruder_logs.title')}</Text>
        {logs.length > 0 ? (
          <Pressable
            onPress={handleClearAll}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Clear all reports"
          >
            <Text style={styles.clearButtonText}>{t('intruder_logs.clear_button')}</Text>
          </Pressable>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {/* Report list */}
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={logs.length === 0 ? styles.emptyListContent : styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

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
    height: layout.topBarHeight,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: c.textPrimary,
  },
  title: {
    ...typography.titleLarge,
    color: c.textPrimary,
  },
  placeholder: {
    width: 50,
  },
  clearButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearButtonText: {
    ...typography.bodyMedium,
    color: c.error,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: c.surfaceContainer,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    ...typography.titleLarge,
    color: c.textPrimary,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: 2,
  },

  // Section headers
  sectionHeader: {
    ...typography.labelLarge,
    color: c.textSecondary,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },

  // Card
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: c.surfaceContainer,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardImageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: c.surfaceContainerHigh,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImagePlaceholderText: {
    ...typography.bodyLarge,
    color: c.textTertiary,
  },
  riskBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  riskBadgeText: {
    ...typography.labelMedium,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cardInfo: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfoLabel: {
    ...typography.bodySmall,
    color: c.textSecondary,
  },
  cardInfoValue: {
    ...typography.bodyMedium,
    color: c.textPrimary,
    fontWeight: '600',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  emptyListContent: {
    flexGrow: 1,
  },
  listContent: {
    paddingBottom: spacing['2xl'],
  },
  emptyIllustration: {
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.titleMedium,
    color: c.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: c.textSecondary,
    textAlign: 'center',
  },
});
