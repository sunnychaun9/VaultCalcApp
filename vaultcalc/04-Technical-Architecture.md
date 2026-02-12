# VaultCalc Technical Architecture Document
## Version 1.0

---

## 1. Architecture Overview

### 1.1 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | React Native CLI (0.73+) | No Expo limitations, full native access |
| Language (JS) | TypeScript 5.x | Type safety, better tooling |
| Language (Native) | Kotlin | Modern Android development |
| State Management | Zustand + React Query | Lightweight, performant |
| Navigation | React Navigation 6 | Industry standard, type-safe |
| Storage (Prefs) | MMKV | 30x faster than AsyncStorage |
| Storage (Metadata) | SQLite (expo-sqlite) | Structured queries, relations |
| Storage (Files) | Native file system | Direct encrypted file access |
| Crypto | Google Tink + Native Module | Audited, hardware-backed |
| UI Components | Custom + React Native Paper | Material You compliance |

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Calculator  │  │    Vault    │  │      Settings       │ │
│  │   Screen    │  │   Screens   │  │      Screens        │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
┌─────────▼────────────────▼────────────────────▼─────────────┐
│                    APPLICATION LAYER                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   State Management                    │   │
│  │         Zustand (UI) + React Query (Async)           │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Auth      │  │   Media     │  │      File           │ │
│  │  Service    │  │  Service    │  │     Service         │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
┌─────────▼────────────────▼────────────────────▼─────────────┐
│                      DOMAIN LAYER                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Native Bridge (JSI)                      │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Crypto    │  │  Biometric  │  │     Storage         │ │
│  │   Module    │  │   Module    │  │     Module          │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
┌─────────▼────────────────▼────────────────────▼─────────────┐
│                    PLATFORM LAYER                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Android    │  │  Biometric  │  │    File System      │ │
│  │  Keystore   │  │   Prompt    │  │    (Encrypted)      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Module Architecture

### 2.1 Project Structure

```
vaultcalc/
├── android/
│   ├── app/
│   │   └── src/main/
│   │       ├── java/com/vaultcalc/
│   │       │   ├── MainApplication.kt
│   │       │   ├── MainActivity.kt
│   │       │   └── modules/
│   │       │       ├── crypto/
│   │       │       │   ├── CryptoModule.kt
│   │       │       │   ├── CryptoPackage.kt
│   │       │       │   └── KeyManager.kt
│   │       │       ├── biometric/
│   │       │       │   ├── BiometricModule.kt
│   │       │       │   └── BiometricPackage.kt
│   │       │       └── storage/
│   │       │           ├── SecureStorageModule.kt
│   │       │           └── SecureStoragePackage.kt
│   │       └── res/
│   └── build.gradle
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── navigation/
│   │       ├── RootNavigator.tsx
│   │       ├── CalculatorStack.tsx
│   │       └── VaultStack.tsx
│   ├── features/
│   │   ├── calculator/
│   │   │   ├── screens/
│   │   │   │   └── CalculatorScreen.tsx
│   │   │   ├── components/
│   │   │   │   ├── Display.tsx
│   │   │   │   ├── Keypad.tsx
│   │   │   │   └── Button.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useCalculator.ts
│   │   │   └── utils/
│   │   │       └── calculator.ts
│   │   ├── vault/
│   │   │   ├── screens/
│   │   │   │   ├── VaultHomeScreen.tsx
│   │   │   │   ├── PhotoGalleryScreen.tsx
│   │   │   │   ├── VideoGalleryScreen.tsx
│   │   │   │   ├── DocumentsScreen.tsx
│   │   │   │   └── MediaViewerScreen.tsx
│   │   │   ├── components/
│   │   │   │   ├── MediaGrid.tsx
│   │   │   │   ├── MediaThumbnail.tsx
│   │   │   │   ├── ImportFAB.tsx
│   │   │   │   └── SelectionToolbar.tsx
│   │   │   └── hooks/
│   │   │       ├── useMediaLibrary.ts
│   │   │       └── useFileImport.ts
│   │   ├── auth/
│   │   │   ├── screens/
│   │   │   │   ├── PinSetupScreen.tsx
│   │   │   │   └── BiometricSetupScreen.tsx
│   │   │   ├── components/
│   │   │   │   └── PinInput.tsx
│   │   │   └── hooks/
│   │   │       └── useAuth.ts
│   │   └── settings/
│   │       ├── screens/
│   │       │   ├── SettingsScreen.tsx
│   │       │   ├── SecuritySettingsScreen.tsx
│   │       │   ├── StorageSettingsScreen.tsx
│   │       │   └── SubscriptionScreen.tsx
│   │       └── components/
│   │           └── SettingsItem.tsx
│   ├── shared/
│   │   ├── components/
│   │   │   ├── Button.tsx
│   │   │   ├── Icon.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Toast.tsx
│   │   ├── hooks/
│   │   │   ├── useTheme.ts
│   │   │   └── useHaptics.ts
│   │   └── utils/
│   │       ├── format.ts
│   │       └── validation.ts
│   ├── services/
│   │   ├── crypto/
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── storage/
│   │   │   ├── database.ts
│   │   │   ├── fileSystem.ts
│   │   │   └── preferences.ts
│   │   └── media/
│   │       ├── import.ts
│   │       ├── export.ts
│   │       └── thumbnail.ts
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── vaultStore.ts
│   │   ├── settingsStore.ts
│   │   └── subscriptionStore.ts
│   └── types/
│       ├── media.ts
│       ├── settings.ts
│       └── navigation.ts
├── package.json
├── tsconfig.json
├── babel.config.js
└── metro.config.js
```

### 2.2 Feature Module Pattern

Each feature follows this structure:

```typescript
// features/vault/index.ts
export { VaultHomeScreen } from './screens/VaultHomeScreen';
export { useMediaLibrary } from './hooks/useMediaLibrary';
export type { VaultNavigationParams } from './types';
```

---

## 3. Native Modules

### 3.1 Crypto Module (Kotlin)

```kotlin
// CryptoModule.kt
package com.vaultcalc.modules.crypto

import com.facebook.react.bridge.*
import com.google.crypto.tink.*
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.aead.AeadKeyTemplates
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore

class CryptoModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val keyStore: KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    override fun getName() = "CryptoModule"

    init {
        AeadConfig.register()
    }

    @ReactMethod
    fun deriveKey(pin: String, salt: String, promise: Promise) {
        try {
            // Argon2id key derivation
            val derivedKey = Argon2id.derive(
                password = pin.toByteArray(),
                salt = salt.decodeHex(),
                iterations = 3,
                memory = 65536, // 64MB
                parallelism = 4,
                outputLength = 32
            )
            promise.resolve(derivedKey.toBase64())
        } catch (e: Exception) {
            promise.reject("DERIVE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun encryptFile(
        inputPath: String,
        outputPath: String,
        keyHandle: String,
        promise: Promise
    ) {
        try {
            val aead = getAead(keyHandle)
            val plaintext = File(inputPath).readBytes()
            val ciphertext = aead.encrypt(plaintext, null)
            File(outputPath).writeBytes(ciphertext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ENCRYPT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun decryptFile(
        inputPath: String,
        outputPath: String,
        keyHandle: String,
        promise: Promise
    ) {
        try {
            val aead = getAead(keyHandle)
            val ciphertext = File(inputPath).readBytes()
            val plaintext = aead.decrypt(ciphertext, null)
            File(outputPath).writeBytes(plaintext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DECRYPT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun generateFileKey(promise: Promise) {
        try {
            val keysetHandle = KeysetHandle.generateNew(AeadKeyTemplates.AES256_GCM)
            val keyId = storeKeyset(keysetHandle)
            promise.resolve(keyId)
        } catch (e: Exception) {
            promise.reject("KEYGEN_ERROR", e.message)
        }
    }

    private fun getAead(keyHandle: String): Aead {
        val keysetHandle = loadKeyset(keyHandle)
        return keysetHandle.getPrimitive(Aead::class.java)
    }

    private fun storeKeyset(keysetHandle: KeysetHandle): String {
        // Store encrypted in Android Keystore
        val masterKey = getMasterKey()
        val keyId = UUID.randomUUID().toString()
        // ... storage implementation
        return keyId
    }

    private fun getMasterKey(): KeysetHandle {
        return AndroidKeysetManager.Builder()
            .withSharedPref(reactApplicationContext, "master_keyset", "vaultcalc_prefs")
            .withKeyTemplate(AeadKeyTemplates.AES256_GCM)
            .withMasterKeyUri("android-keystore://vaultcalc_master_key")
            .build()
            .keysetHandle
    }
}
```

### 3.2 Biometric Module (Kotlin)

```kotlin
// BiometricModule.kt
package com.vaultcalc.modules.biometric

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*

class BiometricModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "BiometricModule"

    @ReactMethod
    fun isAvailable(promise: Promise) {
        val biometricManager = BiometricManager.from(reactApplicationContext)
        when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> promise.resolve(true)
            else -> promise.resolve(false)
        }
    }

    @ReactMethod
    fun authenticate(title: String, subtitle: String, promise: Promise) {
        val activity = currentActivity ?: run {
            promise.reject("NO_ACTIVITY", "No activity")
            return
        }

        val executor = ContextCompat.getMainExecutor(reactApplicationContext)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                promise.resolve(true)
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                promise.reject("AUTH_ERROR", errString.toString())
            }

            override fun onAuthenticationFailed() {
                // Don't reject - user can retry
            }
        }

        val biometricPrompt = BiometricPrompt(activity as FragmentActivity, executor, callback)

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText("Use PIN")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build()

        activity.runOnUiThread {
            biometricPrompt.authenticate(promptInfo)
        }
    }
}
```

### 3.3 TypeScript Bridge

```typescript
// services/crypto/index.ts
import { NativeModules } from 'react-native';

const { CryptoModule } = NativeModules;

export interface CryptoService {
  deriveKey(pin: string, salt: string): Promise<string>;
  encryptFile(inputPath: string, outputPath: string, keyHandle: string): Promise<boolean>;
  decryptFile(inputPath: string, outputPath: string, keyHandle: string): Promise<boolean>;
  generateFileKey(): Promise<string>;
}

export const crypto: CryptoService = {
  deriveKey: (pin, salt) => CryptoModule.deriveKey(pin, salt),
  encryptFile: (input, output, key) => CryptoModule.encryptFile(input, output, key),
  decryptFile: (input, output, key) => CryptoModule.decryptFile(input, output, key),
  generateFileKey: () => CryptoModule.generateFileKey(),
};
```

---

## 4. State Management

### 4.1 Auth Store (Zustand)

```typescript
// store/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '../services/storage/preferences';

interface AuthState {
  isAuthenticated: boolean;
  isDecoyMode: boolean;
  failedAttempts: number;
  lastFailedAttempt: number | null;

  // Actions
  authenticate: (isDecoy?: boolean) => void;
  logout: () => void;
  recordFailedAttempt: () => void;
  resetFailedAttempts: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      isDecoyMode: false,
      failedAttempts: 0,
      lastFailedAttempt: null,

      authenticate: (isDecoy = false) => {
        set({
          isAuthenticated: true,
          isDecoyMode: isDecoy,
          failedAttempts: 0
        });
      },

      logout: () => {
        set({
          isAuthenticated: false,
          isDecoyMode: false
        });
      },

      recordFailedAttempt: () => {
        set(state => ({
          failedAttempts: state.failedAttempts + 1,
          lastFailedAttempt: Date.now(),
        }));
      },

      resetFailedAttempts: () => {
        set({ failedAttempts: 0, lastFailedAttempt: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        failedAttempts: state.failedAttempts,
        lastFailedAttempt: state.lastFailedAttempt,
      }),
    }
  )
);
```

### 4.2 Vault Store (Zustand)

```typescript
// store/vaultStore.ts
import { create } from 'zustand';

interface VaultState {
  // Selection
  selectedIds: Set<string>;
  isSelectionMode: boolean;

  // View
  viewMode: 'grid' | 'list';
  sortBy: 'date' | 'name' | 'size';
  sortOrder: 'asc' | 'desc';

  // Actions
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (sort: 'date' | 'name' | 'size') => void;
  toggleSortOrder: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  selectedIds: new Set(),
  isSelectionMode: false,
  viewMode: 'grid',
  sortBy: 'date',
  sortOrder: 'desc',

  toggleSelection: (id) => set((state) => {
    const newSelected = new Set(state.selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    return {
      selectedIds: newSelected,
      isSelectionMode: newSelected.size > 0,
    };
  }),

  selectAll: (ids) => set({
    selectedIds: new Set(ids),
    isSelectionMode: true,
  }),

  clearSelection: () => set({
    selectedIds: new Set(),
    isSelectionMode: false,
  }),

  setViewMode: (mode) => set({ viewMode: mode }),
  setSortBy: (sort) => set({ sortBy: sort }),
  toggleSortOrder: () => set((state) => ({
    sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc',
  })),
}));
```

### 4.3 React Query for Async Data

```typescript
// features/vault/hooks/useMediaLibrary.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaService } from '../../../services/media';
import type { MediaItem, MediaType } from '../../../types/media';

export function useMediaLibrary(type: MediaType) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['media', type],
    queryFn: () => mediaService.getAll(type),
    staleTime: 30000,
  });

  const importMutation = useMutation({
    mutationFn: mediaService.importFiles,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', type] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: mediaService.deleteFiles,
    onMutate: async (ids: string[]) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['media', type] });
      const previous = queryClient.getQueryData(['media', type]);

      queryClient.setQueryData(['media', type], (old: MediaItem[]) =>
        old.filter(item => !ids.includes(item.id))
      );

      return { previous };
    },
    onError: (err, ids, context) => {
      queryClient.setQueryData(['media', type], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['media', type] });
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    importFiles: importMutation.mutate,
    deleteFiles: deleteMutation.mutate,
    isImporting: importMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
```

---

## 5. Database Schema

### 5.1 SQLite Schema

```sql
-- migrations/001_initial.sql

-- Media items table
CREATE TABLE media_items (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('photo', 'video', 'document')),
    name TEXT NOT NULL,
    encrypted_path TEXT NOT NULL,
    thumbnail_path TEXT,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    duration_ms INTEGER,  -- for videos
    width INTEGER,        -- for images/videos
    height INTEGER,       -- for images/videos
    key_id TEXT NOT NULL, -- reference to encryption key
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    imported_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    is_favorite INTEGER NOT NULL DEFAULT 0,
    is_decoy INTEGER NOT NULL DEFAULT 0,  -- belongs to decoy vault
    metadata TEXT  -- JSON for extensible metadata
);

CREATE INDEX idx_media_type ON media_items(type);
CREATE INDEX idx_media_created ON media_items(created_at);
CREATE INDEX idx_media_is_decoy ON media_items(is_decoy);

-- Albums/Folders table
CREATE TABLE albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cover_media_id TEXT REFERENCES media_items(id),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    is_decoy INTEGER NOT NULL DEFAULT 0
);

-- Album membership (many-to-many)
CREATE TABLE album_media (
    album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
    added_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (album_id, media_id)
);

-- Encryption keys metadata (actual keys in Keystore)
CREATE TABLE encryption_keys (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM'
);

-- Settings that need to persist
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Intruder selfies
CREATE TABLE intruder_logs (
    id TEXT PRIMARY KEY,
    photo_path TEXT,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    failed_pin TEXT,  -- hashed
    device_info TEXT  -- JSON
);
```

### 5.2 Database Service

```typescript
// services/storage/database.ts
import * as SQLite from 'expo-sqlite';
import type { MediaItem, Album } from '../../types/media';

const db = SQLite.openDatabase('vaultcalc.db');

export const database = {
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(MIGRATION_001);
      }, reject, resolve);
    });
  },

  async getMediaByType(type: string, isDecoy: boolean): Promise<MediaItem[]> {
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `SELECT * FROM media_items WHERE type = ? AND is_decoy = ? ORDER BY created_at DESC`,
          [type, isDecoy ? 1 : 0],
          (_, { rows }) => resolve(rows._array as MediaItem[]),
          (_, error) => { reject(error); return false; }
        );
      });
    });
  },

  async insertMedia(item: Omit<MediaItem, 'id'>): Promise<string> {
    const id = generateUUID();
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `INSERT INTO media_items (id, type, name, encrypted_path, thumbnail_path,
            original_name, mime_type, size_bytes, duration_ms, width, height,
            key_id, is_decoy, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, item.type, item.name, item.encryptedPath, item.thumbnailPath,
            item.originalName, item.mimeType, item.sizeBytes, item.durationMs,
            item.width, item.height, item.keyId, item.isDecoy ? 1 : 0,
            JSON.stringify(item.metadata ?? {})
          ],
          () => resolve(id),
          (_, error) => { reject(error); return false; }
        );
      });
    });
  },

  async deleteMedia(ids: string[]): Promise<void> {
    const placeholders = ids.map(() => '?').join(',');
    return new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `DELETE FROM media_items WHERE id IN (${placeholders})`,
          ids,
          () => resolve(),
          (_, error) => { reject(error); return false; }
        );
      });
    });
  },
};
```

---

## 6. File Operations

### 6.1 Import Flow

```typescript
// services/media/import.ts
import { crypto } from '../crypto';
import { database } from '../storage/database';
import { fileSystem } from '../storage/fileSystem';
import DocumentPicker from 'react-native-document-picker';

interface ImportOptions {
  deleteOriginal: boolean;
  isDecoy: boolean;
}

export async function importFiles(
  uris: string[],
  options: ImportOptions
): Promise<string[]> {
  const importedIds: string[] = [];

  for (const uri of uris) {
    try {
      // 1. Get file info
      const fileInfo = await fileSystem.getInfo(uri);

      // 2. Generate encryption key for this file
      const keyId = await crypto.generateFileKey();

      // 3. Determine destination path
      const encryptedPath = fileSystem.getEncryptedPath(fileInfo.name);

      // 4. Encrypt and save file
      await crypto.encryptFile(uri, encryptedPath, keyId);

      // 5. Generate thumbnail (for images/videos)
      let thumbnailPath: string | null = null;
      if (isMedia(fileInfo.mimeType)) {
        thumbnailPath = await generateEncryptedThumbnail(uri, keyId);
      }

      // 6. Save metadata to database
      const mediaItem = {
        type: getMediaType(fileInfo.mimeType),
        name: fileInfo.name,
        encryptedPath,
        thumbnailPath,
        originalName: fileInfo.name,
        mimeType: fileInfo.mimeType,
        sizeBytes: fileInfo.size,
        keyId,
        isDecoy: options.isDecoy,
        ...await extractMediaMetadata(uri, fileInfo.mimeType),
      };

      const id = await database.insertMedia(mediaItem);
      importedIds.push(id);

      // 7. Delete original if requested
      if (options.deleteOriginal) {
        await fileSystem.delete(uri);
      }
    } catch (error) {
      console.error(`Failed to import ${uri}:`, error);
      // Continue with other files
    }
  }

  return importedIds;
}

async function generateEncryptedThumbnail(
  uri: string,
  keyId: string
): Promise<string> {
  // Generate thumbnail
  const thumbUri = await createThumbnail(uri, {
    width: 300,
    height: 300,
    quality: 0.7,
  });

  // Encrypt thumbnail
  const encryptedThumbPath = fileSystem.getThumbnailPath();
  await crypto.encryptFile(thumbUri, encryptedThumbPath, keyId);

  // Clean up unencrypted thumbnail
  await fileSystem.delete(thumbUri);

  return encryptedThumbPath;
}
```

### 6.2 Decryption for Viewing

```typescript
// services/media/view.ts
import { crypto } from '../crypto';
import { fileSystem } from '../storage/fileSystem';
import { database } from '../storage/database';

const decryptedCache = new Map<string, string>();
const CACHE_LIMIT = 10;

export async function getDecryptedPath(mediaId: string): Promise<string> {
  // Check cache first
  if (decryptedCache.has(mediaId)) {
    return decryptedCache.get(mediaId)!;
  }

  // Get media info from database
  const media = await database.getMediaById(mediaId);
  if (!media) {
    throw new Error('Media not found');
  }

  // Create temp path for decrypted file
  const tempPath = fileSystem.getTempPath(media.originalName);

  // Decrypt
  await crypto.decryptFile(media.encryptedPath, tempPath, media.keyId);

  // Cache management
  if (decryptedCache.size >= CACHE_LIMIT) {
    const oldestKey = decryptedCache.keys().next().value;
    const oldestPath = decryptedCache.get(oldestKey);
    await fileSystem.delete(oldestPath!);
    decryptedCache.delete(oldestKey);
  }

  decryptedCache.set(mediaId, tempPath);
  return tempPath;
}

export async function clearDecryptedCache(): Promise<void> {
  for (const path of decryptedCache.values()) {
    try {
      await fileSystem.delete(path);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  decryptedCache.clear();
}
```

---

## 7. Navigation Architecture

### 7.1 Navigation Structure

```typescript
// app/navigation/RootNavigator.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';

export type RootStackParamList = {
  Calculator: undefined;
  Onboarding: undefined;
  Vault: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const isFirstLaunch = useSettingsStore(s => s.isFirstLaunch);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'none', // No animation between calc <-> vault
        }}
      >
        {isFirstLaunch ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <>
            <Stack.Screen name="Calculator" component={CalculatorScreen} />
            <Stack.Screen
              name="Vault"
              component={VaultNavigator}
              options={{ animation: 'fade' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

### 7.2 Vault Navigator

```typescript
// app/navigation/VaultNavigator.tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';

export type VaultTabParamList = {
  Photos: undefined;
  Videos: undefined;
  Documents: undefined;
};

export type VaultStackParamList = {
  VaultTabs: undefined;
  MediaViewer: { mediaId: string };
  AlbumView: { albumId: string };
  Settings: undefined;
  SecuritySettings: undefined;
  StorageSettings: undefined;
  Subscription: undefined;
};

const Tab = createMaterialTopTabNavigator<VaultTabParamList>();
const Stack = createNativeStackNavigator<VaultStackParamList>();

function VaultTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: styles.tabBar,
        tabBarIndicatorStyle: styles.tabIndicator,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen name="Photos" component={PhotoGalleryScreen} />
      <Tab.Screen name="Videos" component={VideoGalleryScreen} />
      <Tab.Screen name="Documents" component={DocumentsScreen} />
    </Tab.Navigator>
  );
}

export function VaultNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="VaultTabs"
        component={VaultTabs}
        options={({ navigation }) => ({
          headerTitle: 'Private',
          headerRight: () => (
            <IconButton
              icon="cog"
              onPress={() => navigation.navigate('Settings')}
            />
          ),
        })}
      />
      <Stack.Screen
        name="MediaViewer"
        component={MediaViewerScreen}
        options={{
          headerShown: false,
          animation: 'fade',
        }}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
      <Stack.Screen name="StorageSettings" component={StorageSettingsScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
    </Stack.Navigator>
  );
}
```

---

## 8. Performance Optimizations

### 8.1 FlashList for Media Grid

```typescript
// features/vault/components/MediaGrid.tsx
import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { MediaThumbnail } from './MediaThumbnail';

interface MediaGridProps {
  items: MediaItem[];
  onItemPress: (id: string) => void;
  onItemLongPress: (id: string) => void;
  selectedIds: Set<string>;
  numColumns?: number;
}

export function MediaGrid({
  items,
  onItemPress,
  onItemLongPress,
  selectedIds,
  numColumns = 3
}: MediaGridProps) {
  const renderItem = useCallback(({ item }: { item: MediaItem }) => (
    <MediaThumbnail
      item={item}
      isSelected={selectedIds.has(item.id)}
      onPress={() => onItemPress(item.id)}
      onLongPress={() => onItemLongPress(item.id)}
    />
  ), [selectedIds, onItemPress, onItemLongPress]);

  const keyExtractor = useCallback((item: MediaItem) => item.id, []);

  return (
    <FlashList
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={numColumns}
      estimatedItemSize={124}
      drawDistance={250}
      overrideItemLayout={(layout, item, index) => {
        layout.size = 124;
        layout.span = 1;
      }}
    />
  );
}
```

### 8.2 Thumbnail Caching

```typescript
// services/media/thumbnail.ts
import { Image } from 'react-native';

const thumbnailCache = new Map<string, string>();

export async function getThumbnailUri(mediaId: string): Promise<string> {
  if (thumbnailCache.has(mediaId)) {
    return thumbnailCache.get(mediaId)!;
  }

  const media = await database.getMediaById(mediaId);
  if (!media?.thumbnailPath) {
    return getPlaceholder(media?.type);
  }

  // Decrypt thumbnail to temp location
  const tempPath = fileSystem.getTempPath(`thumb_${mediaId}`);
  await crypto.decryptFile(media.thumbnailPath, tempPath, media.keyId);

  // Convert to data URI for faster access
  const base64 = await fileSystem.readAsBase64(tempPath);
  const dataUri = `data:image/jpeg;base64,${base64}`;

  // Cleanup temp file
  await fileSystem.delete(tempPath);

  // Cache in memory
  thumbnailCache.set(mediaId, dataUri);

  // Prefetch into image cache
  Image.prefetch(dataUri);

  return dataUri;
}

export function clearThumbnailCache(): void {
  thumbnailCache.clear();
}
```

### 8.3 Startup Optimization

```typescript
// app/App.tsx
import { useEffect } from 'react';
import BootSplash from 'react-native-bootsplash';

export function App() {
  useEffect(() => {
    async function init() {
      // Parallel initialization
      await Promise.all([
        database.initialize(),
        loadSettings(),
        checkSubscriptionStatus(),
      ]);

      // Hide splash after init
      await BootSplash.hide({ fade: true });
    }

    init();
  }, []);

  return <RootNavigator />;
}
```

---

## 9. Build Configuration

### 9.1 ProGuard Rules

```proguard
# proguard-rules.pro

# Keep Tink classes
-keep class com.google.crypto.tink.** { *; }
-keepclassmembers class com.google.crypto.tink.** { *; }

# Keep native modules
-keep class com.vaultcalc.modules.** { *; }

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# Prevent obfuscation of crypto-related classes
-keepnames class * implements javax.crypto.Cipher
-keepnames class * implements java.security.KeyStore
```

### 9.2 Gradle Configuration

```kotlin
// android/app/build.gradle.kts
android {
    compileSdk = 34

    defaultConfig {
        applicationId = "com.vaultcalc"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    // Enable core library desugaring for Java 8+ APIs
    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.crypto.tink:tink-android:1.12.0")
    implementation("androidx.biometric:biometric:1.2.0-alpha05")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

```typescript
// __tests__/services/crypto.test.ts
import { crypto } from '../../src/services/crypto';

describe('CryptoService', () => {
  describe('deriveKey', () => {
    it('should derive consistent keys for same input', async () => {
      const salt = 'test-salt-123';
      const pin = '1234';

      const key1 = await crypto.deriveKey(pin, salt);
      const key2 = await crypto.deriveKey(pin, salt);

      expect(key1).toBe(key2);
    });

    it('should derive different keys for different PINs', async () => {
      const salt = 'test-salt-123';

      const key1 = await crypto.deriveKey('1234', salt);
      const key2 = await crypto.deriveKey('5678', salt);

      expect(key1).not.toBe(key2);
    });
  });
});
```

### 10.2 Integration Tests

```typescript
// __tests__/integration/fileEncryption.test.ts
import { crypto } from '../../src/services/crypto';
import { fileSystem } from '../../src/services/storage/fileSystem';

describe('File Encryption Integration', () => {
  const testFilePath = '/test/input.txt';
  const encryptedPath = '/test/encrypted.bin';
  const decryptedPath = '/test/decrypted.txt';

  beforeAll(async () => {
    await fileSystem.writeFile(testFilePath, 'Hello, World!');
  });

  afterAll(async () => {
    await fileSystem.delete(testFilePath);
    await fileSystem.delete(encryptedPath);
    await fileSystem.delete(decryptedPath);
  });

  it('should encrypt and decrypt file correctly', async () => {
    const keyId = await crypto.generateFileKey();

    await crypto.encryptFile(testFilePath, encryptedPath, keyId);
    await crypto.decryptFile(encryptedPath, decryptedPath, keyId);

    const original = await fileSystem.readFile(testFilePath);
    const decrypted = await fileSystem.readFile(decryptedPath);

    expect(decrypted).toBe(original);
  });
});
```

---

## 11. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cold start | < 800ms | Time to interactive |
| Vault unlock | < 300ms | PIN entry to vault visible |
| Thumbnail load | < 50ms | Per thumbnail decrypt + render |
| File import (10MB) | < 3s | Encrypt + save + thumbnail |
| Memory (idle) | < 120MB | After vault access |
| Memory (browsing) | < 200MB | 100+ thumbnails loaded |
| APK size | < 15MB | Release build |
| Battery | < 2%/hour | Active vault browsing |

---

## 12. Error Handling

### 12.1 Error Boundaries

```typescript
// shared/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, Button } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    // Log to crash reporting service (not analytics)
    logCrash(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Button
            title="Try Again"
            onPress={() => this.setState({ hasError: false, error: null })}
          />
        </View>
      );
    }

    return this.props.children;
  }
}
```

### 12.2 Crypto Error Handling

```typescript
// services/crypto/errors.ts
export class CryptoError extends Error {
  constructor(
    message: string,
    public code: CryptoErrorCode,
    public cause?: Error
  ) {
    super(message);
    this.name = 'CryptoError';
  }
}

export enum CryptoErrorCode {
  KEY_DERIVATION_FAILED = 'KEY_DERIVATION_FAILED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  KEYSTORE_UNAVAILABLE = 'KEYSTORE_UNAVAILABLE',
  INVALID_KEY = 'INVALID_KEY',
}

export function handleCryptoError(error: unknown): never {
  if (error instanceof CryptoError) {
    throw error;
  }

  const message = error instanceof Error ? error.message : 'Unknown crypto error';
  throw new CryptoError(message, CryptoErrorCode.ENCRYPTION_FAILED,
    error instanceof Error ? error : undefined);
}
```

---

*Document Version: 1.0*
*Last Updated: 2024*
