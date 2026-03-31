/**
 * VaultCalc - Properties Bottom Sheet
 *
 * Read-only bottom sheet showing metadata for a single media item:
 * name, type, size, dimensions, duration, dates, favorite status.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type BottomSheetType from '@gorhom/bottom-sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { MediaItem } from '@services/storage/database';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { AppBottomSheet } from '@shared/components/AppBottomSheet';
import { formatFileSize, formatDateTime, formatDuration, formatMimeType } from '@shared/utils/formatters';

interface PropertiesModalProps {
  visible: boolean;
  item: MediaItem | null;
  onClose: () => void;
}

interface PropertyRow {
  label: string;
  value: string;
}

export function PropertiesModal({
  visible,
  item,
  onClose,
}: PropertiesModalProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const sheetRef = useRef<BottomSheetType>(null);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  const rows: PropertyRow[] = useMemo(() => {
    if (item === null) return [];
    const r: PropertyRow[] = [
      { label: 'Name', value: item.originalName },
      { label: 'Type', value: formatMimeType(item.mimeType) },
      { label: 'Size', value: formatFileSize(item.sizeBytes) },
    ];
    if (item.width != null && item.height != null) {
      r.push({ label: 'Dimensions', value: `${item.width} \u00D7 ${item.height}` });
    }
    if (item.durationMs != null && item.durationMs > 0) {
      r.push({ label: 'Duration', value: formatDuration(item.durationMs) });
    }
    r.push({ label: 'Last modified', value: formatDateTime(item.createdAt) });
    const originalUri = item.metadata?.originalUri as string | undefined;
    if (originalUri) {
      const displayPath = originalUri.startsWith('content://')
        ? decodeURIComponent(originalUri.replace(/^content:\/\/[^/]+\//, '/'))
        : originalUri;
      r.push({ label: 'Original path', value: displayPath });
    }
    r.push({ label: 'Current path', value: item.encryptedPath });
    return r;
  }, [item]);

  return (
    <AppBottomSheet
      ref={sheetRef}
      snapPoints={['40%', '75%']}
      title="Properties"
      onDismiss={onClose}
    >
      <BottomSheetScrollView style={styles.scroll}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.value} selectable>{row.value}</Text>
          </View>
        ))}
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  label: {
    ...typography.bodyMedium,
    color: c.textSecondary,
    width: 110,
    flexShrink: 0,
  },
  value: {
    ...typography.bodyMedium,
    color: c.textPrimary,
    flex: 1,
  },
});
