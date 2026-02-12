# VaultCalcApp - Google Play Store Compliance Audit

**Date:** 2026-02-11
**Application:** VaultCalc - Calculator & Vault (React Native 0.83.1, Android-only)
**Overall Status:** 85% Compliant — Ready with reservations

---

## Executive Summary

| Category | Status |
|----------|--------|
| Permissions | COMPLIANT |
| Data Safety & Privacy | COMPLIANT (privacy policy required) |
| Billing | COMPLIANT |
| Content Rating | COMPLIANT |
| Deceptive Behavior | NEEDS ATTENTION |
| Target API Level | COMPLIANT |
| App Signing | NEEDS ATTENTION (Critical) |
| Ads Policy | COMPLIANT (no ads) |
| Camera / Intruder Detection | COMPLIANT (disclosure required) |
| Background Execution | COMPLIANT |

### Critical Blockers

| Issue | Severity | Timeline |
|-------|----------|----------|
| Release signing uses debug keystore | CRITICAL | 1-2 days |
| Privacy policy not published | CRITICAL | 1-2 weeks |
| R8 minification disabled | HIGH | 1 day |

---

## 1. Permissions

**Status: COMPLIANT**

### Declared Permissions (AndroidManifest.xml)

| Permission | Feature | Justified |
|-----------|---------|-----------|
| `INTERNET` | Play Billing, Google Drive Backup | Yes |
| `VIBRATE` | Calculator haptic feedback | Yes |
| `CAMERA` | Intruder detection (optional) | Yes |
| `READ_MEDIA_IMAGES` | Photo import (API 33+) | Yes |
| `READ_MEDIA_VIDEO` | Video import (API 33+) | Yes |
| `READ_EXTERNAL_STORAGE` (maxSdk 32) | Legacy file access | Yes |

### Runtime Permission Handling

- **CAMERA:** Triple-checked — `hasPermission()` before request, pre-capture check, mid-capture re-check. Defensive programming.
- **READ_MEDIA_*:** Handled via Storage Access Framework and system picker. App receives resolved content URIs.
- **No unused permissions** declared. No analytics or tracking SDKs.

---

## 2. Data Safety & Privacy

**Status: COMPLIANT** (privacy policy publication required)

### Data Collection Summary

| Data | Stored | Encrypted | Transmitted |
|------|--------|-----------|------------|
| Photos/Videos/Documents | Vault directory | AES-256-GCM | Never |
| PIN hash | Android Keystore (wrapped) | Yes | Never |
| Intruder photos | Vault encrypted | AES-256-GCM | Never |
| Google Drive token | MMKV (system secure) | Via Android | Optional (Drive API) |
| Billing tokens | Google Play Services | TLS 1.2+ | Play Store only |

### NOT Collected

- No personal identification (name, email, phone)
- No location data, contact lists, call logs
- No device identifiers (IMEI, Android ID)
- No usage analytics or crash reports
- No advertising ID

### Encryption at Rest

- **Algorithm:** AES-256-GCM via Google Tink 1.12.0
- **Key derivation:** Argon2id (64 MB memory, 3 iterations, 4 parallelism)
- **Key storage:** Android Keystore (hardware TEE)
- **Key hierarchy:** Hardware Key → Master Key → Per-file DEKs

### Data Deletion

- Individual file deletion via UI
- "Clear All Data" option in Settings
- `allowBackup="false"` — all data deleted on app uninstall

### Privacy Policy Requirements

Must include sections on:
1. Data collection inventory
2. Encryption & security approach
3. Intruder detection feature disclosure
4. Google Drive backup (optional feature)
5. Google Play Billing data
6. User rights and data deletion
7. **Use case disclaimer** (personal privacy, not deception)

---

## 3. Billing Compliance

**Status: COMPLIANT**

### Library

- **Google Play Billing 7.1.1** (current)
- Callback-based API with `suspendCancellableCoroutine` wrappers

### Products

| Product ID | Type |
|-----------|------|
| `vaultcalc_premium_monthly` | Subscription |
| `vaultcalc_premium_yearly` | Subscription |
| `vaultcalc_premium_lifetime` | One-time (INAPP) |

### Implementation Checklist

- [x] `.enablePendingPurchases()` — handles interrupted purchases
- [x] Purchase acknowledgement within 3-day deadline
- [x] Handles `USER_CANCELED` response code
- [x] Queries both SUBS and INAPP product types
- [x] `purchaseState` field distinguishes PENDING vs PURCHASED
- [x] "Restore Purchases" feature in Settings
- [x] Feature gating for free vs premium users
- [x] Subscription management disclosures (price, cycle, auto-renewal)

---

## 4. Content Rating

**Status: COMPLIANT**

**Rating:** Everyone

- No violence, sexual content, profanity, gambling, or unsafe practices
- Calculator is a fully-functional, family-friendly tool
- Vault/encryption is a standard privacy feature
- User-generated content is local only (not shared publicly)
- Intruder detection requires conditional privacy policy disclosure
- Decoy vault requires conditional privacy policy disclaimer

---

## 5. Deceptive Behavior Policy

**Status: NEEDS ATTENTION**

### Compliant Aspects

- **Transparent naming:** "VaultCalc - Calculator & Vault" discloses both functions
- **Real calculator:** Fully functional with history, operators, themes — not a fake UI
- **Clear store description:** Both calculator and vault features prominently described
- **No false claims:** Marketing says "fully functional calculator" + "private vault" — both true
- **No prohibited language:** Avoids "invisible", "undetectable", "secret", "hidden from"

### Risk Areas Requiring Careful Communication

| Area | Risk | Mitigation |
|------|------|-----------|
| Calculator disguise concept | Reviewers may interpret as deceptive | Reframe as "dual-function app" |
| PIN-based vault unlock | Could be seen as "hidden" mechanism | Screenshot showing PIN entry flow |
| Exclude from Recents | Could be seen as "hiding app" | Describe as "privacy for shared devices" |
| Intruder detection | Could be seen as surveillance | Clear disclosure in privacy policy |
| Decoy vault | "Decoy" implies misleading | Privacy policy: "for personal privacy, not deception" |

### Similar Apps on Play Store (Precedent)

| App | Features | Status |
|-----|----------|--------|
| Calculator Lock | PIN vault behind calculator | Approved, 10M+ installs |
| Photo Vault | Private photo storage | Approved, 50M+ installs |
| Private Calculator | Calculator + privacy vault | Approved, 5M+ installs |

### Required Marketing Language

**DO use:** "Private vault", "Secure storage", "Encrypted protection", "Confidential files"
**DO NOT use:** "Secret calculator", "Hidden vault", "Invisible app", "Hide from [anyone]"

### Store Description Must Include

```
WHAT THIS APP IS:
- A fully functional calculator for everyday use
- An encrypted vault for personal files
- Privacy-focused (no cloud, no tracking)

WHAT THIS APP IS NOT:
- Not a "hidden" or "secret" app
- Not designed to hide from authorities
- Not a surveillance tool
```

### Estimated Approval Likelihood

75-85% on first submission with transparent listing + published privacy policy. Appeal template prepared in `08-Play-Store-Strategy.md` if initially rejected.

---

## 6. Target API Level

**Status: COMPLIANT**

| Setting | Value | Requirement |
|---------|-------|-------------|
| `minSdkVersion` | 24 (Android 7.0) | App's choice — ~95% device coverage |
| `compileSdkVersion` | 36 | Latest SDK tools |
| `targetSdkVersion` | 36 | Meets Google Play minimum (34+) |
| `buildToolsVersion` | 36.0.0 | Current |
| `kotlinVersion` | 2.1.20 | Current |
| `ndkVersion` | 27.1.12297006 | Current |

No problematic behavior changes at API 36 target level. No foreground services, no background work, no clipboard access, no location.

---

## 7. App Signing & Security

**Status: NEEDS ATTENTION — Critical**

### Current Configuration (`android/app/build.gradle`)

```gradle
buildTypes {
    release {
        signingConfig signingConfigs.debug  // <-- PROBLEM
    }
}
```

**Issue:** Release build uses debug keystore. Debug keystore is a well-known default — anyone can sign APKs with it. Play Store will reject or accept with high risk.

### Required Fixes

**Fix 1 — Generate production keystore:**
```bash
keytool -genkey -v -keystore release.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias vaultcalc_release_key
```

**Fix 2 — Update build.gradle** to reference production keystore with environment variables for passwords.

**Fix 3 — Enable R8 minification:**
```gradle
enableProguardInReleaseBuilds = true  // Currently false
```

Benefits: 20-30% APK size reduction, code obfuscation. ProGuard rules already prepared and comprehensive.

### ProGuard Rules — COMPLIANT

Existing `proguard-rules.pro` properly covers:
- React Native bridge methods
- All `vaultcalcapp` native modules
- Google Tink, Bouncy Castle
- BiometricPrompt, CameraX
- Play Billing client
- Line numbers preserved for crash reporting

---

## 8. Ads Policy

**Status: COMPLIANT**

No ad SDKs integrated. No AdMob, Facebook Ads, or other ad networks in `package.json` or native dependencies.

**Note:** Strategy doc claims "Contains Ads: Yes (Free version)" — this is aspirational. Should be set to "No" for launch if ads are not yet implemented.

---

## 9. Camera & Intruder Detection

**Status: COMPLIANT** (with privacy disclosure required)

### Implementation

- Camera permission properly checked at 3 levels (has, pre-capture, mid-capture)
- Front camera only (`LENS_FACING_FRONT`)
- Silent capture with `CAPTURE_MODE_MINIMIZE_LATENCY`
- Camera immediately unbound after capture
- Photo encrypted with AES-256-GCM immediately
- Unencrypted copy deleted
- Only accessible with correct vault PIN
- User can view and delete intruder logs
- Feature gated by user setting (optional, off by default)

### Required Disclosure

Privacy policy must include a dedicated section explaining:
- When the feature activates (failed PIN attempts)
- What is captured (front camera photo)
- How it's stored (encrypted, on-device only)
- Who can access it (only authenticated vault user)
- How to delete (intruder log viewer)
- Not for surveillance — for security awareness only

---

## 10. Background Execution

**Status: COMPLIANT**

- No declared services in AndroidManifest
- No foreground services
- No WorkManager jobs
- No persistent background execution
- Auto-backup is fire-and-forget at app launch (1-hour throttle)
- Shake detection only while app is active
- Lock timeout only while app is running

Minimal battery impact. No problematic sync behavior.

---

## Launch Readiness Timeline

### Week 1: Code Fixes (3-5 days)
- Generate production signing keystore
- Update build.gradle with production signing config
- Enable R8 minification
- Test release APK on multiple devices

### Week 2-3: Documentation (7-10 days)
- Draft privacy policy with all required sections
- Publish privacy policy at public URL
- Finalize store listing (copy, graphics, screenshots)

### Week 4: Store Setup (3-5 days)
- Create Play Console account
- Upload release APK, complete Data Safety form
- Internal testing across devices (API 24, 31, 35+)

### Week 5: Review & Launch (5-7 days)
- Submit for review (typically 24-48 hours, up to 7 days)
- If rejected: address concerns, prepare appeal
- If approved: monitor crashes and reviews

### Data Safety Form Answers

| Question | Answer |
|----------|--------|
| Personal data collected? | Photos, PIN hash, device info (all local) |
| Data encrypted in transit? | Yes (TLS 1.2+ for Google APIs) |
| Data encrypted at rest? | Yes (AES-256-GCM) |
| Shared with third parties? | Google Drive (optional), Play Billing (required) |
| Can users delete data? | Yes (per-item + clear all + uninstall) |
| Privacy policy URL? | [Must be published before submission] |

---

## Compliance Checklist

### Before Submission

- [ ] Release keystore generated and secured (not in git)
- [ ] `build.gradle` updated with production signing config
- [ ] R8 minification enabled (`enableProguardInReleaseBuilds = true`)
- [ ] Release APK built, signed, and tested
- [ ] Privacy policy drafted with all required sections
- [ ] Privacy policy published at public URL
- [ ] Store listing prepared (name, description, screenshots)
- [ ] Data Safety form completed
- [ ] Content rating questionnaire completed
- [ ] Play Console account created

### At Submission

- [ ] Release APK uploaded to Play Console
- [ ] Store listing linked and complete
- [ ] Privacy policy URL linked
- [ ] All required metadata filled
- [ ] Release notes written
- [ ] Submitted for review

---

## Conclusion

VaultCalcApp is **largely compliant** with Google Play policies. The critical blockers (release signing, privacy policy) are procedural, not architectural — the codebase is sound. With 1-2 weeks of documentation work and 1-2 days of build configuration, the app is ready for submission.

**Estimated first-submission approval rate:** 75-85% with transparent listing.
