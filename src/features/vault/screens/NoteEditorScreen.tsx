/**
 * VaultCalc - Note Editor Screen
 *
 * Full-screen editor for creating and editing notes.
 * Auto-saves title and content on back navigation.
 * Supports delete via header trash button.
 *
 * @see FEATURE_INDEX.md NOTES-002
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import type { VaultStackScreenProps } from '@typedefs/navigation';
import { notes as notesDb } from '@services/storage/database';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { Icon, IconButton } from '@shared/components/Icon';
import { useActivityTracker } from '@features/auth';
import { shareNoteAsText } from '@services/share';
import { alert } from '@store/alertStore';
import { sanitizeUserInput } from '@shared/utils/formatters';

type Props = VaultStackScreenProps<'NoteEditor'>;

export function NoteEditorScreen({ navigation, route }: Props): React.JSX.Element {
  const { noteId } = route.params;
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const queryClient = useQueryClient();
  const { onActivity } = useActivityTracker();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  // Track whether edits were made
  const originalTitleRef = useRef('');
  const originalContentRef = useRef('');
  const contentInputRef = useRef<TextInput>(null);

  // Load note from DB
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const loaded = await notesDb.getById(noteId);
      if (cancelled || !loaded) return;
      setTitle(loaded.title);
      setContent(loaded.content);
      originalTitleRef.current = loaded.title;
      originalContentRef.current = loaded.content;
      setIsLoaded(true);
    }
    load();
    return () => { cancelled = true; };
  }, [noteId]);

  /**
   * Save note if changed
   */
  const saveIfDirty = useCallback(async () => {
    const trimmedTitle = sanitizeUserInput(title).trim();
    const isDirty =
      trimmedTitle !== originalTitleRef.current ||
      content !== originalContentRef.current;

    if (!isDirty || trimmedTitle.length === 0) return;

    await notesDb.update(noteId, trimmedTitle, content);
    await queryClient.invalidateQueries({ queryKey: ['notes'] });
  }, [noteId, title, content, queryClient]);

  /**
   * Handle back — save then navigate
   */
  const handleBack = useCallback(async () => {
    onActivity();
    await saveIfDirty();
    navigation.goBack();
  }, [onActivity, saveIfDirty, navigation]);

  /**
   * Handle delete note
   */
  const handleDelete = useCallback(() => {
    onActivity();
    alert(
      'Delete Note',
      `Delete "${title.trim() || 'Untitled'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await notesDb.deleteByIds([noteId]);
            await queryClient.invalidateQueries({ queryKey: ['notes'] });
            navigation.goBack();
          },
        },
      ],
    );
  }, [onActivity, title, noteId, queryClient, navigation]);

  /**
   * Handle share note (ENH-001)
   */
  const handleShareNote = useCallback(async () => {
    onActivity();
    await saveIfDirty();
    await shareNoteAsText(title.trim() || 'Untitled', content);
  }, [onActivity, saveIfDirty, title, content]);

  /**
   * Handle title submit — move focus to content
   */
  const handleTitleSubmit = useCallback(() => {
    contentInputRef.current?.focus();
  }, []);

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Decrypting...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.headerButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={20} color={themeColors.textPrimary} />
          <Text style={styles.backText}> Back</Text>
        </Pressable>
        <View style={styles.headerSpacer} />
        <IconButton
          name="share"
          size={20}
          onPress={handleShareNote}
          color={themeColors.accent}
          accessibilityLabel="Share note"
        />
        <IconButton
          name="trash"
          size={20}
          onPress={handleDelete}
          color={themeColors.error}
          accessibilityLabel="Delete note"
        />
      </View>

      {/* Editor */}
      <KeyboardAvoidingView
        style={styles.editorContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Title input */}
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={(t) => { onActivity(); setTitle(t); }}
          placeholder="Note title"
          placeholderTextColor={themeColors.textSecondary}
          returnKeyType="next"
          onSubmitEditing={handleTitleSubmit}
          maxLength={100}
          blurOnSubmit={false}
        />

        {/* Content input */}
        <TextInput
          ref={contentInputRef}
          style={styles.contentInput}
          value={content}
          onChangeText={(c) => { onActivity(); setContent(c); }}
          placeholder="Start writing..."
          placeholderTextColor={themeColors.textSecondary}
          multiline
          textAlignVertical="top"
          scrollEnabled
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.vaultBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodyMedium,
    color: c.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    height: 48,
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  headerButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  headerButtonPressed: {
    opacity: 0.6,
  },
  headerSpacer: {
    flex: 1,
  },
  backText: {
    ...typography.labelLarge,
    color: c.accent,
  },
  shareText: {
    fontSize: 20,
    color: c.accent,
  },
  deleteText: {
    fontSize: 20,
  },
  editorContainer: {
    flex: 1,
    paddingHorizontal: spacing.base,
  },
  titleInput: {
    ...typography.headlineMedium,
    color: c.textPrimary,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  contentInput: {
    ...typography.bodyMedium,
    color: c.textPrimary,
    flex: 1,
    paddingVertical: spacing.md,
    lineHeight: 24,
  },
});
