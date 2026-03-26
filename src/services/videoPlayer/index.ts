/**
 * VaultCalc - Video Player Service Exports
 *
 * Public API for native video player operations.
 *
 * @see FEATURE_INDEX.md VIDEO-010
 */

export {
  NativeVideoPlayerView,
  loadVideo,
  playVideo,
  pauseVideo,
  seekTo,
  setSpeed,
  muteVideo,
  unmuteVideo,
  enterFullscreen,
  exitFullscreen,
  setPlaylist,
  releasePlayer,
  getVideoDetails,
  deleteTempFile,
} from './nativeVideoPlayer';

export type {
  NativeVideoPlayerProps,
  VideoDetails,
} from './nativeVideoPlayer';
