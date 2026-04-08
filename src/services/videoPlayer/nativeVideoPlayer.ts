/**
 * VaultCalc - Native Video Player Bridge
 *
 * TypeScript interface for the native VaultVideoPlayerView and VideoPlayerModule.
 * Provides the requireNativeComponent wrapper and imperative commands.
 *
 * @see FEATURE_INDEX.md VIDEO-010
 */

import {
  requireNativeComponent,
  UIManager,
  findNodeHandle,
  NativeModules,
  type ViewProps,
} from 'react-native';
import type { RefObject } from 'react';

// ── Native View Props ──────────────────────────────────────────

export interface NativeVideoPlayerProps extends ViewProps {
  title?: string;
  autoPlay?: boolean;
  onLoad?: (event: { nativeEvent: { duration: number; width: number; height: number } }) => void;
  onProgress?: (event: { nativeEvent: { currentTime: number; duration: number; progress: number } }) => void;
  onEnd?: (event: { nativeEvent: Record<string, never> }) => void;
  onError?: (event: { nativeEvent: { error: string; errorCode: number } }) => void;
  onBuffering?: (event: { nativeEvent: Record<string, never> }) => void;
  onPlaybackStateChange?: (event: { nativeEvent: { isPlaying: boolean } }) => void;
  onVolumeChange?: (event: { nativeEvent: { volume: number; isMuted: boolean } }) => void;
  onBrightnessChange?: (event: { nativeEvent: { brightness: number } }) => void;
  onSpeedChange?: (event: { nativeEvent: { speed: number } }) => void;
  onNavigate?: (event: { nativeEvent: { direction: string; index: number } }) => void;
  onBackPress?: (event: { nativeEvent: Record<string, never> }) => void;
  onMenuPress?: (event: { nativeEvent: Record<string, never> }) => void;
  onLockStateChange?: (event: { nativeEvent: Record<string, never> }) => void;
  onShuffleChange?: (event: { nativeEvent: { enabled: boolean } }) => void;
  onRepeatChange?: (event: { nativeEvent: { enabled: boolean } }) => void;
}

// ── Native View Component ──────────────────────────────────────

export const NativeVideoPlayerView = requireNativeComponent<NativeVideoPlayerProps>(
  'VaultVideoPlayerView'
);

// ── Imperative Commands ────────────────────────────────────────

function dispatchCommand(ref: RefObject<any>, command: string, args: any[] = []) {
  const handle = findNodeHandle(ref.current);
  if (handle == null) return;
  UIManager.dispatchViewManagerCommand(handle, command, args);
}

export function loadVideo(ref: RefObject<any>, filePath: string, startPosition: number = 0) {
  dispatchCommand(ref, 'loadVideo', [filePath, startPosition]);
}

export function playVideo(ref: RefObject<any>) {
  dispatchCommand(ref, 'play');
}

export function pauseVideo(ref: RefObject<any>) {
  dispatchCommand(ref, 'pause');
}

export function seekTo(ref: RefObject<any>, positionMs: number) {
  dispatchCommand(ref, 'seekTo', [positionMs]);
}

export function setSpeed(ref: RefObject<any>, speed: number) {
  dispatchCommand(ref, 'setSpeed', [speed]);
}

export function muteVideo(ref: RefObject<any>) {
  dispatchCommand(ref, 'mute');
}

export function unmuteVideo(ref: RefObject<any>) {
  dispatchCommand(ref, 'unmute');
}

export function enterFullscreen(ref: RefObject<any>) {
  dispatchCommand(ref, 'enterFullscreen');
}

export function exitFullscreen(ref: RefObject<any>) {
  dispatchCommand(ref, 'exitFullscreen');
}

export function setPlaylist(ref: RefObject<any>, paths: string[], startIndex: number = 0) {
  dispatchCommand(ref, 'setPlaylist', [paths, startIndex]);
}

export function releasePlayer(ref: RefObject<any>) {
  dispatchCommand(ref, 'release');
}

export function lockScreen(ref: RefObject<any>) {
  dispatchCommand(ref, 'lockScreen');
}

export function unlockScreen(ref: RefObject<any>) {
  dispatchCommand(ref, 'unlockScreen');
}

export function rotateScreen(ref: RefObject<any>) {
  dispatchCommand(ref, 'rotateScreen');
}

export function setAutoRotate(ref: RefObject<any>, enabled: boolean) {
  dispatchCommand(ref, 'setAutoRotate', [enabled]);
}

export function setShuffle(ref: RefObject<any>, enabled: boolean) {
  dispatchCommand(ref, 'setShuffle', [enabled]);
}

export function setRepeat(ref: RefObject<any>, enabled: boolean) {
  dispatchCommand(ref, 'setRepeat', [enabled]);
}

// ── Native Module (for non-view operations) ────────────────────

const VideoPlayerModuleBridge = NativeModules.VideoPlayerModule;

export interface VideoDetails {
  duration: number;
  width: number;
  height: number;
  size: number;
  bitrate: number;
  date: string;
  fileName: string;
  resolution: string;
}

export async function getVideoDetails(filePath: string): Promise<VideoDetails> {
  return VideoPlayerModuleBridge.getVideoDetails(filePath);
}

export async function deleteTempFile(filePath: string): Promise<boolean> {
  return VideoPlayerModuleBridge.deleteTempFile(filePath);
}
