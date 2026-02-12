/**
 * VaultCalc - Media Service Exports
 *
 * Public API for media processing operations.
 *
 * @see FEATURE_INDEX.md FILE-003
 */

// Main media service
export { generateThumbnail, generateVideoThumbnail, deleteFile, deleteContentUri, secureDeleteDirectoryContents, THUMBNAIL_MAX_DIMENSION } from './mediaService';

export type { MediaResult, MediaError } from './mediaService';

// Native module (for advanced use)
export { NativeMedia, MediaErrorCodes } from './nativeMedia';
export type { MediaErrorCode, ThumbnailResult, VideoThumbnailResult } from './nativeMedia';
