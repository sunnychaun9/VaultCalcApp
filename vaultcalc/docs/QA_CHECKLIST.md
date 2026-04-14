# VaultCalc — QA Test Checklist

> Run through every test on your device. Mark `[x]` when passing.
> If a test fails, note the issue next to it and report the **test number** (e.g. "M-03 fails: name still shows old value").

---

## MEDIA — Import, View, Rename, Delete

- [x] **M-01** Import 1 photo from gallery → appears in Images tab with correct thumbnail
- [x] **M-02** Import 1 video from gallery → appears in Videos tab with correct thumbnail
- [x] **M-03** Import 1 PDF document → appears in Documents tab
- [x] **M-04** Import 3+ photos at once (batch) → all appear, progress overlay shows count
- [x] **M-05** Open an imported photo → displays full-screen, pinch-to-zoom works
- [ ] **M-06** Open an imported video → plays in native player, controls visible
- [ ] **M-07** Open a PDF → pages render, can scroll through
- [ ] **M-08** Long-press a photo → select it → tap **Rename** → enter "RenameTest" → confirm → name shows "RenameTest" in the list
- [ ] **M-09** Open the renamed photo → header shows "RenameTest" (not old name)
- [ ] **M-10** Long-press a photo → tap **Delete** → confirm → photo gone from list
- [ ] **M-11** Long-press a video → tap **Delete** → confirm → video gone from list
- [ ] **M-12** Select 3 items (multi-select) → tap **Delete** → all 3 gone from list
- [ ] **M-13** Tap a photo → tap **Favorite** (heart/star) → go back → photo shows favorite indicator
- [ ] **M-14** Toggle "Show Favorites Only" → only favorited items appear
- [ ] **M-15** Un-favorite the photo → it disappears from favorites-only view
- [ ] **M-16** Import a file with "Delete originals after import" ON → original removed from gallery
- [ ] **M-17** Long-press a photo → tap **Share** → Android share sheet opens with the image
- [ ] **M-18** Open a video → play → pause → seek → double-tap to skip 10s → all controls work
- [ ] **M-19** Open a video → lock screen (lock icon) → taps do nothing → unlock → controls return
- [ ] **M-20** Open a video → swipe left/right for brightness/volume → gesture overlays appear
- [ ] **M-21** View **Properties** of a media item → shows name, size, date, type correctly

---

## ALBUMS — Create, Add, Remove, Delete

- [ ] **A-01** Go to Albums tab → create album "TestAlbum" → album appears in list
- [ ] **A-02** Go to Images tab → select 2 photos → "Add to Album" → pick "TestAlbum" → confirm
- [ ] **A-03** Open "TestAlbum" → both photos are inside
- [ ] **A-04** Open a photo from inside the album → displays correctly
- [ ] **A-05** Inside "TestAlbum" → select 1 photo → **Remove from album** → photo gone from album but still in Images tab
- [ ] **A-06** Rename "TestAlbum" to "RenamedAlbum" → new name shows in album list
- [ ] **A-07** Delete "RenamedAlbum" → album gone, photos inside are NOT deleted from vault
- [ ] **A-08** Create album → add 1 photo → that photo becomes the album cover thumbnail
- [ ] **A-09** Delete the cover photo from the vault → album cover updates (blank or next photo)

---

## NOTES — Create, Edit, Delete

- [ ] **N-01** Go to Notes tab → create a new note → type some text → go back → note appears in list with title
- [ ] **N-02** Reopen the note → text is preserved (auto-save worked)
- [ ] **N-03** Edit the note → add more text → go back → reopen → edits are preserved
- [ ] **N-04** Long-press a note → **Delete** → confirm → note gone from list
- [ ] **N-05** Long-press a note → **Share as text** → share sheet opens with note content

---

## AUTH — PIN, Pattern, Lock, Unlock

- [ ] **AU-01** Lock the vault (go back to calculator) → re-enter PIN → vault unlocks, all files still there
- [ ] **AU-02** Enter wrong PIN 3 times → lockout message appears, cannot retry immediately
- [ ] **AU-03** Wait for lockout to expire → can try PIN again → correct PIN works
- [ ] **AU-04** Background the app → wait longer than lock timeout → return → must re-enter PIN
- [ ] **AU-05** If biometric is set up: lock vault → reopen → biometric prompt appears → fingerprint unlocks
- [ ] **AU-06** Decoy PIN: enter decoy PIN → opens decoy vault (different files) → real vault files not visible
- [ ] **AU-07** Lock → enter real PIN → back to real vault, decoy files not visible

---

## SETTINGS — Changes Persist

- [ ] **S-01** Change theme (light/dark/system) → UI updates immediately → relaunch app → theme persists
- [ ] **S-02** Change auto-lock timeout → background app for that duration → returns to locked state
- [ ] **S-03** Toggle "Lock on background" OFF → background briefly → return → vault still unlocked
- [ ] **S-04** Change PIN: Settings → Change PIN → enter old → enter new → lock → new PIN works, old PIN doesn't
- [ ] **S-05** Change app icon → home screen icon changes → app still opens correctly
- [ ] **S-06** Enable stealth mode → app icon hidden from launcher → secret dial code or widget still opens it
- [ ] **S-07** Disable stealth mode → icon reappears on launcher

---

## SUBSCRIPTION / PREMIUM

- [ ] **P-01** Go to Settings → VaultCalc Premium → screen loads without crash
- [ ] **P-02** Select "Yearly" plan → check badge appears → does NOT overlap price text
- [ ] **P-03** Select "Monthly" plan → check badge appears → does NOT overlap price text
- [ ] **P-04** Select "Lifetime" plan → check badge appears → does NOT overlap price text
- [ ] **P-05** Select "Remove Ads Only" → check badge appears → does NOT overlap price text
- [ ] **P-06** Tap CTA button → Play billing sheet opens (or test sandbox flow)

---

## ADS — No Session Disruption

- [ ] **AD-01** View a photo → interstitial ad shows → close ad → returns to the photo viewer (NOT calculator)
- [ ] **AD-02** View a video → interstitial ad shows → close ad → returns to the video (NOT calculator)
- [ ] **AD-03** Import files → interstitial after import → close ad → stays on vault screen
- [ ] **AD-04** App open ad on foreground return → close it → stays on whatever screen you were on

---

## BACKUP & RESTORE

- [ ] **B-01** Connect Google Drive in Settings → shows connected email
- [ ] **B-02** Tap "Backup Now" → backup completes → shows success + timestamp
- [ ] **B-03** After backup → check Google Drive → backup files exist in VaultCalc folder
- [ ] **B-04** Disconnect Google Drive → email cleared from settings

---

## INTRUDER DETECTION

- [ ] **I-01** Enable intruder detection in Settings
- [ ] **I-02** Lock vault → enter wrong PIN 3 times → intruder photo captured
- [ ] **I-03** Unlock vault → go to Settings → Intruder Logs → photo appears with timestamp
- [ ] **I-04** Delete an intruder log entry → entry removed from list

---

## EDGE CASES & STRESS

- [ ] **E-01** Import 20+ files at once → all import, no crash, progress accurate
- [ ] **E-02** Rapidly tap between tabs (Images/Videos/Docs/Audio/Albums/Notes) → no crash or blank screen
- [ ] **E-03** Open a very large video (500MB+) → plays without OOM crash
- [ ] **E-04** Rename a file with special characters (emoji, unicode, spaces) → name displays correctly
- [ ] **E-05** Delete the only file in the vault → empty state screen shows
- [ ] **E-06** Kill the app mid-import (swipe from recents) → relaunch → no corrupted state, can import again
- [ ] **E-07** Rotate device while viewing a photo → image adjusts, no crash
- [ ] **E-08** Rotate device while playing a video → player handles rotation correctly
- [ ] **E-09** Background the app during import → return → import continues or completes

---

## HOW TO REPORT A FAILURE

When a test fails, tell me:

```
Test: M-08
Expected: Name shows "RenameTest" in list
Actual: Name still shows old filename
```

I will fix it in code and mark the test as resolved.
