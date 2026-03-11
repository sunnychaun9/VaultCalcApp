/**
 * VaultCalc - Private Camera Screen
 *
 * Full-screen camera UI with CameraX preview.
 * Captures photos/videos directly into the encrypted vault.
 *
 * @see Private Camera feature
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  requireNativeComponent,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@store/authStore';
import { useActivityTracker } from '@features/auth';
import {
  captureAndStorePhoto,
  startVideoCapture,
  stopAndStoreVideo,
  switchCamera as switchCameraFn,
  toggleFlash as toggleFlashFn,
  type FlashMode,
} from '@services/camera';
import { useQueryClient } from '@tanstack/react-query';
import { alert } from '@store/alertStore';

const VaultCameraPreview = requireNativeComponent<{
  style: object;
}>('VaultCameraPreview');

const FLASH_LABELS: Record<FlashMode, string> = {
  off: 'Flash Off',
  on: 'Flash On',
  auto: 'Flash Auto',
};

export function CameraScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { onActivity } = useActivityTracker();
  const queryClient = useQueryClient();
  const isDecoyMode = useAuthStore(s => s.isDecoyMode);

  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleCapturePhoto = useCallback(async () => {
    if (isCapturing || isRecording) return;
    onActivity();
    setIsCapturing(true);
    try {
      const result = await captureAndStorePhoto(isDecoyMode);
      if (result.success) {
        // Invalidate media queries so vault gallery refreshes
        await queryClient.invalidateQueries({ queryKey: ['media', 'photo'] });
      } else {
        alert('Capture failed', result.error ?? 'Unknown error');
      }
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, isRecording, isDecoyMode, onActivity, queryClient]);

  const handleStartRecording = useCallback(async () => {
    if (isCapturing || isRecording) return;
    onActivity();

    const result = await startVideoCapture();
    if (!result.success) {
      alert('Recording failed', result.error ?? 'Unknown error');
      return;
    }

    setIsRecording(true);
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);
  }, [isCapturing, isRecording, onActivity]);

  const handleStopRecording = useCallback(async () => {
    if (!isRecording) return;
    onActivity();

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setIsCapturing(true); // Show busy indicator while encrypting

    try {
      const result = await stopAndStoreVideo(isDecoyMode);
      if (result.success) {
        await queryClient.invalidateQueries({ queryKey: ['media', 'video'] });
      } else {
        alert('Save failed', result.error ?? 'Unknown error');
      }
    } finally {
      setIsCapturing(false);
    }
  }, [isRecording, isDecoyMode, onActivity, queryClient]);

  const handleSwitchCamera = useCallback(async () => {
    onActivity();
    await switchCameraFn();
  }, [onActivity]);

  const handleToggleFlash = useCallback(async () => {
    onActivity();
    const mode = await toggleFlashFn();
    setFlashMode(mode);
  }, [onActivity]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <View style={styles.container}>
      {/* Camera preview */}
      <VaultCameraPreview style={styles.preview} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} style={styles.topButton}>
          <Text style={styles.topButtonText}>Close</Text>
        </Pressable>

        <Pressable onPress={handleToggleFlash} style={styles.topButton}>
          <Text style={styles.topButtonText}>{FLASH_LABELS[flashMode]}</Text>
        </Pressable>
      </View>

      {/* Recording indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>{formatTime(recordingTime)}</Text>
        </View>
      )}

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        {/* Switch camera */}
        <Pressable
          onPress={handleSwitchCamera}
          style={styles.sideButton}
          disabled={isRecording}
        >
          <Text style={styles.sideButtonText}>Flip</Text>
        </Pressable>

        {/* Capture / Record button */}
        {isRecording ? (
          <Pressable onPress={handleStopRecording} style={styles.stopButton}>
            <View style={styles.stopSquare} />
          </Pressable>
        ) : (
          <View style={styles.captureButtonOuter}>
            {isCapturing ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <Pressable
                onPress={handleCapturePhoto}
                onLongPress={handleStartRecording}
                delayLongPress={400}
                style={styles.captureButtonInner}
              />
            )}
          </View>
        )}

        {/* Placeholder for symmetry */}
        <View style={styles.sideButton}>
          {isCapturing && !isRecording && (
            <ActivityIndicator color="#fff" size="small" />
          )}
        </View>
      </View>

      {/* Hint text */}
      {!isRecording && !isCapturing && (
        <Text style={styles.hintText}>Tap for photo, hold for video</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  preview: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  topButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  topButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  recordingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bottomBar: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  sideButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  captureButtonOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  hintText: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
});
