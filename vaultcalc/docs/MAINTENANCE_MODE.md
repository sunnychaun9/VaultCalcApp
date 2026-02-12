# VaultCalc - Maintenance Mode
## How This Project Operates Post-Development

---

## 1. Project Status

VaultCalc has completed all planned development:

| Phase | Features | Status |
|-------|----------|--------|
| Phase 1 MVP | 54/54 | Complete |
| Phase 2 Enhanced | 27/27 | Complete |
| Phase 3 Premium | 21/21 | Complete |
| **Total** | **112/112** | **Complete** |

The project is now in **maintenance mode**. No new features are being developed. All work is limited to bug fixes, security patches, dependency updates, and Play Store compliance.

---

## 2. How to Request Work

### Allowed Work Types

| Type | Description | Approval Required |
|------|-------------|-------------------|
| Bug Fix | Fixing broken behavior | User approval |
| Security Patch | Addressing vulnerabilities in crypto, auth, or data handling | User approval (Critical: immediate) |
| Dependency Update | Updating React Native, native libraries, or npm packages | User approval |
| Play Store Compliance | Changes required by Google policy updates | User approval |
| Performance Fix | Resolving measurable regressions | User approval |

### Prohibited Work Types

| Type | Why |
|------|-----|
| New features | All 112 features are complete; scope is locked |
| UX redesigns | Design system is locked in `03-Design-System.md` |
| Tech stack changes | Stack is locked in `PROJECT_CONTEXT.md` Section 9 |
| Crypto algorithm changes | Security model is locked in `05-Security-Model.md` |
| Monetization changes | Model is locked in `07-Monetization-Model.md` |

### Request Format

All work requests must specify:

```
WHAT:    [Concise description of the problem or change]
WHY:     [Why this is necessary now]
TYPE:    [Bug Fix | Security Patch | Dependency Update | Compliance | Performance Fix]
IMPACT:  [Low | Medium | High | Critical]
```

---

## 3. Authoritative Files

### Specification Documents (Read-Only Reference)

These files in `vaultcalc/` define what the app is. They are the single source of truth for all product, design, and architecture decisions:

| File | Governs |
|------|---------|
| `01-PRD.md` | Product requirements and scope |
| `02-UX-Design.md` | All UX flows and interactions |
| `03-Design-System.md` | Visual design tokens, typography, spacing |
| `04-Technical-Architecture.md` | Code architecture, database schema, module structure |
| `05-Security-Model.md` | Encryption, authentication, key management |
| `06-Retention-System.md` | Data lifecycle and deletion policies |
| `07-Monetization-Model.md` | Premium features and billing |
| `08-Play-Store-Strategy.md` | Store listing, compliance, review strategy |
| `09-Development-Roadmap.md` | Phase definitions and dependency graph |

### Operational Documents (Actively Updated)

These files in `vaultcalc/docs/` track the living state of the project:

| File | Purpose | Updated When |
|------|---------|--------------|
| `PROJECT_CONTEXT.md` | Non-negotiables, constraints, quick reference | Rarely (locked) |
| `FEATURE_INDEX.md` | Feature completion status | After feature changes |
| `DEVELOPMENT_PLAYBOOK.md` | Development process and rules | After process changes |
| `AI_INSTRUCTIONS.md` | AI behavior rules across sessions | After workflow changes |
| `CHANGE_LOG.md` | Every change with impact and decisions | After every change |
| `PERFORMANCE_AUDIT.md` | Performance baselines and issues | After performance work |
| `SECURITY_AUDIT.md` | Security assessment findings | After security reviews |
| `UX_AUDIT.md` | UX evaluation results | After UX reviews |
| `PLAY_STORE_COMPLIANCE.md` | Compliance verification status | Before releases |
| `MAINTENANCE_MODE.md` | This file: governance rules | After process changes |

### Configuration Files (Change With Caution)

| File | Purpose |
|------|---------|
| `tsconfig.json` | TypeScript strict mode + path aliases |
| `.eslintrc.js` | Linting rules (no-any, no-console enforced) |
| `.prettierrc.js` | Code formatting |
| `android/app/build.gradle` | Version code, signing, dependencies |

---

## 4. What Must Never Be Changed

These constraints are inherited from `PROJECT_CONTEXT.md` Section 8 and are **absolute**:

### Security Invariants
- PIN must never be stored in plain text
- Encryption keys and PINs must never be logged
- Only AES-256-GCM via Google Tink for encryption
- No deprecated crypto (MD5, SHA1, DES)
- No custom crypto algorithms
- Decrypted files must never be stored permanently
- Security must never be disabled for convenience

### Product Invariants
- Calculator must remain a real, functional calculator
- No visual indicator of vault existence
- No vault-related notifications
- No dark patterns for upgrades
- No analytics that identify users
- No account creation requirement
- Free tier must remain usable

### Code Invariants
- TypeScript strict mode must stay enabled
- `any` type is prohibited
- TypeScript errors must never be suppressed
- Crypto operations must never run on the main thread
- No unused dependencies

### Architecture Invariants
- The tech stack in `PROJECT_CONTEXT.md` Section 9 is locked
- Path aliases (@shared, @store, @features, @services, @app, @typedefs) must not change
- Feature module boundaries in `src/features/` must be preserved
- Native modules live in `android/app/src/main/java/com/vaultcalcapp/modules/`

---

## 5. How Decisions Are Logged

Every change to the project is recorded in `vaultcalc/docs/CHANGE_LOG.md` using this format:

```markdown
### YYYY-MM-DD - [Brief Title]

**Type:** [Bug Fix | Security Patch | Dependency Update | Compliance | Performance Fix | Refactor]
**Impact:** [Low | Medium | High | Critical]
**Approved By:** [User | AI Suggestion Approved]

**Summary:**
[What changed and why]

**Files Affected:**
- [file paths]

**Decisions Made:**
- [Any choices made and rationale]

**Follow-Up Required:**
- [Any remaining work, or "None"]
```

### Impact Levels

| Level | Meaning | Examples |
|-------|---------|----------|
| Low | Cosmetic or documentation-only | Typo fix, comment update |
| Medium | Single module affected | Bug fix in one feature |
| High | Multiple modules affected | Dependency update, architecture fix |
| Critical | Security or data integrity | Crypto fix, auth bypass, data loss |

### Rules
- Every change gets a CHANGE_LOG entry, no exceptions
- Security changes must include before/after risk assessment
- Dependency updates must list the old and new versions
- The `Quick Stats` table at the bottom of the log must be updated

---

## 6. How Releases Are Prepared

### Pre-Release Checklist

```
1. CODE VERIFICATION
   [ ] TypeScript compiles:  ./node_modules/.bin/tsc --noEmit
   [ ] ESLint passes:        npx eslint src/
   [ ] All tests pass:       npx jest
   [ ] No `any` types:       grep confirms zero violations

2. BUILD VERIFICATION
   [ ] Debug build succeeds: cd android && ./gradlew assembleDebug
   [ ] Release build succeeds: cd android && ./gradlew assembleRelease
   [ ] APK size is within acceptable range

3. SECURITY REVIEW
   [ ] No secrets in source (API keys, keystores, .env files)
   [ ] Crypto operations verified against 05-Security-Model.md
   [ ] No new permissions added without justification
   [ ] SECURITY_AUDIT.md reviewed and current

4. PLAY STORE COMPLIANCE
   [ ] PLAY_STORE_COMPLIANCE.md reviewed and current
   [ ] No prohibited language (spy, surveillance, hidden, stealth)
   [ ] Privacy policy is current
   [ ] All declared permissions are justified in store listing

5. VERSION BUMP
   [ ] package.json: version bumped (build.gradle auto-derives versionCode/versionName)
   [ ] CHANGE_LOG.md has entries for all changes since last release

6. DOCUMENTATION
   [ ] CHANGE_LOG.md is complete for this release
   [ ] FEATURE_INDEX.md reflects current state
   [ ] Any new decisions are documented
```

### Version Numbering

```
versionName:  MAJOR.MINOR.PATCH
versionCode:  Auto-derived: major*10000 + minor*100 + patch

MAJOR  - Breaking changes or major feature phase
MINOR  - New functionality or significant improvements
PATCH  - Bug fixes, security patches, dependency updates
```

### Release Process

```
Step 1: Complete the pre-release checklist above
Step 2: Create a CHANGE_LOG entry summarizing the release
Step 3: Bump version in package.json (versionCode auto-derives)
Step 4: Build the release AAB: cd android && ./gradlew bundleProdRelease
Step 5: Test the release build on a physical device
Step 6: Submit to Google Play Console
Step 7: Monitor the review and rollout
```

### Rollback Plan

If a release causes critical issues:
1. Halt the Play Store rollout (staged rollout recommended)
2. Identify the regression and log it in CHANGE_LOG.md
3. Fix, rebuild, and submit a patch release (increment PATCH)
4. Never force-push or rewrite history on the release branch

---

## 7. Quick Reference

```
REQUESTING WORK:
  Bug fix / security patch / dependency update / compliance only.
  No new features. No redesigns. No stack changes.

BEFORE ANY CHANGE:
  1. Read the relevant spec document
  2. Confirm it doesn't violate Section 4 invariants
  3. Get user approval

AFTER ANY CHANGE:
  1. Run TypeScript check + ESLint
  2. Add CHANGE_LOG.md entry
  3. Verify build still succeeds

BEFORE ANY RELEASE:
  1. Complete pre-release checklist (Section 6)
  2. Bump version
  3. Build, test, submit
```

---

*Document Version: 1.0*
*Status: Active*
*Created: 2025-02-11*
