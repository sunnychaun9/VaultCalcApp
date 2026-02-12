/**
 * VaultCalc - Decrypted Thumbnail Hook
 *
 * Asynchronously decrypts and caches a media item's encrypted thumbnail,
 * returning the file:// URI for use in an Image component.
 *
 * @see FEATURE_INDEX.md VAULT-004
 */

import { useState, useEffect } from 'react';
import { getDecryptedThumbnail, getCachedThumbnailSync } from '@services/thumbnail';

interface DecryptedThumbnailResult {
  /** file:// URI of the decrypted thumbnail, or null */
  uri: string | null;
  /** Whether decryption is in progress */
  isLoading: boolean;
}

/** Convert a cache path to a file:// URI */
function toFileUri(path: string | null): string | null {
  return path !== null ? `file://${path}` : null;
}

/**
 * Decrypt and return a thumbnail URI for a media item.
 *
 * Initializes synchronously from the in-memory cache when available,
 * so FlashList cell recycling doesn't flash a placeholder frame.
 *
 * @param thumbnailPath MediaItem.thumbnailPath (encrypted, or null)
 * @param id            MediaItem.id
 * @param keyId         MediaItem.keyId (decryption context)
 */
export function useDecryptedThumbnail(
  thumbnailPath: string | null,
  id: string,
  keyId: string,
): DecryptedThumbnailResult {
  // Sync cache check avoids the async gap when FlashList recycles a cell
  // whose thumbnail was already decrypted in a previous mount.
  const [uri, setUri] = useState<string | null>(() => {
    if (thumbnailPath === null) return null;
    const cached = getCachedThumbnailSync(id);
    return cached !== undefined ? toFileUri(cached) : null;
  });
  const [isLoading, setIsLoading] = useState(
    () => thumbnailPath !== null && getCachedThumbnailSync(id) === undefined,
  );

  useEffect(() => {
    if (thumbnailPath === null) {
      setUri(null);
      setIsLoading(false);
      return;
    }

    // Skip async work if we already resolved from the sync cache
    const cached = getCachedThumbnailSync(id);
    if (cached !== undefined) {
      setUri(toFileUri(cached));
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getDecryptedThumbnail(id, thumbnailPath, keyId).then((path) => {
      if (!cancelled) {
        setUri(toFileUri(path));
        setIsLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [thumbnailPath, id, keyId]);

  return { uri, isLoading };
}
