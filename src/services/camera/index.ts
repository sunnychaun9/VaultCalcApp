/**
 * VaultCalc - Private Camera Service
 *
 * Handles camera capture, encryption, and vault storage.
 * Captured media goes directly into the encrypted vault —
 * never touches the system gallery or MediaStore.
 *
 * Follows the same encryption pipeline as importService:
 * capture → generateKey → encrypt → thumbnail → DB insert.
 *
 * @see Private Camera feature
 */

import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import {
  generateKey,
  encryptFileStreaming,
  encryptFile,
  getVaultDirectory,
} from '@services/crypto';
import { generateThumbnail, generateVideoThumbnail, deleteFile } from '@services/media';
import { mediaItems, type MediaType } from '@services/storage/database';

const { VaultCameraModule } = NativeModules;

export type FlashMode = 'off' | 'on' | 'auto';

/** Convert base64 to hex (same as importService) */
function base64ToHex(b64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let bits = '';
  for (const c of b64) {
    if (c === '=') break;
    const idx = chars.indexOf(c);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(6, '0');
  }
  let hex = '';
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    hex += parseInt(bits.substring(i, i + 4), 2).toString(16);
  }
  return hex;
}

/**
 * Request camera + microphone permissions.
 */
export async function requestCameraPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);

  return (
    results[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted' &&
    results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 'granted'
  );
}

/**
 * Check if camera permissions are already granted.
 */
export async function hasCameraPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const cam = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
  const mic = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return cam && mic;
}

/**
 * Capture a photo, encrypt it, and store in the vault.
 * Follows the same pipeline as file import.
 */
export async function captureAndStorePhoto(
  isDecoy: boolean = false,
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    // 0. Resolve vault directory
    const vaultDirResult = await getVaultDirectory();
    if (!vaultDirResult.success || !vaultDirResult.data) {
      return { success: false, error: 'Failed to resolve vault directory' };
    }
    const vaultDir = vaultDirResult.data;

    // 1. Generate unique file ID
    const keyResult = await generateKey(16);
    if (!keyResult.success || !keyResult.data) {
      return { success: false, error: 'Failed to generate file ID' };
    }
    const fileId = base64ToHex(keyResult.data);

    // 2. Capture photo to temp path
    const tempDir = await VaultCameraModule.getVaultTempDir();
    const tempPath = `${tempDir}/photo_${fileId}.jpg`;

    const captureResult = await VaultCameraModule.capturePhoto(tempPath);
    if (!captureResult.success) {
      return { success: false, error: captureResult.error };
    }

    // 3. Encrypt photo
    const destPath = `${vaultDir}/photos/${fileId}.enc`;
    const encResult = await encryptFileStreaming(tempPath, destPath, fileId);
    if (!encResult.success) {
      await deleteFile(tempPath);
      return { success: false, error: 'Encryption failed' };
    }

    // 4. Generate and encrypt thumbnail
    let thumbnailPath: string | null = null;
    let width: number | null = null;
    let height: number | null = null;

    const thumbTemp = `${vaultDir}/thumbnails/${fileId}.tmp`;
    const thumbDest = `${vaultDir}/thumbnails/${fileId}.thumb`;
    const thumbResult = await generateThumbnail(tempPath, thumbTemp);
    if (thumbResult.success && thumbResult.data) {
      const encThumbResult = await encryptFile(thumbTemp, thumbDest, fileId);
      await deleteFile(thumbTemp);
      if (encThumbResult.success) {
        thumbnailPath = thumbDest;
        width = thumbResult.data.width;
        height = thumbResult.data.height;
      }
    }

    // 5. Delete temp file
    await deleteFile(tempPath);

    // 6. Insert metadata
    const timestamp = Date.now();
    const name = `Photo_${new Date(timestamp).toISOString().replace(/[:.]/g, '-')}`;

    await mediaItems.insert({
      id: fileId,
      type: 'photo' as MediaType,
      name,
      encryptedPath: destPath,
      thumbnailPath,
      originalName: name,
      mimeType: 'image/jpeg',
      sizeBytes: 0,
      durationMs: null,
      width,
      height,
      keyId: fileId,
      createdAt: timestamp,
      isFavorite: false,
      isDecoy,
      metadata: { source: 'camera', capturedAt: timestamp },
    });

    return { success: true, mediaId: fileId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/**
 * Start video recording to a temp file.
 * Call stopAndStoreVideo() to finalize.
 */
let pendingVideoFileId: string | null = null;
let pendingVideoTempPath: string | null = null;

export async function startVideoCapture(): Promise<{ success: boolean; error?: string }> {
  try {
    const tempDir = await VaultCameraModule.getVaultTempDir();

    // Generate ID upfront so we can build the temp path
    const keyResult = await generateKey(16);
    if (!keyResult.success || !keyResult.data) {
      return { success: false, error: 'Failed to generate file ID' };
    }
    const fileId = base64ToHex(keyResult.data);
    const tempPath = `${tempDir}/video_${fileId}.mp4`;

    const result = await VaultCameraModule.startRecording(tempPath);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    pendingVideoFileId = fileId;
    pendingVideoTempPath = tempPath;
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/**
 * Stop video recording, encrypt, and store in the vault.
 */
export async function stopAndStoreVideo(
  isDecoy: boolean = false,
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    const fileId = pendingVideoFileId;
    const tempPath = pendingVideoTempPath;
    pendingVideoFileId = null;
    pendingVideoTempPath = null;

    const stopResult = await VaultCameraModule.stopRecording();
    if (!stopResult.success) {
      return { success: false, error: stopResult.error };
    }

    if (!fileId || !tempPath) {
      return { success: false, error: 'No recording in progress' };
    }

    // Brief delay to let the file system flush
    await new Promise(r => setTimeout(r, 500));

    // 0. Resolve vault directory
    const vaultDirResult = await getVaultDirectory();
    if (!vaultDirResult.success || !vaultDirResult.data) {
      return { success: false, error: 'Failed to resolve vault directory' };
    }
    const vaultDir = vaultDirResult.data;

    // 1. Encrypt video
    const destPath = `${vaultDir}/videos/${fileId}.enc`;
    const encResult = await encryptFileStreaming(tempPath, destPath, fileId);
    if (!encResult.success) {
      await deleteFile(tempPath);
      return { success: false, error: 'Encryption failed' };
    }

    // 2. Generate and encrypt video thumbnail
    let thumbnailPath: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    let durationMs: number | null = null;

    const thumbTemp = `${vaultDir}/thumbnails/${fileId}.tmp`;
    const thumbDest = `${vaultDir}/thumbnails/${fileId}.thumb`;
    const thumbResult = await generateVideoThumbnail(tempPath, thumbTemp);
    if (thumbResult.success && thumbResult.data) {
      const encThumbResult = await encryptFile(thumbTemp, thumbDest, fileId);
      await deleteFile(thumbTemp);
      if (encThumbResult.success) {
        thumbnailPath = thumbDest;
        width = thumbResult.data.videoWidth || thumbResult.data.width;
        height = thumbResult.data.videoHeight || thumbResult.data.height;
      }
      durationMs = thumbResult.data.durationMs || null;
    }

    // 3. Delete temp
    await deleteFile(tempPath);

    // 4. Insert metadata
    const timestamp = Date.now();
    const name = `Video_${new Date(timestamp).toISOString().replace(/[:.]/g, '-')}`;

    await mediaItems.insert({
      id: fileId,
      type: 'video' as MediaType,
      name,
      encryptedPath: destPath,
      thumbnailPath,
      originalName: name,
      mimeType: 'video/mp4',
      sizeBytes: 0,
      durationMs,
      width,
      height,
      keyId: fileId,
      createdAt: timestamp,
      isFavorite: false,
      isDecoy,
      metadata: { source: 'camera', capturedAt: timestamp },
    });

    return { success: true, mediaId: fileId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/**
 * Switch between front and back camera.
 */
export async function switchCamera(): Promise<boolean> {
  return VaultCameraModule.switchCamera();
}

/**
 * Toggle flash mode (off → on → auto → off).
 */
export async function toggleFlash(): Promise<FlashMode> {
  return VaultCameraModule.toggleFlash();
}
