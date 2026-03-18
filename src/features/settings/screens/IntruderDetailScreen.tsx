/**
 * VaultCalc - Intruder Detail Screen
 *
 * Shows full details of a single intruder report including:
 * - Full-screen photo
 * - Exact timestamp, device info, coordinates
 * - Risk level badge
 * - Map preview via embedded WebView (OpenStreetMap)
 *
 * @see FEATURE_INDEX.md SEC-005
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  Linking,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { VaultStackParamList } from '@typedefs/navigation';
import { useActivityTracker } from '@features/auth';
import { intruderLogs, type IntruderLog, type RiskLevel } from '@services/storage';
import { decryptFile, getVaultDirectory } from '@services/crypto';
import { deleteFile } from '@services/media';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';

type DetailRoute = RouteProp<VaultStackParamList, 'IntruderDetail'>;

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'HIGH': return '#EF4444';
    case 'MEDIUM': return '#EAB308';
    case 'LOW': return '#22C55E';
  }
}

function getRiskEmoji(level: RiskLevel): string {
  switch (level) {
    case 'HIGH': return '\uD83D\uDD34';
    case 'MEDIUM': return '\uD83D\uDFE1';
    case 'LOW': return '\uD83D\uDFE2';
  }
}

function formatFullTimestamp(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString([], {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDeviceInfo(info: Record<string, unknown> | null): string {
  if (!info) return 'Unknown';
  const parts: string[] = [];
  if (info.platform) parts.push(String(info.platform));
  if (info.osVersion) parts.push(`API ${info.osVersion}`);
  return parts.length > 0 ? parts.join(' · ') : 'Unknown';
}

export function IntruderDetailScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation();
  const route = useRoute<DetailRoute>();
  const { onActivity } = useActivityTracker();

  const [log, setLog] = useState<IntruderLog | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [fullScreenPhoto, setFullScreenPhoto] = useState(false);

  const logId = route.params.logId;

  // Load the specific log entry
  useEffect(() => {
    let cancelled = false;

    async function loadLog() {
      const allLogs = await intruderLogs.getAll();
      const found = allLogs.find(l => l.id === logId);
      if (!cancelled && found) setLog(found);
    }
    loadLog();

    return () => { cancelled = true; };
  }, [logId]);

  // Decrypt photo
  useEffect(() => {
    if (!log?.photoPath) return;
    let cancelled = false;
    let tempPath: string | null = null;

    async function decrypt() {
      const vaultDirResult = await getVaultDirectory();
      if (!vaultDirResult.success || !vaultDirResult.data || cancelled) return;
      tempPath = `${vaultDirResult.data}/temp_intruder_detail_${log!.id}.jpg`;
      const result = await decryptFile(log!.photoPath!, tempPath, log!.id);
      if (!cancelled && result.success) {
        setPhotoUri(`file://${tempPath}`);
      }
    }
    decrypt();

    return () => {
      cancelled = true;
      if (tempPath) deleteFile(tempPath);
    };
  }, [log?.photoPath, log?.id]);

  const handleBack = useCallback(() => {
    onActivity();
    navigation.goBack();
  }, [onActivity, navigation]);

  const handleOpenMap = useCallback(() => {
    if (!log?.latitude || !log?.longitude) return;
    const url = Platform.select({
      android: `geo:${log.latitude},${log.longitude}?q=${log.latitude},${log.longitude}(Intruder)`,
      default: `https://maps.google.com/?q=${log.latitude},${log.longitude}`,
    })!;
    Linking.openURL(url);
  }, [log]);

  if (!log) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>&#x2190;</Text>
          </Pressable>
          <Text style={styles.title}>Report</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const riskColor = getRiskColor(log.riskLevel);
  const hasLocation = log.latitude !== null && log.longitude !== null &&
    log.latitude !== 0 && log.longitude !== 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>&#x2190;</Text>
        </Pressable>
        <Text style={styles.title}>Intruder Report</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo */}
        <Pressable
          onPress={() => photoUri && setFullScreenPhoto(true)}
          style={styles.photoContainer}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>
                {log.photoPath ? 'Decrypting...' : 'No Photo Captured'}
              </Text>
            </View>
          )}
          {/* Risk badge */}
          <View style={[styles.riskOverlay, { backgroundColor: riskColor }]}>
            <Text style={styles.riskOverlayText}>
              {log.riskLevel} RISK {getRiskEmoji(log.riskLevel)}
            </Text>
          </View>
        </Pressable>

        {/* Details card */}
        <View style={styles.detailsCard}>
          <DetailRow label="Timestamp" value={formatFullTimestamp(log.timestamp)} colors={themeColors} />
          <DetailRow label="Location" value={log.cityName || 'Unknown'} colors={themeColors} />
          {hasLocation && (
            <DetailRow
              label="Coordinates"
              value={`${log.latitude!.toFixed(6)}, ${log.longitude!.toFixed(6)}`}
              colors={themeColors}
            />
          )}
          <DetailRow label="Failed Attempts" value={String(log.failedAttempts)} colors={themeColors} />
          <DetailRow
            label="Risk Level"
            value={`${log.riskLevel} ${getRiskEmoji(log.riskLevel)}`}
            valueColor={riskColor}
            colors={themeColors}
          />
          <DetailRow label="Device" value={formatDeviceInfo(log.deviceInfo)} colors={themeColors} />
          <DetailRow label="OS Version" value={`Android ${log.deviceInfo?.osVersion ?? 'Unknown'}`} colors={themeColors} />
        </View>

        {/* Map section */}
        {hasLocation && (
          <View style={styles.mapSection}>
            <Text style={styles.mapSectionTitle}>Location Map</Text>
            <Pressable onPress={handleOpenMap} style={styles.mapCard}>
              <Image
                source={{
                  uri: `https://staticmap.openstreetmap.de/staticmap.php?center=${log.latitude},${log.longitude}&zoom=14&size=600x250&markers=${log.latitude},${log.longitude},red-pushpin`,
                }}
                style={styles.mapImage}
                resizeMode="cover"
              />
              <View style={styles.mapOverlay}>
                <Text style={styles.mapOverlayText}>Tap to open in Maps</Text>
              </View>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Full-screen photo modal */}
      <Modal
        visible={fullScreenPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenPhoto(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setFullScreenPhoto(false)}
        >
          <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => setFullScreenPhoto(false)}
                style={styles.backButton}
              >
                <Text style={styles.modalCloseText}>&#x2715;</Text>
              </Pressable>
              <Text style={styles.modalTimestamp}>
                {formatFullTimestamp(log.timestamp)}
              </Text>
              <View style={styles.placeholder} />
            </View>
            {photoUri && (
              <Image
                source={{ uri: photoUri }}
                style={styles.fullPhoto}
                resizeMode="contain"
              />
            )}
          </SafeAreaView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Detail Row Component ────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  valueColor,
  colors: c,
}: {
  label: string;
  value: string;
  valueColor?: string;
  colors: ColorTokens;
}): React.JSX.Element {
  return (
    <View style={detailRowStyles.row}>
      <Text style={[detailRowStyles.label, { color: c.textSecondary }]}>{label}</Text>
      <Text
        style={[detailRowStyles.value, { color: valueColor || c.textPrimary }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  label: {
    ...typography.bodyMedium,
    flex: 1,
  },
  value: {
    ...typography.bodyMedium,
    fontWeight: '600',
    flex: 1.2,
    textAlign: 'right',
  },
});

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
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodyLarge,
    color: c.textTertiary,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },

  // Photo
  photoContainer: {
    width: '100%',
    height: 300,
    backgroundColor: c.surfaceContainerHigh,
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    ...typography.bodyLarge,
    color: c.textTertiary,
  },
  riskOverlay: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  riskOverlayText: {
    ...typography.labelLarge,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Details
  detailsCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.base,
    backgroundColor: c.surfaceContainer,
    borderRadius: 16,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },

  // Map
  mapSection: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  mapSectionTitle: {
    ...typography.labelLarge,
    color: c.textSecondary,
    marginBottom: spacing.sm,
  },
  mapCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: c.surfaceContainer,
  },
  mapImage: {
    width: '100%',
    height: 180,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  mapOverlayText: {
    ...typography.labelMedium,
    color: '#FFFFFF',
  },

  // Full-screen modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: layout.topBarHeight,
  },
  modalCloseText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  modalTimestamp: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  fullPhoto: {
    flex: 1,
  },
});
