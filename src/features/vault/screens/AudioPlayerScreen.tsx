/**
 * VaultCalc - Audio Player Screen
 *
 * Full-screen audio player with:
 * - Album art placeholder with music note
 * - Track title
 * - Seek bar with timestamps
 * - Play/pause, prev/next, skip ±5s
 * - Speed selector (0.5x–3x)
 * - Playlist bottom sheet
 *
 * Uses ExoPlayer via VideoPlayerModule for decrypted audio playback.
 * Suppresses auto-lock while playing.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  NativeModules,
  NativeEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { VaultStackScreenProps } from '@typedefs/navigation';
import { mediaItems, type MediaItem } from '@services/storage/database';
import { useAuthStore } from '@store/authStore';
import { decryptFileStreaming, getVaultDirectory } from '@services/crypto';
import { deleteFile } from '@services/media';
import { Icon, IconButton } from '@shared/components/Icon';

type Props = VaultStackScreenProps<'AudioPlayer'>;

const AudioBridge = NativeModules.VideoPlayerModule;

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];

export function AudioPlayerScreen({ navigation, route }: Props): React.JSX.Element {
  const { mediaId, mediaIds = [] } = route.params;
  const { width: screenWidth } = useWindowDimensions();
  const setSuppressAutoLock = useAuthStore(s => s.setSuppressAutoLock);

  // State
  const [item, setItem] = useState<MediaItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  // Audio siblings for playlist
  const [audioSiblings, setAudioSiblings] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Play mode: 'order' → sequential, 'repeat-all' → loop playlist,
  // 'repeat-one' → repeat current, 'shuffle' → random
  type PlayMode = 'order' | 'repeat-all' | 'repeat-one' | 'shuffle';
  const [playMode, setPlayMode] = useState<PlayMode>('order');
  const shuffleHistoryRef = useRef<number[]>([]);

  // Refs
  const tempPathRef = useRef<string | null>(null);
  const isSeekingRef = useRef(false);
  const siblingsLenRef = useRef(0);
  const playModeRef = useRef<PlayMode>(playMode);

  // Keep refs in sync so event listeners always see current values
  // without needing to be torn down and recreated.
  isSeekingRef.current = isSeeking;
  siblingsLenRef.current = audioSiblings.length;
  playModeRef.current = playMode;

  // Native event listeners — mounted ONCE, use refs for mutable state
  useEffect(() => {
    const emitter = new NativeEventEmitter(NativeModules.VideoPlayerModule);

    const progressSub = emitter.addListener('onAudioProgress', (event) => {
      if (!isSeekingRef.current) {
        setCurrentTime(event.currentTime);
        if (event.duration > 0) setDuration(event.duration);
      }
    });

    const stateSub = emitter.addListener('onAudioPlaybackState', (event) => {
      setIsPlaying(event.isPlaying);
    });

    const endSub = emitter.addListener('onAudioEnd', () => {
      const mode = playModeRef.current;
      const len = siblingsLenRef.current;

      if (mode === 'repeat-one') {
        // Replay the same track — seek to start and play
        AudioBridge.audioSeekTo(0).then(() => AudioBridge.audioPlay());
        return;
      }

      setIsPlaying(false);

      if (mode === 'shuffle') {
        if (len <= 1) return;
        setCurrentIndex(prev => {
          let next: number;
          do { next = Math.floor(Math.random() * len); } while (next === prev);
          shuffleHistoryRef.current.push(prev);
          return next;
        });
      } else if (mode === 'repeat-all') {
        setCurrentIndex(prev => (prev + 1) % len);
      } else {
        // 'order' — stop at the end
        setCurrentIndex(prev => {
          if (prev < len - 1) return prev + 1;
          return prev;
        });
      }
    });

    const errorSub = emitter.addListener('onAudioError', (event) => {
      setIsPlaying(false);
      setIsBuffering(false);
      setIsLoading(false);
      console.warn('Audio playback error:', event.error);
    });

    const bufferingSub = emitter.addListener('onAudioBuffering', (event) => {
      setIsBuffering(event.isBuffering);
    });

    return () => {
      progressSub.remove();
      stateSub.remove();
      endSub.remove();
      errorSub.remove();
      bufferingSub.remove();
    };
  }, []);

  // Build sibling list
  useEffect(() => {
    if (mediaIds.length === 0) return;
    let cancelled = false;
    async function loadSiblings() {
      const items = await Promise.all(mediaIds.map(id => mediaItems.getById(id)));
      if (cancelled) return;
      const audioItems = items.filter((m): m is MediaItem => m !== null && m.type === 'audio');
      setAudioSiblings(audioItems);
      const idx = audioItems.findIndex(a => a.id === mediaId);
      if (idx >= 0) setCurrentIndex(idx);
    }
    loadSiblings();
    return () => { cancelled = true; };
  }, [mediaIds, mediaId]);

  // Stable track ID — only changes when the user picks a different track,
  // NOT when the siblings list finishes loading for the same track.
  const currentTrackId = useMemo(() => {
    if (audioSiblings.length > 0 && audioSiblings[currentIndex]) {
      return audioSiblings[currentIndex].id;
    }
    return mediaId;
  }, [audioSiblings, currentIndex, mediaId]);

  // Monotonic load ID — only the latest invocation may update state / play
  const loadIdRef = useRef(0);

  // Load and decrypt audio, then play via native ExoPlayer
  useEffect(() => {
    const thisLoadId = ++loadIdRef.current;
    const isCurrent = () => thisLoadId === loadIdRef.current;

    async function loadAudio() {
      setIsLoading(true);
      setIsPlaying(false);
      setCurrentTime(0);

      try {
        // Release previous player instance
        await AudioBridge.audioRelease().catch(() => {});
        if (!isCurrent()) return;

        const trackItem = await mediaItems.getById(currentTrackId);
        if (!isCurrent() || !trackItem) return;
        setItem(trackItem);
        setDuration(trackItem.durationMs || 0);

        const vaultDirResult = await getVaultDirectory();
        if (!isCurrent() || !vaultDirResult.success || !vaultDirResult.data) return;

        // Clean up previous temp file
        if (tempPathRef.current) {
          await deleteFile(tempPathRef.current).catch(() => {});
        }

        const ext = trackItem.originalName.includes('.')
          ? trackItem.originalName.substring(trackItem.originalName.lastIndexOf('.'))
          : '.mp3';
        const tempPath = `${vaultDirResult.data}/viewer_audio_${trackItem.id}${ext}`;
        tempPathRef.current = tempPath;

        const result = await decryptFileStreaming(
          trackItem.encryptedPath, tempPath, trackItem.id,
        );
        if (!isCurrent() || !result.success) return;

        // Load into native ExoPlayer
        const loadResult = await AudioBridge.audioLoad(tempPath);
        if (!isCurrent() || !loadResult.success) return;

        // Backfill duration if it was missing at import time.
        // The native player now has the accurate duration from ExoPlayer.
        const pos = await AudioBridge.audioGetPosition();
        if (isCurrent() && pos.duration > 0) {
          setDuration(pos.duration);
          // Persist to DB so the list also shows correct duration next time
          if (!trackItem.durationMs || trackItem.durationMs <= 0) {
            mediaItems.updateDuration(trackItem.id, pos.duration).catch(() => {});
          }
        }

        // Set speed if not default
        if (speed !== 1.0) {
          await AudioBridge.audioSetSpeed(speed);
        }

        // Auto-play
        await AudioBridge.audioPlay();
        if (isCurrent()) setIsLoading(false);
      } catch {
        if (isCurrent()) setIsLoading(false);
      }
    }

    loadAudio();
    return () => {
      // Incrementing loadIdRef in the next effect invocation invalidates isCurrent()
    };
  }, [currentTrackId]);

  // Suppress auto-lock while playing
  useEffect(() => {
    setSuppressAutoLock(isPlaying);
    return () => { setSuppressAutoLock(false); };
  }, [isPlaying, setSuppressAutoLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      AudioBridge.audioRelease().catch(() => {});
      if (tempPathRef.current) deleteFile(tempPathRef.current).catch(() => {});
    };
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      await AudioBridge.audioPause();
    } else {
      await AudioBridge.audioPlay();
    }
  }, [isPlaying]);

  const handleSeek = useCallback(async (ratio: number) => {
    const newTime = ratio * duration;
    setCurrentTime(newTime);
    await AudioBridge.audioSeekTo(newTime);
  }, [duration]);

  const handleSkip = useCallback(async (deltaMs: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + deltaMs));
    setCurrentTime(newTime);
    await AudioBridge.audioSeekTo(newTime);
  }, [duration, currentTime]);

  const handlePrev = useCallback(async () => {
    if (currentTime > 3000) {
      // Always restart current track if >3s in
      setCurrentTime(0);
      await AudioBridge.audioSeekTo(0);
      return;
    }
    if (playMode === 'shuffle' && shuffleHistoryRef.current.length > 0) {
      const prevIdx = shuffleHistoryRef.current.pop()!;
      setCurrentIndex(prevIdx);
    } else if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else if (playMode === 'repeat-all') {
      setCurrentIndex(audioSiblings.length - 1);
    } else {
      setCurrentTime(0);
      await AudioBridge.audioSeekTo(0);
    }
  }, [currentTime, currentIndex, playMode, audioSiblings.length]);

  const handleNext = useCallback(() => {
    const len = audioSiblings.length;
    if (playMode === 'shuffle') {
      if (len <= 1) return;
      shuffleHistoryRef.current.push(currentIndex);
      let next: number;
      do { next = Math.floor(Math.random() * len); } while (next === currentIndex);
      setCurrentIndex(next);
    } else if (playMode === 'repeat-all') {
      setCurrentIndex(prev => (prev + 1) % len);
    } else {
      if (currentIndex < len - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    }
  }, [currentIndex, audioSiblings.length, playMode]);

  const handleSpeedSelect = useCallback(async (s: number) => {
    setSpeed(s);
    setShowSpeedPicker(false);
    await AudioBridge.audioSetSpeed(s);
  }, []);

  const cyclePlayMode = useCallback(() => {
    setPlayMode(prev => {
      const modes: PlayMode[] = ['order', 'repeat-all', 'repeat-one', 'shuffle'];
      const nextIdx = (modes.indexOf(prev) + 1) % modes.length;
      if (modes[nextIdx] === 'shuffle') {
        shuffleHistoryRef.current = [];
      }
      return modes[nextIdx];
    });
  }, []);

  const handleBack = useCallback(async () => {
    await AudioBridge.audioRelease().catch(() => {});
    // Natural transition — try interstitial when returning to vault
    try {
      const { tryShowInterstitial } = require('@services/ads');
      await tryShowInterstitial('VaultHome', 'audio_close');
    } catch { /* non-critical */ }
    navigation.goBack();
  }, [navigation]);

  const artSize = screenWidth * 0.65;
  const seekRatio = duration > 0 ? currentTime / duration : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Back button */}
        <IconButton
          name="arrow-left"
          onPress={handleBack}
          color="#FFFFFF"
          accessibilityLabel="Go back"
          containerStyle={styles.backButton}
        />

        {/* Album art area */}
        <View style={styles.artContainer}>
          <View style={[styles.artBox, { width: artSize, height: artSize }]}>
            {isLoading ? (
              <ActivityIndicator size="large" color={ACCENT} />
            ) : (
              <Icon name="music" size={64} color="rgba(255,255,255,0.3)" />
            )}
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleText} numberOfLines={1}>
            {item?.originalName ?? 'Loading...'}
          </Text>
          <Text style={styles.subtitleText}>
            {isLoading ? 'Preparing...' : item ? formatTime(item.durationMs || 0) : ''}
          </Text>
        </View>

        {/* Controls area */}
        <View style={styles.controlsArea}>
          {/* Skip / Speed row */}
          <View style={styles.skipRow}>
            <Pressable onPress={() => handleSkip(-5000)} style={styles.skipButton}>
              <Icon name="rotate-ccw" size={20} color="rgba(255,255,255,0.7)" />
              <Text style={styles.skipLabel}>5</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowSpeedPicker(true)}
              style={styles.speedBadge}
            >
              <Text style={styles.speedText}>{speed}X</Text>
            </Pressable>

            <Pressable onPress={() => handleSkip(5000)} style={styles.skipButton}>
              <Icon name="rotate-cw" size={20} color="rgba(255,255,255,0.7)" />
              <Text style={styles.skipLabel}>5</Text>
            </Pressable>
          </View>

          {/* Seek bar */}
          <View
            style={styles.seekContainer}
            onStartShouldSetResponder={() => true}
            onResponderGrant={(e) => {
              setIsSeeking(true);
              const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / (screenWidth - 48)));
              handleSeek(ratio);
            }}
            onResponderMove={(e) => {
              const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / (screenWidth - 48)));
              setCurrentTime(ratio * duration);
            }}
            onResponderRelease={(e) => {
              const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / (screenWidth - 48)));
              handleSeek(ratio);
              setIsSeeking(false);
            }}
          >
            <View style={styles.seekTrack}>
              <View style={[styles.seekFill, { width: `${seekRatio * 100}%` }]} />
            </View>
            <View style={[styles.seekThumb, { left: `${seekRatio * 100}%` }]} />
          </View>

          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>

          {/* Playback controls */}
          <View style={styles.playbackRow}>
            <IconButton
              name={playMode === 'shuffle' ? 'shuffle' : playMode === 'repeat-one' ? 'repeat-1' : 'repeat'}
              size={20}
              onPress={cyclePlayMode}
              color={playMode === 'order' ? 'rgba(255,255,255,0.5)' : ACCENT}
              accessibilityLabel={`Play mode: ${playMode}`}
            />

            <IconButton name="skip-back" size={28} onPress={handlePrev} color="#FFFFFF" accessibilityLabel="Previous" />

            <Pressable onPress={handlePlayPause} style={styles.playButton} disabled={isLoading}>
              {isBuffering || isLoading ? (
                <ActivityIndicator size={28} color="#0a0a0a" />
              ) : (
                <Icon name={isPlaying ? 'pause' : 'play'} size={32} color="#0a0a0a" fill="#0a0a0a" />
              )}
            </Pressable>

            <IconButton name="skip-forward" size={28} onPress={handleNext} color="#FFFFFF" accessibilityLabel="Next" />

            <IconButton name="list-music" size={20} onPress={() => setShowPlaylist(true)} color="rgba(255,255,255,0.5)" accessibilityLabel="Playlist" />
          </View>
        </View>
      </SafeAreaView>

      {/* Speed picker modal */}
      <Modal visible={showSpeedPicker} transparent animationType="fade" onRequestClose={() => setShowSpeedPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSpeedPicker(false)}>
          <View style={styles.speedMenu}>
            <Text style={styles.speedMenuTitle}>Playback Speed</Text>
            {SPEEDS.map(s => (
              <Pressable
                key={s}
                onPress={() => handleSpeedSelect(s)}
                style={[styles.speedMenuItem, s === speed && styles.speedMenuItemActive]}
              >
                <Text style={[styles.speedMenuItemText, s === speed && styles.speedMenuItemTextActive]}>
                  {s}x
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Playlist modal */}
      <Modal visible={showPlaylist} transparent animationType="slide" onRequestClose={() => setShowPlaylist(false)}>
        <View style={styles.playlistBackdrop}>
          <Pressable style={styles.playlistDismiss} onPress={() => setShowPlaylist(false)} />
          <View style={styles.playlistSheet}>
            <View style={styles.playlistHeader}>
              <Pressable onPress={() => setShowPlaylist(false)}>
                <Icon name="x" size={20} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.playlistTitle}>Playlist ({audioSiblings.length})</Text>
              <View style={{ width: 32 }} />
            </View>
            <FlatList
              data={audioSiblings}
              keyExtractor={a => a.id}
              renderItem={({ item: audioItem, index }) => (
                <Pressable
                  onPress={() => { setCurrentIndex(index); setShowPlaylist(false); }}
                  style={[styles.playlistItem, index === currentIndex && styles.playlistItemActive]}
                >
                  <View style={styles.playlistItemIcon}>
                    <Icon name={index === currentIndex ? 'volume' : 'music'} size={16} color={index === currentIndex ? '#3B82F6' : 'rgba(255,255,255,0.5)'} />
                  </View>
                  <View style={styles.playlistItemText}>
                    <Text
                      style={[styles.playlistItemName, index === currentIndex && styles.playlistItemNameActive]}
                      numberOfLines={1}
                    >
                      {audioItem.originalName}
                    </Text>
                    <Text style={styles.playlistItemMeta}>
                      {formatTime(audioItem.durationMs || 0)}
                    </Text>
                  </View>
                </Pressable>
              )}
              style={styles.playlistList}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ACCENT = '#3B82F6';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  safeArea: { flex: 1 },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  artContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  artBox: { borderRadius: 20, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center', elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16 },
  titleContainer: { alignItems: 'center', paddingHorizontal: 32, marginBottom: 16 },
  titleText: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  subtitleText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  controlsArea: { paddingHorizontal: 24, paddingBottom: 16 },
  skipRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 40, marginBottom: 16 },
  skipButton: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44 },
  skipLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: -4 },
  speedBadge: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 },
  speedText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  seekContainer: { height: 28, justifyContent: 'center', marginBottom: 4 },
  seekTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  seekFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 2 },
  seekThumb: { position: 'absolute', top: 7, width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF', marginLeft: -7, elevation: 3 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  timeText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontVariant: ['tabular-nums'] },
  playbackRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8 },
  playButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', elevation: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  speedMenu: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, width: 200 },
  speedMenuTitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textAlign: 'center' },
  speedMenuItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  speedMenuItemActive: { backgroundColor: 'rgba(59,130,246,0.15)' },
  speedMenuItemText: { fontSize: 15, color: '#FFFFFF', textAlign: 'center' },
  speedMenuItemTextActive: { color: ACCENT, fontWeight: '700' },
  playlistBackdrop: { flex: 1, justifyContent: 'flex-end' },
  playlistDismiss: { flex: 1 },
  playlistSheet: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '50%', paddingBottom: 16 },
  playlistHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  playlistTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  playlistList: { paddingHorizontal: 12 },
  playlistItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
  playlistItemActive: { backgroundColor: 'rgba(59,130,246,0.1)' },
  playlistItemIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  playlistItemText: { flex: 1 },
  playlistItemName: { fontSize: 14, color: '#FFFFFF' },
  playlistItemNameActive: { color: ACCENT, fontWeight: '600' },
  playlistItemMeta: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
});
