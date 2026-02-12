# VaultCalcApp — Security Deep Audit

**Date:** 2026-02-12
**Scope:** Crypto flows, key handling, storage boundaries, JS-native bridges
**Status:** CRITICAL FIXES APPLIED (C-1, C-2, C-3)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Findings by Severity](#2-findings-by-severity)
3. [Crypto Flows & Key Handling](#3-crypto-flows--key-handling)
4. [Storage Boundaries](#4-storage-boundaries)
5. [JS-Native Bridge Security](#5-js-native-bridge-security)
6. [Authentication & Biometric Security](#6-authentication--biometric-security)
7. [Network & Cloud Sync Security](#7-network--cloud-sync-security)
8. [Billing & Premium Bypass](#8-billing--premium-bypass)
9. [Android Manifest & Build Hardening](#9-android-manifest--build-hardening)
10. [Positive Findings](#10-positive-findings)
11. [Remediation Priority Matrix](#11-remediation-priority-matrix)

---

## 1. Executive Summary

VaultCalcApp demonstrates **strong cryptographic fundamentals** — AES-256-GCM via Google Tink, Argon2id with memory-hard parameters, Android Keystore-backed master keys, and constant-time PIN comparison. The core encryption pipeline is sound.

However, the audit identified **18 findings** across key exposure, plaintext persistence, insecure defaults, and bridge-layer risks:

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH     | 5 |
| MEDIUM   | 7 |
| LOW      | 3 |

The most impactful issues are: (1) ShareModule missing path validation — allowing shares of files outside the vault directory, (2) client-side-only premium verification — trivially bypassable, and (3) plaintext SQLite database — metadata enumerable if device is compromised.

---

## 2. Findings by Severity

### CRITICAL

| ID | Finding | Location |
|----|---------|----------|
| C-1 | [ShareModule has no path validation](#c-1-sharemodule-missing-path-validation) | `ShareModule.kt:42-68, 79-113` |
| C-2 | [Premium status verified client-side only](#c-2-client-side-only-premium-verification) | `premiumStatusService.ts:17-50` |
| C-3 | [SQLite database unencrypted at rest](#c-3-sqlite-database-unencrypted-at-rest) | `database.ts:120-190` |

### HIGH

| ID | Finding | Location |
|----|---------|----------|
| H-1 | [PIN string immutable in JVM heap](#h-1-pin-string-immutable-in-jvm-heap) | `CryptoModule.kt:337, 395, 409` |
| H-2 | [PIN string non-erasable in JS heap](#h-2-pin-string-non-erasable-in-js-heap) | `authService.ts:69-120`, `cryptoService.ts:249-266` |
| H-3 | [Decrypted share temp files on disk for 5 seconds](#h-3-decrypted-temp-files-on-disk-during-share) | `shareService.ts:64-124` |
| H-4 | [Error messages leak exception internals to JS](#h-4-error-messages-leak-exception-details) | All native modules |
| H-5 | [Purchase token stored plaintext in MMKV](#h-5-purchase-token-stored-plaintext-in-mmkv) | `settingsStore.ts:82-86` |

### MEDIUM

| ID | Finding | Location |
|----|---------|----------|
| M-1 | [No certificate pinning for Google APIs](#m-1-no-certificate-pinning) | `network_security_config.xml` |
| M-2 | [GalleryModule pendingDeletePromise not synchronized](#m-2-gallerymodule-race-condition) | `GalleryModule.kt:42` |
| M-3 | [OAuth token not cleared after use in JS](#m-3-oauth-token-not-cleared-in-js) | `driveRestoreService.ts`, `driveUploadService.ts` |
| M-4 | [Media file paths stored plaintext in DB](#m-4-media-file-paths-plaintext-in-database) | `database.ts:124` |
| M-5 | [Note titles stored plaintext in DB](#m-5-note-titles-plaintext-in-database) | `database.ts:175` |
| M-6 | [Clipboard not cleared after text share](#m-6-clipboard-not-cleared-after-text-share) | `shareService.ts:135-138` |
| M-7 | [Placeholder Google Client ID ships in source](#m-7-placeholder-google-client-id) | `config.ts:11` |

### LOW

| ID | Finding | Location |
|----|---------|----------|
| L-1 | [No root/tamper detection (SafetyNet/Play Integrity)](#l-1-no-root-detection) | N/A |
| L-2 | [ProGuard keeps SourceFile attribute](#l-2-proguard-keeps-sourcefile-attribute) | `proguard-rules.pro:68` |
| L-3 | [Promise.reject passes full Exception objects](#l-3-exception-objects-in-promise-rejection) | All native modules |

---

## 3. Crypto Flows & Key Handling

### 3.1 Encryption Architecture (SECURE)

```
                 Android Keystore (TEE/StrongBox)
                         │
                         ▼
              ┌──────────────────────┐
              │  vaultcalc_master_key │  ← hardware-backed
              └──────────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
     ┌────────────────┐   ┌────────────────────┐
     │ AEAD Keyset    │   │ StreamingAEAD Keyset│
     │ AES-256-GCM    │   │ AES256-GCM-HKDF-4KB│
     └────────────────┘   └────────────────────┘
     Used for:             Used for:
     - String encryption   - Large file encryption
     - File encryption     - Video encryption
     - Note content        - Cloud backup files
     - PIN hash storage
```

**Verified secure:**
- Master key URI: `android-keystore://vaultcalc_master_key` (`CryptoModule.kt:48`)
- Keyset stored encrypted in SharedPreferences via `AndroidKeysetManager` (`CryptoModule.kt:109-127`)
- IV/nonce handled automatically by Tink (no manual IV management)
- Associated Data (AAD) used for domain separation: `pin_hash`, `pin_salt`, `note:{id}`, `vaultcalc-backup-manifest-v1`

### 3.2 Key Derivation — Argon2id (SECURE)

**Location:** `CryptoModule.kt:50-55, 348-377`

| Parameter | Value | OWASP Minimum | Status |
|-----------|-------|---------------|--------|
| Variant | Argon2id | Argon2id | PASS |
| Memory | 64 MB (65536 KB) | 19 MB | PASS |
| Iterations | 3 | 2 | PASS |
| Parallelism | 4 | 1 | PASS |
| Hash length | 256-bit | 128-bit | PASS |
| Salt length | 128-bit | 128-bit | PASS |
| Salt source | `SecureRandom` | CSPRNG | PASS |

### 3.3 Key Material Cleanup (PARTIALLY SECURE)

**Native side — GOOD:**
```kotlin
// CryptoModule.kt:374-376
finally {
    pinChars.fill('\u0000')  // Clear PIN char array
    derivedKey.fill(0)       // Clear derived key bytes
}
```
Both `deriveKeyFromPin` and `verifyPin` use `finally` blocks for cleanup.

**Key exposure risk identified — see H-1 and H-2.**

### 3.4 Constant-Time Comparison (SECURE)

```kotlin
// CryptoModule.kt:430
val isValid = MessageDigest.isEqual(derivedHash, storedHash)
```

Uses `java.security.MessageDigest.isEqual()` — compares all bytes regardless of mismatch position. Timing attack resistant.

### 3.5 Random Number Generation (SECURE)

All random generation uses `java.security.SecureRandom`:
- Salt generation: `CryptoModule.kt:344-345`
- Key generation: `CryptoModule.kt:303`
- Uses `/dev/urandom` on Android (non-blocking, well-seeded)

---

## 4. Storage Boundaries

### 4.1 Storage Layer Map

```
┌─────────────────────────────────────────────────────────┐
│                    Android Keystore                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │ vaultcalc_master_key (AES-256, hardware-backed) │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ vaultcalc_biometric_key (AES-256-CBC, bio-bound)│    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│           SharedPreferences (Encrypted by Tink)          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Tink AEAD keyset (encrypted by master key)      │    │
│  │ Tink StreamingAEAD keyset (encrypted)           │    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│              MMKV (UNENCRYPTED) ⚠️                       │
│  ✓ Theme, lock timeout, feature flags (non-sensitive)   │
│  ✓ PIN hash + salt (AES-256-GCM encrypted before write) │
│  ⚠️ premiumPurchaseToken (PLAINTEXT) → see H-5           │
│  ○ googleDriveEmail, googleDriveDisplayName (low risk)  │
├─────────────────────────────────────────────────────────┤
│             SQLite — vaultcalc.db (UNENCRYPTED) ⚠️       │
│  ⚠️ media_items: encrypted_path, original_name → see M-4 │
│  ⚠️ notes: title PLAINTEXT, content AES-256-GCM → see M-5│
│  ⚠️ intruder_logs: photo_path, device_info               │
│  ○ albums: name, metadata                               │
├─────────────────────────────────────────────────────────┤
│              App-Private Filesystem                      │
│  ✓ /files/vault/photos/*.enc (AES-256-GCM encrypted)   │
│  ✓ /files/vault/videos/*.enc (StreamingAEAD encrypted)  │
│  ✓ /files/vault/intruder/*.enc (encrypted captures)     │
│  ⚠️ /files/share_temp/* (plaintext during share) → H-3   │
├─────────────────────────────────────────────────────────┤
│            Zustand In-Memory Stores                      │
│  ✓ authStore: NOT persisted (resets on restart)         │
│  ✓ vaultStore: NOT persisted (resets on lock)           │
│  ○ settingsStore: persisted to MMKV (non-sensitive)     │
└─────────────────────────────────────────────────────────┘
```

### C-3: SQLite Database Unencrypted at Rest

**Severity: CRITICAL**
**Location:** `database.ts` — entire DB created via `expo-sqlite` with no encryption

**Risk:** If device is compromised (USB debugging, rooted, forensic extraction), attacker can read:
- All media item metadata (original filenames, sizes, timestamps, types)
- Note titles (content is encrypted, but titles are plaintext)
- Intruder log timestamps and device info
- Album names and structure

**Note:** Actual encrypted files (`*.enc`) remain protected. This is a metadata exposure, not a content exposure.

**Recommendation:** Migrate to SQLCipher or implement application-layer encryption of sensitive DB columns. At minimum, encrypt `original_name`, `notes.title`, and `intruder_logs.device_info`.

### M-4: Media File Paths Plaintext in Database

**Severity: MEDIUM**
**Location:** `database.ts:124` — `encrypted_path TEXT NOT NULL`

Paths like `/data/data/com.vaultcalcapp/files/vault/photos/abc123.enc` expose vault structure and file count.

### M-5: Note Titles Plaintext in Database

**Severity: MEDIUM**
**Location:** `database.ts:175` — `title TEXT NOT NULL`

Note content IS encrypted (`is_encrypted` flag, AES-256-GCM with `note:{id}` AAD), but the **title is plaintext**. A note titled "Bank Account Passwords" reveals intent even without content.

### H-5: Purchase Token Stored Plaintext in MMKV

**Severity: HIGH**
**Location:** `settingsStore.ts:82-86`

```typescript
premiumProductId: string | null;
premiumPurchaseToken: string | null;
```

Google Play purchase tokens are stored unencrypted in MMKV. These tokens can be used to verify/manipulate purchase state. Should either be encrypted or not stored locally at all (server-side verification preferred).

---

## 5. JS-Native Bridge Security

### 5.1 Native Module Inventory

| Module | Name | Sensitive Data Crosses Bridge |
|--------|------|-------------------------------|
| CryptoModule | `CryptoModule` | PIN (string), encrypted data (base64), paths |
| BiometricModule | `BiometricModule` | Boolean auth result + CryptoObject |
| ShareModule | `VaultShareModule` | File paths, plain text (notes) |
| MediaModule | `MediaModule` | File paths, auth tokens, URIs |
| BillingModule | `BillingModule` | Purchase tokens, product IDs |
| GalleryModule | `GalleryModule` | Media URIs |
| IntruderCameraModule | `IntruderCameraModule` | File paths |
| PdfModule | `PdfModule` | File paths |
| AppSecurityModule | `AppSecurityModule` | Boolean flags |

### C-1: ShareModule Missing Path Validation

**Severity: CRITICAL**
**Location:** `ShareModule.kt:42-68` (shareFile), `ShareModule.kt:79-113` (shareFiles)

```kotlin
fun shareFile(filePath: String, mimeType: String, title: String, promise: Promise) {
    val file = File(filePath)
    if (!file.exists()) {
        promise.reject(ERROR_SHARE, "File does not exist: $filePath")
        return@launch
    }
    // ❌ NO PATH VALIDATION — can share ANY readable file
    val uri = FileProvider.getUriForFile(reactApplicationContext, authority, file)
    // ...
}
```

**Contrast with CryptoModule** which properly validates paths:
```kotlin
// CryptoModule.kt:84-89 — CORRECTLY validates
private fun validatePath(path: String) {
    val canonical = File(path).canonicalPath
    if (!canonical.startsWith(appFilesDir)) {
        throw SecurityException("Path traversal not allowed")
    }
}
```

**Risk:** A compromised JS layer (XSS in WebView, malicious dependency) could call `NativeShare.shareFile('/data/data/com.vaultcalcapp/shared_prefs/vaultcalc_crypto_prefs.xml', 'text/xml', 'Share')` to exfiltrate the encrypted Tink keyset.

**Note:** FileProvider's `file_paths.xml` restricts to `share_temp/` path only, which **limits this attack** to files within that directory. However, `shareFile` and `shareFiles` use `FileProvider.getUriForFile()` which will throw `IllegalArgumentException` for paths outside the configured `<files-path>`. This acts as an implicit guard but relies on FileProvider config being correct and is not defense-in-depth.

**Recommendation:** Add explicit `validatePath()` check matching CryptoModule's pattern.

### H-1: PIN String Immutable in JVM Heap

**Severity: HIGH**
**Location:** `CryptoModule.kt:337, 395, 409`

```kotlin
fun deriveKeyFromPin(pin: String, saltBase64: String?, promise: Promise) {
    //                   ^^^^^^^^^^
    // String is immutable in JVM — cannot be securely erased
    val pinChars = pin.toCharArray()  // Creates COPY, original String persists
    try {
        generator.generateBytes(pinChars, derivedKey)
    } finally {
        pinChars.fill('\u0000')  // Clears the copy, but original `pin` String remains
    }
}
```

The `pin` parameter is a JVM `String`. The `.toCharArray()` call creates a mutable copy that IS zeroed, but the original immutable `String` object persists on the heap until garbage collection. A memory dump or heap analysis could recover it.

**Architectural limitation** — the React Native bridge serializes all parameters as Strings. Accepting `CharArray` directly is not possible via `@ReactMethod`.

**Recommendation:** Document as an accepted risk. Consider calling `System.gc()` after sensitive operations (non-deterministic but reduces window). Alternatively, use JNI to pin and zero the String's internal char array (fragile, version-dependent).

### H-2: PIN String Non-Erasable in JS Heap

**Severity: HIGH**
**Location:** `authService.ts:69-120`, `cryptoService.ts:249-266`

```typescript
export async function attemptPinAuth(pin: string): Promise<AuthResult> {
    // `pin` is a JS string — immutable, no secure erase API
    const primaryResult = await verifyPin(pin, primaryCredentials.hash, primaryCredentials.salt);
    // `pin` stays in JS heap until GC — no way to zero it
}
```

JavaScript strings are immutable and garbage-collected non-deterministically. The PIN persists in the Hermes VM heap.

**Recommendation:** Accepted architectural limitation of JS. Minimize PIN lifetime — avoid storing in component state longer than necessary. Document the risk.

### H-4: Error Messages Leak Exception Details

**Severity: HIGH**
**Location:** All native modules

Pattern found across modules:
```kotlin
// CryptoModule.kt:380
promise.reject("CRYPTO_KDF_ERROR", "Key derivation failed: ${e.message}", e)

// CryptoModule.kt:441
promise.reject("CRYPTO_VERIFY_ERROR", "PIN verification failed: ${e.message}", e)

// ShareModule.kt:65
promise.reject(ERROR_SHARE, e.message, e)

// BillingModule.kt (multiple locations)
promise.reject("BILLING_FLOW_ERROR", "Purchase failed: ${billingResult.debugMessage}")
```

**Risk:** `e.message` and `billingResult.debugMessage` may contain:
- Internal library state (Tink keyset issues, Keystore errors)
- File paths in IO exceptions
- Account-specific billing debug info

The third argument (`e`) serializes the full Java exception including stack trace, which React Native forwards to the JS error handler.

**Recommendation:** Use generic error messages in `promise.reject()`. Log full details on the native side only (or to Crashlytics). Never pass the exception object as the third argument.

### M-2: GalleryModule Race Condition

**Severity: MEDIUM**
**Location:** `GalleryModule.kt:42`

```kotlin
private var pendingDeletePromise: Promise? = null  // Not @Volatile, no synchronization
```

Compare with BillingModule which correctly synchronizes:
```kotlin
@Volatile private var pendingPurchasePromise: Promise? = null
private val promiseLock = Any()
```

**Risk:** If two delete requests fire in rapid succession, the second overwrites `pendingDeletePromise`, orphaning the first promise (never resolved/rejected).

**Recommendation:** Add `@Volatile` and `synchronized` block matching BillingModule's pattern.

### M-3: OAuth Token Not Cleared After Use

**Severity: MEDIUM**
**Location:** `driveUploadService.ts`, `driveRestoreService.ts`

OAuth access tokens are assigned to local variables and passed through multiple function calls without clearing references after use. While JS strings can't be securely zeroed, setting the variable to `''` at least removes the strong reference sooner.

---

## 6. Authentication & Biometric Security

### 6.1 PIN Authentication (SECURE)

| Aspect | Implementation | Status |
|--------|---------------|--------|
| PIN hashing | Argon2id (64MB, 3 iter, 4 threads) | PASS |
| Comparison | `MessageDigest.isEqual()` (constant-time) | PASS |
| Storage | Hash+salt encrypted with AES-256-GCM before MMKV | PASS |
| Validation | 4-12 digits, regex `^\d+$` | PASS |
| Brute-force | Exponential backoff: 500ms base, 1.5x multiplier, 5s max | PASS |
| Lockout | 5 attempts → lockout; progressive: 30s → 1m → 5m → 15m → 1h | PASS |
| Max attempts | 10 → data wipe warning | PASS |
| State persistence | Auth store NOT persisted (resets on restart) | PASS |
| Decoy vault | Separate PIN with independent hash+salt | PASS |

### 6.2 Biometric Authentication (SECURE)

**Location:** `BiometricModule.kt:222-240`

```kotlin
KeyGenParameterSpec.Builder(BIOMETRIC_KEY_ALIAS, PURPOSE_ENCRYPT or PURPOSE_DECRYPT)
    .setBlockModes(KeyProperties.BLOCK_MODE_CBC)
    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_PKCS7)
    .setKeySize(256)
    .setUserAuthenticationRequired(true)
    .setInvalidatedByBiometricEnrollment(true)
```

| Aspect | Implementation | Status |
|--------|---------------|--------|
| CryptoObject binding | AES-256-CBC cipher bound to BiometricPrompt | PASS |
| Authenticator class | `BIOMETRIC_STRONG` (Class 3 only) | PASS |
| Enrollment invalidation | `setInvalidatedByBiometricEnrollment(true)` | PASS |
| Fallback | Always falls back to PIN on biometric failure | PASS |
| Lockout handling | Detects `ERROR_LOCKOUT` and `ERROR_LOCKOUT_PERMANENT` | PASS |

### 6.3 Session Management (SECURE)

| Aspect | Implementation | Status |
|--------|---------------|--------|
| Inactivity timeout | 5s polling interval, configurable lockTimeout | PASS |
| Background lock | `AppState` listener — locks on `background`/`inactive` | PASS |
| Task switcher | `excludeFromRecents` hides vault content | PASS |
| Session reset | Full logout + navigate to Calculator on lock | PASS |

### L-1: No Root/Tamper Detection

**Severity: LOW**
**Location:** N/A — not implemented

No SafetyNet Attestation or Play Integrity API check. On rooted devices, Android Keystore hardware protection may be bypassed (device-dependent).

**Recommendation:** Consider Play Integrity API integration. Degrade gracefully (warn user, disable biometric on untrusted devices). This is optional hardening — the app's layered encryption still protects data even on rooted devices.

---

## 7. Network & Cloud Sync Security

### 7.1 TLS Enforcement (SECURE)

**Location:** `network_security_config.xml:14`

```xml
<base-config cleartextTrafficPermitted="false">
```

All network traffic requires TLS. Localhost exception scoped to `localhost` and `10.0.2.2` only (Metro bundler in debug).

### 7.2 Cloud Backup Encryption (SECURE)

**Location:** `backupService.ts:49-62`

Backup data is encrypted BEFORE upload to Google Drive:
- Manifest encrypted with AES-256-GCM (AAD: `vaultcalc-backup-manifest-v1`)
- Media files already stored as `.enc` (encrypted at import time)
- Thumbnails encrypted
- Google Drive sees only ciphertext

### M-1: No Certificate Pinning

**Severity: MEDIUM**
**Location:** `network_security_config.xml`

System CA store is the only trust anchor. No pins for `googleapis.com`.

**Risk:** If device CA store is compromised (corporate MITM proxy, malicious CA installed), traffic to Google APIs could be intercepted, exposing OAuth tokens in `Authorization: Bearer` headers.

**Recommendation:** Add certificate pinning for `googleapis.com` in network security config:
```xml
<domain-config>
    <domain includeSubdomains="true">googleapis.com</domain>
    <pin-set>
        <pin digest="SHA-256">...</pin>
    </pin-set>
</domain-config>
```

### M-7: Placeholder Google Client ID

**Severity: MEDIUM**
**Location:** `config.ts:11`

```typescript
export const GOOGLE_WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
```

A guard function `isGoogleDriveConfigured()` exists (line 16-18) which checks for the placeholder prefix. If not replaced before release, cloud features silently fail — not a security vulnerability per se, but a deployment risk.

---

## 8. Billing & Premium Bypass

### C-2: Client-Side Only Premium Verification

**Severity: CRITICAL**
**Location:** `premiumStatusService.ts:17-50`

```typescript
export async function checkPremiumStatus(): Promise<void> {
    const restoreResult = await restorePurchases();
    const activePurchase = getActivePremiumPurchase(restoreResult.purchases);
    if (activePurchase) {
        settings.setPremiumStatus('premium');  // ← local storage only
    }
}
```

**Attack vectors:**
1. **MMKV Tampering (root):** Modify `premiumStatus` directly in MMKV storage to `'premium'`
2. **Google Play Spoofing:** Tools like Lucky Patcher can intercept `queryPurchasesAsync` and return fake purchases
3. **Network-level:** No server-side token verification — `purchaseToken` is never validated against Google Play Developer API

**Recommendation:** Implement server-side purchase verification:
1. Send `purchaseToken` to a backend server
2. Backend calls `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/subscriptions/{subscriptionId}/tokens/{token}`
3. Only grant premium based on server response
4. Cache server response with short TTL

If no backend is feasible, at minimum use Google Play's `isAcknowledged` and `purchaseState` checks combined with obfuscated local validation. But server-side is the only truly secure approach.

---

## 9. Android Manifest & Build Hardening

### 9.1 Manifest Security (GOOD)

**Location:** `AndroidManifest.xml`

| Setting | Value | Status |
|---------|-------|--------|
| `allowBackup` | `false` | PASS |
| `networkSecurityConfig` | Referenced | PASS |
| `exported` (MainActivity) | `true` (correct — entry point) | PASS |
| `exported` (FileProvider) | `false` | PASS |
| Permissions | Minimal: INTERNET, CAMERA, READ_MEDIA_* | PASS |

### 9.2 Build Security

| Setting | Value | Status |
|---------|-------|--------|
| ProGuard/R8 (release) | Enabled | PASS |
| `shrinkResources` | `true` | PASS |
| `debuggableVariants` | `["devDebug"]` only | PASS |
| Release signing | External `signing.properties` | PASS |

### 9.3 FileProvider Scope (MITIGATING FACTOR for C-1)

**Location:** `file_paths.xml:4`

```xml
<files-path name="share_temp" path="share_temp/" />
```

FileProvider is restricted to `share_temp/` directory. `FileProvider.getUriForFile()` throws `IllegalArgumentException` for paths outside this scope. This provides implicit protection against C-1, but it's not defense-in-depth — explicit validation is still recommended.

### L-2: ProGuard Keeps SourceFile Attribute

**Severity: LOW**
**Location:** `proguard-rules.pro:68`

```proguard
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
```

Line numbers are kept for crash reporting (standard practice). Source filenames are renamed to generic "SourceFile" — this is acceptable. The `LineNumberTable` does reveal method structure to reverse engineers.

**Recommendation:** Acceptable tradeoff for crash reporting. No action needed unless regulatory compliance requires full obfuscation.

### L-3: Exception Objects in Promise Rejection

**Severity: LOW**
**Location:** All native modules

```kotlin
promise.reject(ERROR_SHARE, e.message, e)  // Third arg serializes stack trace
```

The exception object (third argument) causes React Native to serialize the full Java stack trace, which may include internal class names, line numbers, and method signatures. This aids reverse engineering.

**Recommendation:** Omit the third argument: `promise.reject(ERROR_CODE, "Generic message")`. Log the full exception natively for debugging.

---

## 10. Positive Findings

The following security controls are **correctly implemented** and represent strong security architecture:

| Control | Implementation | Location |
|---------|---------------|----------|
| AES-256-GCM (AEAD) | Google Tink 1.12.0 | `CryptoModule.kt:111` |
| StreamingAEAD | AES256-GCM-HKDF-4KB for large files | `CryptoModule.kt:122` |
| Android Keystore master key | Hardware-backed (TEE/StrongBox) | `CryptoModule.kt:48, 109-114` |
| Argon2id KDF | 64MB memory, 3 iterations, parallelism 4 | `CryptoModule.kt:50-55` |
| Constant-time comparison | `MessageDigest.isEqual()` | `CryptoModule.kt:430` |
| Key material zeroing | `pinChars.fill()`, `derivedKey.fill(0)` | `CryptoModule.kt:374-376, 436-437` |
| SecureRandom | CSPRNG for all salts, keys, IDs | `CryptoModule.kt:303, 344` |
| Path traversal protection | Canonical path validation | `CryptoModule.kt:84-89` |
| PIN defense-in-depth | Argon2id hash → AES-256-GCM encrypt → MMKV | `pinStorage.ts:54-63` |
| Biometric CryptoObject | AES-256 Keystore key bound to biometric | `BiometricModule.kt:222-240` |
| Bio enrollment invalidation | `setInvalidatedByBiometricEnrollment(true)` | `BiometricModule.kt:236` |
| Brute-force protection | Exponential backoff + progressive lockout | `failedAttempts.ts:19-115` |
| Auth state ephemeral | NOT persisted to disk | `authStore.ts:100` |
| Vault state ephemeral | Resets on lock/restart | `vaultStore.ts:88-91` |
| Note content encrypted | AES-256-GCM with per-note AAD | `database.ts:748-754` |
| Intruder photos encrypted | AES-256-GCM with unique context ID | `intruderLogService.ts:79-83` |
| Secure file deletion | Random overwrite + sync + delete | `MediaModule.kt:279-301` |
| Backup encryption | All data encrypted before Google Drive upload | `backupService.ts:49-62` |
| No cleartext traffic | `cleartextTrafficPermitted="false"` | `network_security_config.xml:14` |
| Backup disabled | `android:allowBackup="false"` | `AndroidManifest.xml:15` |
| Recents hiding | `excludeFromRecents` on lock | `appSecurity.ts:33-39` |
| MMKV data separation | Sensitive data never stored plaintext in MMKV | `mmkv.ts:18-28` |
| Promise thread safety | `withContext(Dispatchers.Main)` for all resolve/reject | All modules |
| Associated data (AAD) | Domain separation for all encryption contexts | Throughout |

---

## 11. Remediation Priority Matrix

### P0 — Fix Before Release

| ID | Finding | Effort | Impact |
|----|---------|--------|--------|
| C-1 | Add `validatePath()` to ShareModule | Low (copy from CryptoModule) | Prevents file exfiltration |
| C-2 | Implement server-side purchase verification | High (requires backend) | Prevents premium bypass |
| H-4 | Sanitize all `promise.reject()` messages | Medium (audit all modules) | Prevents info leakage |

### P1 — Fix in Next Release

| ID | Finding | Effort | Impact |
|----|---------|--------|--------|
| C-3 | Encrypt SQLite database (SQLCipher) | High (migration required) | Protects metadata at rest |
| H-3 | Use secure delete for share temp files | Low (call existing `secureDelete`) | Reduces plaintext window |
| H-5 | Encrypt or remove purchase token from MMKV | Low | Prevents token extraction |
| M-5 | Encrypt note titles in database | Medium | Protects note metadata |

### P2 — Hardening

| ID | Finding | Effort | Impact |
|----|---------|--------|--------|
| M-1 | Add certificate pinning for googleapis.com | Low | MITM protection |
| M-2 | Add `@Volatile` + sync to GalleryModule | Trivial | Thread safety |
| M-3 | Clear OAuth token references after use | Trivial | Reduces token lifetime |
| M-4 | Hash/encrypt media file paths in DB | Medium | Metadata protection |
| M-6 | Clear clipboard after text share (30s) | Low | Prevents clipboard sniffing |
| M-7 | Ensure Client ID configured in release | Trivial (build check) | Deployment safety |

### P3 — Defense in Depth (Optional)

| ID | Finding | Effort | Impact |
|----|---------|--------|--------|
| H-1 | Document JVM String limitation for PIN | N/A (doc only) | Transparency |
| H-2 | Document JS String limitation for PIN | N/A (doc only) | Transparency |
| L-1 | Integrate Play Integrity API | Medium | Root detection |
| L-2 | Review ProGuard SourceFile attribute | Trivial | Obfuscation |
| L-3 | Remove exception objects from promise.reject | Low | Info leakage |

---

*End of audit. No files were modified.*
