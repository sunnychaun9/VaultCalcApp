/**
 * VaultCalc - Native Media Module Interface
 *
 * TypeScript interface for the native MediaModule.
 * Provides type-safe access to media processing operations.
 *
 * @see FEATURE_INDEX.md FILE-003
 */

import { NativeModules, Platform } from 'react-native';

/**
 * Thumbnail generation result from native module
 */
export interface ThumbnailResult {
  width: number;
  height: number;
  thumbnailPath: string;
}

/**
 * Video thumbnail generation result (VIDEO-002)
 */
export interface VideoThumbnailResult {
  width: number;
  height: number;
  thumbnailPath: string;
  durationMs: number;
  videoWidth: number;
  videoHeight: number;
}

/**
 * Native MediaModule interface
 */
interface MediaModuleInterface {
  /**
   * Generate a JPEG thumbnail from a content URI.
   * @param sourceUri content:// URI of the source image
   * @param destPath Absolute path for the output thumbnail
   * @param maxDimension Maximum width or height in pixels
   * @returns Thumbnail dimensions and path
   */
  generateThumbnail(
    sourceUri: string,
    destPath: string,
    maxDimension: number,
  ): Promise<ThumbnailResult>;

  /**
   * Generate a JPEG thumbnail from a video content URI (VIDEO-002).
   * Extracts a frame near the start and video metadata.
   * @param sourceUri content:// URI of the source video
   * @param destPath Absolute path for the output thumbnail
   * @param maxDimension Maximum width or height in pixels
   * @returns Thumbnail dimensions, path, duration, and video dimensions
   */
  generateVideoThumbnail(
    sourceUri: string,
    destPath: string,
    maxDimension: number,
  ): Promise<VideoThumbnailResult>;

  /**
   * Extract audio metadata (duration) from a content URI.
   * Unlike generateVideoThumbnail, this does not require a video frame.
   * @param sourceUri content:// URI of the audio file
   * @returns Audio duration in milliseconds
   */
  extractAudioMetadata(sourceUri: string): Promise<{ durationMs: number }>;

  /**
   * Delete a file at the given absolute path.
   * @param filePath Absolute path to the file to delete
   * @returns true if deleted or didn't exist, false on error
   */
  deleteFile(filePath: string): Promise<boolean>;

  /**
   * Delete a content URI document (e.g. a file picked via SAF).
   * @param uri content:// URI to delete
   * @returns true if deleted, false otherwise
   */
  deleteContentUri(uri: string): Promise<boolean>;

  /**
   * Securely delete all files within a directory (overwrite + unlink).
   * @param dirPath Absolute path to the directory
   * @returns Number of files deleted
   */
  secureDeleteDirectoryContents(dirPath: string): Promise<number>;

  /**
   * Get the size in bytes of a file at the given absolute path (CLOUD-003).
   * @param filePath Absolute path to the file
   * @returns File size in bytes, or -1 if not found
   */
  getFileSize(filePath: string): Promise<number>;

  /**
   * Download a file from a URL to a local path, streaming to disk (CLOUD-004).
   * @param url The URL to download from
   * @param authToken Bearer token for authorization
   * @param destPath Absolute path for the output file
   * @returns true on success, false on failure
   */
  downloadFile(url: string, authToken: string, destPath: string): Promise<boolean>;

  /**
   * Save a decrypted file to public storage (device gallery).
   * Uses MediaStore API for scoped storage compatibility (API 29+).
   * @param sourcePath Absolute path to the decrypted temp file
   * @param fileName Display name for the file in the gallery
   * @param mimeType MIME type of the file
   * @returns true on success
   */
  saveToPublicStorage(sourcePath: string, fileName: string, mimeType: string): Promise<boolean>;
}

/**
 * Get the native MediaModule (lazy — resolved on first access)
 */
let cachedModule: MediaModuleInterface | null = null;

function getMediaModule(): MediaModuleInterface {
  if (cachedModule) {
    return cachedModule;
  }

  if (Platform.OS !== 'android') {
    throw new Error('MediaModule is only available on Android');
  }

  const { MediaModule } = NativeModules;

  if (!MediaModule) {
    throw new Error(
      'MediaModule is not available. Make sure the native module is properly linked.',
    );
  }

  cachedModule = MediaModule as MediaModuleInterface;
  return cachedModule;
}

/**
 * Native media module proxy — lazily resolves the native module on first method call.
 * This avoids accessing NativeModules at import time, which can fail if the
 * React Native bridge hasn't finished initializing.
 */
export const NativeMedia: MediaModuleInterface = new Proxy(
  {} as MediaModuleInterface,
  {
    get(_target, prop: string) {
      const module = getMediaModule();
      return module[prop as keyof MediaModuleInterface];
    },
  },
);

/**
 * Media error codes
 */
export const MediaErrorCodes = {
  THUMBNAIL_ERROR: 'MEDIA_THUMBNAIL_ERROR',
} as const;

export type MediaErrorCode = (typeof MediaErrorCodes)[keyof typeof MediaErrorCodes];
