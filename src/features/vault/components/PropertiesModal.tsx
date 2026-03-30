/**
 * VaultCalc - Properties Modal
 *
 * Read-only modal showing metadata for a single media item:
 * name, type, size, dimensions, duration, dates, favorite status.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import type { MediaItem } from '@services/storage/database';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
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
    // Original path from metadata (stored during import)
    const originalUri = item.metadata?.originalUri as string | undefined;
    if (originalUri) {
      // Convert content:// URI to a readable path or show as-is
      const displayPath = originalUri.startsWith('content://')
        ? decodeURIComponent(originalUri.replace(/^content:\/\/[^/]+\//, '/'))
        : originalUri;
      r.push({ label: 'Original path', value: displayPath });
    }
    r.push({ label: 'Current path', value: item.encryptedPath });
    return r;
  }, [item]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Properties</Text>
          <ScrollView style={styles.scroll}>
            {rows.map((row) => (
              <View key={row.label} style={styles.row}>
                <Text style={styles.label}>{row.label}</Text>
                <Text style={styles.value} selectable>{row.value}</Text>
              </View>
            ))}
          </ScrollView>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 340,
  },
  title: {
    ...typography.titleLarge,
    color: c.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  scroll: {
    maxHeight: 400,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
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
  closeButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    backgroundColor: c.surfaceContainerHigh,
    borderRadius: 8,
  },
  closeText: {
    ...typography.labelLarge,
    color: c.textPrimary,
  },
});
