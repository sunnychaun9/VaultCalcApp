/**
 * VaultCalc - Decrypted Thumbnail Hook
 *
 * Asynchronously decrypts and caches a media item's encrypted thumbnail,
 * returning the file:// URI for use in an Image component.
 *
 * @see FEATURE_INDEX.md VAULT-004
 */

import { useState, useEffect, useRef } from 'react';
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
 * - Initializes synchronously from the in-memory cache so recycled
 *   FlashList cells don't flash a placeholder.
 * - When the id changes (cell recycled to a different item), the
 *   URI is synchronously resolved from cache or cleared.
 * - Returns the same URI reference across re-renders for the same item
 *   to keep Fresco stable.
 */
export function useDecryptedThumbnail(
  thumbnailPath: string | null,
  id: string,
  keyId: string,
): DecryptedThumbnailResult {
  // Resolve from sync cache on first mount
  const initialUri = useRef<string | null>(null);
  if (initialUri.current === null && thumbnailPath !== null) {
    const cached = getCachedThumbnailSync(id);
    if (cached !== undefined) {
      initialUri.current = toFileUri(cached);
    }
  }

  const [uri, setUri] = useState<string | null>(() => {
    if (thumbnailPath === null) return null;
    const cached = getCachedThumbnailSync(id);
    return cached !== undefined ? toFileUri(cached) : null;
  });
  const [isLoading, setIsLoading] = useState(
    () => thumbnailPath !== null && getCachedThumbnailSync(id) === undefined,
  );

  // Track prev id to detect cell recycling
  const prevId = useRef(id);

  useEffect(() => {
    const idChanged = prevId.current !== id;
    prevId.current = id;

    if (thumbnailPath === null) {
      setUri(null);
      setIsLoading(false);
      return;
    }

    // Always try the sync cache first — covers both cell recycle
    // (id changed) and re-render (id same, cache populated since mount).
    const cached = getCachedThumbnailSync(id);
    if (cached !== undefined) {
      setUri(toFileUri(cached));
      setIsLoading(false);
      return;
    }

    // If id changed and no cache hit, clear the stale URI from the
    // previous item so we don't show the wrong thumbnail.
    if (idChanged) {
      setUri(null);
    }

    // Kick off async decryption
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
