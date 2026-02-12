# VaultCalc Retention System Document
## Version 1.0

---

## 1. Retention Philosophy

### 1.1 Core Principles

1. **Value-First Retention**: Users stay because the app is genuinely useful, not because we manipulate them
2. **No Dark Patterns**: No guilt trips, fake urgency, or manipulative messaging
3. **Respect User Time**: Minimal notifications, no engagement farming
4. **Earn Trust Over Time**: Long-term relationship over short-term metrics
5. **Transparent Business**: Clear value proposition for free and paid tiers

### 1.2 Anti-Patterns We Avoid

| Dark Pattern | Our Approach |
|--------------|--------------|
| Notification spam | Max 1 notification/week, user-controlled |
| Guilt messaging | Neutral, factual messaging |
| Fake urgency | No countdown timers or "limited offers" |
| Hidden unsubscribe | Clear cancellation in 2 taps |
| Engagement manipulation | No streaks, no FOMO mechanics |
| Data hostage | Easy export, no lock-in |

### 1.3 Success Metrics (Ethical)

**Primary Metrics:**
- 30-day retention rate
- Net Promoter Score (NPS)
- Monthly active users (MAU)
- Feature adoption rate
- Support ticket sentiment

**Avoided Metrics:**
- Daily active users (encourages addictive design)
- Session length (not relevant for utility app)
- Notification open rate (encourages spam)
- "Engagement" (vague, often manipulative)

---

## 2. Retention Stages

### 2.1 User Journey Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER RETENTION JOURNEY                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Day 0-1: ACTIVATION                                                │
│  ├── Install complete                                               │
│  ├── PIN created                                                    │
│  └── First file imported ← KEY MOMENT                               │
│                                                                      │
│  Day 2-7: HABIT FORMATION                                           │
│  ├── 3+ files imported                                              │
│  ├── Vault accessed 2+ times                                        │
│  └── Biometric enabled (optional)                                   │
│                                                                      │
│  Day 8-30: VALUE REALIZATION                                        │
│  ├── 10+ files stored                                               │
│  ├── Organized into categories                                      │
│  └── Returned naturally when needed                                 │
│                                                                      │
│  Day 30+: LONG-TERM USER                                            │
│  ├── Regular usage pattern established                              │
│  ├── Consider premium for more storage                              │
│  └── Potential advocate (organic referral)                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Stage-Specific Strategies

**Stage 1: Activation (Day 0-1)**

Goal: Get user to import first file

Tactics:
- Streamlined onboarding (4 screens max)
- Clear value proposition during setup
- Immediate path to import after PIN creation
- Tutorial overlay on first vault visit

**Stage 2: Habit Formation (Day 2-7)**

Goal: Establish the vault as the default for private content

Tactics:
- Share intent integration (share to VaultCalc from gallery)
- Optional reminder after 3 days if no files imported
- Quick import from notification (if permissions granted)

**Stage 3: Value Realization (Day 8-30)**

Goal: User recognizes ongoing value

Tactics:
- Smooth media browsing experience
- Reliable encryption gives peace of mind
- Albums/organization features available
- Show storage usage (builds perceived value)

**Stage 4: Long-Term User (Day 30+)**

Goal: Natural, sustainable usage

Tactics:
- No interference - app just works
- Premium prompt only at natural moments
- Easy backup/restore for phone upgrades

---

## 3. Onboarding Excellence

### 3.1 First Launch Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ONBOARDING FLOW (4 SCREENS)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Screen 1: VALUE PROPOSITION                                        │
│  ┌─────────────────────────────────────┐                            │
│  │                                     │                            │
│  │     [Calculator Icon Animation]     │                            │
│  │                                     │                            │
│  │  "Your private space, hidden in    │                            │
│  │   plain sight"                      │                            │
│  │                                     │                            │
│  │  A working calculator that          │                            │
│  │  protects your photos, videos,      │                            │
│  │  and documents.                     │                            │
│  │                                     │                            │
│  │         [Get Started]               │                            │
│  │                                     │                            │
│  └─────────────────────────────────────┘                            │
│                                                                      │
│  Screen 2: CREATE PIN                                               │
│  ┌─────────────────────────────────────┐                            │
│  │                                     │                            │
│  │  "Create your vault PIN"            │                            │
│  │                                     │                            │
│  │  This PIN unlocks your private      │                            │
│  │  vault. Choose something you'll     │                            │
│  │  remember.                          │                            │
│  │                                     │                            │
│  │  Tip: Use 6+ digits for stronger   │                            │
│  │  security.                          │                            │
│  │                                     │                            │
│  │      [  _  _  _  _  _  _  ]        │                            │
│  │                                     │                            │
│  │  [Skip] will set default: 1234     │                            │
│  │  (you can change it later)          │                            │
│  │                                     │                            │
│  └─────────────────────────────────────┘                            │
│                                                                      │
│  Screen 3: HOW IT WORKS                                             │
│  ┌─────────────────────────────────────┐                            │
│  │                                     │                            │
│  │  "Here's how it works"              │                            │
│  │                                     │                            │
│  │  [Animation: Calculator → PIN →    │                            │
│  │   = → Vault opens]                  │                            │
│  │                                     │                            │
│  │  1. Use as normal calculator        │                            │
│  │  2. Type your PIN                   │                            │
│  │  3. Press = to open vault          │                            │
│  │                                     │                            │
│  │  Try it: Type [PIN] then =         │                            │
│  │                                     │                            │
│  └─────────────────────────────────────┘                            │
│                                                                      │
│  Screen 4: IMPORT FIRST FILES                                       │
│  ┌─────────────────────────────────────┐                            │
│  │                                     │                            │
│  │  "Add your first private files"     │                            │
│  │                                     │                            │
│  │  ┌───────┐  ┌───────┐  ┌───────┐  │                            │
│  │  │ Photos│  │Videos │  │  Docs │  │                            │
│  │  └───────┘  └───────┘  └───────┘  │                            │
│  │                                     │                            │
│  │         [Import Now]                │                            │
│  │                                     │                            │
│  │      [I'll do this later]           │                            │
│  │                                     │                            │
│  └─────────────────────────────────────┘                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Onboarding Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Completion rate | > 80% | < 60% |
| Time to complete | < 90 seconds | > 3 minutes |
| First import rate | > 50% | < 30% |
| Drop-off Screen 1→2 | < 20% | > 35% |
| Drop-off Screen 2→3 | < 15% | > 30% |
| Drop-off Screen 3→4 | < 10% | > 25% |

### 3.3 Onboarding Recovery

If user skips onboarding:
- Calculator works normally
- Subtle "?" icon in corner for help
- In-app tutorial accessible from settings
- No nagging or repeated prompts

---

## 4. Re-Engagement Strategy

### 4.1 Notification Policy

**Maximum Frequency:** 1 notification per week

**Allowed Notification Types:**
1. Security alerts (attempted access, new device)
2. Import completion (background import finished)
3. Feature announcement (major update, 1x per release)
4. Subscription expiring (7 days before, 1x only)

**Prohibited:**
- "We miss you" messages
- "Your files are waiting"
- Daily reminders
- Gamification notifications
- Promotional spam

### 4.2 Notification Copy Guidelines

**Good:**
```
"Background import complete. 12 photos secured."
```

**Bad:**
```
"🔥 Don't forget about your private photos! Tap to view NOW! 🔥"
```

**Good:**
```
"VaultCalc 2.0 available with video support."
```

**Bad:**
```
"You haven't opened VaultCalc in 3 days 😢 Your photos miss you!"
```

### 4.3 In-App Prompts

**When to Show:**
- Biometric prompt: After 3 successful PIN entries
- Rate prompt: After 20 vault accesses, max 2x lifetime
- Premium prompt: When hitting free tier limits
- Feature discovery: Once per feature, dismissible

**When NOT to Show:**
- On every app open
- After failed actions
- During media viewing
- Within 24 hours of last prompt

---

## 5. Feature Discovery

### 5.1 Progressive Disclosure

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FEATURE DISCOVERY TIMELINE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Immediate (Setup):                                                  │
│  • Calculator functionality                                          │
│  • PIN-based vault access                                           │
│  • Photo/video import                                                │
│                                                                      │
│  After 3 vault accesses:                                            │
│  • Biometric unlock (if not enabled)                                │
│  → Tooltip: "Want faster access? Enable fingerprint"               │
│                                                                      │
│  After 10 files imported:                                           │
│  • Albums feature                                                   │
│  → Tooltip: "Organize with albums" (on long-press)                 │
│                                                                      │
│  After 7 days:                                                      │
│  • Decoy vault (subtle mention in settings)                         │
│  → No tooltip, discoverable in settings                            │
│                                                                      │
│  When storage > 50%:                                                │
│  • Premium storage options                                          │
│  → Banner: "Running low on space? Upgrade for more"                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Tooltip System

```typescript
interface Tooltip {
  id: string;
  trigger: TooltipTrigger;
  message: string;
  action?: string;
  maxShows: number;
  dismissible: boolean;
}

const tooltips: Tooltip[] = [
  {
    id: 'biometric-hint',
    trigger: { vaultAccesses: 3, biometricEnabled: false },
    message: 'Enable fingerprint for faster access',
    action: 'Enable',
    maxShows: 2,
    dismissible: true,
  },
  {
    id: 'album-hint',
    trigger: { filesImported: 10, albumsCreated: 0 },
    message: 'Long-press to organize into albums',
    maxShows: 1,
    dismissible: true,
  },
  {
    id: 'share-hint',
    trigger: { filesExported: 0, daysInstalled: 14 },
    message: 'Swipe up on any photo to share securely',
    maxShows: 1,
    dismissible: true,
  },
];
```

### 5.3 Feature Discovery Metrics

| Feature | Discovery Rate Target | Activation Rate Target |
|---------|----------------------|------------------------|
| Biometric | 90% aware | 60% enabled |
| Albums | 70% aware | 30% created |
| Decoy vault | 40% aware | 15% configured |
| Share/export | 80% aware | 50% used |

---

## 6. Value Reinforcement

### 6.1 Subtle Value Indicators

**Storage Summary (Settings):**
```
Private Storage
├── 47 photos (234 MB)
├── 12 videos (1.2 GB)
└── 8 documents (15 MB)

Total secured: 1.45 GB
```

**Security Summary (Settings):**
```
Security Status: Strong
├── PIN: 6 digits ✓
├── Biometric: Enabled ✓
├── Auto-lock: 1 minute ✓
└── Last access: 2 hours ago
```

### 6.2 Milestone Recognition

**Subtle, Non-Gamified:**
```
After 100 files imported:
"100 files secured in your vault"
[Toast notification, 3 seconds, no action required]
```

**What We Don't Do:**
- Badges or achievements
- Streaks or daily goals
- Leaderboards
- Points or rewards

### 6.3 Trust Building

**Transparency Moments:**
- Show encryption in progress ("Encrypting...")
- Explain security during setup
- Clear error messages
- Honest about limitations

**Reliability:**
- Never lose user data
- Always decrypt successfully
- Quick, consistent performance
- No crashes during operations

---

## 7. Churn Prevention

### 7.1 Churn Risk Indicators

| Indicator | Risk Level | Response |
|-----------|------------|----------|
| No access in 7 days | Low | None |
| No access in 14 days | Medium | Optional email (if subscribed) |
| No access in 30 days | High | None (respect their choice) |
| Failed PIN 3+ times | Medium | Help link in lockout screen |
| Storage full, not upgraded | High | Clear upgrade path |
| Uninstall intent detected | High | Offer feedback survey |

### 7.2 Exit Survey

**Triggered:** When user clears app data or uninstalls (if detectable)

```
┌─────────────────────────────────────────┐
│                                         │
│  Help us improve                        │
│                                         │
│  Why are you leaving?                   │
│                                         │
│  ○ Found a better alternative          │
│  ○ No longer need this type of app     │
│  ○ Technical issues                    │
│  ○ Privacy concerns                    │
│  ○ Too complicated                     │
│  ○ Other                               │
│                                         │
│  [Submit]     [Skip]                    │
│                                         │
└─────────────────────────────────────────┘
```

**Never:**
- Guilt trip ("Are you sure? Your files will be gone forever!")
- Make export difficult
- Hide unsubscribe option
- Require reason to leave

### 7.3 Win-Back Strategy

**Approach:** Minimal and respectful

**For Churned Free Users:**
- No action (they chose to leave)

**For Churned Paying Users:**
- Single email: "Your subscription ended. Your encrypted files remain on your device."
- Offer: Easy re-subscribe link
- No follow-up if ignored

---

## 8. Premium Conversion

### 8.1 Ethical Upgrade Prompts

**When to Show:**
- Storage approaching limit (80%)
- Attempting to use premium feature
- In settings (always visible, not pushy)

**When NOT to Show:**
- During onboarding
- After failed operations
- Every app open
- More than 1x per session

### 8.2 Prompt Examples

**Good (At Natural Limit):**
```
┌─────────────────────────────────────────┐
│                                         │
│  Storage almost full                    │
│                                         │
│  You've used 480 MB of 500 MB           │
│  ━━━━━━━━━━━━━━━━━━━━━━━░░              │
│                                         │
│  Premium includes 50 GB storage         │
│                                         │
│  [See Premium]  [Maybe Later]           │
│                                         │
└─────────────────────────────────────────┘
```

**Bad (Manipulative):**
```
┌─────────────────────────────────────────┐
│                                         │
│  ⚠️ WARNING ⚠️                          │
│                                         │
│  Your files are at RISK!                │
│  Upgrade NOW to protect them!           │
│                                         │
│  🔥 LIMITED TIME: 50% OFF 🔥            │
│  Only 2 hours left!!!                   │
│                                         │
│  [UPGRADE NOW]                          │
│                                         │
│  [No thanks, I don't care about        │
│   my private files]                     │
│                                         │
└─────────────────────────────────────────┘
```

### 8.3 Free Tier Value

Free tier must be genuinely useful:
- 500 MB storage (meaningful amount)
- All core features (encryption, biometric)
- No ads in vault area
- No feature crippling

Premium is "more" not "complete":
- More storage (50 GB)
- More features (cloud backup, video)
- No ads anywhere
- Priority support

---

## 9. User Feedback Loop

### 9.1 Feedback Collection

**In-App Feedback:**
- Settings → Help & Feedback
- Shake to report (optional, disabled by default)
- After support interaction

**Rating Prompt:**
- After 20 successful vault accesses
- Maximum 2 prompts lifetime
- Easy dismiss, no guilt

```
┌─────────────────────────────────────────┐
│                                         │
│  Enjoying VaultCalc?                    │
│                                         │
│  Your rating helps others discover      │
│  the app.                               │
│                                         │
│  [Rate on Play Store]  [Not Now]        │
│                                         │
│  □ Don't ask again                      │
│                                         │
└─────────────────────────────────────────┘
```

### 9.2 Feedback Response

| Feedback Type | Response Time | Action |
|---------------|---------------|--------|
| Bug report | < 24 hours | Acknowledge + investigate |
| Feature request | < 48 hours | Acknowledge + log |
| Security issue | < 4 hours | Immediate escalation |
| Negative review | < 24 hours | Empathetic response |
| Positive review | Optional | Thank you |

### 9.3 Public Roadmap

Maintain transparent roadmap:
- What we're working on
- What we're considering
- What we've decided against (with reasons)

Builds trust and reduces "when will you add X?" queries.

---

## 10. Retention Metrics Dashboard

### 10.1 Key Metrics

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RETENTION DASHBOARD                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ACTIVATION                                                          │
│  ├── Onboarding completion: 82% ✓                                  │
│  ├── First import rate: 54% ✓                                      │
│  └── Day 1 retention: 71% ✓                                        │
│                                                                      │
│  RETENTION                                                           │
│  ├── Day 7 retention: 48% ✓                                        │
│  ├── Day 30 retention: 31% ●                                       │
│  └── Day 90 retention: 22% ●                                       │
│                                                                      │
│  ENGAGEMENT (Ethical)                                               │
│  ├── MAU: 45,000                                                   │
│  ├── Vault accesses/user/month: 8.3                                │
│  └── Files imported/user: 34                                       │
│                                                                      │
│  SATISFACTION                                                        │
│  ├── Play Store rating: 4.6 ✓                                      │
│  ├── NPS: +42 ✓                                                    │
│  └── Support satisfaction: 89% ✓                                   │
│                                                                      │
│  CONVERSION                                                          │
│  ├── Free → Trial: 12%                                             │
│  ├── Trial → Paid: 34%                                             │
│  └── Paid churn: 4%/month ✓                                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.2 Cohort Analysis

Track retention by:
- Install source (organic, search, referral)
- Install date (cohorts)
- Device type
- Country
- Onboarding path

### 10.3 Alerts

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Day 1 retention | < 60% | Review onboarding |
| Day 7 retention | < 35% | Review core UX |
| Onboarding completion | < 70% | Simplify flow |
| First import rate | < 40% | Review CTA clarity |
| Play Store rating | < 4.0 | Address feedback |

---

## 11. Seasonal & Lifecycle

### 11.1 Lifecycle Events

**New Phone Setup:**
- Prompt for backup restore (if premium)
- Easy re-authentication
- Seamless migration path

**App Update:**
- Minimal update prompts
- No forced updates unless critical
- Clear changelog

**Subscription Renewal:**
- Single reminder 7 days before
- No spam, no manipulation
- Easy cancellation maintained

### 11.2 What We Don't Do

- Holiday promotion spam
- "Anniversary" notifications
- "You've been with us for X days!" messages
- Seasonal urgency campaigns
- FOMO-based marketing

---

## 12. Implementation Checklist

### Phase 1: Foundation
- [x] Streamlined onboarding (4 screens)
- [x] First import CTA
- [x] Basic analytics (privacy-respecting)
- [x] Feedback mechanism

### Phase 2: Optimization
- [ ] A/B test onboarding variants
- [ ] Implement tooltip system
- [ ] Add storage visualization
- [ ] Create exit survey

### Phase 3: Refinement
- [ ] Cohort analysis dashboard
- [ ] Automated churn prediction
- [ ] Premium conversion optimization
- [ ] NPS survey integration

---

*Document Version: 1.0*
*Last Updated: 2024*
*Philosophy: Value-first, respect-always*
