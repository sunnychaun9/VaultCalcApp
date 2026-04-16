/**
 * VaultCalc - Note Editor Screen
 *
 * Full-screen editor for creating and editing notes.
 * Auto-saves with debounce and shows save status.
 * Explicit save button + auto-save on back navigation.
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
  ScrollView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import type { VaultStackScreenProps } from '@typedefs/navigation';
import { notes as notesDb } from '@services/storage/database';
import { useThemeColors, colors, type ColorTokens, typography, spacing } from '@shared/theme';
import { Icon, IconButton } from '@shared/components/Icon';
import { useActivityTracker } from '@features/auth';
import { shareNoteAsText } from '@services/share';
import { alert } from '@store/alertStore';
import { sanitizeUserInput } from '@shared/utils/formatters';
import { useTranslation } from 'react-i18next';

type Props = VaultStackScreenProps<'NoteEditor'>;

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved';

export function NoteEditorScreen({ navigation, route }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const { noteId } = route.params;
  const themeColors = useThemeColors();
  const isDark = themeColors === colors.dark;
  const styles = useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);
  const queryClient = useQueryClient();
  const { onActivity } = useActivityTracker();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Track whether edits were made
  const originalTitleRef = useRef('');
  const originalContentRef = useRef('');
  const contentInputRef = useRef<TextInput>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  // Save check animation
  const checkScale = useSharedValue(0);
  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

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
   * Check if there are unsaved changes
   */
  const isDirty = useCallback(() => {
    const trimmedTitle = sanitizeUserInput(title).trim();
    return (
      trimmedTitle !== originalTitleRef.current ||
      content !== originalContentRef.current
    );
  }, [title, content]);

  /**
   * Save note to DB
   */
  const saveNote = useCallback(async () => {
    const trimmedTitle = sanitizeUserInput(title).trim();
    if (trimmedTitle.length === 0) return;
    if (!isDirty()) {
      setSaveStatus('saved');
      return;
    }
    if (isSavingRef.current) return;

    isSavingRef.current = true;
    setSaveStatus('saving');

    await notesDb.update(noteId, trimmedTitle, content);
    await queryClient.invalidateQueries({ queryKey: ['notes'] });

    originalTitleRef.current = trimmedTitle;
    originalContentRef.current = content;
    isSavingRef.current = false;
    setSaveStatus('saved');

    // Animate check mark
    checkScale.value = withSequence(
      withTiming(1.2, { duration: 150, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 100 }),
    );

    // Reset to idle after 2s
    setTimeout(() => {
      setSaveStatus(prev => prev === 'saved' ? 'idle' : prev);
    }, 2000);
  }, [noteId, title, content, queryClient, isDirty, checkScale]);

  /**
   * Schedule auto-save after 2s of inactivity
   */
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setSaveStatus('unsaved');
    autoSaveTimerRef.current = setTimeout(() => {
      saveNote();
    }, 2000);
  }, [saveNote]);

  // Cleanup auto-save timer
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  /**
   * Handle text changes with auto-save scheduling
   */
  const handleTitleChange = useCallback((t: string) => {
    onActivity();
    setTitle(t);
    scheduleAutoSave();
  }, [onActivity, scheduleAutoSave]);

  const handleContentChange = useCallback((c: string) => {
    onActivity();
    setContent(c);
    scheduleAutoSave();
  }, [onActivity, scheduleAutoSave]);

  /**
   * Handle explicit save button press
   */
  const handleSave = useCallback(async () => {
    onActivity();
    Keyboard.dismiss();
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    await saveNote();
  }, [onActivity, saveNote]);

  /**
   * Handle back — save then navigate
   */
  const handleBack = useCallback(async () => {
    onActivity();
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (isDirty()) {
      const trimmedTitle = sanitizeUserInput(title).trim();
      if (trimmedTitle.length > 0) {
        await notesDb.update(noteId, trimmedTitle, content);
        await queryClient.invalidateQueries({ queryKey: ['notes'] });
      }
    }
    // Natural transition — try interstitial when returning to vault
    try {
      const { tryShowInterstitial } = require('@services/ads');
      await tryShowInterstitial('VaultHome', 'note_close');
    } catch { /* non-critical */ }
    navigation.goBack();
  }, [onActivity, isDirty, title, content, noteId, queryClient, navigation]);

  /**
   * Handle delete note
   */
  const handleDelete = useCallback(() => {
    onActivity();
    alert(
      t('note_editor.delete_title'),
      t('note_editor.delete_body', { title: title.trim() || t('note_editor.untitled') }),
      [
        { text: t('common.keep'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            if (autoSaveTimerRef.current) {
              clearTimeout(autoSaveTimerRef.current);
            }
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
    // Save first if dirty
    if (isDirty()) {
      await saveNote();
    }
    await shareNoteAsText(title.trim() || 'Untitled', content);
  }, [onActivity, isDirty, saveNote, title, content]);

  /**
   * Handle title submit — move focus to content
   */
  const handleTitleSubmit = useCallback(() => {
    contentInputRef.current?.focus();
  }, []);

  /** Word count */
  const wordCount = useMemo(() => {
    const trimmed = content.trim();
    if (trimmed.length === 0) return 0;
    return trimmed.split(/\s+/).length;
  }, [content]);

  /** Character count */
  const charCount = content.length;

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('common.decrypting')}</Text>
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
            styles.backButton,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back and save"
          hitSlop={8}
        >
          <Icon name="arrow-left" size={20} color={themeColors.textPrimary} />
        </Pressable>

        {/* Save status indicator */}
        <View style={styles.statusContainer}>
          {saveStatus === 'unsaved' && (
            <View style={styles.statusDot} />
          )}
          {saveStatus === 'saving' && (
            <Text style={styles.statusText}>{t('common.saving')}</Text>
          )}
          {saveStatus === 'saved' && (
            <Animated.View style={[styles.statusSavedRow, checkAnimStyle]}>
              <Icon name="check" size={14} color={themeColors.success} />
              <Text style={styles.statusSavedText}> {t('common.done')}</Text>
            </Animated.View>
          )}
        </View>

        <View style={styles.headerActions}>
          {/* Save button */}
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              (saveStatus === 'unsaved') && styles.saveButtonActive,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Save note"
            hitSlop={4}
          >
            <Icon
              name="check"
              size={18}
              color={saveStatus === 'unsaved' ? themeColors.textOnAccent : themeColors.textSecondary}
              strokeWidth={2.5}
            />
          </Pressable>

          <IconButton
            name="share"
            size={19}
            onPress={handleShareNote}
            color={themeColors.textSecondary}
            accessibilityLabel="Share note"
          />
          <IconButton
            name="trash"
            size={19}
            onPress={handleDelete}
            color={themeColors.error}
            accessibilityLabel="Delete note"
          />
        </View>
      </View>

      {/* Editor */}
      <KeyboardAvoidingView
        style={styles.editorWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title input */}
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={handleTitleChange}
            placeholder={t('note_editor.title_placeholder')}
            placeholderTextColor={themeColors.textTertiary}
            returnKeyType="next"
            onSubmitEditing={handleTitleSubmit}
            maxLength={100}
            blurOnSubmit={false}
            selectionColor={themeColors.accent}
          />

          {/* Separator */}
          <View style={styles.separator} />

          {/* Content input */}
          <TextInput
            ref={contentInputRef}
            style={styles.contentInput}
            value={content}
            onChangeText={handleContentChange}
            placeholder={t('note_editor.content_placeholder')}
            placeholderTextColor={themeColors.textTertiary}
            multiline
            textAlignVertical="top"
            selectionColor={themeColors.accent}
          />
        </ScrollView>

        {/* Bottom bar with word count */}
        <Animated.View style={styles.bottomBar} entering={FadeIn.delay(200).duration(300)}>
          <Text style={styles.countText}>
            {t(wordCount === 1 ? 'note_editor.word_count_one' : 'note_editor.word_count_other', { count: wordCount })}
          </Text>
          <Text style={styles.countDivider}>{'\u00B7'}</Text>
          <Text style={styles.countText}>
            {charCount} {charCount === 1 ? 'char' : 'chars'}
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (c: ColorTokens, isDark: boolean) => StyleSheet.create({
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

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 52,
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  buttonPressed: {
    opacity: 0.6,
  },
  statusContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.warning,
  },
  statusText: {
    ...typography.labelSmall,
    color: c.textTertiary,
  },
  statusSavedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusSavedText: {
    ...typography.labelSmall,
    color: c.success,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  saveButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  saveButtonActive: {
    backgroundColor: c.accent,
  },

  // ── Editor ──
  editorWrapper: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
    flexGrow: 1,
  },
  titleInput: {
    ...typography.headlineLarge,
    color: c.textPrimary,
    fontWeight: '600',
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    minHeight: 48,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    marginBottom: spacing.sm,
  },
  contentInput: {
    ...typography.bodyLarge,
    color: c.textPrimary,
    lineHeight: 26,
    paddingTop: spacing.sm,
    minHeight: 200,
  },

  // ── Bottom bar ──
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    backgroundColor: c.surface,
  },
  countText: {
    ...typography.labelSmall,
    color: c.textTertiary,
  },
  countDivider: {
    ...typography.labelSmall,
    color: c.textTertiary,
    marginHorizontal: spacing.sm,
  },
});
