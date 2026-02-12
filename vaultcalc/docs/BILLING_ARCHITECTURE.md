# Billing Architecture

## Overview

The billing abstraction layer provides a swappable billing backend so development
can proceed without a Play Console or real product IDs.

```
UI Screens
    |
    +-- useFeatureGate(feature)   <-- premium access checks
    +-- getBillingService()       <-- purchase / restore flows
            |
      BillingService interface
            |
     +------+------+
     |             |
MockBilling   ProductionBilling
(dev builds)   (release builds)
```

## BILLING_MODE

Defined in `src/services/billing/billingConfig.ts`:

```ts
const BILLING_MODE: BillingMode = __DEV__ ? 'mock' : 'production';
```

- **`mock`** — Uses `MockBillingService` with configurable scenarios
- **`production`** — Uses `ProductionBillingService` (stub until Play Console is ready)

`getBillingService()` returns a singleton for the active mode.

## SubscriptionState

```
FREE ──> TRIAL ──> ACTIVE ──> CANCELLED ──> EXPIRED
                     |
                     └──> GRACE_PERIOD ──> EXPIRED
```

| State | Access Granted | Description |
|-------|:---:|---|
| `FREE` | No | Default / never subscribed |
| `TRIAL` | Yes | Active free trial period |
| `ACTIVE` | Yes | Paid subscription active |
| `CANCELLED` | No | User cancelled, period ended |
| `EXPIRED` | No | Subscription expired |
| `GRACE_PERIOD` | Yes | Payment retry window |

## Feature Gate

### React hook

```tsx
import { useFeatureGate } from '@services/billing';

function MyComponent() {
  const { hasAccess, isPremium, subscriptionState } = useFeatureGate('notes');

  if (!isPremium) return <PremiumUpsell />;
  return <PremiumContent />;
}
```

### Pure function (non-React)

```ts
import { hasFeatureAccess, SubscriptionState } from '@services/billing';

const canAccess = hasFeatureAccess(SubscriptionState.ACTIVE); // true
```

## MockBillingService Scenarios

Control via `mockBillingConfig`:

```ts
import { mockBillingConfig } from '@services/billing';

mockBillingConfig.scenario = 'failure';
mockBillingConfig.latencyMs = 1500;
```

| Scenario | `purchaseProduct()` | `restorePurchases()` | State |
|----------|---|---|---|
| `success` | Returns purchase | Returns active purchase | `ACTIVE` |
| `failure` | Returns error | Returns error | unchanged |
| `cancelled` | `cancelled: true` | Empty list | `CANCELLED` |
| `expired` | Returns error | Empty list | `EXPIRED` |
| `grace_period` | Returns purchase | Returns active purchase | `GRACE_PERIOD` |

## Migration Path: Wiring ProductionBillingService

When Play Console is ready:

1. Open `src/services/billing/ProductionBillingService.ts`
2. Import from `./billingService` (the existing functions)
3. Delegate each method to the corresponding function:
   - `initialize()` → `initializeBilling()`
   - `loadProducts()` → `loadProducts()` (map `products` to `data`)
   - `purchaseProduct()` → `purchaseProduct()`
   - `restorePurchases()` → `restorePurchases()` (map `purchases` to `data`)
   - `getActivePremiumPurchase()` → `getActivePremiumPurchase()`
4. Types are compatible — `BillingProductInfo` mirrors `ProductInfo`

## Existing Files Preserved

These files are **not modified** by the abstraction layer:

- `billingService.ts` — Google Play Billing high-level API
- `nativeBilling.ts` — Native module TypeScript interface
- `premiumStatusService.ts` — Startup premium status verification

They remain available for `ProductionBillingService` to delegate to.
