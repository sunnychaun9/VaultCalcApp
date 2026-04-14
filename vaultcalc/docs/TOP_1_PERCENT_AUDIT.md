# VaultCalc — Top 1% Audit

> Brutal, evidence-based audit grounded in code actually touched during the audit session: video player, media viewer, album view, subscription screen, rename flow, ad service, auth session, useMediaQuery, settings store, premium billing, and native modules — plus systematic sub-audits on caching, animations, referrals, and video-player internals. Every critique cites concrete code or observed bugs.

---

## 1. Product Clarity & Positioning

The "calculator that hides your files" premise is strong and pre-validated — Calculator+ (Smart Hide), HideX, and Vaulty have proven the market. The unique angle within that niche is **Decoy Mode (dual PIN → real vault vs fake vault)**, which is a legitimate differentiator: most competitors have a decoy mode, but few integrate it cleanly at the auth store layer (`authStore.isDecoyMode` propagated through every query key in `useMediaQuery.ts:46`).

But the value is **not instantly clear to a non-technical user** on first open. There is no first-run teaching flow that demonstrates: (a) enter your PIN via the calculator `=` button, (b) this is what decoy vs real looks like. `isFirstLaunch` is referenced in `App.tsx:87` to gate app-open ads, but nothing explains the trick. A confused user on Day 0 is an uninstall on Day 1.

**Score: 7/10 — Verdict: Strong**

---

## 2. UX/UI Quality (Critical)

There is a clear gap between the **infrastructure** (which is genuinely good) and the **execution** (which is inconsistent).

**What's good, concretely:** The animation system at `src/shared/hooks/useAnimations.ts` is thoughtful — Reanimated worklet-based, spring presets (SNAPPY/GENTLE/STIFF), shared `useListItemAnimation` with stagger capped at 15 items, `usePressAnimation` app-wide via `AnimatedPressable`. The theme system (CALC-008) with `ColorTokens` mapped types is cleaner than most production codebases. The video player's control fade uses staggered slide+fade with `DecelerateInterpolator(1.5f)` and looks premium.

**What's not good, concretely, from a single testing session:**

- The Subscription screen shipped with the check badge absolutely positioned at `right: 14`, landing directly on top of the price text on two of the four plan cards. Anyone who tapped Lifetime or Remove Ads saw a broken card.
- The Album view shipped with both a back icon **and** a "Back" text label, while `SettingsScreen.tsx:667` uses icon-only. Two different conventions inside the same app.
- `MediaViewerScreen.tsx:547` prefills the rename modal from `item?.name` while the header renders `item?.originalName`. For any pre-existing item where those diverge, the prefill is inconsistent with what the user sees.

These are not architecture issues. They are visual QA failures in code marked "complete." Top 1% apps do not ship with mismatched back buttons.

**Score: 6/10 — Verdict: Good**

---

## 3. Feature Depth & Differentiation

This is where the app punches hardest.

**Genuinely differentiated:**
- The native ExoPlayer video player in `VaultVideoPlayerView.kt` (2,198 lines) is **MX Player-tier** — thumbnail scrub with LRU cache on a dedicated `HandlerThread`, double-tap 10s skip with ripple, long-press speed scrub (0.25×–3×), vertical sliders for volume/brightness, seek bar that uses `scaleX` to bypass Yoga. Vault apps don't ship players this sophisticated. This alone raises the app's ceiling.
- Decoy Mode wired at the store level (not just a separate vault).
- Rewarded ad-free mode with anti-tamper (`validateAdFreeMode` on cold start, `App.tsx:114`) is unusually thoughtful for the ad layer.

**Missing things top-1% competitors ship:**
- No **intruder selfie** (wrong-PIN → take front camera photo). Table stakes in this niche.
- No **fake-crash decoy** (fake error screen to disguise the app from shoulder-surfers).
- No **cross-device sync**. Google Drive backup is one-way and manual-ish — not a second-device restore experience.
- No **referral loop** — `PRODUCTION_AUDIT.md:249` flagged it as a P1 TODO; still not built.
- No **widget / quick tile** for fast vault access.
- No **per-album password** (extra privacy layer some competitors use).

**Score: 7/10 — Verdict: Differentiated (not category-leading)**

---

## 4. Trust & Security Perception

Actual security appears solid: field-level encryption via `encryptField` in `database.ts:388` with per-row AAD (`media_name:${id}` pattern), `FLAG_SECURE` gated by `BuildConfig.ENABLE_FLAG_SECURE`, auto-lock with both timeout and background grace, biometric + PIN + pattern. Good.

But *perceived* trust has gaps:

- **No visible "what's encrypted" transparency screen.** Users distrust vault apps because they can't tell the difference between "encrypted" and "hidden in a folder." A Settings → Security row that shows algorithm, key derivation, what's encrypted vs not, would be a trust multiplier.
- **Recovery story is weak.** If the user forgets their PIN and hasn't set up Drive backup, the data is gone. Competitors offer security question fallback. You have no backend, so options are limited — but "you lose your phone, you lose your vault" is not communicated upfront.
- **Decoy mode's risks aren't explained.** If you accidentally import a real file while in decoy mode, it's now siloed from your real vault with no cross-import tool.
- Known native-module fragility: `BitmapFactory.decodeStream` with `inJustDecodeBounds=true` returning null used to be misinterpreted. Fixed, but the class of sharp edges is invisible to users.

**Score: 7/10 — Verdict: Trustworthy**

---

## 5. Performance & Engineering Quality

Mixed — with concrete evidence.

**Genuinely production-grade:**
- `useMediaQuery` uses `useInfiniteQuery` with `PAGE_SIZE=100`, `FlashList` with `overrideItemLayout`, JS-side LRU `thumbnailCache` capped at 1000 with `MAX_CONCURRENT_DECRYPTS=6` queue to avoid flooding the crypto bridge.
- Two-pass bitmap decoding (`inJustDecodeBounds` → `inSampleSize`) in `MediaModule.kt:68`, bitmaps recycled, JPEG q=80.
- Lazy ad SDK init — never touched on cold start, only after first eligible interaction. `tryShowInterstitial` follows a strict "never block" pattern.
- Video player releases ExoPlayer, scrubber thread, handlers, and lifecycle observer in `onDetachedFromWindow` — cleanup is actually correct.

**But in a single casual testing session, five real bugs surfaced:**

1. **Rename was broken app-wide.** `mediaItemsDb.rename()` in `database.ts:610` only updated the plaintext `name` column. The entire UI (list items, grid items, audio items, doc items, properties modal, viewer header, **and the sort comparator**) reads `originalName`, which is encrypted. Rename has *literally never visibly worked* anywhere. Fix required adding `encryptField` to the rename path.

2. **Optimistic cache update crashed on the first rename attempt.** `VaultHomeScreen.tsx:634` called `queryClient.setQueryData<MediaItem[]>(...)` and `.map` over `old` — but the query is `useInfiniteQuery`, so the cached value is `{ pages, pageParams }`. `old.map is not a function`. The optimistic path was never successfully exercised in development.

3. **Closing an interstitial ad kicked users to the Calculator.** `useAuthSession.ts:93` treats `background` for longer than `BACKGROUND_LOCK_GRACE_MS=4000` as a lock trigger. Every AdMob interstitial is a separate Activity, so every interstitial = background state, and almost all ads exceed 4s. The app locked users out of the media viewer every time an ad closed. This affected every ad impression on affected screens.

4. **Subscription plan cards had overlapping icon/price.**

5. **Album back button inconsistent with Settings back button.**

Memory file reports **"112/112 features complete, in maintenance mode."** That claim is not supported by the evidence. Five bugs surfaced from normal use in one sitting. This is the single biggest concern about the codebase.

**Score: 6/10 — Verdict: Decent** (infra is strong, QA is weak)

---

## 6. Market Readiness

- Play Billing 7.1.1 is wired with encrypted premium proof for offline verification (`premiumStatusService.ts`) — above average.
- AdMob is wired with consent flow (`runConsentFlow`), frequency caps (`adFrequencyManager`), remote feature flag kill-switch (`adFeatureFlags`), and rewarded-ad-free drift detection. Also above average.
- Re-engagement notifications across Day 1–30 exist.

**But:**
- No referral system (P1 in `PRODUCTION_AUDIT.md`).
- No Crashlytics / Sentry, no Firebase installed at all. You cannot see production crashes. For an app that just had five bugs surface in casual testing, this is a serious blind spot.
- No analytics funnel instrumentation — no "track install → onboarded → unlocked vault → imported first file → Day 1 retained."
- No localization strings file. Top-1% vault apps ship in 10–30 languages; the biggest growth in this category is non-English markets.
- No ASO assets audit (screenshots, feature graphic, store listing).

Ready to **launch**. Not ready to **compete at top-1% scale**.

**Score: 5/10 — Verdict: Needs Work**

---

## 7. Honest Top 1% Verdict

**⚠️ Close but not yet.**

The bones are better than 90% of Play Store vault apps: real native modules, field-level encryption, decoy mode, an MX-player-grade video experience, thoughtful ad architecture, Reanimated worklets, FlashList, Play Billing + encrypted proof. The ingredients for top-1% are present.

What's missing isn't engineering ambition — it's **QA discipline**, **growth loops**, **observability**, and a handful of category-standard features (intruder selfie, referrals, cross-device sync, localization). And right now, there is no production crash reporting, which means you don't even know what you don't know.

---

## 8. Brutal Truth — Top 10 Reasons This Is Not Top 1%

1. **Rename was broken on every surface in the app** (`database.ts:610` updated the wrong column; the entire UI reads `originalName`). Shipped in code marked "complete." The most damning single finding because it means nobody did a real QA pass on a primary flow.

2. **Optimistic query cache update crashed on the first rename attempt** (`VaultHomeScreen.tsx:634` typed the cache as `MediaItem[]` but it's `InfiniteData<MediaItem[]>`). The happy path was never exercised before ship.

3. **Interstitial ads kicked users out of the media viewer** (`useAuthSession.ts:93` vs `adService.showInterstitial`). Every affected ad impression broke the session. Likely negative ARPU signal without realizing it.

4. **No production crash reporting.** No Firebase, no Crashlytics, no Sentry. Flying blind on stability. After the bugs above, this is unacceptable for a shipped app.

5. **No analytics funnel.** Cannot answer Day 1 retention, Day 7 retention, install → first-unlock conversion, or import-rate per user. Top-1% teams make every decision off these numbers.

6. **Referral system does not exist** despite being P1 in `PRODUCTION_AUDIT.md:249`. The single biggest organic growth lever in this category (invite → get premium) is missing.

7. **No `onTrimMemory` / `ComponentCallbacks2` handler.** The app handles 1000+ files but does not react when Android signals memory pressure. On low-RAM devices, the OOM killer fires before caches are cleared.

8. **No intruder selfie, no fake-crash decoy, no per-album lock.** Category-standard features in top-10 vault apps. Table stakes.

9. **No cross-device experience.** Google Drive backup is one-way and manual. The moment a user buys a new phone, their vault is a restore ordeal. Competitors sync.

10. **No localization.** Android-first, global-growth category. Shipping English-only caps the addressable market at ~15% of Play Store users.

---

## 9. Upgrade Roadmap

### Quick Wins (1–7 days)
- **Add Sentry** (or Firebase Crashlytics). Non-negotiable. One afternoon.
- **QA sweep on every mutation flow**: create, rename, delete, move-to-album, share, restore. Specifically audit every `queryClient.setQueryData` call for the `InfiniteData` shape bug — there are probably more latent instances.
- **Audit every screen's header** for the back-button inconsistency. Pattern-match `navigation.goBack` across `src/features/**`.
- **Add `onTrimMemory` handler** — ~50 lines, register `ComponentCallbacks2` in `MainApplication`, emit `onMemoryPressure` event, clear `thumbnailCache` + `queryClient.clear()` on JS side.
- **Fix the `name` vs `originalName` data model confusion** — pick one field, migrate, and stop having both. Right now they're a trap for every future feature.

### Medium Improvements (2–4 weeks)
- **Build the referral system** — Google Play Install Referrer API + a ~50-line Cloudflare Worker backend. Highest-leverage growth move.
- **First-run teaching flow.** Animated demo of the calculator-facade unlock. Do not ship a vault app that doesn't teach its own trick on Day 0.
- **Intruder selfie** (3 wrong PINs → front camera photo saved to a protected log). Category table stakes.
- **Analytics funnel instrumentation** — Amplitude, PostHog, or Firebase. Track install → onboard → unlock → import → Day 1 open.
- **Localize top 10 languages** (Spanish, Portuguese BR, Hindi, Indonesian, Vietnamese, Turkish, Russian, Arabic, French, German). Critical for this category.
- **Transparency screen in Settings**: "What we encrypt, how, key derivation, what's NOT encrypted." Trust multiplier.

### Major Upgrades (1–3 months)
- **Backend + cross-device sync.** The biggest gap to category leaders. Cloudflare Workers + D1, or Supabase. Encrypted vault sync, not plaintext.
- **Fake-crash decoy mode.** Serious category differentiator.
- **Per-album password + self-destruct album** (after N wrong attempts wipes that album).
- **ASO pass**: screenshots, feature graphic, A/B test listings, keyword optimization.
- **Establish a release process with automated regression tests** on core flows — import, rename, delete, unlock. The bugs found this session would have been caught by any smoke test.

---

## 10. Final Score

| Category | Score |
|---|---|
| Product Clarity & Positioning | 7/10 |
| UX/UI Quality | 6/10 |
| Feature Depth & Differentiation | 7/10 |
| Trust & Security Perception | 7/10 |
| Performance & Engineering Quality | 6/10 |
| Market Readiness | 5/10 |

**Weighted final score: 63/100 — Average**

Engineering and UX weighted slightly higher than market readiness because those are the fixable-with-discipline items. Weighted the way a Play Store user would, the score drops into the high 50s. Weighted the way an engineer would (native-module ambition), it rises into the high 60s. 63 is the honest middle.

**75 is within reach in 4 weeks.** Quick wins + referrals + intruder selfie + first-run flow + crash reporting would move the needle hard. **90 requires backend + cross-device sync + localization + 6+ months of retention iteration.** That's the honest gap.

The single most important thing to do tomorrow is **install Sentry and run the app for a week.** Everything else in this audit is secondary to that.
