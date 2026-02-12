/**
 * VaultCalc - Gallery Service
 *
 * High-level service for the in-app media gallery.
 * Handles permission requests and wraps native module calls.
 *
 * @see FEATURE_INDEX.md GALLERY-001
 */

import { PermissionsAndroid, Platform } from 'react-native';
import { NativeGallery, type GalleryAlbum, type GalleryMediaItem, type GalleryMediaType } from './nativeGallery';

/**
 * Request gallery read permissions.
 * API 33+: READ_MEDIA_IMAGES + READ_MEDIA_VIDEO
 * API <33: READ_EXTERNAL_STORAGE
 *
 * Returns true if all needed permissions are granted.
 */
export async function requestGalleryPermissions(mediaType: GalleryMediaType): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    if (Platform.Version >= 33) {
      const permission = mediaType === 'video'
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO
        : PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES;

      const result = await PermissionsAndroid.request(permission, {
        title: 'Media Access',
        message: `VaultCalc needs access to your ${mediaType === 'video' ? 'videos' : 'photos'} to import them.`,
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      });
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Access',
          message: 'VaultCalc needs access to your files to import media.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch {
    return false;
  }
}

/**
 * Check if gallery permissions are currently granted (without prompting).
 */
export async function hasGalleryPermissions(mediaType: GalleryMediaType): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    if (Platform.Version >= 33) {
      const permission = mediaType === 'video'
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO
        : PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES;
      return await PermissionsAndroid.check(permission);
    } else {
      return await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );
    }
  } catch {
    return false;
  }
}

/**
 * Get album list from MediaStore.
 */
export async function getAlbums(mediaType: GalleryMediaType): Promise<GalleryAlbum[]> {
  return NativeGallery.queryAlbums(mediaType);
}

/**
 * Get media items in an album.
 */
export async function getMediaInAlbum(
  bucketId: string,
  mediaType: GalleryMediaType,
): Promise<GalleryMediaItem[]> {
  return NativeGallery.queryMediaInAlbum(bucketId, mediaType);
}

/**
 * Request deletion of original files after import.
 * API 30+: Shows system confirmation dialog.
 * API <30: Deletes directly.
 *
 * @returns true if all files were deleted
 */
export async function deleteOriginals(uris: string[]): Promise<boolean> {
  if (uris.length === 0) return true;
  return NativeGallery.requestDeletePermission(uris);
}
