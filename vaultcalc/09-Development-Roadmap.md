# VaultCalc Development Roadmap
## Version 1.0

---

## 1. Roadmap Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                       VAULTCALC ROADMAP                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PHASE 1: MVP                    PHASE 2: ENHANCED                  │
│  ──────────────                  ────────────────                   │
│  • Calculator                    • Video support                    │
│  • PIN authentication            • Document support                 │
│  • Photo vault                   • Biometrics                       │
│  • Basic encryption              • Decoy vault                      │
│  • Simple settings               • Albums                           │
│                                  • Intruder detection               │
│                                                                      │
│  PHASE 3: PREMIUM                PHASE 4: EXPANSION                 │
│  ────────────────                ─────────────────                  │
│  • Cloud backup                  • Secure notes                     │
│  • Subscriptions                 • Widget                           │
│  • Extended storage              • Advanced security                │
│  • Premium themes                • Cross-device sync                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1: MVP

### Objective
Launch a functional calculator with basic photo vault capabilities.

### Duration
8-12 weeks

### Features

| Feature | Priority | Effort | Risk |
|---------|----------|--------|------|
| Calculator UI & Logic | P0 | Medium | Low |
| PIN Authentication | P0 | Medium | Medium |
| Native Crypto Module | P0 | High | High |
| Photo Import & Storage | P0 | Medium | Medium |
| Encrypted Thumbnails | P0 | Medium | Medium |
| Photo Viewer | P0 | Low | Low |
| Onboarding Flow | P1 | Low | Low |
| Basic Settings | P1 | Low | Low |
| Auto-Lock | P1 | Low | Low |
| Light/Dark Theme | P2 | Low | Low |

### Detailed Breakdown

#### Sprint 1-2: Foundation (Weeks 1-4)

```
Week 1-2: Project Setup
├── Initialize React Native CLI project
├── Configure TypeScript strict mode
├── Set up folder structure per architecture
├── Configure ESLint + Prettier
├── Set up navigation skeleton
├── Create native module skeleton (Kotlin)
└── Verify Android build

Week 3-4: Calculator
├── Calculator display component
├── Calculator keypad component
├── Basic operations (+, -, ×, ÷)
├── Decimal and negative support
├── Calculation history (last 3)
├── Clear and backspace
├── Haptic feedback
└── Calculator tests
```

#### Sprint 3-4: Security Core (Weeks 5-8)

```
Week 5-6: Crypto Module
├── Integrate Google Tink (Kotlin)
├── Implement Argon2id key derivation
├── Implement AES-256-GCM encrypt
├── Implement AES-256-GCM decrypt
├── Android Keystore integration
├── Per-file key generation
├── React Native bridge
└── Crypto unit tests

Week 7-8: Authentication
├── PIN detection in calculator
├── PIN storage (Argon2id hash)
├── PIN verification (constant-time)
├── Auth state management (Zustand)
├── Auto-lock on timeout
├── Failed attempt counter
├── Lockout mechanism
└── Auth integration tests
```

#### Sprint 5-6: Vault Core (Weeks 9-12)

```
Week 9-10: Vault UI
├── Vault home screen
├── Tab navigation structure
├── Photo gallery grid (FlashList)
├── Thumbnail decryption & caching
├── Photo viewer (full screen)
├── Empty state
├── Lock button
└── Navigation tests

Week 11-12: File Operations & Polish
├── File picker integration
├── Photo import flow
├── Thumbnail generation
├── SQLite metadata storage
├── File deletion flow
├── Onboarding screens (4)
├── Basic settings screen
├── Final integration testing
└── Performance optimization
```

### MVP Exit Criteria

- [ ] Calculator works correctly for all basic operations
- [ ] PIN authentication secure and functional
- [ ] Photos can be imported and encrypted
- [ ] Photos can be viewed (decrypted on-demand)
- [ ] Auto-lock functions correctly
- [ ] Onboarding guides new users
- [ ] No critical bugs
- [ ] Performance targets met
- [ ] Ready for closed beta

### MVP Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Crypto implementation issues | Medium | Critical | Follow Tink docs exactly, test thoroughly |
| Performance on low-end devices | Medium | High | Test on budget devices early |
| React Native bridge issues | Low | High | Use established patterns, JSI if needed |
| Calculator UX not convincing | Low | High | Reference real calculator apps |

---

## 3. Phase 2: Enhanced

### Objective
Add video/document support, biometrics, and security features.

### Duration
6-8 weeks

### Features

| Feature | Priority | Effort | Risk |
|---------|----------|--------|------|
| Biometric Authentication | P0 | Medium | Low |
| Video Import & Storage | P0 | High | High |
| Video Player | P0 | Medium | Medium |
| Document Support | P1 | Medium | Low |
| Decoy Vault | P1 | Medium | Medium |
| Albums | P2 | Medium | Low |
| Intruder Detection | P2 | Medium | Medium |
| Multi-Select & Batch Ops | P2 | Low | Low |

### Detailed Breakdown

#### Sprint 7-8: Biometrics & Video (Weeks 13-16)

```
Week 13-14: Biometric Authentication
├── Check biometric availability
├── BiometricPrompt integration
├── Biometric setup flow
├── Biometric unlock
├── Fallback to PIN
├── Settings toggle
└── Biometric tests

Week 15-16: Video Support
├── Video import flow
├── Large file handling
├── Video thumbnail generation
├── Video encryption (streaming)
├── Video gallery grid
├── Video player integration
├── Playback controls
└── Video performance tests
```

#### Sprint 9-10: Security & Organization (Weeks 17-20)

```
Week 17-18: Decoy Vault & Documents
├── Decoy PIN setup
├── Decoy storage area
├── Decoy routing logic
├── Document import flow
├── Document list view
├── PDF viewer integration
├── Document icons
└── Decoy vault tests

Week 19-20: Albums & Intruder Detection
├── Create album flow
├── Album list view
├── Add to album (move/copy)
├── Album management
├── Camera permission handling
├── Intruder photo capture
├── Intruder log storage
├── Intruder log viewer
└── Integration tests
```

### Phase 2 Exit Criteria

- [ ] Biometric unlock works reliably
- [ ] Videos can be imported and played
- [ ] Documents can be imported and viewed
- [ ] Decoy vault fully functional
- [ ] Albums work correctly
- [ ] Intruder detection captures photos
- [ ] No performance regression
- [ ] Ready for public beta

### Phase 2 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Video encryption performance | High | High | Stream decryption, chunk processing |
| Large file memory issues | Medium | High | Process in chunks, limit preview size |
| Biometric edge cases | Medium | Medium | Handle all BiometricPrompt callbacks |
| Decoy detection by inspection | Low | Medium | Ensure identical UX in both vaults |

---

## 4. Phase 3: Premium

### Objective
Implement monetization, cloud backup, and premium features.

### Duration
6-8 weeks

### Features

| Feature | Priority | Effort | Risk |
|---------|----------|--------|------|
| Google Play Billing | P0 | High | Medium |
| Subscription Management | P0 | Medium | Medium |
| Cloud Backup (Google Drive) | P0 | High | High |
| Premium Feature Gating | P1 | Medium | Low |
| AdMob Integration | P1 | Medium | Low |
| Extended Storage Limit | P1 | Low | Low |
| AMOLED Theme | P2 | Low | Low |
| Premium Support Channel | P2 | Low | Low |

### Detailed Breakdown

#### Sprint 11-12: Monetization (Weeks 21-24)

```
Week 21-22: Google Play Billing
├── Play Billing library integration
├── Subscription products setup
├── Purchase flow implementation
├── Subscription verification
├── Restore purchases
├── Premium status persistence
├── Receipt validation
└── Billing tests

Week 23-24: Feature Gating & Ads
├── Premium feature checks
├── Storage limit enforcement
├── Video/doc gating (free tier)
├── AdMob SDK integration
├── Banner ad placement
├── Ad-free for premium
├── Subscription screen UI
└── Monetization tests
```

#### Sprint 13-14: Cloud Backup (Weeks 25-28)

```
Week 25-26: Google Drive Integration
├── Google Sign-In integration
├── Drive API setup
├── OAuth scopes configuration
├── Backup file structure
├── Pre-upload encryption
├── Upload implementation
├── Progress tracking
└── Drive permission tests

Week 27-28: Backup & Restore
├── Incremental backup logic
├── Backup scheduling
├── Restore flow
├── Download + decrypt
├── Conflict resolution
├── Backup status UI
├── Settings for backup
└── Full backup/restore tests
```

### Phase 3 Exit Criteria

- [ ] Subscriptions can be purchased
- [ ] Premium features properly gated
- [ ] Ads display in free tier only
- [ ] Cloud backup works reliably
- [ ] Restore recovers all data
- [ ] Billing edge cases handled
- [ ] No data loss scenarios
- [ ] Ready for public launch

### Phase 3 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Billing integration complexity | High | Medium | Follow Google's samples exactly |
| Cloud backup data corruption | Medium | Critical | Verify after upload, checksums |
| OAuth token expiration | Medium | Medium | Proper refresh token handling |
| Storage cost at scale | Low | High | Monitor usage, adjust limits |

---

## 5. Phase 4: Expansion

### Objective
Add advanced features and prepare for scale.

### Duration
Ongoing

### Features

| Feature | Priority | Effort | Risk |
|---------|----------|--------|------|
| Secure Notes | P1 | Medium | Low |
| Calculator Widget | P2 | Medium | Medium |
| Search & Filters | P2 | Medium | Low |
| Export/Share Flow | P2 | Low | Low |
| Favorites | P2 | Low | Low |
| Advanced Sort Options | P3 | Low | Low |
| Panic Button | P3 | Low | Low |
| Root Detection | P3 | Medium | Medium |

### Potential Future Features (Not Committed)

- Cross-device sync (beyond Google Drive)
- Secure browser
- Password manager integration
- iOS version
- Wear OS companion
- Desktop sync

---

## 6. Technical Milestones

### Architecture Checkpoints

| Milestone | Phase | Validation |
|-----------|-------|------------|
| Project compiles | 1.1 | Clean build, no warnings |
| Calculator functional | 1.2 | All operations work |
| Crypto module working | 1.3 | Encrypt/decrypt tests pass |
| Auth flow complete | 1.4 | PIN unlock works |
| MVP feature complete | 1.5 | All MVP features work |
| Video streaming works | 2.1 | 100MB video plays smoothly |
| Billing integration | 3.1 | Test purchase works |
| Cloud backup working | 3.2 | Full backup/restore cycle |

### Performance Checkpoints

| Checkpoint | Target | When to Test |
|------------|--------|--------------|
| Cold start | < 800ms | After MVP |
| Vault unlock | < 300ms | After Auth |
| Thumbnail load | < 50ms | After Vault UI |
| 10MB import | < 3s | After File Ops |
| 100MB video play | No stutter | After Video |
| Memory (active) | < 200MB | Every phase |

### Security Checkpoints

| Checkpoint | Validation | When |
|------------|------------|------|
| PIN storage | Verify Argon2id hash | After Auth |
| File encryption | Verify AES-256-GCM | After Crypto |
| Key storage | Verify Keystore usage | After Crypto |
| Temp file cleanup | Verify deletion | After Vault |
| Memory clearing | Verify no leaks | Every phase |

---

## 7. Quality Gates

### Before MVP Launch

```
Code Quality:
□ TypeScript strict mode passes
□ ESLint with zero warnings
□ No TODO comments in core paths
□ Code review completed

Testing:
□ Unit tests for crypto (100% coverage)
□ Unit tests for auth (100% coverage)
□ Integration tests for vault flow
□ Manual test on 5+ devices

Performance:
□ Cold start < 800ms on mid-range device
□ Memory < 150MB active
□ No jank in gallery scrolling

Security:
□ No sensitive data in logs
□ Encryption verified by inspection
□ PIN brute force protection works
□ Auto-lock functions correctly
```

### Before Public Launch

```
Additional Requirements:
□ Privacy policy published
□ Play Store listing complete
□ Crash reporting enabled
□ Analytics (privacy-respecting)
□ Support email active
□ FAQ written

Compliance:
□ Data safety form complete
□ Content rating obtained
□ All permissions justified
□ Ad implementation compliant
```

---

## 8. Risk Register

### Critical Risks

| ID | Risk | Phase | Probability | Impact | Mitigation | Owner |
|----|------|-------|-------------|--------|------------|-------|
| R1 | Crypto implementation flaw | 1 | Medium | Critical | Use Tink, test thoroughly | Dev |
| R2 | Play Store rejection | 3 | Medium | High | Follow compliance docs | Dev |
| R3 | Data loss bug | 1-3 | Low | Critical | Test all paths, backups | Dev |
| R4 | Performance issues | 1-2 | Medium | High | Profile early and often | Dev |
| R5 | Video memory crashes | 2 | High | High | Streaming decryption | Dev |

### Risk Monitoring

| Risk Level | Review Frequency |
|------------|------------------|
| Critical | Every sprint |
| High | Every 2 sprints |
| Medium | Monthly |
| Low | Quarterly |

---

## 9. Resource Requirements

### Development

| Role | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|---------|---------|---------|---------|
| Mobile Dev | 1 FT | 1 FT | 1 FT | 1 PT |
| Native Dev (Kotlin) | 0.5 FT | 0.25 FT | 0.25 FT | As needed |
| QA | 0.5 FT | 0.5 FT | 0.5 FT | 0.25 FT |

### Infrastructure

| Item | Phase 1 | Phase 2 | Phase 3+ |
|------|---------|---------|----------|
| Play Console | $25 (one-time) | - | - |
| Test devices | 3-5 devices | Same | Same |
| CI/CD | GitHub Actions (free) | Same | Same |
| Crash reporting | Firebase (free tier) | Same | Same |

---

## 10. Success Metrics

### Phase 1 (MVP)

| Metric | Target | Stretch |
|--------|--------|---------|
| Crash-free rate | > 99% | > 99.5% |
| Cold start time | < 800ms | < 600ms |
| Beta user satisfaction | > 4.0 | > 4.5 |

### Phase 2 (Enhanced)

| Metric | Target | Stretch |
|--------|--------|---------|
| Video playback success | > 98% | > 99% |
| Biometric success rate | > 95% | > 98% |
| Beta retention (7-day) | > 30% | > 40% |

### Phase 3 (Premium)

| Metric | Target | Stretch |
|--------|--------|---------|
| Free → Trial | > 10% | > 15% |
| Trial → Paid | > 30% | > 40% |
| Backup success rate | > 99% | > 99.9% |

### Post-Launch

| Metric | Target | Stretch |
|--------|--------|---------|
| Play Store rating | > 4.3 | > 4.5 |
| 30-day retention | > 25% | > 35% |
| Monthly revenue | $5K | $10K |

---

## 11. Timeline Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                       TIMELINE (WEEKS)                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Phase 1: MVP                                                        │
│  ├── Setup & Calculator    [████████░░░░] Weeks 1-4                │
│  ├── Crypto & Auth         [░░░░████████░░░░] Weeks 5-8            │
│  └── Vault & Polish        [░░░░░░░░████████] Weeks 9-12           │
│                                                                      │
│  Phase 2: Enhanced                                                   │
│  ├── Biometrics & Video    [████████░░░░] Weeks 13-16              │
│  └── Security & Albums     [░░░░████████] Weeks 17-20              │
│                                                                      │
│  Phase 3: Premium                                                    │
│  ├── Monetization          [████████░░░░] Weeks 21-24              │
│  └── Cloud Backup          [░░░░████████] Weeks 25-28              │
│                                                                      │
│  Phase 4: Expansion        [Ongoing after launch]                   │
│                                                                      │
│  Total to Launch: ~28 weeks (7 months)                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 12. Decision Log

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| - | React Native CLI over Expo | Need native crypto module | Architecture |
| - | Google Tink for crypto | Audited, maintained, misuse-resistant | Security |
| - | Zustand over Redux | Simpler, less boilerplate | Code quality |
| - | FlashList over FlatList | Better performance for large lists | Performance |
| - | Calculator-first branding | Play Store compliance | Marketing |

---

*Document Version: 1.0*
*Last Updated: 2024*
*Next Review: After Phase 1 completion*
