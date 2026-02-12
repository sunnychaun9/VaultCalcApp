/**
 * VaultCalc - Media Service
 *
 * High-level media processing service wrapping the native module.
 * Provides thumbnail generation with error handling.
 *
 * @see FEATURE_INDEX.md FILE-003
 */

import {
  NativeMedia,
  MediaErrorCodes,
  type MediaErrorCode,
  type ThumbnailResult,
  type VideoThumbnailResult,
} from './nativeMedia';

/**
 * Media operation result
 */
export interface MediaResult<T> {
  success: boolean;
  data?: T;
  error?: MediaError;
}

/**
 * Media error
 */
export interface MediaError {
  code: MediaErrorCode | 'UNKNOWN_ERROR';
  message: string;
}

/** Maximum thumbnail dimension (256px) */
export const THUMBNAIL_MAX_DIMENSION = 256;

/**
 * Generate a JPEG thumbnail from a content URI.
 *
 * @param sourceUri content:// URI of the source image
 * @param destPath Absolute path for the output thumbnail
 * @param maxDimension Maximum width or height (default 256)
 * @returns Thumbnail dimensions and path
 */
export async function generateThumbnail(
  sourceUri: string,
  destPath: string,
  maxDimension: number = THUMBNAIL_MAX_DIMENSION,
): Promise<MediaResult<ThumbnailResult>> {
  try {
    const result = await NativeMedia.generateThumbnail(
      sourceUri,
      destPath,
      maxDimension,
    );
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Generate a JPEG thumbnail from a video content URI (VIDEO-002).
 * Extracts a frame near the start and video metadata (duration, dimensions).
 *
 * @param sourceUri content:// URI of the source video
 * @param destPath Absolute path for the output thumbnail
 * @param maxDimension Maximum width or height (default 256)
 * @returns Thumbnail dimensions/path, video duration, and video dimensions
 */
export async function generateVideoThumbnail(
  sourceUri: string,
  destPath: string,
  maxDimension: number = THUMBNAIL_MAX_DIMENSION,
): Promise<MediaResult<VideoThumbnailResult>> {
  try {
    const result = await NativeMedia.generateVideoThumbnail(
      sourceUri,
      destPath,
      maxDimension,
    );
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Delete a file at the given absolute path.
 *
 * @param filePath Absolute path to the file to delete
 * @returns true if deleted or didn't exist, false on error
 */
export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    return await NativeMedia.deleteFile(filePath);
  } catch {
    return false;
  }
}

/**
 * Securely delete all files within a directory (overwrite with random data + unlink).
 *
 * @param dirPath Absolute path to the directory
 * @returns Number of files deleted
 */
export async function secureDeleteDirectoryContents(dirPath: string): Promise<number> {
  try {
    return await NativeMedia.secureDeleteDirectoryContents(dirPath);
  } catch {
    return 0;
  }
}

/**
 * Delete a content URI document (e.g. an original file picked via SAF).
 *
 * @param uri content:// URI to delete
 * @returns true if deleted, false on error
 */
export async function deleteContentUri(uri: string): Promise<boolean> {
  try {
    return await NativeMedia.deleteContentUri(uri);
  } catch {
    return false;
  }
}

/**
 * Handle errors from native module.
 */
function handleError(error: unknown): MediaResult<never> {
  if (error instanceof Error) {
    const message = error.message;

    for (const code of Object.values(MediaErrorCodes)) {
      if (message.includes(code)) {
        return {
          success: false,
          error: { code, message },
        };
      }
    }

    return {
      success: false,
      error: { code: 'UNKNOWN_ERROR', message },
    };
  }

  return {
    success: false,
    error: { code: 'UNKNOWN_ERROR', message: String(error) },
  };
}
