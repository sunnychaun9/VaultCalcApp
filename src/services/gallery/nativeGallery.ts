/**
 * VaultCalc - Native Gallery Bridge
 *
 * TypeScript interface to the native GalleryModule.
 * Queries local media via Android MediaStore.
 *
 * @see FEATURE_INDEX.md GALLERY-001
 */

import { NativeModules } from 'react-native';

/** Album (bucket) from MediaStore */
export interface GalleryAlbum {
  bucketId: string;
  bucketName: string;
  itemCount: number;
  coverUri: string;
}

/** Media item from MediaStore */
export interface GalleryMediaItem {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  dateAdded: number;
  durationMs?: number;
}

export type GalleryMediaType = 'image' | 'video';

interface NativeGalleryModule {
  queryAlbums(mediaType: string): Promise<GalleryAlbum[]>;
  queryMediaInAlbum(bucketId: string, mediaType: string): Promise<GalleryMediaItem[]>;
  requestDeletePermission(uris: string[]): Promise<boolean>;
}

export const NativeGallery = NativeModules.GalleryModule as NativeGalleryModule;
