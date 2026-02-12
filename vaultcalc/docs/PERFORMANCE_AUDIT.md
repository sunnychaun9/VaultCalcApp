# VaultCalcApp - Performance Audit Report

**Date:** 2026-02-11
**Application:** VaultCalcApp (React Native 0.83.1, Android-only)
**Overall Rating:** 7.5 / 10

---

## Executive Summary

VaultCalcApp demonstrates strong architectural decisions and well-implemented performance patterns across most areas. Excellent memoization, granular state subscriptions, efficient list virtualization, and robust memory management. Several medium-severity optimization opportunities exist around screen complexity, state subscription consolidation, and native module dispatchers.

| Category | Score | Notes |
|----------|-------|-------|
| Rendering Performance | 8/10 | Excellent memo usage, some screen complexity |
| List Virtualization | 8/10 | Well-configured FlashList, good patterns |
| State Management | 7/10 | Good patterns but over-subscription in main screen |
| Image Performance | 9/10 | Outstanding thumbnail generation and caching |
| Native Module Efficiency | 7.5/10 | Correct patterns mostly, one dispatcher issue |
| Memory Management | 8/10 | Good cleanup, missing some native listener cleanup |
| Startup Performance | 7/10 | Google Drive sign-in blocking UI |
| Database Performance | 8/10 | Well-indexed, good query patterns |

---

## 1. Rendering Performance

### 1.1 React.memo — GOOD (8/10)

All primary list item components properly implement `React.memo`:

| Component | File | Status |
|-----------|------|--------|
| AlbumListItem | `src/features/vault/components/AlbumListItem.tsx:34` | Memoized |
| NoteListItem | `src/features/vault/components/NoteListItem.tsx:32` | Memoized |
| DocumentListItem | `src/features/vault/components/DocumentListItem.tsx:54` | Memoized |
| MediaGridItem | `src/features/vault/components/MediaGridItem.tsx:59` | Memoized |

### 1.2 useMemo/useCallback — EXCELLENT (9/10)

All components use the `createStyles(c: ColorTokens)` pattern with `useMemo`:

```typescript
const styles = useMemo(() => createStyles(themeColors), [themeColors]);
```

Theme colors use `as const` objects, so reference equality works for `isDark` checks.

### 1.3 VaultHomeScreen Complexity — MEDIUM ISSUE (6.5/10)

**File:** `src/features/vault/screens/VaultHomeScreen.tsx`

The screen subscribes to **13 separate Zustand selectors** (lines 93-106) and declares **30+ useCallback** hooks. This creates complex dependency chains where toggling decoy mode recreates 8-10 callbacks unnecessarily.

**Metrics:**
- ~850 lines of code
- 20+ `useState` declarations
- 13 Zustand subscriptions
- 30+ `useCallback` declarations

**Recommendation:** Extract album management into a separate component and create a `useVaultSelectionState()` custom hook to consolidate 9 vaultStore selectors into 1.

### 1.4 StyleSheet Patterns — EXCELLENT (9/10)

All components correctly use `createStyles(c: ColorTokens)` with memoization. No inline style objects that would break referential equality.

---

## 2. List Virtualization

### 2.1 FlashList Configuration — GOOD (8/10)

App uses FlashList v2.2.2 (which removed `estimatedItemSize` in favor of auto-detection).

| Component | Config Quality | Selection Handling | Grid Support |
|-----------|---------------|-------------------|-------------|
| AlbumList | Good | N/A | N/A |
| NoteList | Excellent | `extraData={selectedIds}` | N/A |
| DocumentList | Excellent | `extraData={selectedIds}` | N/A |
| MediaGrid | Excellent | Via Zustand selector | `numColumns` |

### 2.2 KeyExtractor — EXCELLENT (9/10)

All lists use stable `useCallback(() => item.id, [])` pattern. No key recreation on re-renders.

### 2.3 ItemSeparator — EXCELLENT

Stable separator components defined outside the render function:
```typescript
function ItemSeparator() {
  return <View style={separatorStyle} />;
}
const separatorStyle = { height: GAP };
```

### 2.4 Selection State Strategies

Two approaches used appropriately:

| Approach | Lists Using It | Re-renders | Best For |
|----------|---------------|-----------|----------|
| `extraData={selectedIds}` | NoteList, DocumentList | All items | < 1000 items |
| Zustand selector per item | MediaGrid | Only changed items | 5000+ items |

MediaGridItem subscribes granularly: `useVaultStore(s => s.selectedIds.has(item.id))` — only re-renders when THIS item's selection flips.

---

## 3. State Management

### 3.1 VaultHomeScreen Over-Subscription — MEDIUM ISSUE (7/10)

**13 Zustand selectors** across 3 stores. Only 5 are used in the render output — the other 8 exist solely for callbacks.

**Impact:** Each store state change triggers re-render checks for all 13 subscriptions.

**Recommendation:** Create custom hooks:
- `useVaultSelectionState()` — bundles 9 vaultStore selectors
- Reduces VaultHomeScreen subscriptions from 13 to ~3

### 3.2 React Query Cache — GOOD (8/10)

- Specific invalidation (only changed queries)
- Decoy-mode-aware query keys
- Conditional fetching (`enabled` prevents unnecessary queries)
- `staleTime: 30s`, `gcTime: 5min`, no retries (local data)

### 3.3 useDecryptedThumbnail — EXCELLENT (9/10)

Three-phase strategy prevents UI flashing:
1. **Sync cache init** — `useState(() => getCachedThumbnailSync(id))` for instant mount
2. **Quick return** — skip async work if sync cache hit
3. **Async fallback** — decrypt with cancellation token pattern

This hook is a model pattern for async-on-mount hooks.

---

## 4. Image Performance

### 4.1 Thumbnail Generation — EXCELLENT (9/10)

**File:** `android/.../modules/media/MediaModule.kt`

Two-pass decoding approach:
1. **Pass 1:** `inJustDecodeBounds = true` — reads dimensions without allocating pixel memory
2. **Pass 2:** Subsampled decode with computed `inSampleSize` (powers of 2)

**Example:** 4000x3000 image → `inSampleSize = 8` → decode at 500x375 (64x memory reduction)

Final output: JPEG quality 80 (4-8 KB per thumbnail).

Bitmap recycling uses nested `finally` blocks to guarantee cleanup even on exceptions.

### 4.2 Thumbnail Cache Architecture — EXCELLENT (9/10)

Three-layer caching:

| Layer | Type | Purpose |
|-------|------|---------|
| In-memory Map | `Map<string, string \| null>` | Synchronous lookups |
| In-flight Promise Map | `Map<string, Promise>` | Prevents duplicate decryptions |
| Disk cache | `thumbcache/{id}.jpg` | Persists across re-renders |

In-flight tracking ensures that if 10 grid cells request the same thumbnail simultaneously, only 1 decrypt operation runs.

Cache is cleared on vault lock (`App.tsx:55`).

---

## 5. Native Module Efficiency

### 5.1 Coroutine Dispatchers — MOSTLY GOOD (7.5/10)

| Module | Dispatcher | Correct? |
|--------|-----------|---------|
| MediaModule | `Dispatchers.IO` | Yes — file I/O |
| CryptoModule | `Dispatchers.Default` | Yes — CPU-intensive |
| GalleryModule | `Dispatchers.IO` | Yes — MediaStore queries |
| **BillingModule** | **`Dispatchers.Main`** | **NO — can cause ANR** |

**Issue:** BillingModule runs billing queries on the Main thread. Billing queries can take 500-2000ms, blocking the UI.

**Fix:** Change to `Dispatchers.Default` and use `withContext(Dispatchers.Main)` only for promise resolution.

### 5.2 Promise Resolution — EXCELLENT (9/10)

All modules correctly use `withContext(Dispatchers.Main)` before `promise.resolve/reject`. This prevents silent failures from resolving on background threads.

### 5.3 Resource Cleanup — PARTIAL (7/10)

| Module | `onCatalystInstanceDestroy` | Issue |
|--------|---------------------------|-------|
| MediaModule | `scope.cancel()` | OK |
| CryptoModule | Implicit | OK |
| **GalleryModule** | **Missing listener removal** | Memory leak |
| **BillingModule** | **Missing `endConnection()`** | Memory leak |

**GalleryModule** registers an `activityEventListener` in `init` but never removes it. **BillingModule** never calls `billingClient?.endConnection()`.

---

## 6. Memory Management

### 6.1 JavaScript-Side — GOOD (8/10)

- Zustand subscriptions auto-cleanup via React unmount
- App.tsx auth state subscriber returns `unsub` function
- QueryClient cleared on vault lock
- Thumbnail cache cleared on vault lock

### 6.2 Native-Side — PARTIAL (See 5.3)

GalleryModule and BillingModule have listener/connection cleanup gaps.

### 6.3 Bitmap Recycling — EXCELLENT (9/10)

Nested `finally` blocks guarantee recycling of both sampled and scaled bitmaps.

---

## 7. Startup Performance

### 7.1 Initialization Flow — FAIR (7/10)

**File:** `src/app/App.tsx:68-81`

```
T+0:      App mounts
T+100:    Database initialized (~100ms)
T+200:    Check for Google Drive email
T+2200:   Google Drive signInSilently() completes (500-2000ms)
T+2210:   setDbReady(true) — UI finally renders
```

**Issue:** Google Drive silent sign-in is awaited before showing the UI, adding 500-2000ms to startup.

**Recommendation:** Move `setDbReady(true)` before the Google Drive call — let sign-in happen in the background. Saves 500-2000ms on startup.

### 7.2 Lazy Loading — GOOD (8/10)

Google Drive service uses dynamic `import()`:
```typescript
const { signInSilently } = await import('@services/googleDrive');
```
Only loaded if `googleDriveEmail` is configured.

---

## 8. Database Performance

### 8.1 Index Coverage — GOOD (8/10)

**File:** `src/services/storage/database.ts:140-145`

| Index | Columns | Covers |
|-------|---------|--------|
| `idx_media_type` | `type` | Type filtering |
| `idx_media_created` | `created_at` | Sort order |
| `idx_media_is_decoy` | `is_decoy` | Vault separation |
| `idx_media_is_favorite` | `is_favorite` | Favorites filter |
| `idx_notes_is_decoy` | `is_decoy` | Note separation |
| `idx_notes_updated` | `updated_at` | Note sort |

Sufficient for expected data sizes (< 50K items). Composite indexes (`type, is_decoy`) recommended if library grows beyond 50K.

### 8.2 Query Patterns — GOOD (7.5/10)

- Batch operations wrapped in `withTransactionAsync`
- JOIN queries prevent N+1 (e.g., `getCoverMediaMap`)
- Aggregate functions computed by SQLite (`COUNT`, `SUM`)
- No explicit `LIMIT` clause on `getByType` — acceptable now, needs pagination if > 50K items

### 8.3 Note Decryption Strategy — EXCELLENT (9/10)

List view returns `content: ''` for encrypted notes — decryption deferred to when user opens a note. List renders instantly (< 100ms) regardless of encrypted note count.

---

## Implementation Roadmap

### Phase 1: Quick Wins (2 hours)

| Fix | File | Effort |
|-----|------|--------|
| Fix BillingModule dispatcher | `BillingModule.kt:38` | 30 min |
| Move Google Drive sign-in to fire-and-forget | `App.tsx:73` | 30 min |
| Add GalleryModule listener cleanup | `GalleryModule.kt` | 30 min |
| Add BillingModule `endConnection()` | `BillingModule.kt` | 30 min |

### Phase 2: Medium Effort (2-3 hours)

| Fix | Effort |
|-----|--------|
| Create `useVaultSelectionState()` hook | 1-2 hours |
| Extract album management from VaultHomeScreen | 2-3 hours |

### Phase 3: Long-Term (As Needed)

| Fix | Trigger |
|-----|---------|
| Add composite database indexes | When library > 50K items |
| Implement pagination for `getByType` | When library > 50K items |
| Add `estimatedItemHeight` to FlashLists | When scroll perf degrades |

---

## Conclusion

VaultCalcApp has a solid performance foundation with excellent image handling, proper memoization, and well-designed state management. The main optimization opportunities are:

1. **Simplify VaultHomeScreen** through component decomposition
2. **Fix BillingModule dispatcher** to prevent ANR during billing
3. **Deprioritize Google Drive sign-in** to speed up startup
4. **Complete native module cleanup** in GalleryModule and BillingModule

Implementing Phase 1 + 2 would raise the rating from **7.5/10 to ~8.5/10**.
