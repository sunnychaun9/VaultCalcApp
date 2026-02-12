# VaultCalc Security Model Document
## Version 1.0

---

## 1. Security Philosophy

### 1.1 Core Principles

1. **Defense in Depth**: Multiple security layers, no single point of failure
2. **Honest Claims**: Only promise what we can deliver; no "unbreakable" marketing
3. **Secure by Default**: Security features enabled out of the box
4. **Minimal Attack Surface**: Collect only necessary data, expose minimal APIs
5. **Fail Secure**: On error, default to locked state

### 1.2 Threat Model Scope

**What We Protect Against:**
- Casual snooping (friends, family, colleagues)
- Opportunistic device theft
- Basic forensic examination
- App-level attacks from other apps
- Physical access to unlocked device (without vault PIN)

**What We Do NOT Protect Against:**
- Nation-state adversaries with unlimited resources
- Advanced forensic tools with physical device access
- Targeted attacks with malware already on device
- User coercion (rubber-hose cryptanalysis)
- Hardware-level attacks (cold boot, JTAG)

### 1.3 Security Guarantees

| Claim | Guarantee | Limitation |
|-------|-----------|------------|
| Encryption | AES-256-GCM for all stored files | Key security depends on PIN strength and device security |
| Key Derivation | Argon2id with 64MB memory cost | Brute-force resistance depends on PIN complexity |
| Key Storage | Android Keystore (hardware-backed when available) | TEE availability varies by device |
| PIN Attempts | Configurable lockout after failed attempts | Does not prevent offline attacks on extracted data |
| Biometrics | Android BiometricPrompt (BIOMETRIC_STRONG) | Subject to Android biometric vulnerabilities |

---

## 2. Authentication Architecture

### 2.1 PIN Authentication

```
User Input → Argon2id KDF → Derived Key → Decrypt Master Key → Access Granted
                ↓
           Salt (random, per-installation)
           Iterations: 3
           Memory: 64MB
           Parallelism: 4
           Output: 256-bit key
```

**PIN Requirements:**
- Minimum: 4 digits
- Maximum: 16 digits
- Recommended: 6+ digits

**Brute Force Resistance (6-digit PIN):**
- 1,000,000 possible combinations
- Argon2id cost: ~500ms per attempt
- Full enumeration: ~5.8 days (single thread)
- With lockout: Effectively infinite

### 2.2 Biometric Authentication

```
┌─────────────────────────────────────────────────────────────┐
│                    Biometric Flow                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Request → BiometricPrompt (BIOMETRIC_STRONG)          │
│        ↓                                                     │
│  Android verifies biometric                                  │
│        ↓                                                     │
│  Success → Keystore releases wrapped Master Key              │
│        ↓                                                     │
│  Master Key decrypts vault                                   │
│                                                              │
│  Note: Biometric is a convenience layer over PIN-based      │
│        key. User can always fall back to PIN.               │
└─────────────────────────────────────────────────────────────┘
```

**Biometric Security:**
- Uses `BiometricManager.Authenticators.BIOMETRIC_STRONG`
- Class 3 biometrics only (secure, not convenience-level)
- Biometric change invalidates stored keys
- PIN always required as fallback

### 2.3 Decoy PIN System

```
PIN Entry → Check against stored hashes
        ↓
   Primary PIN? → Decrypt real Master Key → Real Vault
        ↓
   Decoy PIN? → Decrypt decoy Master Key → Decoy Vault
        ↓
   Invalid? → Record attempt → Apply lockout policy
```

**Decoy Implementation:**
- Separate Master Key for decoy vault
- Separate encrypted storage area
- Identical UX - no visual differences
- Decoy media stored separately with own encryption keys

---

## 3. Encryption Architecture

### 3.1 Key Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     KEY HIERARCHY                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Level 0: Hardware Key (Android Keystore / TEE)             │
│     │                                                        │
│     ├── Used to wrap Level 1 keys                           │
│     │                                                        │
│  Level 1: Master Key (AES-256, per-vault)                   │
│     │                                                        │
│     ├── Derived from PIN via Argon2id                       │
│     ├── Stored encrypted in Keystore                        │
│     │                                                        │
│  Level 2: File Encryption Keys (DEKs)                       │
│     │                                                        │
│     ├── Unique per file (AES-256-GCM)                       │
│     ├── Wrapped by Master Key                               │
│     └── Stored in SQLite (wrapped form)                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 File Encryption Details

**Algorithm:** AES-256-GCM (Galois/Counter Mode)

**Properties:**
- Authenticated encryption (confidentiality + integrity)
- 256-bit key size
- 96-bit nonce (random per encryption)
- 128-bit authentication tag

**File Format:**
```
┌────────────────────────────────────────────┐
│  Encrypted File Structure                   │
├────────────────────────────────────────────┤
│  Header (16 bytes)                         │
│    - Magic: "VCLT" (4 bytes)               │
│    - Version: 1 (2 bytes)                  │
│    - Reserved (10 bytes)                   │
├────────────────────────────────────────────┤
│  Nonce (12 bytes)                          │
├────────────────────────────────────────────┤
│  Ciphertext (variable)                     │
├────────────────────────────────────────────┤
│  Auth Tag (16 bytes)                       │
└────────────────────────────────────────────┘
```

### 3.3 Key Generation

```kotlin
// Using Google Tink
fun generateFileKey(): KeysetHandle {
    return KeysetHandle.generateNew(AeadKeyTemplates.AES256_GCM)
}
```

**Per-File Keys Rationale:**
- Limits exposure if single key compromised
- Enables secure file deletion (destroy key)
- Allows individual file sharing without master key exposure
- No key reuse across files

### 3.4 Thumbnail Encryption

Thumbnails are encrypted with the same DEK as their parent file:
- Ensures thumbnail cannot reveal content without access to file key
- Single key deletion removes both file and thumbnail
- Slightly less secure than separate keys, but simpler key management

---

## 4. Secure Storage

### 4.1 Storage Layout

```
/data/data/com.vaultcalc/
├── files/
│   ├── vault/                    # Encrypted media files
│   │   ├── photos/
│   │   │   ├── {uuid}.vclt       # Encrypted photo
│   │   │   └── ...
│   │   ├── videos/
│   │   │   └── ...
│   │   └── documents/
│   │       └── ...
│   ├── thumbs/                   # Encrypted thumbnails
│   │   └── {uuid}.vclt
│   └── temp/                     # Temporary decrypted files
│       └── (cleared on lock)
├── databases/
│   └── vaultcalc.db              # Metadata (not encrypted at rest)
└── shared_prefs/
    └── vaultcalc_prefs.xml       # Encrypted with EncryptedSharedPreferences
```

### 4.2 Database Security

**Metadata Database:**
- Contains file metadata, not content
- Stored in app's private directory (Android sandbox)
- Not additionally encrypted (Android provides app sandboxing)

**Sensitive Fields:**
- Original filenames (could reveal content)
- File paths (reveals vault structure)
- Import timestamps (could reveal usage patterns)

**Mitigation:**
- Future: SQLCipher for database encryption
- Current: Rely on Android sandboxing + full-disk encryption

### 4.3 Temporary Files

**Decrypted Cache:**
- Created when viewing files
- Stored in private temp directory
- Cleared immediately on:
  - App lock (timeout or manual)
  - App background (configurable)
  - App termination

```kotlin
// Secure temp file deletion
fun secureDelete(path: String) {
    val file = File(path)
    if (file.exists()) {
        // Overwrite with random data
        RandomAccessFile(file, "rw").use { raf ->
            val length = raf.length()
            raf.seek(0)
            val buffer = ByteArray(4096)
            SecureRandom().nextBytes(buffer)
            var written = 0L
            while (written < length) {
                val toWrite = minOf(buffer.size.toLong(), length - written).toInt()
                raf.write(buffer, 0, toWrite)
                written += toWrite
            }
        }
        // Then delete
        file.delete()
    }
}
```

---

## 5. Access Control

### 5.1 Authentication States

```
┌─────────────────────────────────────────────────────────────┐
│                  AUTHENTICATION STATE MACHINE                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   LOCKED ──(correct PIN)──→ UNLOCKED                        │
│     │                           │                            │
│     │                           │                            │
│   (decoy PIN)              (timeout/lock)                   │
│     │                           │                            │
│     ▼                           ▼                            │
│   DECOY_UNLOCKED ─────────→ LOCKED                          │
│                                                              │
│   States:                                                    │
│   - LOCKED: Only calculator visible                         │
│   - UNLOCKED: Real vault accessible                         │
│   - DECOY_UNLOCKED: Decoy vault accessible                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Session Management

**Auto-Lock Triggers:**
- Configurable timeout (30s - 5min, default: 1min)
- App backgrounded (configurable)
- Screen off
- User-initiated lock

**Session Data Cleared on Lock:**
- Decrypted file cache
- Thumbnail memory cache
- Navigation state (returns to calculator)
- Clipboard (if contained vault data)

### 5.3 Failed Attempt Handling

```
Attempt 1-4:   Normal feedback ("Incorrect PIN")
Attempt 5:     Warning ("1 attempt remaining")
Attempt 6+:    Lockout starts
    │
    ├── Default: 30 second lockout
    ├── After 10 fails: 5 minute lockout
    ├── After 15 fails: 30 minute lockout
    │
    └── Optional: Intruder photo captured
```

**Intruder Detection:**
- Front camera captures on failed attempt (if enabled)
- Photo encrypted and stored in secure log
- Timestamp and failed PIN hash recorded
- Only accessible from settings (authenticated)

---

## 6. Threat Analysis

### 6.1 Attack Vectors and Mitigations

| Attack Vector | Risk | Mitigation |
|---------------|------|------------|
| PIN brute force | Medium | Argon2id + lockout policy |
| Shoulder surfing | Medium | PIN masking, quick entry |
| Device theft (locked) | Low | Full encryption at rest |
| Device theft (unlocked) | High | Auto-lock timeout |
| Malicious app | Low | Android sandboxing |
| ADB extraction | Medium | USB debugging detection (future) |
| Memory dump | High | Clear sensitive data promptly |
| Forensic imaging | High | Per-file encryption limits exposure |
| Social engineering | High | User education, decoy vault |

### 6.2 Known Limitations

1. **Metadata Exposure**
   - File existence is visible in database
   - File sizes and timestamps recorded
   - Mitigation: Future SQLCipher integration

2. **Memory Residue**
   - Decrypted data exists briefly in memory
   - Java/Kotlin memory not securely wiped
   - Mitigation: Minimize decryption window

3. **Side Channels**
   - Timing attacks on PIN entry possible
   - Storage access patterns observable
   - Mitigation: Constant-time comparisons (partial)

4. **Android Keystore Variability**
   - Not all devices have hardware-backed TEE
   - Software Keystore less secure
   - Mitigation: Detect and warn users

### 6.3 Security Assumptions

We assume:
1. Android OS is not compromised
2. Device bootloader is locked
3. User keeps device physically secure
4. User chooses reasonably strong PIN
5. User doesn't share PIN
6. Device has reasonably recent security patches

---

## 7. Cryptographic Implementation

### 7.1 Library Choice: Google Tink

**Why Tink:**
- Developed by Google's security team
- Misuse-resistant API design
- Regularly audited and updated
- Android Keystore integration built-in
- Used by Google products

**Alternatives Considered:**
- Bouncy Castle: Lower-level, easier to misuse
- libsodium: Good but requires JNI
- javax.crypto: Prone to implementation errors

### 7.2 Argon2id Configuration

```kotlin
object Argon2Config {
    const val ITERATIONS = 3         // Time cost
    const val MEMORY_KB = 65536      // 64MB memory cost
    const val PARALLELISM = 4        // 4 threads
    const val OUTPUT_LENGTH = 32     // 256-bit output
    const val SALT_LENGTH = 16       // 128-bit salt
}
```

**Rationale:**
- Memory cost (64MB) prevents GPU attacks
- 3 iterations balances security and UX
- ~500ms on mid-range device
- OWASP recommended minimum

### 7.3 Random Number Generation

```kotlin
// Always use SecureRandom for cryptographic purposes
val secureRandom = SecureRandom.getInstanceStrong()

// Generate nonce
fun generateNonce(): ByteArray {
    val nonce = ByteArray(12) // 96 bits for GCM
    secureRandom.nextBytes(nonce)
    return nonce
}

// Generate salt
fun generateSalt(): ByteArray {
    val salt = ByteArray(16) // 128 bits
    secureRandom.nextBytes(salt)
    return salt
}
```

---

## 8. Security Testing

### 8.1 Test Categories

**Unit Tests:**
- Key derivation consistency
- Encryption/decryption round-trip
- Nonce uniqueness
- Error handling

**Integration Tests:**
- Full import/view/export cycle
- Vault lock/unlock cycle
- Multi-vault isolation
- Key rotation

**Security Tests:**
- PIN brute force lockout
- Invalid key handling
- Corrupted file detection
- Memory clearing verification

### 8.2 Test Cases

```typescript
describe('Security Tests', () => {
  describe('PIN Brute Force Protection', () => {
    it('should lock after 6 failed attempts', async () => {
      for (let i = 0; i < 6; i++) {
        await auth.attemptLogin('wrong');
      }
      expect(auth.isLockedOut()).toBe(true);
    });

    it('should increase lockout duration progressively', async () => {
      // 6 fails = 30s, 10 fails = 5min, 15 fails = 30min
      for (let i = 0; i < 10; i++) {
        await auth.attemptLogin('wrong');
      }
      expect(auth.getLockoutDuration()).toBeGreaterThan(30);
    });
  });

  describe('Encryption Integrity', () => {
    it('should detect tampered ciphertext', async () => {
      const path = await encryptTestFile();
      await tamperFile(path);
      await expect(decryptFile(path)).rejects.toThrow('AUTHENTICATION_FAILED');
    });

    it('should reject wrong key', async () => {
      const path = await encryptTestFile(key1);
      await expect(decryptFile(path, key2)).rejects.toThrow();
    });
  });
});
```

### 8.3 Penetration Testing Checklist

- [ ] Static analysis with MobSF
- [ ] Dynamic analysis with Frida
- [ ] Network traffic analysis
- [ ] Binary analysis (APK decompilation)
- [ ] Data extraction from rooted device
- [ ] Memory analysis during runtime
- [ ] PIN entry timing analysis
- [ ] Biometric bypass attempts
- [ ] Database content review
- [ ] Log file analysis

---

## 9. Compliance

### 9.1 OWASP MASVS Alignment

**MASVS-L1 (Standard Security):**
| Requirement | Status |
|-------------|--------|
| MSTG-STORAGE-1: Secure credential storage | ✓ Keystore |
| MSTG-STORAGE-2: No sensitive data in logs | ✓ No logging |
| MSTG-CRYPTO-1: No hardcoded keys | ✓ Generated per-install |
| MSTG-CRYPTO-2: Proven crypto algorithms | ✓ Tink/AES-256-GCM |
| MSTG-AUTH-1: Biometric as secondary | ✓ PIN primary |

**MASVS-L2 (Defense in Depth):**
| Requirement | Status |
|-------------|--------|
| MSTG-RESILIENCE-1: Root detection | Planned v1.5 |
| MSTG-RESILIENCE-2: Anti-debugging | Planned v1.5 |
| MSTG-RESILIENCE-3: Tamper detection | Planned v2.0 |

### 9.2 GDPR Considerations

- No personal data leaves device
- No analytics that identify users
- No cloud storage (v1.0)
- Data deletion: Uninstall removes all data

---

## 10. Security Roadmap

### Phase 1 (v1.0)
- [x] AES-256-GCM encryption
- [x] Argon2id key derivation
- [x] Android Keystore integration
- [x] Biometric authentication
- [x] Decoy vault
- [x] Basic intruder detection

### Phase 2 (v1.5)
- [ ] Root/emulator detection
- [ ] USB debugging detection
- [ ] Screen capture prevention
- [ ] Clipboard auto-clear
- [ ] Panic button (quick lock)

### Phase 3 (v2.0)
- [ ] SQLCipher for database
- [ ] Code obfuscation (R8/ProGuard)
- [ ] Certificate pinning (for cloud features)
- [ ] Tamper detection
- [ ] Security audit by third party

### Phase 4 (v2.5)
- [ ] Hardware security key support
- [ ] Duress PIN (triggers wipe)
- [ ] Steganographic storage option
- [ ] Secure enclave utilization (where available)

---

## 11. Incident Response

### 11.1 If Vulnerability Discovered

1. **Assessment**: Determine severity and exploitability
2. **Containment**: Identify if actively exploited
3. **Fix Development**: Priority based on severity
4. **Release**: Expedited update process
5. **Disclosure**: Responsible disclosure after fix

### 11.2 Security Contact

Users can report security issues via:
- Email: security@vaultcalc.app (future)
- GitHub: Security advisory (private)

### 11.3 Update Policy

- Critical vulnerabilities: Patch within 72 hours
- High severity: Patch within 1 week
- Medium/Low: Next scheduled release

---

## 12. Security User Education

### In-App Guidance

**PIN Setup:**
> "Choose a PIN you can remember but others can't guess. Avoid birthdays, repeated digits (1111), or sequential numbers (1234)."

**Biometric Setup:**
> "Fingerprint unlock is convenient but can be compelled. Your PIN is always available as backup and provides the strongest protection."

**Decoy Vault:**
> "Your decoy vault appears identical to your real vault. Store some believable content here for situations where you need to show something."

---

*Document Version: 1.0*
*Last Updated: 2024*
*Security Contact: security@vaultcalc.app*
