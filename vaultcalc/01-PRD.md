# VaultCalc — Product Requirements Document (Final)

**Version:** 1.1 (Sanitized)
**Classification:** Internal Strategy Document
**Platform:** Android (API 26+)
**Stack:** React Native + Native Modules (Encryption, Biometrics)

---

## 1. Product Vision & Positioning

### Vision Statement
VaultCalc is a fully functional scientific calculator with integrated private encrypted storage for sensitive files — designed for users who value privacy and organization.

### Strategic Positioning
**Category:** Utilities → Calculator
**Secondary Value:** Privacy & Security

**Positioning Matrix:**

| Competitor Weakness | VaultCalc Response |
|---------------------|-------------------|
| Calculator is afterthought | Genuine calculator-first design |
| Laggy, dated UI | Optimized performance, Material You |
| Excessive permissions | Minimal, justified permissions |
| Cloud-dependent | Offline-first, local encryption |
| Aggressive paywalls | Value delivered before any paywall |

**One-liner:** "A premium calculator with built-in encrypted storage for your private files."

---

## 2. Target Users & Psychology

### Primary Persona: "The Privacy-Conscious Professional"
- **Demographics:** 25-45, professional, manages sensitive documents
- **Behavior:** Already uses notes apps, cloud storage; privacy-aware
- **Trigger:** Needs secure storage for financial docs, personal photos, work files
- **Core Need:** Control over personal data
- **Desire:** Peace of mind with simple organization

### Secondary Persona: "The Organized Minimalist"
- **Demographics:** 18-30, digital-native, values clean phone organization
- **Behavior:** Curates apps carefully, prefers multi-function tools
- **Trigger:** Wants fewer apps with more utility
- **Core Need:** Efficiency and simplicity
- **Desire:** One well-designed app that serves multiple purposes

### Design Principles

1. **User Control** — Users decide what to store and how to access it
2. **Low Cognitive Load** — Vault access should feel natural and fast
3. **Transparency** — Explain security features in plain language
4. **Respectful Design** — Neutral language; no judgment about stored content

---

## 3. Core Value Proposition

### The Promise
> "A premium calculator with strong encryption to keep your private files organized and secure."

### Value Hierarchy

```
┌─────────────────────────────────────────┐
│  TRUST                                  │  ← Foundation
│  "This app respects my privacy"         │
├─────────────────────────────────────────┤
│  PERFORMANCE                            │  ← Daily Experience
│  "Fast and responsive"                  │
├─────────────────────────────────────────┤
│  PRIVACY                                │  ← Core Utility
│  "My files are encrypted locally"       │
├─────────────────────────────────────────┤
│  SIMPLICITY                             │  ← Delight
│  "Easy to use from day one"             │
└─────────────────────────────────────────┘
```

---

## 4. Non-Negotiable Product Principles

### Principle 1: Calculator-First Design
- The calculator must be genuinely useful and well-designed
- App icon, name, and Play Store listing accurately describe functionality
- Both calculator and vault are prominent features

### Principle 2: Responsive Performance
- Calculator interactions feel immediate
- Vault operations complete without perceived lag
- App startup is fast relative to category benchmarks
- No loading spinners for core flows where avoidable

### Principle 3: Strong Encryption
- AES-256-GCM for file encryption
- Argon2id for PIN/password key derivation
- No server-side key storage
- No analytics on vault contents or access patterns
- Encryption keys bound to device secure storage (Android Keystore)

### Principle 4: Offline-First
- Full functionality without internet
- No account required for core features
- No cloud sync by default
- Works on mid-range devices (3GB+ RAM recommended)

### Principle 5: Ethical Monetization
- Free tier is functional and permanent
- Premium unlocks capacity and convenience, not security features
- No ads inside the vault
- No upsells during file operations

---

## 5. Functional Requirements

### 5.1 Calculator Module

#### Basic Calculator
- Standard operations: +, −, ×, ÷
- Percentage calculations
- Memory functions (M+, M−, MR, MC)
- History tape (last 50 calculations)
- Copy/paste support

#### Scientific Calculator (toggle or swipe)
- Trigonometric functions (sin, cos, tan, inverse)
- Logarithmic functions (log, ln)
- Exponential and power functions
- Constants (π, e)
- Parenthetical expressions
- Degree/radian toggle

#### Calculator UX
- Haptic feedback on keypress
- Large touch targets (min 48dp)
- Landscape mode with extended functions
- Dark/light theme (follows system)
- Material You dynamic color support (Android 12+)

### 5.2 Vault Access Mechanism

#### Primary Method: PIN Entry
- User sets a vault PIN (4-12 digits)
- Entering PIN followed by `=` opens vault
- Incorrect PIN shows calculator result (no error state)
- Configurable unlock gesture

#### Secondary Method (Phase 1)
- Biometric unlock (after initial PIN verification per session)

#### Additional Methods (Phase 2+)
- Pattern entry via calculator buttons
- Alternative PIN for separate vault profile

### 5.3 Vault Module

#### File Support
| Type | Supported Formats | Limits (Free) | Limits (Premium) |
|------|------------------|---------------|------------------|
| Images | JPG, PNG, WEBP, GIF | 100 files | Unlimited |
| Videos | MP4, WEBM | 10 files | Unlimited |
| Documents | PDF, TXT | 25 files | Unlimited |
| Audio | MP3, M4A | 25 files | Unlimited |

#### Import Methods (Phase 1)
- Share sheet integration ("Share to VaultCalc")
- In-app file picker
- Direct camera capture (photo/video)

#### Import Methods (Phase 2+)
- Batch import from folder
- Auto-import from designated folder (Premium)

#### Vault UX
- Grid/list view toggle
- Sort by date, name, size, type
- Folders for organization
- Search by filename
- Thumbnail previews (encrypted locally)
- Full-screen media viewer with gestures

#### Export & Sharing
- Export to device storage
- Share via system share sheet
- Batch export/delete

### 5.4 Security Module

#### Encryption Architecture
```
┌────────────────────────────────────────────────────┐
│                   USER PIN                         │
│                      │                             │
│                      ▼                             │
│            ┌─────────────────┐                     │
│            │   Argon2id KDF  │                     │
│            │  (salt stored)  │                     │
│            └────────┬────────┘                     │
│                     │                              │
│                     ▼                              │
│            ┌─────────────────┐                     │
│            │  Master Key     │                     │
│            │ (protected by   │                     │
│            │  Keystore)      │                     │
│            └────────┬────────┘                     │
│                     │                              │
│                     ▼                              │
│  ┌──────────────────────────────────────────────┐ │
│  │           Per-File Keys (DEK)                │ │
│  │     Unique AES-256-GCM key per file          │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

#### Brute-Force Protection
- Progressive delay after failed attempts: 1s → 2s → 5s → 30s
- No visible attempt counter

#### Data Protection
- Files encrypted at rest using AES-256-GCM
- Thumbnails encrypted separately
- Metadata (filenames, dates) encrypted
- Standard file deletion (secure overwrite available in Phase 2)

#### Recovery (Phase 2)
- Optional recovery phrase (12 words)
- Exportable recovery key
- No server-side recovery

---

## 6. Non-Functional Requirements

### 6.1 Performance Specifications (React Native Realistic)

| Metric | Target | Notes |
|--------|--------|-------|
| Cold start | <800ms | Time to interactive calculator |
| Vault unlock | <500ms | PIN entry to vault grid visible |
| Image encryption | <100ms/MB | Native module with hardware acceleration |
| Gallery scroll | 55+ fps | Using FlashList, optimized images |
| Memory baseline | <120MB | Typical React Native footprint |
| APK size | <25MB | Including native modules |

### 6.2 Security Standards
- OWASP MASVS Level 1 compliance (Level 2 target for Phase 2)
- Minimal runtime permissions (scoped storage)
- ProGuard/R8 obfuscation enabled
- Root detection with user warning (non-blocking)

### 6.3 Compatibility
- **Minimum SDK:** 26 (Android 8.0)
- **Target SDK:** Latest stable (34)
- **Architectures:** arm64-v8a, armeabi-v7a
- **Screen sizes:** Phone layouts (tablet Phase 2)
- **Accessibility:** TalkBack support, WCAG AA contrast

### 6.4 Reliability
- Encryption operations are atomic (no partial writes)
- Crash-free rate target: 99.5%+
- Background operations persist across app lifecycle
- Integrity checks on vault database

---

## 7. Retention Mechanics

### 7.1 Activation (Week 1)

**Day 1: First Import**
- Onboarding guides user to import first file
- Clear confirmation: "Your file is now encrypted"
- No account required

**Day 2-7: Habit Building**
- Calculator widget available
- Educational tips about encryption (non-intrusive)
- No upsells during this period

### 7.2 Engagement Loops

**The Organization Ritual**
```
Trigger → User receives/creates sensitive file
Action  → Share to VaultCalc
Reward  → Organized, encrypted storage
Investment → Growing file library
```

**The Calculator Habit**
- Home screen widget
- Quick settings tile (Phase 2)

### 7.3 Re-engagement

**Acceptable:**
- Optional widget showing "X files protected"
- Anniversary summary (in-app only)

**Never:**
- Push notifications about vault contents
- Notifications implying inactivity
- Any notification revealing vault existence to observers

### 7.4 Retention Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| D1 Retention | >45% | First import success |
| D7 Retention | >30% | Calculator habit formed |
| D30 Retention | >20% | Vault becomes routine |
| Premium conversion (D30) | >4% | Value proven before paywall |

---

## 8. Monetization Strategy

### 8.1 Free Tier (Permanent)

**Included:**
- Full calculator functionality
- Vault with capacity limits (100 images, 10 videos, 25 docs)
- AES-256-GCM encryption (identical to Premium)
- Biometric unlock
- Basic folder organization

### 8.2 Premium Tier

**Price:** $3.99/month or $24.99/year
**Alternative:** $39.99 lifetime (promotional periods)

**Unlocks:**
- Unlimited file storage
- Unlimited folders
- Additional vault profiles (Phase 2)
- Cloud backup with end-to-end encryption (Phase 3)
- Priority support
- No ads (free tier has non-intrusive calculator banner)

### 8.3 Conversion Flow

**Trigger:** User approaches capacity limit

**UX:**
```
User tries to exceed limit
      │
      ▼
Informational modal: "You've reached the free tier limit"
      │
      ├── "See Premium options" (primary)
      │
      ├── "Manage existing files" (secondary)
      │
      └── "Maybe later" (tertiary, always available)
```

**Principles:**
- Never lock existing files
- Never degrade security
- No countdown timers or false urgency

### 8.4 Revenue Model

| Users | Free (96%) | Premium (4%) | MRR |
|-------|------------|--------------|-----|
| 100K | 96K | 4K | $16K |
| 500K | 480K | 20K | $80K |
| 1M | 960K | 40K | $160K |

---

## 9. Play Store Policy Compliance

### 9.1 Policy Alignment

| Policy Area | Approach |
|-------------|----------|
| **Accurate representation** | App title and description clearly state both calculator and encrypted storage features |
| **User data** | End-to-end encryption explained; no content moderation capability disclosed |
| **Permissions** | Only scoped storage permission requested; justified in listing |
| **Ads** | AdMob compliant; no ads in vault interface |
| **Security claims** | Specific and accurate: "AES-256 encryption" not "unbreakable" |

### 9.2 Play Store Listing

**Title:** VaultCalc - Calculator & Encrypted Storage
**Short description:** Scientific calculator with private encrypted file storage
**Category:** Tools

**Listing Guidelines:**
- Lead with calculator features
- Describe encrypted storage as a privacy feature
- Use accurate security terminology
- Include screenshots of both calculator and vault interfaces

**Prohibited Language:**
- "Hidden," "Secret," "Invisible," "Spy"
- "Unbreakable," "Unhackable," "Military-grade"
- Any implication of evading authority or detection

### 9.3 Content Rating
**Target:** PEGI 3 / Everyone
**Basis:** No user-generated content sharing, no social features

### 9.4 Legal Compliance
- **GDPR/CCPA:** Minimal data collection; privacy policy details
- **Encryption disclosure:** App description notes encryption capability
- **Terms of Service:** Standard prohibited uses clause
- **Liability:** Clear disclaimer that security depends on user practices (PIN strength, device security)

---

## 10. Technical Architecture

### 10.1 Stack Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Calculator  │  │   Vault     │  │     Settings        │ │
│  │   Screen    │  │   Screen    │  │     Screen          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    State Management                         │
│              (Zustand + React Query)                        │
├─────────────────────────────────────────────────────────────┤
│                    Native Modules                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Crypto     │  │  Biometric  │  │     File I/O        │ │
│  │  Module     │  │  Module     │  │     Module          │ │
│  │  (Tink)     │  │ (BiometricX)│  │  (Scoped Storage)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  SQLite     │  │  Encrypted  │  │   Android           │ │
│  │ (metadata)  │  │  File Store │  │   Keystore          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Key Dependencies
- **UI:** React Native 0.73+, React Navigation, FlashList
- **State:** Zustand, React Query
- **Crypto:** Google Tink (via native module)
- **Biometrics:** react-native-biometrics
- **Storage:** react-native-fs, SQLite (encrypted with SQLCipher)
- **Media:** react-native-fast-image, react-native-video

### 10.3 Native Module Requirements
Critical paths requiring native implementation:
- All cryptographic operations (Tink)
- Keystore integration
- Biometric authentication
- Large file I/O with streaming encryption

---

## 11. Success Metrics

### North Star Metric
**Monthly Active Users with 5+ Encrypted Files**
- Target: 60% of MAU at M6

### Supporting Metrics

| Category | Metric | Target |
|----------|--------|--------|
| Acquisition | Install to first import | >35% |
| Activation | Files imported D1 | >2 |
| Engagement | Calculator uses/week | >3 |
| Retention | M6 retention | >12% |
| Revenue | LTV:CAC ratio | >2.5:1 |
| Quality | Crash-free sessions | >99.5% |
| Trust | Data loss reports | <0.01% of users |

---

## 12. Launch Phases

### Phase 1: MVP (Months 1-4)
- Calculator module (basic + scientific)
- Vault (images and documents only)
- PIN + biometric unlock
- Core encryption architecture
- Basic folder organization
- Free tier with limits
- Internal testing → Closed beta (200 users)

### Phase 2: Feature Expansion (Months 5-8)
- Video and audio file support
- Batch import
- Auto-import from folders (Premium)
- Additional vault profiles (Premium)
- Secure file deletion
- Recovery phrase export
- Tablet layout optimization
- Open beta → Soft launch (10 countries)

### Phase 3: Scale (Months 9-14)
- Cloud backup with E2E encryption (Premium)
- Wear OS widget
- Quick settings tile
- Localization (8 languages)
- OWASP MASVS Level 2 audit
- Global launch

---

## Appendix A: Competitive Analysis

| Feature | VaultCalc | Calculator+ | Private Photo Vault | KeepSafe |
|---------|-----------|-------------|--------------------|---------|
| Functional calculator | ✓ Full | Basic | ✗ | ✗ |
| Clean design | ✓✓ | ✓ | ✓ | ✓ |
| AES-256 encryption | ✓ | Unknown | ✓ | ✓ |
| Offline-first | ✓ | ✓ | ✗ | ✗ |
| No account required | ✓ | ✓ | ✗ | ✗ |
| Transparent pricing | ✓ | ✓ | ✗ | ✗ |

---

## Appendix B: Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Play Store policy concern | Low | High | Policy-compliant listing; both features prominently described |
| React Native performance issues | Medium | Medium | Critical paths in native modules; performance testing |
| Encryption implementation flaw | Low | Critical | Use established library (Tink); security review |
| User data loss | Low | Critical | Atomic writes; integrity verification; user education |
| Competitor feature parity | High | Low | Focus on quality and trust over feature count |

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| AES-256-GCM | Advanced Encryption Standard with 256-bit key and Galois/Counter Mode authentication |
| Argon2id | Memory-hard key derivation function resistant to GPU/ASIC attacks |
| DEK | Data Encryption Key — unique key per file |
| E2E | End-to-end encryption — only user holds decryption keys |
| Keystore | Android secure hardware/software key storage |

---

*Document finalized for development. Version 1.1.*
