/**
 * VaultCalc - Gallery Service Exports
 *
 * @see FEATURE_INDEX.md GALLERY-001
 */

export {
  requestGalleryPermissions,
  hasGalleryPermissions,
  getAlbums,
  getMediaInAlbum,
  deleteOriginals,
} from './galleryService';

export type {
  GalleryAlbum,
  GalleryMediaItem,
  GalleryMediaType,
} from './nativeGallery';
