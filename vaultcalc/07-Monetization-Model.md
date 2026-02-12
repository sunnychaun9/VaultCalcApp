# VaultCalc Monetization Model Document
## Version 1.0

---

## 1. Monetization Philosophy

### Core Principles

1. **Value Exchange**: Users pay for genuine value, not artificial limitations
2. **Free Must Be Useful**: Free tier is a real product, not a demo
3. **No Dark Patterns**: Honest pricing, easy cancellation
4. **Regional Fairness**: Pricing adjusted for purchasing power
5. **Sustainable Business**: Revenue model that supports long-term development

### What We Believe

```
✓ Free users deserve a good product
✓ Premium should be "more" not "complete"
✓ Prices should be fair globally
✓ Cancellation should be 2 taps
✓ No guilt, no manipulation, no urgency
```

---

## 2. Tier Structure

### Free Tier

| Feature | Limit | Rationale |
|---------|-------|-----------|
| Storage | 500 MB | Meaningful amount (~200 photos) |
| Photos | Unlimited (within storage) | Core functionality |
| Videos | ❌ Not included | Premium differentiator |
| Documents | ❌ Not included | Premium differentiator |
| Encryption | Full AES-256 | Never compromise security |
| Biometric | ✅ Included | Convenience for all |
| Decoy Vault | ✅ Included | Security for all |
| Themes | Light/Dark | Basic theming |
| Ads | Banner in calculator | Non-intrusive revenue |

**Free Tier Value Proposition:**
"A fully functional private photo vault with real encryption. No catches."

### Premium Tier

| Feature | Benefit | Value |
|---------|---------|-------|
| Storage | 50 GB | 100x more storage |
| Videos | ✅ Full support | Store private videos |
| Documents | ✅ Full support | PDFs, text files |
| Cloud Backup | ✅ Google Drive | Never lose files |
| Albums | ✅ Unlimited | Better organization |
| No Ads | ✅ Ad-free | Clean experience |
| Themes | ✅ AMOLED + custom | Premium aesthetics |
| Priority Support | ✅ 24hr response | Faster help |
| Intruder Photos | ✅ Unlimited history | Security logging |

**Premium Value Proposition:**
"Everything in Free, plus video support, cloud backup, and 50GB of storage."

---

## 3. Pricing Strategy

### Base Pricing (USD - Tier 1 Markets)

| Plan | Price | Effective Monthly |
|------|-------|-------------------|
| Monthly | $4.99/month | $4.99 |
| Yearly | $29.99/year | $2.50 (50% savings) |
| Lifetime | $79.99 (one-time) | — |

### Regional Pricing (PPP Adjusted)

#### Tier 1: US, UK, Canada, Australia, Western Europe
- Monthly: $4.99
- Yearly: $29.99
- Lifetime: $79.99

#### Tier 2: Eastern Europe, Brazil, Mexico
- Monthly: $2.99 (~40% reduction)
- Yearly: $17.99
- Lifetime: $49.99

#### Tier 3: India, Southeast Asia, Africa
- Monthly: ₹149 (~$1.80)
- Yearly: ₹799 (~$9.60)
- Lifetime: ₹1,999 (~$24)

#### Tier 4: Special Markets (Argentina, Turkey, etc.)
- Monthly: $0.99
- Yearly: $5.99
- Lifetime: $14.99

### Pricing Rationale

```
┌─────────────────────────────────────────────────────────────┐
│                    PRICING MATH                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Free User Value:                                           │
│  ├── Storage cost (500MB): ~$0.01/month                    │
│  ├── Development amortized: ~$0.05/user                    │
│  └── Ad revenue potential: ~$0.50/month                    │
│                                                              │
│  Premium User Value:                                         │
│  ├── Storage cost (50GB): ~$0.50/month                     │
│  ├── Cloud backup cost: ~$0.10/month                       │
│  ├── Support cost: ~$0.20/month                            │
│  └── Target margin: 60%                                    │
│                                                              │
│  Result: $2.50/month covers costs + margin                  │
│  Monthly premium ($4.99) = healthy margin                   │
│  Yearly ($2.50/month) = sustainable                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Ad Strategy

### Ad Placement Rules

**Allowed:**
- Calculator screen (bottom banner)
- Settings screen (bottom banner)

**Forbidden:**
- Inside vault (privacy concern)
- During file operations
- On media viewing screens
- Interstitials anywhere
- Rewarded video ads

### Ad Implementation

```
┌─────────────────────────────────────────────────────────────┐
│                    CALCULATOR SCREEN                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    DISPLAY                           │   │
│  │                                                      │   │
│  │                     123.45                           │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────┬─────┬─────┬─────┐                                 │
│  │  C  │  ±  │  %  │  ÷  │                                 │
│  ├─────┼─────┼─────┼─────┤                                 │
│  │  7  │  8  │  9  │  ×  │                                 │
│  ├─────┼─────┼─────┼─────┤                                 │
│  │  4  │  5  │  6  │  -  │                                 │
│  ├─────┼─────┼─────┼─────┤                                 │
│  │  1  │  2  │  3  │  +  │                                 │
│  ├─────┼─────┴─────┼─────┤                                 │
│  │  0  │     .     │  =  │                                 │
│  └─────┴───────────┴─────┘                                 │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              [Banner Ad - 320x50]                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Ad Provider: Google AdMob

**Configuration:**
- Format: Adaptive banner
- Refresh: 60 seconds (minimum)
- Categories blocked: Dating, gambling, political
- COPPA: Compliant settings

**Estimated Revenue:**
| Market | eCPM | Impressions/User/Month | Revenue/User |
|--------|------|------------------------|--------------|
| Tier 1 | $2.00 | 50 | $0.10 |
| Tier 2 | $0.80 | 50 | $0.04 |
| Tier 3 | $0.30 | 50 | $0.015 |

---

## 5. Conversion Strategy

### Free → Trial Conversion

**Trigger Points:**
1. Storage at 80% capacity
2. Attempting to import video
3. Attempting to import document
4. After 30 days of active use

**Prompt Design:**
```
┌─────────────────────────────────────────┐
│                                         │
│  Storage almost full                    │
│                                         │
│  480 MB / 500 MB used                   │
│  ━━━━━━━━━━━━━━━━━━━━░░                 │
│                                         │
│  Premium includes 50 GB storage,        │
│  plus videos and cloud backup.          │
│                                         │
│  [Try 7 Days Free]  [Maybe Later]       │
│                                         │
└─────────────────────────────────────────┘
```

### Trial → Paid Conversion

**7-Day Trial Includes:**
- All premium features
- Full 50 GB storage
- Video support
- Cloud backup

**Trial Timeline:**
- Day 1: Trial starts (no messaging)
- Day 5: Subtle reminder ("2 days left in trial")
- Day 7: Trial ends, reverts to free

**No Trial Lock-Out:**
- Users keep access to their files
- Premium features disabled
- Can re-subscribe anytime
- Never delete user data

---

## 6. Subscription Management

### Purchase Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION SCREEN                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                     VaultCalc Premium                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✓ 50 GB Storage                                    │   │
│  │  ✓ Video Support                                    │   │
│  │  ✓ Document Support                                 │   │
│  │  ✓ Cloud Backup                                     │   │
│  │  ✓ No Ads                                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌───────────────────┐  ┌───────────────────┐             │
│  │     YEARLY        │  │    MONTHLY        │             │
│  │                   │  │                   │             │
│  │   $29.99/year     │  │  $4.99/month      │             │
│  │   $2.50/month     │  │                   │             │
│  │                   │  │                   │             │
│  │   BEST VALUE      │  │                   │             │
│  │   Save 50%        │  │                   │             │
│  └───────────────────┘  └───────────────────┘             │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   LIFETIME                           │   │
│  │                   $79.99 one-time                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│           [Start 7-Day Free Trial]                          │
│                                                              │
│  Cancel anytime in Google Play settings                     │
│  Restore purchases                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Cancellation Flow

**Must be easy:**
1. Settings → Subscription → Manage
2. Opens Google Play subscription page
3. Standard Google cancellation

**Post-Cancellation:**
- Premium active until period ends
- Reminder 3 days before downgrade
- Graceful downgrade (keep files, limit features)
- No guilt messaging

### Downgrade Handling

When premium expires:
1. Files over 500MB limit: Read-only access
2. Videos: Read-only access (can view, not add)
3. Cloud backup: Disabled (local files safe)
4. Ads: Re-enabled

**Never:**
- Delete user files
- Lock users out of existing content
- Make export difficult

---

## 7. Lifetime License

### Lifetime Value Calculation

```
Average subscription duration: 18 months
Average monthly revenue: $3.50 (blended yearly/monthly)
Expected lifetime revenue: $63

Lifetime price: $79.99
Premium over expected: 27%
Break-even: ~23 months
```

### Lifetime Terms

- One-time payment
- All current premium features
- Major version updates included
- Support for 5 years minimum
- Transferable via Google Play family

### Lifetime Availability

- Always available (not "limited time")
- Not prominently featured (subtle option)
- For users who prefer one-time purchase

---

## 8. Revenue Projections

### Assumptions

| Metric | Conservative | Moderate | Optimistic |
|--------|--------------|----------|------------|
| Monthly installs | 10,000 | 25,000 | 50,000 |
| 30-day retention | 25% | 30% | 35% |
| Trial conversion | 8% | 12% | 15% |
| Trial → Paid | 30% | 40% | 50% |
| Ad eCPM (blended) | $0.50 | $0.75 | $1.00 |

### Year 1 Projection (Moderate Scenario)

| Month | MAU | Premium | Ad Revenue | Sub Revenue | Total |
|-------|-----|---------|------------|-------------|-------|
| 1 | 7,500 | 90 | $281 | $360 | $641 |
| 3 | 20,000 | 480 | $750 | $1,920 | $2,670 |
| 6 | 40,000 | 1,440 | $1,500 | $5,760 | $7,260 |
| 12 | 75,000 | 4,500 | $2,812 | $18,000 | $20,812 |

**Year 1 Total (Moderate): ~$120,000**

### Revenue Split Target

| Source | Target % | Rationale |
|--------|----------|-----------|
| Subscriptions | 70% | Primary revenue |
| Ads | 25% | Free tier monetization |
| Lifetime | 5% | Niche preference |

---

## 9. Ethical Guidelines

### Pricing Ethics

```
✓ DO: Show all prices upfront
✓ DO: Make yearly savings clear
✓ DO: Honor regional pricing
✓ DO: Allow easy cancellation
✓ DO: Give grace period for payment failures

✗ DON'T: Use fake "discounts"
✗ DON'T: Create artificial urgency
✗ DON'T: Hide auto-renewal
✗ DON'T: Make cancellation difficult
✗ DON'T: Charge different prices for same service
```

### Communication Ethics

**Good:**
```
"Your trial ends in 2 days. Upgrade to keep premium features."
```

**Bad:**
```
"⚠️ WARNING: You'll LOSE all your precious memories if you don't
subscribe NOW! Don't let your photos disappear forever! 🚨"
```

### Data Ethics

- Never sell user data
- Never use file metadata for ads
- Never analyze vault contents
- Analytics: Aggregate only, no PII
- Transparent privacy policy

---

## 10. Competitor Pricing Analysis

| App | Free Limit | Premium Price | Features |
|-----|------------|---------------|----------|
| Calculator Vault A | 100 photos | $9.99/month | Photos, videos |
| Photo Vault B | 50 photos | $4.99/month | Photos only |
| Private Gallery C | Unlimited | $2.99/month | Ads, no encryption |
| **VaultCalc** | **500 MB** | **$2.50/month** | **Full encryption** |

**Our Position:**
- Most generous free tier
- Competitive premium pricing
- Superior security (real encryption)
- Honest marketing

---

## 11. Implementation Checklist

### Phase 1 (MVP)
- [ ] Free tier with 500MB limit
- [ ] AdMob integration (calculator only)
- [ ] Basic premium screen (info only)
- [ ] Storage usage tracking

### Phase 2
- [ ] Google Play Billing integration
- [ ] Subscription management
- [ ] Trial system (7 days)
- [ ] Premium feature gating
- [ ] Regional pricing setup

### Phase 3
- [ ] Lifetime license option
- [ ] Restore purchases
- [ ] Subscription analytics
- [ ] Churn analysis
- [ ] A/B test pricing

---

## 12. Key Metrics to Track

| Metric | Target | Alert |
|--------|--------|-------|
| Free → Trial | > 10% | < 5% |
| Trial → Paid | > 35% | < 20% |
| Monthly churn | < 5% | > 8% |
| ARPU (all users) | > $0.50 | < $0.25 |
| ARPPU (paying) | > $3.00 | < $2.00 |
| Refund rate | < 2% | > 5% |

---

*Document Version: 1.0*
*Last Updated: 2024*
*Principle: Fair value, honest pricing*
