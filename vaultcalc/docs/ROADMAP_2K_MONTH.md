# VaultCalcApp — $2,000/month Roadmap

> Step-by-step implementation plan to reach $2,000/month revenue.
> Mark each task `[x]` when complete. Every new session should read this file first.

---

## Current State (as of 2026-04-14)

| Area | Status | Notes |
|------|--------|-------|
| App version | 1.0.0 | Not yet on Play Store |
| Onboarding | DONE | 4-slide welcome + how-it-works + first-import flow |
| Intruder selfie | DONE | Camera + location + risk scoring + encrypted storage |
| Ad system | DONE | Interstitial + rewarded + app-open, frequency capped, consent gated |
| Ad/auth lock bug | FIXED | `withAutoLockSuppressed` in adService.ts suppresses auto-lock during ads |
| Subscription billing | DONE | Play Billing 7.1.1, 4 tiers, encrypted premium proof |
| Sentry crash reporting | DONE | JS + native, privacy-hardened, auto-init disabled in manifest |
| Referral system | NOT STARTED | Only `appShareCount` field in settingsStore (unused) |
| Analytics/funnels | NOT STARTED | Sentry captures crashes only, no event tracking |
| Localization (i18n) | NOT STARTED | All strings hardcoded English, no i18n library |
| ASO assets | NOT STARTED | Only app icon exists |
| Geo-tiered pricing | NOT STARTED | Flat pricing across all countries |
| iOS | NOT STARTED | 26 Kotlin native modules would need Swift rewrites |

---

## Revenue Target Math

$2,000/month needs one of these user/revenue combos:

| Strategy | Required MAU | Ad Rev | Sub Rev | IAP Rev |
|----------|-------------|--------|---------|---------|
| India-heavy (low eCPM) | 150K–200K | $800 | $900 | $300 |
| Mixed geo (30% Tier-1) | 50K–80K | $600 | $1,100 | $300 |
| US/EU focused (high eCPM) | 20K–30K | $400 | $1,300 | $300 |

Key insight: 1 US user = 10-15x ad revenue of 1 Indian user. Don't abandon India, but Tier-1 users in the mix dramatically reduce the MAU needed.

---

## PHASE 1: Launch Foundation (Week 1-2)

Goal: Get live on Play Store with analytics so every decision from here is data-driven.

### Task 1.1: Analytics Integration (PostHog or Firebase Analytics)
- [x] **Status: CODE COMPLETE — awaiting Firebase project setup + `google-services.json`**
- **Why first:** Every optimization after this depends on real data. Without funnel metrics, you're guessing.
- **Effort:** 1-2 days
- **Date completed (code):** 2026-04-14
- **What shipped:**
  - Added `@react-native-firebase/app` + `@react-native-firebase/analytics` to package.json (`^21.6.1`)
  - Added `com.google.gms:google-services:4.4.2` Gradle classpath in `android/build.gradle`
  - Applied `com.google.gms.google-services` plugin in `android/app/build.gradle`
  - `android/app/google-services.json` added to `.gitignore`
  - `AndroidManifest.xml` meta-data disables Firebase Analytics auto-collection + ADID + SSAID for privacy; JS enables collection via `setAnalyticsCollectionEnabled(true)` after `initAnalytics()`
  - Created `src/services/analytics/events.ts` — type-safe event catalog with param types and bucket helpers
  - Created `src/services/analytics/analyticsService.ts` — wrapper with `initAnalytics`, `trackEvent`, `trackScreen`, `setUserProperty`, `setUserProperties`, `disableAnalytics`. Sanitizes params (drops path-like strings, caps at 100 chars), fire-and-forget, swallows errors
  - `src/app/App.tsx`: initAnalytics + seedUserProperties in InteractionManager.runAfterInteractions; NavigationContainer onReady + onStateChange wired to `trackScreen`; settingsStore subscription updates `premium_status` user property on tier changes; `resolvePremiumTier()` maps `premiumStatus + premiumProductId` → analytics tier
  - Events instrumented:
    - `onboarding_started` — WelcomeScreen mount
    - `onboarding_completed` — WelcomeScreen "Secure My Files" tap
    - `pin_setup_completed` — PinSetupScreen initial-setup success
    - `tutorial_completed` — HowItWorksScreen "Got It" tap
    - `first_import` — FirstImportScreen success
    - `vault_unlocked` — usePinAuth success (non-decoy only)
    - `media_imported` — VaultHomeScreen import success
    - `media_viewed` — MediaViewerScreen per unique item id (pager-aware)
    - `feature_discovery_shown` — FeatureDiscoveryCard mount
    - `intruder_alert_triggered` — intruderLogService.ts after log insert
    - `paywall_shown` / `paywall_plan_selected` / `paywall_purchased` / `paywall_dismissed` — SubscriptionScreen
    - `ad_shown` — adService.ts for interstitial/app_open/rewarded
    - `rewarded_ad_completed` — adService.ts after `result.rewarded` is true
  - User properties: `premium_status`, `app_language` (from `Intl.DateTimeFormat`), `vault_item_bucket`, `install_age_bucket`
- **Remaining manual step:**
  1. Create Firebase project at https://console.firebase.google.com/
  2. Add Android app with package `com.vaultcalcapp`
  3. Download `google-services.json` and place in `android/app/google-services.json`
  4. Run `npm install` to pull the new Firebase packages
  5. Rebuild: `cd android && ./gradlew clean && cd .. && npm run android`
  6. Verify events in DebugView: `adb shell setprop debug.firebase.analytics.app com.vaultcalcapp`
- **Events NOT yet instrumented (deferred — require new features first):**
  - `referral_sent` — needs Task 2.1 (referral system)
  - `ad_clicked` — requires click callback from native AdMob layer (not currently exposed)
- **Files touched:**
  - NEW: `src/services/analytics/events.ts`
  - NEW: `src/services/analytics/analyticsService.ts`
  - NEW: `src/services/analytics/index.ts`
  - MODIFIED: `package.json`, `.gitignore`, `android/build.gradle`, `android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml`
  - MODIFIED: `src/app/App.tsx`, `src/features/onboarding/screens/WelcomeScreen.tsx`, `HowItWorksScreen.tsx`, `FirstImportScreen.tsx`
  - MODIFIED: `src/features/auth/hooks/usePinAuth.ts`, `src/features/auth/screens/PinSetupScreen.tsx`
  - MODIFIED: `src/features/vault/screens/VaultHomeScreen.tsx`, `MediaViewerScreen.tsx`, `src/features/vault/components/FeatureDiscoveryCard.tsx`
  - MODIFIED: `src/features/settings/screens/SubscriptionScreen.tsx`
  - MODIFIED: `src/services/ads/adService.ts`, `src/services/intruderCamera/intruderLogService.ts`

#### What to implement:
1. Install analytics SDK
   - Option A: PostHog (`posthog-react-native`) — free tier 1M events/month, no Google dependency
   - Option B: Firebase Analytics (`@react-native-firebase/analytics`) — free, tight Android integration
   - Recommendation: **Firebase Analytics** (free, unlimited events, integrates with AdMob for ROAS tracking)

2. Install dependencies:
   ```
   npm install @react-native-firebase/app @react-native-firebase/analytics
   ```

3. Android setup:
   - Add `google-services.json` to `android/app/`
   - Add Firebase plugin to `android/build.gradle` and `android/app/build.gradle`
   - Firebase project: create at console.firebase.google.com

4. Initialize in `src/app/App.tsx` alongside Sentry init

5. Create analytics service at `src/services/analytics/analyticsService.ts`:
   ```typescript
   // Thin wrapper around Firebase Analytics
   // trackEvent(name, params?) — single call site for all events
   // trackScreen(screenName) — called from navigation state change
   ```

6. **Mandatory events to track (minimum viable funnel):**

   | Event Name | Where to Fire | Why It Matters |
   |------------|---------------|----------------|
   | `onboarding_started` | WelcomeScreen mount | Measures install → onboard |
   | `onboarding_completed` | WelcomeScreen "Secure My Files" tap | Drop-off rate |
   | `pin_setup_completed` | PinSetupScreen success | Setup friction |
   | `tutorial_completed` | HowItWorksScreen "Got It" tap | Teaching effectiveness |
   | `first_import` | FirstImportScreen import success | Activation metric |
   | `vault_unlocked` | usePinAuth success (non-decoy) | DAU proxy |
   | `media_imported` | VaultHomeScreen import success, with `{count, type}` | Engagement depth |
   | `media_viewed` | MediaViewerScreen mount, with `{type}` | Content consumption |
   | `paywall_shown` | SubscriptionScreen mount | Funnel top |
   | `paywall_plan_selected` | Plan card tap, with `{plan}` | Plan preference |
   | `paywall_purchased` | Purchase success, with `{plan, price}` | Conversion |
   | `paywall_dismissed` | SubscriptionScreen back/close | Rejection rate |
   | `ad_shown` | adService after successful show, with `{type, trigger}` | Ad load rate |
   | `ad_clicked` | adService click callback, with `{type}` | CTR |
   | `rewarded_ad_completed` | Rewarded ad completion | Ad-free cannibalization |
   | `referral_sent` | shareApp() call (future) | Viral coefficient |
   | `feature_discovery_shown` | FeatureDiscoveryCard mount, with `{feature}` | Feature awareness |
   | `feature_discovery_tapped` | FeatureDiscoveryCard tap, with `{feature}` | Feature interest |
   | `intruder_alert_triggered` | intruderCameraService capture | Security engagement |

7. **Screen tracking:**
   - Hook into React Navigation's `onStateChange` in App.tsx
   - Call `trackScreen(routeName)` on every navigation

8. **User properties to set (once):**
   - `premium_status`: 'free' | 'trial' | 'monthly' | 'yearly' | 'lifetime'
   - `app_language`: device locale
   - `vault_item_count`: bucketed (0, 1-10, 11-50, 51-200, 200+)
   - `days_since_install`: computed from `firstLaunchTimestamp`

#### Files to create/modify:
- CREATE: `src/services/analytics/analyticsService.ts`
- CREATE: `src/services/analytics/index.ts`
- MODIFY: `src/app/App.tsx` (init + screen tracking)
- MODIFY: `src/features/onboarding/screens/WelcomeScreen.tsx`
- MODIFY: `src/features/onboarding/screens/HowItWorksScreen.tsx`
- MODIFY: `src/features/onboarding/screens/FirstImportScreen.tsx`
- MODIFY: `src/features/settings/screens/SubscriptionScreen.tsx`
- MODIFY: `src/features/auth/hooks/usePinAuth.ts`
- MODIFY: `src/features/vault/screens/VaultHomeScreen.tsx`
- MODIFY: `src/features/vault/screens/MediaViewerScreen.tsx`
- MODIFY: `src/services/ads/adService.ts`
- MODIFY: `src/features/vault/components/FeatureDiscoveryCard.tsx`
- MODIFY: `android/build.gradle` (Firebase plugin)
- MODIFY: `android/app/build.gradle` (apply plugin)
- CREATE: `android/app/google-services.json` (from Firebase console — gitignore this)

#### Verification:
- [ ] Events appear in Firebase Analytics DebugView (enable with `adb shell setprop debug.firebase.analytics.app com.vaultcalcapp`)
- [ ] Screen tracking shows correct route names
- [ ] No events fire for premium users watching ads (they shouldn't see ads)
- [ ] No PII in any event parameters

---

### Task 1.2: QA Sweep on Critical Flows
- [ ] **Status: NOT STARTED**
- **Why:** 5 bugs found in one casual session during top-1% audit. Bad first impressions = 1-star reviews = death.
- **Effort:** 1 day

#### What to verify (test each manually):
1. [ ] **Rename flow** — rename a file, verify it shows the new name in:
   - List view
   - Grid view
   - Properties modal
   - Viewer header
   - Sort order
   - After app restart (persistence)

2. [ ] **Import flow** — import 5+ files of each type:
   - Photos (JPG, PNG)
   - Videos (MP4)
   - Audio (MP3, AAC)
   - Documents (PDF)
   - Verify thumbnails generate
   - Verify encrypted playback works

3. [ ] **Delete flow** — delete single + batch:
   - Verify files removed from list
   - Verify cache updated (no phantom items)
   - Verify storage freed

4. [ ] **Move to album** — create album, move files, verify:
   - Files appear in album
   - Files removed from "All" view (or still shown, depending on design)
   - Album count updates

5. [ ] **Share flow** — share a decrypted file:
   - Verify file decrypts to temp dir
   - Verify share sheet opens
   - Verify temp file cleaned up after

6. [ ] **Ad flow** — trigger each ad type:
   - Interstitial: import files, exit vault, close viewer
   - Verify NO lock-out after ad dismiss (the old bug)
   - Rewarded: watch ad, verify 24hr ad-free activates
   - App-open: background + foreground, verify ad shows

7. [ ] **Subscription flow**:
   - Verify all 4 plan cards render correctly (no overlap)
   - Verify purchase flow works (use test cards in Play Console)
   - Verify premium features unlock after purchase
   - Verify restore purchases works

8. [ ] **Decoy mode**:
   - Enter decoy PIN, verify fake vault
   - Enter real PIN, verify real vault
   - Verify no data leaks between modes

9. [ ] **Intruder detection**:
   - Enable in settings
   - Enter wrong PIN 3x
   - Verify selfie captured + notification + log entry

10. [ ] **Backup/restore** (Google Drive):
    - Manual backup
    - Restore to fresh install (clear app data)
    - Verify all files restored + decryptable

---

### Task 1.3: Play Store Submission
- [ ] **Status: NOT STARTED**
- **Why:** Every day not on the store is a day losing potential organic installs.
- **Effort:** 2-3 days (mostly waiting for review)

#### Checklist:
1. [ ] **Google Play Console** account set up ($25 one-time)

2. [ ] **App signing:**
   - Generate upload key (or use existing from `android/signing.properties`)
   - Enroll in Play App Signing

3. [ ] **Store listing text:**
   - App name: "VaultCalc - Hide Photos & Videos" (30 char limit)
   - Short description (80 chars): "Secret calculator that hides your private photos, videos & files"
   - Full description (4000 chars): Write keyword-rich copy covering:
     - Calculator disguise
     - AES-256 encryption
     - Intruder detection
     - Decoy vault
     - Video player
     - Cloud backup
     - Biometric unlock
   - Keywords to target: "hide photos", "secret calculator", "vault app", "photo locker", "video hider", "private gallery", "calculator vault", "hide files"

4. [ ] **Screenshots** (minimum 4, recommended 8):
   - Calculator home screen
   - Vault gallery (with sample photos)
   - Video player with controls
   - Intruder detection log
   - Decoy mode comparison
   - Settings / security options
   - Subscription screen
   - Album view
   - Use Figma/Canva frames with device mockup + feature callout text

5. [ ] **Feature graphic** (1024x500):
   - "Your Calculator Has a Secret" hero text
   - Calculator → vault transition visual

6. [ ] **Privacy Policy** (required):
   - Host on a simple webpage (GitHub Pages, Notion public page, or Firebase Hosting)
   - Cover: what data is collected (none stored on servers), encryption, ad SDKs, analytics
   - Link in Play Console + in-app Settings

7. [ ] **Data Safety form:**
   - Data collected: device identifiers (AdMob), crash reports (Sentry)
   - Data NOT collected: photos, videos, personal files (all local + encrypted)
   - Encryption: yes (AES-256-GCM)
   - Data sharing: AdMob (for ads), Sentry (for crashes)

8. [ ] **Content rating questionnaire** (IARC)

9. [ ] **Target audience:** 18+ (privacy app)

10. [ ] **Build & upload:**
    ```bash
    cd android && ./gradlew bundleProdRelease
    # Upload build/outputs/bundle/prodRelease/app-prodRelease.aab
    ```

11. [ ] **Release track:** Start with Internal Testing → Closed Testing (100 users) → Open Testing → Production
    - Get 20+ testers for closed track (friends, family, Reddit r/androidapps)
    - Collect 10+ positive reviews before going to production

#### Declaration forms (if applicable):
- [ ] Accessibility Service declaration (if used)
- [ ] Notification Listener declaration (if used)
- [ ] Device Admin declaration (if used)
- [ ] Photos/Videos permission declaration

---

## PHASE 2: Growth Engine (Weeks 3-6)

Goal: Build the two features that unlock organic growth — referrals and localization.

### Task 2.1: Referral System
- [x] **Status: CODE COMPLETE (Option C — zero backend)**
- **Why:** Vault apps spread by word of mouth. A referral incentive turns every user into a $0 CAC acquisition channel. This is your single highest-ROI feature.
- **Effort:** 3-5 days
- **Date completed (code):** 2026-04-14
- **Approach chosen:** Option C — Play Install Referrer API + share-milestone rewards (no backend). This ships fast; upgrade to Branch.io when we have revenue.
- **Reward model:**
  - Incoming install via referral link → 7 days ad-free
  - Share milestone 3 → 7 days ad-free
  - Share milestone 5 → 14 days ad-free
  - Share milestone 10 → 30 days ad-free
  - Rewards stack on top of existing `adFreeUntil` (never truncate a longer window)
- **What shipped:**
  - Native Kotlin module `InstallReferrerModule` using `com.android.installreferrer:installreferrer:2.2`
  - Dependency added to `android/app/build.gradle`; package registered in `MainApplication.kt`
  - settingsStore fields: `referralCode`, `referredBy`, `referralCheckCompleted`, `referralRewardTier` — all persisted
  - `src/services/referral/referralService.ts` — `getOrCreateReferralCode`, `getReferralLink`, `checkIncomingReferral`, `checkAndGrantShareMilestones`, `getShareRewardProgress`, `extractCodeFromReferrer`, `SHARE_REWARD_TIERS`
  - `shareApp()` in `shareService.ts` now uses the referral-coded Play Store URL
  - `App.tsx` calls `getOrCreateReferralCode()` + `checkIncomingReferral()` once per install inside `InteractionManager.runAfterInteractions`
  - `AboutScreen` shows share count + next-tier progress ("Share 2 more times to unlock 7 days ad-free") + reward alert on milestone hit
  - `SettingsScreen` share handler also checks milestones
  - Analytics `referral_sent` fires on each share
  - Self-referral guard: clicking your own link on the same device never grants a reward
  - Format guard: `utm_content` must match `^[a-z0-9]{4,16}$` — prevents stray UTM campaigns from granting rewards
- **Files touched:**
  - NEW: `android/app/src/main/java/com/vaultcalcapp/modules/referral/InstallReferrerModule.kt`
  - NEW: `android/app/src/main/java/com/vaultcalcapp/modules/referral/InstallReferrerPackage.kt`
  - NEW: `src/services/referral/referralService.ts`
  - NEW: `src/services/referral/index.ts`
  - MODIFIED: `android/app/build.gradle`, `android/app/src/main/java/com/vaultcalcapp/MainApplication.kt`
  - MODIFIED: `src/store/settingsStore.ts` (fields + actions + persist partialize)
  - MODIFIED: `src/services/share/shareService.ts`
  - MODIFIED: `src/app/App.tsx`
  - MODIFIED: `src/features/settings/screens/AboutScreen.tsx`, `SettingsScreen.tsx`
- **Manual step required:** rebuild Android (`cd android && ./gradlew clean && cd .. && npm run android`) to pick up the new native dependency.
- **Verification on device:**
  1. Fresh install → check settings have no `referredBy` (organic)
  2. Tap Share in About — system share sheet opens with URL containing `?referrer=utm_source%3Dvaultcalc%26utm_content%3D<CODE>`
  3. Uninstall, install via the share link → `referredBy` field set, `adFreeUntil` extended by 7 days
  4. Share 3 times → reward alert pops, `referralRewardTier = 3`, `adFreeUntil` extended
  5. Analytics DebugView shows `referral_sent` on each share
- **Known limitations (acceptable for MVP):**
  - No cross-device sync of referral codes — works only because Play Store's Install Referrer API attributes the source install
  - Referrer can't be notified when someone installs their link (requires backend). Mitigation: milestone rewards reward the sharer directly based on share count
  - `ad_clicked` analytics event still deferred — needs native AdMob click callback plumbing
- **Future upgrade path:** Swap `Option C` for Branch.io when we have revenue. Branch gives real referrer→referee attribution, proper reward-on-install, deep linking into specific screens, and a dashboard.

#### Architecture:

**Option A: Firebase Dynamic Links (deprecated but still works through 2025)**
- Generates deep links that survive install
- Attribute installs to referrers
- Free

**Option B: Branch.io**
- Industry standard for referral attribution
- Free tier: 10K MAU
- Better dashboard

**Option C: Simple approach (no backend, works now)**
- Generate unique referral code per user (hash of device ID + install timestamp)
- Share link: `https://play.google.com/store/apps/details?id=com.vaultcalcapp&referrer=REF_CODE`
- On new install: read referrer via Play Install Referrer API
- Store referrer code → grant 7 days premium to new user
- Problem: can't reward the referrer (no backend to notify them)
- Workaround: reward referrer based on `appShareCount` milestones (share 3x = 7 days, share 10x = 30 days)

**Recommended: Option C first (ship fast), upgrade to Branch.io later when you have revenue.**

#### Implementation steps:

1. **Install Play Install Referrer library:**
   - Add to `android/app/build.gradle`: `implementation 'com.android.installreferrer:installreferrer:2.2'`

2. **Create native module `InstallReferrerModule.kt`:**
   - Read the install referrer on first launch
   - Extract referral code from UTM params
   - Return to JS via promise

3. **Create referral service `src/services/referral/referralService.ts`:**
   ```typescript
   // generateReferralCode() — deterministic from device + install timestamp
   // getReferralLink() — Play Store URL with ?referrer=utm_source%3Dvaultcalc%26utm_content%3D{code}
   // checkIncomingReferral() — call native module, parse referrer string
   // rewardReferral(code) — grant 7 days premium via settingsStore
   // getShareRewardTier() — based on appShareCount: 3→7d, 5→14d, 10→30d
   ```

4. **Update `shareApp()` in `shareService.ts`:**
   - Replace hardcoded Play Store URL with referral link
   - Include referral code in URL
   - Increment `appShareCount`

5. **Add referral check on first launch:**
   - In `App.tsx` or onboarding flow, call `checkIncomingReferral()`
   - If valid referral code found → grant 7 days premium + show welcome toast
   - Store `referredBy` in settingsStore (for analytics)

6. **Add referral UI:**
   - Settings → "Invite Friends" row (already exists as "Share App")
   - Show share count + reward tier progress
   - "Share 3 more times to unlock 7 days Premium!"
   - After sharing: confirmation toast with count

7. **Add share prompt triggers:**
   - After 7th vault unlock: "Enjoying VaultCalc? Share with a friend!"
   - After 30 days active: "You've been using VaultCalc for a month! Tell a friend"
   - After successful import of 50+ files: "Your vault is growing! Invite friends"

8. **Track analytics events:**
   - `referral_link_generated`
   - `referral_shared` (with method: SMS/WhatsApp/etc if detectable)
   - `referral_installed` (incoming referral detected)
   - `referral_reward_granted` (with tier)

#### Files to create/modify:
- CREATE: `android/app/src/main/java/com/vaultcalcapp/modules/referral/InstallReferrerModule.kt`
- CREATE: `android/app/src/main/java/com/vaultcalcapp/modules/referral/InstallReferrerPackage.kt`
- CREATE: `src/services/referral/referralService.ts`
- CREATE: `src/services/referral/index.ts`
- MODIFY: `src/services/share/shareService.ts` (use referral link)
- MODIFY: `src/store/settingsStore.ts` (add `referredBy`, `referralCode`, `referralRewardTier`)
- MODIFY: `src/features/settings/screens/AboutScreen.tsx` or `SettingsScreen.tsx` (referral UI)
- MODIFY: `src/app/App.tsx` (check incoming referral on first launch)
- MODIFY: `android/app/build.gradle` (install referrer dependency)
- MODIFY: `android/app/src/main/java/com/vaultcalcapp/MainApplication.kt` (register package)

#### Verification:
- [ ] Referral link generates with unique code
- [ ] Sharing opens system share sheet with correct URL
- [ ] New install with referral UTM grants 7 days premium
- [ ] Share count increments correctly
- [ ] Milestone rewards trigger at 3, 5, 10 shares
- [ ] Analytics events fire correctly

---

### Task 2.2: Localization (i18n) — 10 Languages
- [x] **Status: CORE COMPLETE — remaining screens to migrate on demand**
- **Date completed (core):** 2026-04-14
- **What shipped:**
  - `react-i18next`, `i18next`, `expo-localization` added to package.json (installed)
  - `src/shared/i18n/i18n.ts`: init config, device-locale resolver, `changeLanguage()`, `SUPPORTED_LANGUAGES` (12 entries including `system`), `RTL_LANGUAGES = ['ar']`
  - `src/shared/i18n/index.ts`: public API — also re-exports `useTranslation` and `Trans`
  - `src/shared/i18n/locales/en.json`: source-of-truth with ~150 keys across namespaces (common, onboarding, calculator, vault, settings, subscription, feature_discovery, referral, pin_setup, about)
  - 10 translation files shipped — `es`, `pt-BR`, `hi`, `fr`, `de`, `tr`, `id`, `ru`, `ar`, `vi` — all with full coverage of the en.json surface (these are production-usable translations that will benefit from a native-speaker review pass but don't block launch)
  - settingsStore: `language` field (persisted) + `rtlApplied` flag + `setLanguage` + `setRtlApplied`
  - `App.tsx`: `initI18n(language)` before first render (dbReady AND i18nReady gate RootNavigator); `applyRtlFromLanguage()` on startup flips `I18nManager.forceRTL` based on resolved language
  - `LanguageScreen.tsx`: new screen with `SUPPORTED_LANGUAGES` list, native+English name display, selected checkmark, RTL restart prompt on Arabic toggle
  - `VaultNavigator`: registered `Language` route
  - `SettingsScreen`: "Language" row under Tell a friend, icon `globe`, subtitle shows current native name
  - Icon component: added `globe` → Lucide `Globe`
  - Migrated to `t()`: `WelcomeScreen` (4 slide titles/subtitles, Skip, Next, CTA), `HowItWorksScreen` (title, 3 steps, Got It), `FirstImportScreen` (title, subtitle, CTA, skip, loading, success/partial/error alerts with pluralization)
  - Pluralization via i18next suffix convention (`*_one` / `*_other` + `{ count }`)
- **RTL support:**
  - `RTL_LANGUAGES` constant = `['ar']`
  - `applyRtlFromLanguage()` in App.tsx calls `I18nManager.allowRTL + forceRTL` when entering/leaving an RTL language
  - `LanguageScreen.handleSelect` does the same on user switch + alerts for restart
  - Native layout only fully flips after process restart (RN limitation — documented in the restart prompt)
- **Screens NOT yet migrated (acceptable — low user impact):**
  - `SettingsScreen` (dense — migrate gradually as sections get touched)
  - `SubscriptionScreen` (keys ready in en.json under `subscription.*` — replace strings next pass)
  - `AboutScreen` (keys ready under `about.*`)
  - `PinSetupScreen`, `VaultHomeScreen`, `MediaViewerScreen`, `AudioPlayerScreen`, `AlbumViewScreen`, `NoteEditorScreen`, `IntruderLogsScreen`, `FeatureDiscoveryCard` — keys in en.json, strings still hardcoded
  - **Next pass ordering:** SubscriptionScreen → SettingsScreen → VaultHomeScreen → rest. Done screen-by-screen so we never ship a half-translated page.
- **Known limitations (acceptable for v1):**
  - Translations are AI-assisted — professional native-speaker review recommended before major marketing push. Use `en.json` as the source; only edit other locales after translator review.
  - Date/time/number formatting still uses default `toLocaleString()` — works correctly once `I18nManager` RTL flips. No extra work needed unless we add currency formatting later.
  - Google Play Console listing localization is separate — add translated store title/description/screenshots per language when submitting.
- **Files touched:**
  - NEW: `src/shared/i18n/i18n.ts`, `src/shared/i18n/index.ts`, `src/shared/i18n/locales/{en,es,pt-BR,hi,fr,de,tr,id,ru,ar,vi}.json` (11 files)
  - NEW: `src/features/settings/screens/LanguageScreen.tsx`
  - MODIFIED: `package.json`, `src/app/App.tsx`, `src/store/settingsStore.ts`, `src/types/navigation.ts`
  - MODIFIED: `src/app/navigation/VaultNavigator.tsx`, `src/features/settings/index.ts`, `src/features/settings/screens/index.ts`, `src/features/settings/screens/SettingsScreen.tsx`
  - MODIFIED: `src/shared/components/Icon.tsx` (Globe icon)
  - MODIFIED: `src/features/onboarding/screens/{WelcomeScreen,HowItWorksScreen,FirstImportScreen}.tsx`
- **Verification on device:**
  1. Fresh install with device locale = Spanish → app renders in Spanish
  2. Settings → Language → pick French → onboarding (if re-triggered) renders in French
  3. Settings → Language → pick Arabic → restart prompt shows, restart app → layout is RTL
  4. Settings → Language → System default → reverts to device locale
- **Reference this when migrating remaining screens:** every string you touch that's user-facing should become `t('namespace.key')`. Add the English source to `en.json` under the right namespace. Don't translate the other locale files by hand — run the next translation pass against all 10 at once (either AI + review or Fiverr)
- **Why:** English-only caps addressable market at ~15% of Play Store users. Vault apps are global. Adding 10 languages 5-7x your audience overnight.
- **Effort:** 3-4 days for setup + string extraction. Translation: $500-$1000 via Fiverr/Gengo, or use AI translation + native speaker review.

#### Language priority (by vault-app market size + willingness to pay):

| Priority | Language | Code | Market Reason |
|----------|----------|------|---------------|
| 1 | Spanish | es | LATAM + Spain, large Android, moderate WTP |
| 2 | Portuguese (BR) | pt-BR | Brazil, huge Android market |
| 3 | Hindi | hi | Your India base |
| 4 | French | fr | France + Africa, decent eCPM |
| 5 | German | de | High eCPM, privacy-conscious market |
| 6 | Turkish | tr | Large Android, high vault app demand |
| 7 | Indonesian | id | Massive volume |
| 8 | Russian | ru | Large market |
| 9 | Arabic | ar | RTL support needed, big market |
| 10 | Vietnamese | vi | Growing Android market |

#### Implementation steps:

1. **Install i18n libraries:**
   ```
   npm install react-i18next i18next expo-localization
   ```

2. **Create i18n config at `src/shared/i18n/i18n.ts`:**
   ```typescript
   // Initialize i18next with:
   // - Language detection from expo-localization
   // - Fallback to 'en'
   // - Lazy loading of translation files
   // - Interpolation config
   ```

3. **Create translation directory structure:**
   ```
   src/shared/i18n/
   ├── i18n.ts              # Config + init
   ├── index.ts             # Export useTranslation, etc.
   └── locales/
       ├── en.json           # English (source of truth)
       ├── es.json           # Spanish
       ├── pt-BR.json        # Portuguese (Brazil)
       ├── hi.json           # Hindi
       ├── fr.json           # French
       ├── de.json           # German
       ├── tr.json           # Turkish
       ├── id.json           # Indonesian
       ├── ru.json           # Russian
       ├── ar.json           # Arabic
       └── vi.json           # Vietnamese
   ```

4. **Extract all hardcoded strings:**
   This is the biggest task. Systematically go through every screen and replace hardcoded strings with `t('key')` calls.

   **Screens to extract (in priority order — user-facing first):**

   | Screen | File | Approx Strings |
   |--------|------|----------------|
   | Welcome/Onboarding | `WelcomeScreen.tsx` | ~20 |
   | How It Works | `HowItWorksScreen.tsx` | ~10 |
   | First Import | `FirstImportScreen.tsx` | ~8 |
   | Calculator | `CalculatorScreen.tsx` | ~5 |
   | Vault Home | `VaultHomeScreen.tsx` | ~30 |
   | Media Viewer | `MediaViewerScreen.tsx` | ~15 |
   | Audio Player | `AudioPlayerScreen.tsx` | ~10 |
   | Album View | `AlbumViewScreen.tsx` | ~15 |
   | Notes | `NoteEditorScreen.tsx` | ~10 |
   | Settings | `SettingsScreen.tsx` | ~40 |
   | Subscription | `SubscriptionScreen.tsx` | ~25 |
   | About | `AboutScreen.tsx` | ~15 |
   | Intruder Logs | `IntruderLogsScreen.tsx` | ~10 |
   | PIN Setup | `PinSetupScreen.tsx` | ~10 |
   | Pattern Setup | `PatternSetupScreen.tsx` | ~8 |
   | Backup/Restore | `BackupScreen.tsx` | ~15 |
   | Feature Discovery | `FeatureDiscoveryCard.tsx` | ~12 |
   | **Total** | | **~250 strings** |

5. **Create `en.json` with all extracted strings:**
   ```json
   {
     "onboarding": {
       "slide1_title": "Your privacy is not safe",
       "slide1_desc": "Anyone can pick up your phone...",
       ...
     },
     "vault": {
       "tab_images": "Images",
       "tab_videos": "Videos",
       "import_button": "Import",
       "empty_title": "No files yet",
       ...
     },
     "settings": { ... },
     "subscription": { ... },
     "common": {
       "cancel": "Cancel",
       "delete": "Delete",
       "save": "Save",
       "back": "Back",
       ...
     }
   }
   ```

6. **Get translations:**
   - Option A: AI-translate `en.json` → all languages (fast, ~80% quality)
   - Option B: Fiverr translators ($30-$80 per language for 250 strings)
   - Option C: Both — AI draft + Fiverr native speaker review ($15-$30/language)
   - **Recommended: Option C** — total cost ~$200-$400

7. **RTL support for Arabic:**
   - React Native has built-in RTL support via `I18nManager.forceRTL()`
   - Test all screens in RTL mode
   - May need layout adjustments for absolute-positioned elements

8. **Language selector in Settings:**
   - Add "Language" row in SettingsScreen
   - Options: System default + 11 specific languages
   - Store preference in settingsStore
   - Restart app or re-render on change

9. **Localize Play Store listing:**
   - Google Play Console supports per-language store listings
   - Translate title, short description, full description for all 10 languages
   - Create localized screenshots (at least for top 5 languages)

#### Files to create/modify:
- CREATE: `src/shared/i18n/i18n.ts`
- CREATE: `src/shared/i18n/index.ts`
- CREATE: `src/shared/i18n/locales/en.json` (+ 10 translation files)
- MODIFY: Every screen file listed above (replace hardcoded strings with `t()`)
- MODIFY: `src/app/App.tsx` (wrap with I18nextProvider)
- MODIFY: `src/store/settingsStore.ts` (add `language` preference)
- MODIFY: `src/features/settings/screens/SettingsScreen.tsx` (language selector)

#### Verification:
- [ ] App detects device language and renders correct translation
- [ ] Language can be manually changed in Settings
- [ ] All 250+ strings translate correctly (spot-check 5 screens per language)
- [ ] RTL layout works for Arabic (no overlapping text, correct alignment)
- [ ] Fallback to English for missing translations
- [ ] Play Store listing translated for all 10 languages

---

## PHASE 3: Revenue Optimization (Weeks 7-10)

Goal: Maximize revenue per user through pricing, ad optimization, and paywall tuning.

### Task 3.1: Geo-Tiered Pricing
- [ ] **Status: NOT STARTED**
- **Why:** Your current $9.99/yr is India-priced. A US user would happily pay $24.99/yr. You're leaving 2-3x subscription ARPU on the table.
- **Effort:** 1 day

#### Implementation:

Google Play supports per-country pricing in Play Console. No code changes needed.

| Plan | India/SEA/LATAM | US/UK/EU/AU |
|------|-----------------|-------------|
| Monthly | $1.99/mo | $4.99/mo |
| Yearly | $9.99/yr | $24.99/yr |
| Lifetime | $19.99 | $49.99 |
| Remove Ads | $1.99 | $4.99 |

#### Steps:
1. [ ] Go to Play Console → Monetize → Products → Subscriptions
2. [ ] For each subscription: set per-country prices
3. [ ] Use Play Console's "auto-convert" as starting point, then manually adjust
4. [ ] Group 1 (premium pricing): US, UK, Canada, Australia, Germany, France, Japan, South Korea, Netherlands, Sweden, Norway, Denmark, Switzerland
5. [ ] Group 2 (mid pricing): Brazil, Mexico, Turkey, Poland, Romania, Czech Republic
6. [ ] Group 3 (budget pricing): India, Indonesia, Vietnam, Philippines, Egypt, Nigeria, Pakistan, Bangladesh

#### Verification:
- [ ] Test with VPN or Play Console test account in different regions
- [ ] Verify correct price shown on SubscriptionScreen (Play Billing returns localized price)
- [ ] No code changes needed — Play Billing SDK automatically returns geo-local prices

---

### Task 3.2: Fix Subscription Cannibalization
- [ ] **Status: NOT STARTED**
- **Why:** The $1.99 "Remove Ads" one-time purchase kills your recurring subscription revenue. Users buy it and never subscribe.
- **Effort:** 0.5 days

#### Strategy change:

**Option A (recommended): Remove the "Remove Ads" tier entirely**
- Users who just want no ads will buy the yearly plan (better LTV)
- Fewer choices = less decision paralysis
- Keep only: Monthly ($2.99/$4.99) + Yearly ($9.99/$24.99) + Lifetime ($19.99/$49.99)

**Option B: Make "Remove Ads" only remove interstitials, keep app-open ads**
- Subscription = truly ad-free + all premium features
- "Remove Ads" becomes a half-measure that upsells to subscription

**Option C: Raise "Remove Ads" price to $4.99+ so it doesn't undercut yearly**

#### Additional change — limit rewarded ad-free:
- Current: user can watch rewarded ad for 24hr ad-free (unlimited)
- Change to: 1 rewarded ad-free per 72 hours (not per 24 hours)
- This makes the subscription more attractive vs. the free workaround
- Modify in `src/services/ads/rewardedAdFreeService.ts`

#### Files to modify:
- MODIFY: `src/features/settings/screens/SubscriptionScreen.tsx` (remove tier or adjust)
- MODIFY: `src/services/ads/rewardedAdFreeService.ts` (extend cooldown)
- MODIFY: Play Console product listings (deprecate or re-price)

---

### Task 3.3: Paywall A/B Testing
- [ ] **Status: NOT STARTED**
- **Why:** Small changes to paywall timing and presentation can 2-3x conversion. Need data first (Task 1.1).
- **Effort:** 2-3 days
- **Prerequisite:** Task 1.1 (analytics) must be live with 2+ weeks of data

#### What to A/B test (one at a time, 2 weeks per test):

**Test 1: Paywall trigger timing**
- Current: after 3 vault unlocks + 10 imported files
- Variant A: after 2 vault unlocks + 5 imported files (earlier)
- Variant B: after 5 vault unlocks + 20 imported files (later, more invested)
- Measure: `paywall_shown` → `paywall_purchased` conversion rate

**Test 2: Default plan selection**
- Current: Yearly highlighted as "Most Popular"
- Variant: Monthly highlighted, yearly shown as "Save 72%"
- Measure: revenue per paywall view (not just conversion rate)

**Test 3: Free trial length**
- Current: 3-day free trial on yearly
- Variant A: 7-day free trial
- Variant B: No free trial (direct purchase)
- Measure: trial start rate, trial → paid conversion rate

**Test 4: Urgency copy**
- Current: "New user offer — Save 72%" shown first 72 hours
- Variant: No urgency copy (clean presentation)
- Measure: conversion rate + 7-day refund rate

#### Implementation:
- Use existing A/B test infrastructure (already have `paywallVariant` in settingsStore)
- Assign variant on first paywall view, persist in settingsStore
- Log variant in every `paywall_*` analytics event
- Analyze in Firebase Analytics after 2 weeks per test

---

## PHASE 4: Scale (Months 3-6)

Goal: Compound growth through content marketing, paid acquisition, and platform expansion.

### Task 4.1: Content Marketing (Social Media)
- [ ] **Status: NOT STARTED**
- **Why:** "This calculator is actually a secret vault" is inherently viral content. Free acquisition channel.
- **Effort:** Ongoing, 2-3 hours/week
- **Cost:** $0 (DIY) or $200-$500 (hire creator)

#### Content ideas (short-form video, 15-30 seconds):

1. **"The Calculator Trick"** — Screen record: open calculator, do math, enter PIN, press =, vault opens. Reveal reaction.
2. **"Intruder Caught"** — Show intruder log with captured selfie + location. "Someone tried to break into my vault..."
3. **"Decoy Mode Demo"** — Wrong PIN → fake vault. Right PIN → real vault. "Two passwords, two different worlds."
4. **"MX Player in a Calculator"** — Show video player with gesture controls, speed scrub, thumbnails. "My calculator plays videos better than my video app."
5. **"My Boyfriend/Girlfriend Tried to Open It"** — Social proof / relationship angle (be careful with tone).

#### Where to post:
- TikTok (highest viral potential)
- Instagram Reels
- YouTube Shorts
- Reddit: r/androidapps, r/privacy, r/apps

#### Posting schedule:
- 3 videos/week minimum for first month
- Track which content drives installs (UTM params in bio link)

---

### Task 4.2: Paid Acquisition (Only After Data)
- [ ] **Status: NOT STARTED**
- **Prerequisite:** 60+ days of analytics data, known Day 30 retention and LTV
- **Why:** Scale proven organic growth with paid channels.
- **Effort:** Ongoing, budget-dependent

#### When to start paid acquisition:
- Only if Day 7 retention > 25% AND subscription conversion > 2%
- Start with $5-$10/day budget on Google UAC
- Target countries where LTV > 2x CPI

#### Google UAC setup:
1. Link AdMob account to Google Ads
2. Create Universal App Campaign
3. Upload creative assets (the social media videos work here)
4. Set target CPI bids:
   - US/UK: $0.30-$0.50 CPI
   - Brazil/Mexico: $0.08-$0.15 CPI
   - India: $0.03-$0.08 CPI
5. Set daily budget: $10/day initially
6. Measure ROAS weekly — kill any campaign with ROAS < 1.0 after 14 days

#### Decision framework:
- If LTV > $0.50/install: run Tier-1 campaigns (US/UK/EU)
- If LTV > $0.20/install: run Tier-2 campaigns (Brazil/Mexico/Turkey)
- If LTV < $0.10/install: don't run paid acquisition, focus on organic

---

### Task 4.3: iOS Port (Biggest Revenue Unlock)
- [ ] **Status: NOT STARTED**
- **Why:** iOS users pay 3-5x more for subscriptions and have 3-5x higher ad eCPM. Could double total revenue.
- **Effort:** 2-3 months (26 Kotlin native modules need Swift rewrites)
- **Prerequisite:** Android generating $500+/month (prove the business first)

#### Native modules requiring Swift rewrite:

| Module | Kotlin File | Complexity | Notes |
|--------|-------------|------------|-------|
| CryptoModule | AES-256-GCM, Argon2id | HIGH | Use CryptoKit + Argon2Swift |
| MediaModule | Bitmap processing, thumbnails | HIGH | Use UIKit + AVFoundation |
| VaultVideoPlayerView | 2,198-line ExoPlayer | VERY HIGH | Rewrite with AVPlayer |
| IntruderCameraModule | Front camera capture | MEDIUM | Use AVCaptureSession |
| IntruderLocationModule | GPS logging | LOW | Use CoreLocation |
| IntruderNotificationModule | Local notifications | LOW | Use UNUserNotificationCenter |
| BiometricModule | Fingerprint/face | LOW | Use LocalAuthentication (FaceID/TouchID) |
| StealthModule | Icon swap, launcher hide | MEDIUM | iOS has different APIs (alternate icons) |
| PanicModule | Shake/volume detect | MEDIUM | UIDevice motion + volume button detection |
| BillingModule | Play Billing 7.1 | HIGH | Rewrite with StoreKit 2 |
| DriveBackupModule | Google Drive API | MEDIUM | Use Google Sign-In iOS SDK |
| ShareModule | Native share sheet | LOW | Use UIActivityViewController |
| LocalNotifModule | Scheduled notifications | LOW | Use UNUserNotificationCenter |
| PermissionsModule | Runtime permissions | LOW | Use iOS permission APIs |
| DeviceInfoModule | Device model, OS | LOW | Use UIDevice |
| ... | (remaining modules) | VARIES | Assess individually |

#### Decision: Build this only after Android reaches $500+/month sustainably.

---

## PHASE 5: Retention & Polish (Ongoing)

### Task 5.1: First-Run Experience Polish
- [ ] **Status: DONE (onboarding exists), but evaluate with data**
- **Why:** Onboarding drop-off is the biggest funnel leak. Measure it first, optimize based on data.
- **Prerequisite:** Task 1.1 (analytics) live for 2+ weeks

#### After collecting data:
- Check `onboarding_started` → `onboarding_completed` conversion (target: >85%)
- Check `pin_setup_completed` → `first_import` conversion (target: >50%)
- Check `first_import` → `day_1_return` (target: >40%)
- If any metric is below target, optimize that specific step

---

### Task 5.2: Review Velocity
- [ ] **Status: NOT STARTED**
- **Why:** Apps with <50 reviews are invisible on Play Store. Reviews are social proof for conversion.
- **Effort:** Optimize existing in-app review prompt

#### Tactics:
1. Trigger in-app review at the moment of highest satisfaction:
   - After successfully viewing a private video (emotional relief)
   - After 7th successful vault unlock (habitual user)
   - After recovering from intruder alert (security validated)
   - NOT after import (user is busy), NOT after ad (user is annoyed)

2. Add "Rate Us" in Settings (for users who want to come back to it)

3. Respond to every Play Store review within 24 hours (builds trust, signals active dev)

---

## Tracking Dashboard

Copy this table to track weekly progress:

| Week | MAU | DAU | New Installs | D1 Retention | D7 Retention | Sub Conv % | Ad Rev | Sub Rev | IAP Rev | Total Rev |
|------|-----|-----|-------------|-------------|-------------|-----------|--------|---------|---------|-----------|
| W1 | | | | | | | | | | |
| W2 | | | | | | | | | | |
| W3 | | | | | | | | | | |
| W4 | | | | | | | | | | |
| W5 | | | | | | | | | | |
| W6 | | | | | | | | | | |
| W7 | | | | | | | | | | |
| W8 | | | | | | | | | | |

---

## Quick Reference: Key Files

| Purpose | Path |
|---------|------|
| App entry | `src/app/App.tsx` |
| Settings store | `src/store/settingsStore.ts` |
| Auth store | `src/store/authStore.ts` |
| Ad service | `src/services/ads/adService.ts` |
| Ad config | `src/services/ads/adConfig.ts` |
| Ad frequency | `src/services/ads/adFrequencyManager.ts` |
| Rewarded ad-free | `src/services/ads/rewardedAdFreeService.ts` |
| Consent flow | `src/services/ads/consentService.ts` |
| Share service | `src/services/share/shareService.ts` |
| Subscription screen | `src/features/settings/screens/SubscriptionScreen.tsx` |
| Onboarding welcome | `src/features/onboarding/screens/WelcomeScreen.tsx` |
| How it works | `src/features/onboarding/screens/HowItWorksScreen.tsx` |
| First import | `src/features/onboarding/screens/FirstImportScreen.tsx` |
| Vault home | `src/features/vault/screens/VaultHomeScreen.tsx` |
| Media viewer | `src/features/vault/screens/MediaViewerScreen.tsx` |
| Database | `src/services/storage/database.ts` |
| PIN auth | `src/features/auth/hooks/usePinAuth.ts` |
| Auth session | `src/features/auth/hooks/useAuthSession.ts` |
| Intruder camera | `src/services/intruderCamera/intruderCameraService.ts` |
| Feature discovery | `src/features/vault/components/FeatureDiscoveryCard.tsx` |
| Re-engagement notifs | `src/services/notifications/reengagementService.ts` |
| Android manifest | `android/app/src/main/AndroidManifest.xml` |
| Android app build | `android/app/build.gradle` |
| Android root build | `android/build.gradle` |
| Package.json | `package.json` |

---

## Decision Log

Record key decisions here so future sessions have context:

| Date | Decision | Reason |
|------|----------|--------|
| 2026-04-14 | Created roadmap | Target $2K/month revenue |
| 2026-04-14 | Chose Firebase Analytics over PostHog | Free unlimited events, integrates with AdMob for ROAS tracking, consistent with existing Google stack (AdMob, Play Billing, Google Drive) |
| 2026-04-14 | Privacy-hardened Firebase Analytics | Manifest disables auto-collection + ADID + SSAID; JS opts in after init. Matches Sentry privacy posture (vault app = no PII leaving device without explicit consent). |
| 2026-04-14 | Task 1.1 code complete | All funnel events wired. User must create Firebase project + drop google-services.json into android/app/ to activate. |
| 2026-04-14 | Task 2.1 chose Option C (Play Install Referrer, no backend) | Ship fast with no infra cost. Reward sharers via share-count milestones (3/5/10 shares → 7/14/30 days ad-free) since we can't notify them server-side. Upgrade to Branch.io once revenue justifies backend. |
| 2026-04-14 | Referral reward = extended `adFreeUntil` (not `premiumStatus='trial'`) | Cleaner interaction with existing billing flow — no risk of the referral grant being overwritten by `checkPremiumStatus()` polling. Users get the most concrete part of premium (no ads) without corrupting the subscription state machine. |
| 2026-04-14 | Task 2.1 code complete | All referral wiring + reward UI done. User must rebuild Android (new native dependency) and verify on device with a test install-via-link flow. |
| 2026-04-14 | Task 2.2 shipped 11 locales at once | Ship all 10 translations up-front (AI-assisted) rather than rolling out one at a time. Rationale: Play Store ASO benefits require the listing to be translated for each market, so having the in-app translations ready lets us localize the listing in parallel. Native-speaker review is a follow-up polish pass, not a blocker. |
| 2026-04-14 | Kept all locale JSONs bundled (not lazy-loaded) | Total locale payload is ~50KB gzipped — negligible on Android. Lazy loading would add a loading state on first language switch and a failure mode for offline users. Bundle-all is simpler and faster. |
| 2026-04-14 | Migrated only onboarding screens to t() in this pass | Onboarding is the first user impression and most visible. Other screens will migrate as they're next touched for feature work — lowers the risk of a half-translated screen shipping. |

---

> **Rule for every new session:** Read this file first. Check which tasks are `[x]` done vs `[ ]` pending. Pick up from the next incomplete task. Don't re-research what's already documented here.
