# VaultCalc - Change Log
## Record of All Project Changes

---

## Format

Each entry follows this structure:

```
### [DATE] - [BRIEF TITLE]

**Type:** [Documentation | Feature | Bug Fix | Refactor | Security | Infrastructure]
**Impact:** [Low | Medium | High | Critical]
**Approved By:** [User | AI Suggestion Approved | Auto]

**Summary:**
[What changed and why]

**Files Affected:**
- [file path]

**Decisions Made:**
- [Any notable decisions]

**Follow-Up Required:**
- [Any pending items]
```

---

## 2024

### 2024-XX-XX - Project Documentation System Created

**Type:** Documentation
**Impact:** High
**Approved By:** User

**Summary:**
Created the complete Project Memory & Execution System for VaultCalc. This establishes the documentation foundation for long-term development across multiple sessions.

**Files Created:**
- `docs/PROJECT_CONTEXT.md` - Product vision, constraints, non-negotiables
- `docs/DEVELOPMENT_PLAYBOOK.md` - Step-by-step development process
- `docs/AI_INSTRUCTIONS.md` - AI behavior guidelines across sessions
- `docs/FEATURE_INDEX.md` - Master feature list with status tracking
- `docs/CHANGE_LOG.md` - This file

**Files Previously Created:**
- `01-PRD.md` - Product Requirements Document
- `02-UX-Design.md` - UX Design Specifications
- `03-Design-System.md` - Visual Design System
- `04-Technical-Architecture.md` - Technical Architecture
- `05-Security-Model.md` - Security Model
- `06-Retention-System.md` - Retention System

**Decisions Made:**
- Used 112 feature IDs across 4 phases for tracking
- Established dependency graph for build order
- Defined clear status indicators (📋 🔨 ✅ 🚫 ⏸️)

**Follow-Up Required:**
- Create remaining spec documents (07, 08, 09)
- Begin INFRA-001 (Project Setup) when ready

---

### 2025-02-05 - Project Infrastructure Initialized (INFRA-001 to INFRA-004, INFRA-009, INFRA-010)

**Type:** Infrastructure
**Impact:** High
**Approved By:** User

**Summary:**
Initialized VaultCalc React Native project with complete foundation setup. Android-only build. No feature code, UI, or business logic—infrastructure only. All verification checks passed: TypeScript compiles, ESLint passes, Android debug build succeeds.

**Features Completed:**
- INFRA-001: Project Setup (RN CLI 0.83.1)
- INFRA-002: TypeScript Configuration (strict mode + path aliases)
- INFRA-003: ESLint + Prettier (no-any, no-console enforced)
- INFRA-004: Folder Structure (per 04-Technical-Architecture.md)
- INFRA-009: Native Module Skeleton (directories created)
- INFRA-010: Build Configuration (debug build verified)

**Files Created:**
- `VaultCalcApp/` - New React Native project
- `src/app/App.tsx` - Minimal root component
- `src/types/index.ts` - Type definitions placeholder
- `src/features/` - Feature module directories (empty)
- `src/services/` - Service directories (empty)
- `src/shared/` - Shared code directories (empty)
- `src/store/` - State store directory (empty)
- `android/.../modules/` - Native module skeleton directories

**Files Modified:**
- `tsconfig.json` - Strict mode, path aliases
- `.eslintrc.js` - Strict rules, no-any, no-console
- `.prettierrc.js` - Consistent formatting
- `babel.config.js` - Module resolver for path aliases
- `index.js` - Points to src/app/App
- `.gitignore` - Android-only, security-focused

**Decisions Made:**
- React Native 0.83.1 (latest stable)
- Android only (iOS folder removed)
- npm as package manager (not yarn)
- Path aliases for clean imports (@app, @features, etc.)
- babel-plugin-module-resolver for runtime path resolution

**Verification Results:**
- ✅ TypeScript compiles (npx tsc --noEmit)
- ✅ ESLint passes (npx eslint src/)
- ✅ Android build succeeds (gradlew assembleDebug)

**Follow-Up Required:**
- INFRA-005: Navigation Setup (React Navigation)
- INFRA-006: State Management Setup (Zustand + React Query)
- INFRA-007: MMKV Setup
- INFRA-008: SQLite Setup
- CALC-001: Calculator UI Layout

---

### 2025-02-05 - Navigation Setup (INFRA-005)

**Type:** Infrastructure
**Impact:** Medium
**Approved By:** User

**Summary:**
Installed and configured React Navigation 6 with type-safe navigation structure. Created RootNavigator with placeholder screens. Navigation ready for Calculator and Vault screens to be added.

**Features Completed:**
- INFRA-005: Navigation Setup

**Dependencies Added:**
- @react-navigation/native ^6.x
- @react-navigation/native-stack ^6.x
- react-native-screens ^3.x
- react-native-safe-area-context ^4.x

**Files Created:**
- `src/types/navigation.ts` - Type-safe navigation param lists
- `src/app/navigation/RootNavigator.tsx` - Main navigator
- `src/app/navigation/index.ts` - Navigation exports
- `src/app/navigation/placeholders/CalculatorPlaceholder.tsx` - Temp placeholder
- `src/app/navigation/placeholders/index.ts` - Placeholder exports

**Files Modified:**
- `src/app/App.tsx` - Added NavigationContainer and SafeAreaProvider
- `src/types/index.ts` - Export navigation types
- `tsconfig.json` - Changed @types alias to @typedefs (avoid DefinitelyTyped conflict)
- `babel.config.js` - Changed @types alias to @typedefs

**Decisions Made:**
- Changed path alias from `@types` to `@typedefs` to avoid conflict with DefinitelyTyped
- Used placeholder screens until CALC-001 is implemented
- Disabled gestures on Calculator screen for security
- No animation between Calculator <-> Vault per UX spec

**Verification Results:**
- ✅ TypeScript compiles
- ✅ ESLint passes
- ✅ Android build succeeds

**Follow-Up Required:**
- INFRA-006: State Management Setup (Zustand + React Query)
- INFRA-007: MMKV Setup
- INFRA-008: SQLite Setup
- CALC-001: Calculator UI Layout

---

### 2025-02-05 - State Management Setup (INFRA-006)

**Type:** Infrastructure
**Impact:** Medium
**Approved By:** User

**Summary:**
Installed and configured Zustand for local state management and React Query for async state. Created three core stores (auth, vault, settings) with full TypeScript types. Stores are ready for feature implementation.

**Features Completed:**
- INFRA-006: State Management Setup

**Dependencies Added:**
- zustand ^4.x
- @tanstack/react-query ^5.x

**Files Created:**
- `src/app/queryClient.ts` - React Query client configuration
- `src/store/authStore.ts` - Authentication state (isAuthenticated, failedAttempts, lockout)
- `src/store/vaultStore.ts` - Vault UI state (selection, viewMode, sort)
- `src/store/settingsStore.ts` - App settings (theme, lockTimeout, biometric)
- `src/store/index.ts` - Store exports

**Files Modified:**
- `src/app/App.tsx` - Added QueryClientProvider wrapper

**Design Decisions:**
- authStore NOT persisted (security: resets on app restart)
- vaultStore NOT persisted (security: clears on lock)
- settingsStore WILL be persisted with MMKV (INFRA-007)
- React Query configured for local-first (no network retries)
- Zustand stores use no middleware yet (persistence added in INFRA-007)

**Verification Results:**
- ✅ TypeScript compiles
- ✅ ESLint passes

**Follow-Up Required:**
- INFRA-007: MMKV Setup (persistence for settingsStore)
- INFRA-008: SQLite Setup
- CALC-001: Calculator UI Layout

---

### 2025-02-05 - MMKV Setup (INFRA-007)

**Type:** Infrastructure
**Impact:** Medium
**Approved By:** User

**Summary:**
Installed and configured react-native-mmkv for fast synchronous key-value storage. Updated settingsStore with Zustand persist middleware to automatically persist settings to MMKV. Settings now survive app restarts.

**Features Completed:**
- INFRA-007: MMKV Setup

**Dependencies Added:**
- react-native-mmkv ^4.1.2

**Files Created:**
- `src/services/storage/mmkv.ts` - MMKV instance and Zustand storage adapter
- `src/services/storage/index.ts` - Storage service exports

**Files Modified:**
- `src/store/settingsStore.ts` - Added persist middleware with MMKV storage

**Technical Notes:**
- MMKV v4 uses `createMMKV()` function (not `new MMKV()`)
- Method for removing keys is `remove()` not `delete()`
- Storage NOT encrypted (use native CryptoModule for sensitive data)
- Persisted settings: theme, lockTimeout, biometric, firstLaunch, etc.

**Verification Results:**
- ✅ TypeScript compiles
- ✅ ESLint passes

**Follow-Up Required:**
- INFRA-008: SQLite Setup
- CALC-001: Calculator UI Layout

---

### 2025-02-05 - SQLite Setup (INFRA-008)

**Type:** Infrastructure
**Impact:** Medium
**Approved By:** User

**Summary:**
Installed expo-sqlite and created the database service for storing file metadata. Implements schema from 04-Technical-Architecture.md Section 5.1: media_items, albums, album_media, intruder_logs tables. Provides TypeScript interfaces and CRUD operations for media items.

**Features Completed:**
- INFRA-008: SQLite Setup

**Dependencies Added:**
- expo-sqlite ^15.1.4

**Files Created:**
- `src/services/storage/database.ts` - SQLite database service with schema and CRUD operations

**Files Modified:**
- `src/services/storage/index.ts` - Export database functions and types

**Technical Notes:**
- Uses expo-sqlite (NOT native-only react-native-sqlite-storage)
- Stores METADATA only, not encrypted file content
- MediaItem, Album, IntruderLog TypeScript interfaces
- Foreign keys enabled for referential integrity
- Schema version tracking for future migrations
- Indexes on type, created_at, is_decoy, is_favorite for query performance

**Verification Results:**
- ✅ TypeScript compiles
- ✅ ESLint passes

**Follow-Up Required:**
- CALC-001: Calculator UI Layout (all infrastructure complete)

---

### 2026-02-11 - Production Release Preparation & Stabilization Audit

**Type:** Infrastructure
**Impact:** High
**Approved By:** User

**Summary:**
All 112 features complete. Prepared codebase for first Play Store release with build config, then performed comprehensive stabilization audit. Five production config areas implemented: automated versioning from package.json, dev/prod build flavors, ProGuard/R8 minification, release signing config, and Play Store checklist. Full audit resolved all ESLint errors (44 duplicate imports + 1 missing dep + 1 inline style), fixed path alias inconsistencies, removed unused dependencies, and verified security invariants.

**Production Release Config:**
- Versioning: package.json 0.0.1 → 1.0.0, auto-derived versionCode (10000) in build.gradle
- Build flavors: `dev` (com.vaultcalcapp.dev, "VaultCalc Dev") + `prod` (com.vaultcalcapp, "VaultCalc")
- ProGuard/R8: enabled with shrinkResources, proguard-android-optimize.txt, Hermes/Guava/GMS/Expo keep rules
- Signing: release signingConfig from android/signing.properties (gitignored), falls back to debug if keystore absent
- debuggableVariants = ["devDebug"] so only dev+debug skips JS bundling

**Stabilization Audit Results:**
- TypeScript strict: PASS (0 errors)
- ESLint: PASS (0 errors, 0 warnings after fixes)
- Security audit: PASS — no hardcoded secrets, no sensitive data in logs, 1 intentional `as any` (fetch body for file upload), all crypto invariants hold (Tink only, Argon2id only, AES-256-GCM only, no weak algorithms), all temp files cleaned up, 6 Android permissions all justified, allowBackup=false, cleartext disabled
- Build: devDebug PASS (155 MB), prodRelease PASS (76 MB, 51% reduction), mapping.txt confirmed (68 MB)
- Dependencies: removed unused `@react-native/new-app-screen` and redundant `expo-asset`; `react-native-nitro-modules` restored (required by react-native-mmkv native build)

**Files Affected:**
- `package.json` — version bump, removed unused deps
- `android/app/build.gradle` — versioning, flavors, ProGuard, signing
- `android/app/proguard-rules.pro` — Hermes/Guava/GMS/Expo rules
- `android/signing.properties` — new (gitignored template)
- `android/app/src/main/res/values/strings.xml` — removed app_name (flavor provides it)
- `.gitignore` — added signing.properties
- `src/app/App.tsx` — extracted inline style, removed unused StyleSheet import
- `src/features/auth/screens/PinSetupScreen.tsx` — added missing useCallback dep
- `src/store/settingsStore.ts` — relative import → @services alias
- `src/app/navigation/RootNavigator.tsx` — relative import → @typedefs alias
- 39 files across src/ — merged duplicate imports from @shared/theme, @services/storage/database, @react-navigation/native, @services/media
- `vaultcalc/docs/PLAY_STORE_CHECKLIST.md` — new

**Decisions Made:**
- versionCode formula: major*10000 + minor*100 + patch (allows 99 minor + 99 patch per major)
- Signing fallback checks keystore file existence (not just props file), so builds work without keystore
- Kept `react-native-nitro-modules` — it is a native build dependency of react-native-mmkv, not directly imported in TS
- ProGuard console.log/warn in ErrorBoundary and autoBackupService deemed acceptable (generic error messages only, no vault data)

**Follow-Up Required:**
- Generate release keystore (manual keytool command — see PLAY_STORE_CHECKLIST.md)
- Populate android/signing.properties with real passwords
- Complete Play Store listing assets (icon, screenshots, descriptions)
- Test prodRelease on physical device with real signing

---

## Template for Future Entries

Copy this template for new entries:

```markdown
### YYYY-MM-DD - [Title]

**Type:** [Type]
**Impact:** [Impact Level]
**Approved By:** [Who Approved]

**Summary:**
[Description]

**Files Affected:**
- [Files]

**Decisions Made:**
- [Decisions]

**Follow-Up Required:**
- [Next steps]
```

---

## Change Categories

### Documentation Changes
Changes to markdown files, specs, or this change log.

### Feature Changes
New features added, features modified, or features removed.

### Bug Fixes
Corrections to existing functionality.

### Refactors
Code restructuring without behavior change.

### Security Changes
Any changes affecting encryption, authentication, or data protection.

### Infrastructure Changes
Build configuration, dependencies, project structure.

---

## Impact Levels

| Level | Meaning | Examples |
|-------|---------|----------|
| Low | Minimal impact | Typo fix, comment update |
| Medium | Localized impact | Single feature change |
| High | Broad impact | Architecture change, new module |
| Critical | System-wide | Security fix, breaking change |

---

## Approval Types

| Type | Meaning |
|------|---------|
| User | User explicitly requested or approved |
| AI Suggestion Approved | AI suggested, user confirmed |
| Auto | Automatic (e.g., version bump, timestamp) |

---

## Quick Stats

| Metric | Count |
|--------|-------|
| Total Entries | 7 |
| Documentation Changes | 1 |
| Infrastructure Changes | 6 |
| Feature Changes | 0 |
| Bug Fixes | 0 |
| Security Changes | 0 |

---

*Document Version: 1.0*
*Purpose: Maintain complete history of project evolution*
*Update: After every significant change*
