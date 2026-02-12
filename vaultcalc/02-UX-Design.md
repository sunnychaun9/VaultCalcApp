# VaultCalc — Complete UX Design Document

**Version:** 1.0
**Based on:** PRD v1.1 (Final)
**Design System:** Material Design 3 / Material You

---

## 1. Complete Screen List

### Primary Screens
| ID | Screen | Purpose |
|----|--------|---------|
| `CALC-01` | Calculator (Default) | Primary app screen, scientific calculator |
| `VAULT-01` | Vault Home | Grid/list of all protected files |
| `VAULT-02` | Folder View | Contents of a specific folder |
| `VAULT-03` | Image Viewer | Full-screen image display |
| `VAULT-04` | Video Player | Full-screen video playback |
| `VAULT-05` | Document Viewer | PDF/TXT reader |
| `VAULT-06` | Audio Player | Audio playback with controls |
| `SET-01` | Settings Home | Main settings menu |

### Onboarding Screens
| ID | Screen | Purpose |
|----|--------|---------|
| `ONB-01` | Welcome | Value proposition |
| `ONB-02` | PIN Setup | Create vault PIN |
| `ONB-03` | PIN Confirm | Verify vault PIN |
| `ONB-04` | Biometric Opt-in | Enable fingerprint (optional) |
| `ONB-05` | First Import Prompt | Guide to add first file |

### Security Screens
| ID | Screen | Purpose |
|----|--------|---------|
| `SEC-01` | Biometric Prompt | System fingerprint dialog |
| `SEC-02` | PIN Change | Modify vault PIN |
| `SEC-03` | Recovery Setup | Create recovery phrase (Phase 2) |

### Settings Subscreens
| ID | Screen | Purpose |
|----|--------|---------|
| `SET-02` | Security Settings | PIN, biometrics, timeout |
| `SET-03` | Storage Settings | View usage, manage storage |
| `SET-04` | Appearance | Theme, calculator style |
| `SET-05` | Premium | Subscription management |
| `SET-06` | About | Version, licenses, support |
| `SET-07` | Calculator Settings | Precision, haptics, history |

### Overlay/Modal Screens
| ID | Screen | Purpose |
|----|--------|---------|
| `MOD-01` | Import Sheet | Share sheet / file picker |
| `MOD-02` | Create Folder | New folder dialog |
| `MOD-03` | Move Files | Folder selection for move |
| `MOD-04` | Delete Confirm | Confirm file deletion |
| `MOD-05` | Upgrade Prompt | Premium upsell (at limit) |
| `MOD-06` | Export Options | Share/save to device |

### Phase 2 Screens (Design Reserved)
| ID | Screen | Purpose |
|----|--------|---------|
| `P2-01` | Vault Profile Switcher | Switch between vault profiles |
| `P2-02` | Recovery Phrase Display | Show 12-word phrase |
| `P2-03` | Recovery Entry | Enter phrase to recover |

---

## 2. Navigation Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         APP LAUNCH                              │
│                             │                                   │
│                             ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    CALC-01: Calculator                    │  │
│  │                    (Always Default)                       │  │
│  │                                                           │  │
│  │   ┌─────────────────────────────────────────────────┐    │  │
│  │   │  Enter PIN + "=" → Vault Access                 │    │  │
│  │   └─────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                   │
│                     [Correct PIN + =]                           │
│                             │                                   │
│                             ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    VAULT-01: Vault Home                   │  │
│  │                                                           │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐         │  │
│  │  │ Images │  │ Videos │  │  Docs  │  │ Audio  │         │  │
│  │  │  Tab   │  │  Tab   │  │  Tab   │  │  Tab   │         │  │
│  │  └────────┘  └────────┘  └────────┘  └────────┘         │  │
│  │       │           │           │           │              │  │
│  │       ▼           ▼           ▼           ▼              │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │              File Grid / List                    │    │  │
│  │  │                                                  │    │  │
│  │  │   [Tap File] → Viewer (03/04/05/06)             │    │  │
│  │  │   [Tap Folder] → VAULT-02                        │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │  Bottom Bar: [+ Import] [⚙ Settings]            │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  EXIT VAULT: [Calculator icon] or [Back] → CALC-01             │
│  (Vault session persists for configured timeout)                │
└─────────────────────────────────────────────────────────────────┘
```

### Navigation Patterns

| Action | Behavior |
|--------|----------|
| App launch | Always opens Calculator |
| Correct PIN + `=` | Crossfade to Vault Home (no animation artifact) |
| Wrong PIN + `=` | Shows "0" (standard calculator behavior) |
| Back from Vault | Returns to Calculator |
| Back from Viewer | Returns to Vault Home or Folder |
| Home button | App backgrounds, vault locks after timeout |
| Recent apps | Calculator shown in preview (not vault) |

---

## 3. First-Launch Onboarding Flow

### Flow Diagram

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  ONB-01 │───▶│  ONB-02 │───▶│  ONB-03 │───▶│  ONB-04 │───▶│  ONB-05 │
│ Welcome │    │PIN Setup│    │ Confirm │    │Biometric│    │  Import │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                                  │              │
                                             [Skip]          [Skip]
                                                  │              │
                                                  ▼              ▼
                                             ┌─────────┐    ┌─────────┐
                                             │  ONB-05 │    │ CALC-01 │
                                             └─────────┘    └─────────┘
```

### Screen Details

#### ONB-01: Welcome
```
┌────────────────────────────────┐
│                                │
│         [App Icon]             │
│                                │
│         VaultCalc              │
│                                │
│   Calculator & Private Storage │
│                                │
│   Your files, encrypted and    │
│   organized in one app.        │
│                                │
│                                │
│                                │
│     ┌──────────────────────┐   │
│     │    Get Started       │   │
│     └──────────────────────┘   │
│                                │
└────────────────────────────────┘
```
**UX Rationale:** Single clear message. No feature list overwhelming user.

---

#### ONB-02: PIN Setup
```
┌────────────────────────────────┐
│                                │
│      Create Your Vault PIN     │
│                                │
│   This PIN unlocks your        │
│   encrypted storage.           │
│                                │
│      ┌─────────────────┐       │
│      │  • • • • • •    │       │
│      └─────────────────┘       │
│                                │
│   Tip: Use a PIN different     │
│   from your device unlock.     │
│                                │
│   ┌─┐ ┌─┐ ┌─┐                  │
│   │1│ │2│ │3│                  │
│   └─┘ └─┘ └─┘                  │
│   ┌─┐ ┌─┐ ┌─┐                  │
│   │4│ │5│ │6│                  │
│   └─┘ └─┘ └─┘                  │
│   ┌─┐ ┌─┐ ┌─┐                  │
│   │7│ │8│ │9│                  │
│   └─┘ └─┘ └─┘                  │
│   ┌─┐ ┌─┐ ┌─┐                  │
│   │ │ │0│ │⌫│                  │
│   └─┘ └─┘ └─┘                  │
│                                │
└────────────────────────────────┘
```
**Requirements:**
- 4-12 digits
- Show strength indicator (Weak/Medium/Strong)
- No "Continue" button — auto-advance when PIN entered

---

#### ONB-03: PIN Confirm
```
┌────────────────────────────────┐
│                                │
│       Confirm Your PIN         │
│                                │
│   Enter your PIN again         │
│   to confirm.                  │
│                                │
│      ┌─────────────────┐       │
│      │  • • • • • •    │       │
│      └─────────────────┘       │
│                                │
│                                │
│       [Same keypad]            │
│                                │
└────────────────────────────────┘
```
**On mismatch:** Subtle shake animation, "PINs don't match. Try again."

---

#### ONB-04: Biometric Opt-in
```
┌────────────────────────────────┐
│                                │
│      [Fingerprint Icon]        │
│                                │
│     Enable Quick Unlock?       │
│                                │
│   Use your fingerprint to      │
│   access your vault faster.    │
│                                │
│   Your PIN remains as backup.  │
│                                │
│                                │
│     ┌──────────────────────┐   │
│     │   Enable Biometrics  │   │
│     └──────────────────────┘   │
│                                │
│          Skip for now          │
│                                │
└────────────────────────────────┘
```
**UX Rationale:** Optional, non-pushy. Clear that PIN remains available.

---

#### ONB-05: First Import
```
┌────────────────────────────────┐
│                                │
│      [Shield + File Icon]      │
│                                │
│        You're All Set          │
│                                │
│   To access your vault:        │
│   Enter your PIN in the        │
│   calculator, then press =     │
│                                │
│   Example: 1234 + =            │
│                                │
│     ┌──────────────────────┐   │
│     │   Add Your First File│   │
│     └──────────────────────┘   │
│                                │
│      Start with calculator     │
│                                │
└────────────────────────────────┘
```
**UX Rationale:** Teaches access method immediately. Two clear paths forward.

---

## 4. Calculator Interaction Behavior

### Default Calculator State

```
┌────────────────────────────────┐
│ ≡                         ⟳   │  ← Menu (history) / Scientific toggle
├────────────────────────────────┤
│                                │
│                          0     │  ← Display (right-aligned)
│                                │
├────────────────────────────────┤
│  MC   MR   M+   M-   C   ⌫    │  ← Memory row
├────────────────────────────────┤
│  7    8    9    ÷             │
├────────────────────────────────┤
│  4    5    6    ×             │
├────────────────────────────────┤
│  1    2    3    −             │
├────────────────────────────────┤
│  %    0    .    +             │
├────────────────────────────────┤
│            =                   │  ← Full-width equals
└────────────────────────────────┘
```

### Interaction States

| Input | Display | Behavior |
|-------|---------|----------|
| `5+3` | `5+3` | Shows expression |
| `5+3=` | `8` | Shows result |
| `1234=` (wrong PIN) | `1234` | Treats as number, shows it |
| `[correct PIN]=` | `0` | Brief flash, crossfade to vault |
| `C` | `0` | Clears display |
| `⌫` | Removes last digit | Backspace |

### Vault Access Sequence

```
State 1: Calculator showing "0"
         ↓
User enters: 7 2 8 1 (their PIN)
         ↓
Display shows: "7281"
         ↓
User presses: =
         ↓
         ┌─────────────────────────────────┐
         │ System checks:                  │
         │ Is "7281" the vault PIN?        │
         │                                 │
         │ YES → Display briefly shows "0" │
         │       Crossfade to Vault Home   │
         │       (< 500ms total)           │
         │                                 │
         │ NO  → Display shows "7281"      │
         │       (normal calculator        │
         │        behavior for number)     │
         └─────────────────────────────────┘
```

### Scientific Mode (Swipe Left or Toggle)

```
┌────────────────────────────────┐
│ ≡                    [SCI]    │
├────────────────────────────────┤
│                                │
│                          0     │
│                                │
├────────────────────────────────┤
│ sin  cos  tan  ln   log  √    │
├────────────────────────────────┤
│ sin⁻¹ cos⁻¹ tan⁻¹  (   )   π │
├────────────────────────────────┤
│  7    8    9    ÷    xʸ   e  │
├────────────────────────────────┤
│  4    5    6    ×    x²   !  │
├────────────────────────────────┤
│  1    2    3    −   DEG  EXP │
├────────────────────────────────┤
│  %    0    .    +    ±   =   │
└────────────────────────────────┘
```

### Calculator History (Menu → History)

```
┌────────────────────────────────┐
│  ←  History              Clear │
├────────────────────────────────┤
│                                │
│  5 + 3                         │
│  = 8                      [↗]  │  ← Tap to reuse result
│  ─────────────────────────     │
│  12 × 4                        │
│  = 48                     [↗]  │
│  ─────────────────────────     │
│  sin(45)                       │
│  = 0.7071...              [↗]  │
│                                │
│  [Shows last 50 calculations]  │
│                                │
└────────────────────────────────┘
```

**Critical UX Detail:** PIN attempts are NEVER shown in history.

---

## 5. Vault Home UX

### Primary Layout

```
┌────────────────────────────────┐
│  ⊞  Private Storage       ⋮   │  ← Calculator icon / overflow menu
├────────────────────────────────┤
│ ┌──────┬──────┬──────┬──────┐ │
│ │Images│Videos│ Docs │Audio │ │  ← Tab bar (swipeable)
│ └──────┴──────┴──────┴──────┘ │
├────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │     │ │     │ │     │       │
│ │ 📁  │ │ 🖼  │ │ 🖼  │       │  ← Grid view (default)
│ │     │ │     │ │     │       │
│ │Trips│ │img01│ │img02│       │
│ └─────┘ └─────┘ └─────┘       │
│ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │     │ │     │ │     │       │
│ │ 🖼  │ │ 🖼  │ │ 🖼  │       │
│ │     │ │     │ │     │       │
│ │img03│ │img04│ │img05│       │
│ └─────┘ └─────┘ └─────┘       │
│                                │
│ ───────────────────────────── │
│  100 of 100 images (Free)     │  ← Storage indicator
├────────────────────────────────┤
│                                │
│    [+ Add Files]    [⚙]       │  ← Bottom action bar
│                                │
└────────────────────────────────┘
```

### View Modes

**Grid View (Default)**
- 3 columns on phone
- Thumbnails with filename below
- Folders appear first, sorted by name
- Files sorted by date (newest first)

**List View (Toggle)**
```
┌────────────────────────────────┐
│ 🖼 vacation_photo.jpg          │
│    2.4 MB • Jan 15, 2026       │
├────────────────────────────────┤
│ 🖼 document_scan.png           │
│    1.1 MB • Jan 14, 2026       │
└────────────────────────────────┘
```

### Selection Mode

**Trigger:** Long-press any item

```
┌────────────────────────────────┐
│  ✕  3 selected          ⋮     │
├────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │ ✓  │ │     │ │ ✓  │       │  ← Checkmarks on selected
│ │ 🖼  │ │ 🖼  │ │ 🖼  │       │
│ └─────┘ └─────┘ └─────┘       │
│                                │
├────────────────────────────────┤
│  [Share] [Move] [Delete]      │  ← Contextual actions
└────────────────────────────────┘
```

### Empty State

```
┌────────────────────────────────┐
│                                │
│                                │
│        [Illustration]          │
│                                │
│     No images yet              │
│                                │
│   Tap the + button below or    │
│   share files from other apps  │
│                                │
│     ┌──────────────────────┐   │
│     │     + Add Images     │   │
│     └──────────────────────┘   │
│                                │
└────────────────────────────────┘
```

### Overflow Menu (⋮)

```
┌────────────────────┐
│ ☐ Select all       │
│ ⊞ View: Grid       │  → List
│ ↕ Sort: Date       │  → Name, Size, Type
│ 🔍 Search          │
│ ⚙ Settings         │
└────────────────────┘
```

---

## 6. Media Browsing UX

### Image Viewer (VAULT-03)

```
┌────────────────────────────────┐
│ ←                   ⋮          │  ← Back / options (auto-hide)
│                                │
│                                │
│                                │
│                                │
│         [Full Image]           │
│                                │
│                                │
│                                │
│                                │
│                                │
├────────────────────────────────┤
│ vacation_photo.jpg             │
│ 2.4 MB • 3024 × 4032          │
│                                │
│ [Share]  [Delete]  [Info]     │
└────────────────────────────────┘
```

**Gestures:**
| Gesture | Action |
|---------|--------|
| Swipe left/right | Next/previous image |
| Pinch | Zoom in/out |
| Double-tap | Toggle zoom |
| Swipe down | Close viewer |
| Tap | Toggle UI visibility |

### Video Player (VAULT-04)

```
┌────────────────────────────────┐
│ ←                   ⋮          │
│                                │
│                                │
│                                │
│         [Video Frame]          │
│                                │
│            [ ▶ ]               │  ← Large play button (paused)
│                                │
│                                │
├────────────────────────────────┤
│ ●━━━━━━━━━━━━━━━━━━━━━━○      │  ← Seek bar
│ 0:45                   3:21    │
│                                │
│  [⟲10]    [▶/⏸]    [10⟳]     │  ← Skip controls
└────────────────────────────────┘
```

**Controls auto-hide after 3 seconds of no interaction.**

### Document Viewer (VAULT-05)

```
┌────────────────────────────────┐
│ ← document.pdf         🔍  ⋮  │  ← Search in doc
├────────────────────────────────┤
│                                │
│   ┌─────────────────────────┐  │
│   │                         │  │
│   │     [PDF Content]       │  │
│   │                         │  │
│   │                         │  │
│   │                         │  │
│   │                         │  │
│   └─────────────────────────┘  │
│                                │
├────────────────────────────────┤
│       < Page 3 of 12 >        │  ← Page navigation
└────────────────────────────────┘
```

### Audio Player (VAULT-06)

```
┌────────────────────────────────┐
│ ←                              │
│                                │
│                                │
│        ┌──────────────┐        │
│        │              │        │
│        │   🎵         │        │  ← Album art or waveform
│        │              │        │
│        └──────────────┘        │
│                                │
│       recording_01.m4a         │
│                                │
│ ●━━━━━━━━━━━━━━━━━━━━━━━━━○   │
│ 1:23                    4:56   │
│                                │
│     [⟲15]   [▶/⏸]   [15⟳]    │
│                                │
└────────────────────────────────┘
```

---

## 7. Security-Related UX

### PIN Entry Behaviors

**Progressive Lockout (After Failed Attempts)**
| Attempts | Delay | User Feedback |
|----------|-------|---------------|
| 1-3 | None | No indication |
| 4-5 | 1 second | Brief "wait" before accepting input |
| 6-7 | 5 seconds | "Please wait 5 seconds" |
| 8+ | 30 seconds | "Please wait 30 seconds" |

**UX Detail:** Delays happen silently within calculator — no modal, no message that reveals vault exists.

### Biometric Prompt (SEC-01)

Triggered when:
- User enters vault after session timeout
- Biometric is enabled
- Previous session used biometric

```
┌────────────────────────────────┐
│                                │
│    ┌────────────────────────┐  │
│    │                        │  │
│    │   [Fingerprint Icon]   │  │
│    │                        │  │
│    │   Unlock Private       │  │
│    │   Storage              │  │
│    │                        │  │
│    │   Use fingerprint or   │  │
│    │   enter PIN            │  │
│    │                        │  │
│    │        [Cancel]        │  │
│    │         Use PIN        │  │
│    │                        │  │
│    └────────────────────────┘  │
│                                │
└────────────────────────────────┘
```

**On cancel:** Returns to calculator with "0" displayed.

### Intruder Detection (Phase 2)

When enabled in settings:
- After 3 failed PIN attempts, front camera captures silently
- Photos stored in separate encrypted location
- No flash, no shutter sound
- User can view in Settings → Security → Access Log

**Settings Toggle:**
```
┌────────────────────────────────┐
│  Access Log                    │
│  Take photo after failed       │
│  unlock attempts         [OFF] │
└────────────────────────────────┘
```

**UX Rationale:** Off by default. Requires camera permission only when enabled.

### Session Timeout

**Settings:**
```
┌────────────────────────────────┐
│  Auto-lock vault               │
│                                │
│  ○ Immediately                 │
│  ○ After 30 seconds            │
│  ● After 1 minute (default)    │
│  ○ After 5 minutes             │
│  ○ When app closes             │
└────────────────────────────────┘
```

**Behavior:** After timeout, vault access requires PIN/biometric again. Calculator remains functional.

---

## 8. Vault Profiles UX (Phase 2)

**Note:** This is called "Vault Profiles" not "Decoy Vault" in all user-facing UI.

### Setup Flow

```
Settings → Security → Vault Profiles → Add Profile

┌────────────────────────────────┐
│  ←  Add Vault Profile          │
├────────────────────────────────┤
│                                │
│  Profile Name                  │
│  ┌─────────────────────────┐   │
│  │  Work                   │   │
│  └─────────────────────────┘   │
│                                │
│  Access PIN                    │
│  ┌─────────────────────────┐   │
│  │  • • • • • •            │   │
│  └─────────────────────────┘   │
│                                │
│  Each profile has separate     │
│  storage and its own PIN.      │
│                                │
│     ┌──────────────────────┐   │
│     │   Create Profile     │   │
│     └──────────────────────┘   │
│                                │
└────────────────────────────────┘
```

### Profile Switching

From vault home, user can:
1. Return to calculator
2. Enter different PIN → opens that profile

**No profile selector UI** — profiles are accessed solely by PIN.

### Profile Indicator (Subtle)

```
┌────────────────────────────────┐
│  ⊞  Private Storage            │
│      Work                      │  ← Small profile name
├────────────────────────────────┤
```

---

## 9. Settings Information Architecture

### Settings Home (SET-01)

```
┌────────────────────────────────┐
│  ←  Settings                   │
├────────────────────────────────┤
│                                │
│  SECURITY                      │
│  ┌─────────────────────────┐   │
│  │ 🔐 PIN & Biometrics     │   │
│  │ 🕐 Auto-lock            │   │
│  │ 📋 Recovery (Phase 2)   │   │
│  └─────────────────────────┘   │
│                                │
│  STORAGE                       │
│  ┌─────────────────────────┐   │
│  │ 💾 Storage Used         │   │
│  │    145 files • 2.3 GB   │   │
│  │ 📁 Manage Folders       │   │
│  └─────────────────────────┘   │
│                                │
│  CALCULATOR                    │
│  ┌─────────────────────────┐   │
│  │ 🔢 Calculator Settings  │   │
│  │ 📜 Calculation History  │   │
│  └─────────────────────────┘   │
│                                │
│  APPEARANCE                    │
│  ┌─────────────────────────┐   │
│  │ 🎨 Theme                │   │
│  │ 📐 Calculator Style     │   │
│  └─────────────────────────┘   │
│                                │
│  PREMIUM                       │
│  ┌─────────────────────────┐   │
│  │ ⭐ Upgrade to Premium   │   │
│  └─────────────────────────┘   │
│                                │
│  ABOUT                         │
│  ┌─────────────────────────┐   │
│  │ ℹ About VaultCalc       │   │
│  │ 📄 Privacy Policy       │   │
│  │ 💬 Send Feedback        │   │
│  └─────────────────────────┘   │
│                                │
└────────────────────────────────┘
```

### Security Settings (SET-02)

```
┌────────────────────────────────┐
│  ←  PIN & Biometrics           │
├────────────────────────────────┤
│                                │
│  VAULT PIN                     │
│  ┌─────────────────────────┐   │
│  │ Change PIN              │ → │
│  └─────────────────────────┘   │
│                                │
│  QUICK UNLOCK                  │
│  ┌─────────────────────────┐   │
│  │ Use Fingerprint    [ON] │   │
│  └─────────────────────────┘   │
│                                │
│  AUTO-LOCK                     │
│  ┌─────────────────────────┐   │
│  │ Lock vault after...     │   │
│  │ 1 minute               →│   │
│  └─────────────────────────┘   │
│                                │
│  ADVANCED (Phase 2)            │
│  ┌─────────────────────────┐   │
│  │ Vault Profiles          │ → │
│  │ Access Log              │ → │
│  │ Recovery Phrase         │ → │
│  └─────────────────────────┘   │
│                                │
└────────────────────────────────┘
```

### Calculator Settings (SET-07)

```
┌────────────────────────────────┐
│  ←  Calculator                 │
├────────────────────────────────┤
│                                │
│  PRECISION                     │
│  ┌─────────────────────────┐   │
│  │ Decimal places          │   │
│  │ 8                      →│   │
│  └─────────────────────────┘   │
│                                │
│  FEEDBACK                      │
│  ┌─────────────────────────┐   │
│  │ Button haptics     [ON] │   │
│  │ Button sounds     [OFF] │   │
│  └─────────────────────────┘   │
│                                │
│  ANGLE MODE                    │
│  ┌─────────────────────────┐   │
│  │ ● Degrees               │   │
│  │ ○ Radians               │   │
│  └─────────────────────────┘   │
│                                │
│  HISTORY                       │
│  ┌─────────────────────────┐   │
│  │ Clear History           │   │
│  └─────────────────────────┘   │
│                                │
└────────────────────────────────┘
```

---

## 10. Subscription & Upgrade UX

### Design Principles

1. **Value first** — User hits limit, not arbitrary time gate
2. **No blocking** — User can always dismiss and manage files
3. **Transparent** — Clear what free includes, what premium adds
4. **No urgency** — No countdown, no "limited time" language

### Upgrade Prompt (MOD-05)

**Trigger:** User tries to add 101st image (or exceeds other limit)

```
┌────────────────────────────────┐
│                                │
│    ┌────────────────────────┐  │
│    │                        │  │
│    │   You've reached the   │  │
│    │   free storage limit   │  │
│    │                        │  │
│    │   100 / 100 images     │  │
│    │                        │  │
│    │   Upgrade to Premium   │  │
│    │   for unlimited        │  │
│    │   storage.             │  │
│    │                        │  │
│    │  ┌──────────────────┐  │  │
│    │  │ See Premium      │  │  │
│    │  └──────────────────┘  │  │
│    │                        │  │
│    │    Manage my files     │  │
│    │                        │  │
│    │    Maybe later         │  │
│    │                        │  │
│    └────────────────────────┘  │
│                                │
└────────────────────────────────┘
```

### Premium Screen (SET-05)

```
┌────────────────────────────────┐
│  ←  Premium                    │
├────────────────────────────────┤
│                                │
│        VaultCalc Premium       │
│                                │
│  ┌─────────────────────────┐   │
│  │ ✓ Unlimited file storage│   │
│  │ ✓ Unlimited folders     │   │
│  │ ✓ Auto-import (Phase 2) │   │
│  │ ✓ Vault profiles (Ph 2) │   │
│  │ ✓ No ads                │   │
│  │ ✓ Priority support      │   │
│  └─────────────────────────┘   │
│                                │
│  ┌─────────────────────────┐   │
│  │  $3.99 / month          │   │
│  │  ────────────────────   │   │
│  │  or                     │   │
│  │  $24.99 / year          │   │
│  │  Save 48%               │   │
│  └─────────────────────────┘   │
│                                │
│     ┌──────────────────────┐   │
│     │   Start Free Trial   │   │
│     └──────────────────────┘   │
│                                │
│  7-day free trial. Cancel      │
│  anytime in Google Play.       │
│                                │
│  ┌─────────────────────────┐   │
│  │  Restore Purchase       │   │
│  └─────────────────────────┘   │
│                                │
└────────────────────────────────┘
```

### Post-Purchase Confirmation

```
┌────────────────────────────────┐
│                                │
│           [✓ Icon]             │
│                                │
│    Welcome to Premium          │
│                                │
│    Your storage is now         │
│    unlimited.                  │
│                                │
│     ┌──────────────────────┐   │
│     │    Continue          │   │
│     └──────────────────────┘   │
│                                │
└────────────────────────────────┘
```

### Storage Indicator (Persistent, Non-Intrusive)

At bottom of vault home for free users:

```
───────────────────────────────────
 85 of 100 images • Upgrade for more
───────────────────────────────────
```

**At 90%+:**
```
───────────────────────────────────
 95 of 100 images • Almost full
───────────────────────────────────
```

**Premium users:** No indicator shown.

---

## Critical UX Decisions — Rationale Summary

| Decision | Rationale |
|----------|-----------|
| Calculator as default screen | Must feel like a real calculator app; reduces suspicion |
| PIN attempts show nothing | No error state that reveals vault existence |
| No "hidden" language | Play Store policy compliance |
| Biometric opt-in not push | Respects user choice; some users prefer PIN-only |
| Session timeout configurable | Different users have different security needs |
| Upgrade prompt has 3 options | Always provides escape; no forced decision |
| Tabs not drawer for vault | One-hand reachability; faster navigation |
| Grid as default view | Thumbnails are primary for photos/videos |
| Auto-hide viewer controls | Maximizes media viewing area |
| Profile indicator subtle | Doesn't draw attention to multiple vaults |

---

*Document complete. Ready for design system application and prototype development.*
