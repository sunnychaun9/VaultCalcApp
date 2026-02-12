# VaultCalcApp - Security Audit Report

**Date:** 2026-02-11
**Application:** VaultCalcApp (React Native 0.83.1, Android-only)
**Scope:** Complete codebase security review

---

## Executive Summary

VaultCalcApp demonstrates a **STRONG overall security posture** with proper cryptographic implementation, Android platform security best practices, and solid architectural decisions.

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | None found |
| HIGH | 1 | Needs attention |
| MEDIUM | 4 | Recommended |
| LOW | 0 | - |
| INFO | 25+ | Positive findings |

---

## HIGH Severity Findings (1)

### H-1: PIN Not Cleared from JavaScript Memory

- **Category:** Authentication — Memory Safety
- **File:** `src/features/auth/services/authService.ts`
- **Issue:** PIN string passed to `verifyPin()` is not explicitly cleared from JavaScript memory after use.
- **Risk:** Memory dump on a compromised device could expose the PIN string.
- **Recommendation:** Clear PIN `CharArray` on the native side with explicit `fill()`:
  ```kotlin
  val charArray = pin.toCharArray()
  try {
    generator.generateBytes(charArray, derivedKey)
  } finally {
    charArray.fill('\u0000')
  }
  ```

---

## MEDIUM Severity Findings (4)

### M-1: Thumbnail Cache — Decrypted Files on Disk

- **File:** `src/services/thumbnail/thumbnailCache.ts`
- **Issue:** Thumbnails are decrypted and cached as unencrypted JPEG files in `thumbcache/`.
- **Risk:** Forensic recovery of deleted thumbnails before garbage collection.
- **Mitigations already present:** `clearThumbnailCache()` called on vault lock (App.tsx:55).
- **Recommendations:**
  1. Verify `clearCache()` called on every logout path.
  2. Consider in-memory caching only for high-security mode.
  3. Implement secure deletion (overwrite with random data before unlink).

### M-2: Path Traversal — Missing Input Validation in CryptoModule

- **File:** `android/.../modules/crypto/CryptoModule.kt`
- **Issue:** File encryption method does not validate the destination path against a canonical vault directory.
- **Risk:** Path traversal attacks (e.g., `../../system/app/attacker.apk`).
- **Recommendation:**
  ```kotlin
  if (!destFile.canonicalPath.startsWith(vaultDir.canonicalPath)) {
    promise.reject("INVALID_PATH", "Path traversal not allowed")
  }
  ```

### M-3: Network Security Configuration Missing

- **File:** Expected at `android/app/src/main/res/xml/network_security_config.xml` — **not found**.
- **Issue:** No explicit TLS / network security policy.
- **Risk:** MITM attacks possible on rooted devices or compromised networks.
- **Recommendation:** Create `network_security_config.xml` with:
  - Cleartext traffic disabled globally
  - Minimum TLS 1.2 enforcement
  - Optional certificate pinning for Google APIs

### M-4: Biometric — Non-Cryptographic Binding

- **File:** `android/.../modules/biometric/BiometricModule.kt`
- **Issue:** Biometric is verified separately from key operations — no `CryptoObject` binding.
- **Risk:** No cryptographic guarantee that the biometrically-authenticated user is the one decrypting the vault.
- **Recommendation:** Bind biometric prompt to a `CryptoObject` wrapping the vault master key (4-6 hours effort).

---

## Positive Findings (25+)

### Cryptography
- AES-256-GCM encryption with automatic IV generation via Google Tink 1.12.0
- Argon2id key derivation with 64 MB memory cost (3.4x OWASP minimum)
- Constant-time PIN verification (`MessageDigest.isEqual`)
- Android Keystore for master key protection (hardware-backed TEE)
- Streaming AEAD for large files
- Cryptographically secure random (`java.security.SecureRandom`)

### Authentication
- PIN hashes encrypted before MMKV storage
- Comprehensive brute-force protection (exponential delays, progressive lockouts)
- Dual PIN system (real + decoy) with proper separation
- Session auto-lock with activity tracking

### Data at Rest
- Database encryption for note content (AES-256-GCM)
- Media file encryption during import
- Android backup disabled (`allowBackup="false"`)

### Native Module Security
- Thread-safe promise resolution (`AtomicBoolean`, `AtomicLong`)
- Main-thread promise execution (`withContext(Dispatchers.Main)`)
- Defensive permission re-checks before camera capture
- Proper coroutine scope management with `SupervisorJob`

### Input Validation
- SQL injection prevention (all parameterized queries via expo-sqlite)
- User input sanitization (`sanitizeUserInput` strips control characters)
- No code injection vectors (`eval`, `dangerouslySetInnerHTML` not found)

### Android Platform
- Minimal required permissions (INTERNET, VIBRATE, CAMERA, READ_MEDIA_*)
- `FLAG_SECURE` prevents screenshots/screen recording of vault
- Proper component export configuration in AndroidManifest
- FileProvider restricted to `share_temp` directory only

### Temporary File Cleanup
- Unhide service cleanup in `finally` block
- Import original file safe deletion
- File deletion abstracted to native module

### Biometric
- `BIOMETRIC_STRONG` authenticators only
- Graceful degradation on unavailable hardware

### Decoy Mode
- Proper database separation via `is_decoy` flag
- Identical PIN strength for decoy vault

### Intruder Detection
- Silent camera capture with immediate AES-256-GCM encryption
- Defensive permission handling (triple-check pattern)
- Encrypted storage — no plaintext intruder photos persist

### Dependencies
- Google Tink 1.12.0 (cryptography) — actively maintained
- Bouncy Castle 1.77 (Argon2id) — industry standard
- React Native 0.83.1 (stable release)
- No analytics, tracking, or ad SDKs present

---

## Implementation Priorities

### Priority 1 — Implement Immediately
1. **Add path validation in CryptoModule.kt** (M-2) — 1-2 hours
2. **Clear PIN CharArray on native side** (H-1) — 30 minutes

### Priority 2 — Implement Soon
3. **Create network_security_config.xml** (M-3) — 1-2 hours
4. **Verify thumbnail cache cleanup on all logout paths** (M-1) — 30 minutes

### Priority 3 — Defense-in-Depth
5. **Bind biometric to CryptoObject** (M-4) — 4-6 hours
6. **Implement secure file deletion** (M-1 enhancement) — 2-3 hours

---

## Conclusion

**Overall Security Rating: STRONG**

The vault is well-engineered and suitable for protecting sensitive personal data. All critical architectural decisions (encryption algorithm, key derivation, key storage) are sound. With the 4 medium-priority improvements implemented, the rating would be **EXCELLENT**.

**Risk Assessment:** LOW-TO-MEDIUM with recommendations implemented.
