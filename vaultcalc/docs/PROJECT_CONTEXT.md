# VaultCalc - Project Context
## Single Source of Truth for All Development Sessions

---

## 1. Product Vision

**One-Line Vision:** A fully functional calculator that secretly protects your most private files.

**Core Identity:**
- Calculator FIRST, vault SECOND
- Privacy through obscurity + cryptographic security
- Premium quality, not "spy app" aesthetic
- Long-term trust over quick engagement

**Target Users:**
- Privacy-conscious individuals (primary)
- People in sensitive personal situations
- Professionals with confidential content
- Anyone who values digital privacy

---

## 2. Non-Negotiables

These principles are LOCKED and must never be compromised:

| Principle | Meaning | Why It Matters |
|-----------|---------|----------------|
| Calculator Authenticity | Must function as a real, usable calculator | Detection = app failure |
| Zero Trace | No visual indicator of vault existence | Plausible deniability |
| One-Hand Use | All primary actions reachable with thumb | Mobile-first UX |
| No Dark Patterns | No guilt, manipulation, or fake urgency | Long-term trust |
| Honest Security | Only claim what we can deliver | Legal safety, user trust |
| Play Store Safe | Language and behavior must pass review | Distribution requirement |

---

## 3. Locked PRD Summary

### Core Features (MVP - Phase 1)

| Feature | Description | Priority |
|---------|-------------|----------|
| Real Calculator | Full arithmetic operations, history, memory | P0 |
| PIN-Based Vault Access | Type PIN + "=" to unlock | P0 |
| Photo Storage | Import, view, encrypt photos | P0 |
| AES-256 Encryption | Per-file encryption with Tink | P0 |
| Biometric Unlock | Fingerprint as convenience layer | P1 |
| Auto-Lock | Timeout-based vault locking | P0 |
| Basic Settings | PIN change, lock timeout, theme | P1 |

### Phase 2 Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Video Support | Import, play encrypted videos | P1 |
| Document Storage | PDF, text file support | P1 |
| Decoy Vault | Secondary PIN → fake vault | P1 |
| Albums | Organize media into folders | P2 |
| Intruder Detection | Photo on failed attempts | P2 |

### Phase 3 Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Cloud Backup | Encrypted backup to Google Drive | P2 |
| Secure Notes | Encrypted text notes | P2 |
| Break-In Alerts | Notification on suspicious activity | P2 |
| Widget | Calculator widget for home screen | P3 |

### Explicitly OUT OF SCOPE

- Password manager functionality
- Secure browser
- VPN features
- Call/SMS hiding
- App locking for other apps
- Social features of any kind

---

## 4. UX Principles

### Calculator UX
- Standard calculator layout (no custom designs)
- Haptic feedback on button press
- Display shows calculation history
- Scientific mode toggle (settings)
- No visual hint of vault functionality

### Vault Access UX
- PIN entry through calculator keypad
- "=" triggers authentication
- Instant transition (no loading screen visible)
- Wrong PIN = silent failure (shows "0")
- Correct PIN = fade to vault

### Vault UX
- Tab-based navigation (Photos / Videos / Docs)
- Grid view default, list view optional
- Bottom FAB for import
- Swipe gestures for actions
- Pull-to-refresh disabled (not needed)

### General UX
- Maximum 3 taps to any feature
- No tutorials that block usage
- Settings organized by category
- Confirmation for destructive actions only

---

## 5. Security Philosophy

### What We Guarantee
- AES-256-GCM encryption for all stored files
- Argon2id key derivation (64MB memory cost)
- Android Keystore for key protection
- Per-file encryption keys
- Secure deletion of temp files

### What We DON'T Guarantee
- Protection against nation-state actors
- Protection against physical device compromise
- Protection against pre-installed malware
- Resistance to sophisticated forensics
- "Unbreakable" or "military-grade" security

### Security Implementation Rules
1. Use Google Tink library exclusively for crypto
2. Never implement custom cryptographic algorithms
3. Never log sensitive data (PINs, keys, file contents)
4. Always clear decrypted files on lock
5. Use constant-time comparisons for PIN verification
6. Generate unique salt per installation
7. Generate unique key per file

---

## 6. Performance Constraints

| Metric | Target | Maximum Acceptable |
|--------|--------|-------------------|
| Cold Start | < 800ms | 1200ms |
| Vault Unlock | < 300ms | 500ms |
| Thumbnail Load | < 50ms each | 100ms |
| File Import (10MB) | < 3s | 5s |
| Memory (Idle) | < 120MB | 150MB |
| Memory (Active) | < 200MB | 250MB |
| APK Size | < 15MB | 20MB |

### Performance Rules
1. Use FlashList for all scrollable lists
2. Lazy load thumbnails with caching
3. Encrypt/decrypt in background threads
4. Never block UI thread for crypto operations
5. Limit decrypted cache to 10 files
6. Clear cache aggressively on memory pressure

---

## 7. Play Store Compliance Rules

### Forbidden Language (in app, listing, metadata)
- "Hidden" / "Hide"
- "Secret" / "Secretly"
- "Spy" / "Spying"
- "Stealth"
- "Invisible"
- "Undetectable"
- "Military-grade"
- "Unbreakable"
- "NSA-proof"

### Approved Language
- "Private" / "Privacy"
- "Secure" / "Security"
- "Protected" / "Protection"
- "Personal" / "Personal space"
- "Encrypted" / "Encryption"
- "Vault" / "Safe"

### Compliance Requirements
1. App must have legitimate primary function (calculator)
2. No deceptive practices or misleading claims
3. Must request only necessary permissions
4. Must have clear privacy policy
5. No incentivized reviews
6. No fake engagement metrics

### Permissions Required
- `READ_EXTERNAL_STORAGE` (import files)
- `WRITE_EXTERNAL_STORAGE` (Android < 10)
- `CAMERA` (intruder detection, optional)
- `USE_BIOMETRIC` (fingerprint auth)
- `VIBRATE` (haptic feedback)

---

## 8. Things We Must NEVER Do

### Security Never-Do
- [ ] Store PIN in plain text
- [ ] Log encryption keys or PINs
- [ ] Use deprecated crypto (MD5, SHA1, DES)
- [ ] Implement custom crypto algorithms
- [ ] Trust client-side validation alone
- [ ] Store decrypted files permanently
- [ ] Disable security for "convenience"

### UX Never-Do
- [ ] Add splash screens or loading delays
- [ ] Show vault-related notifications
- [ ] Add "rate us" popups on every launch
- [ ] Use dark patterns for upgrades
- [ ] Make export/delete difficult
- [ ] Send "we miss you" notifications
- [ ] Add gamification (streaks, badges)

### Code Never-Do
- [ ] Commit API keys or secrets
- [ ] Use `any` type in TypeScript
- [ ] Ignore TypeScript errors
- [ ] Skip error handling
- [ ] Use synchronous crypto on main thread
- [ ] Add unused dependencies
- [ ] Write code without tests for crypto

### Business Never-Do
- [ ] Sell or share user data
- [ ] Add analytics that identify users
- [ ] Require account creation
- [ ] Make free tier unusable
- [ ] Use deceptive pricing
- [ ] Hide cancellation options

---

## 9. Technical Stack (Locked)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | React Native CLI 0.73+ | Full native access |
| Language | TypeScript 5.x | Type safety |
| Native Code | Kotlin | Modern Android |
| State | Zustand + React Query | Lightweight |
| Navigation | React Navigation 6 | Standard |
| Storage (KV) | MMKV | Fast |
| Storage (SQL) | expo-sqlite | Structured |
| Crypto | Google Tink | Audited |
| Biometrics | BiometricPrompt | Standard |
| UI List | FlashList | Performance |

---

## 10. File Structure Reference

```
vaultcalc/
├── docs/                    # Project documentation (THIS)
│   ├── PROJECT_CONTEXT.md
│   ├── DEVELOPMENT_PLAYBOOK.md
│   ├── AI_INSTRUCTIONS.md
│   ├── FEATURE_INDEX.md
│   └── CHANGE_LOG.md
├── 01-PRD.md               # Product Requirements
├── 02-UX-Design.md         # UX Specifications
├── 03-Design-System.md     # Visual Design System
├── 04-Technical-Architecture.md
├── 05-Security-Model.md
├── 06-Retention-System.md
├── 07-Monetization-Model.md
├── 08-Play-Store-Strategy.md
└── 09-Development-Roadmap.md
```

---

## 11. Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    VAULTCALC AT A GLANCE                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WHAT: Calculator app with encrypted private vault          │
│  WHO: Privacy-conscious Android users                       │
│  HOW: PIN entry via calculator → vault access               │
│                                                              │
│  TECH: React Native + Kotlin + Tink                         │
│  CRYPTO: AES-256-GCM + Argon2id + Android Keystore          │
│                                                              │
│  MUST: Real calculator, zero trace, honest security         │
│  NEVER: Dark patterns, spy language, custom crypto          │
│                                                              │
│  MVP: Calculator + Photos + PIN + Encryption                 │
│  PHASE 2: Videos + Docs + Decoy + Biometric                 │
│  PHASE 3: Cloud backup + Notes + Widgets                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

*Document Version: 1.0*
*Status: LOCKED - Changes require explicit approval*
*Last Updated: 2024*
