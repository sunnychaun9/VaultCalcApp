# VaultCalc - Development Playbook
## How to Build This App Correctly Across Sessions

---

## 1. Development Philosophy

### Core Principles
1. **Incremental Progress**: Small, tested changes over big rewrites
2. **Documentation First**: Update docs before/after code changes
3. **Security by Default**: Never compromise security for speed
4. **Test Critical Paths**: Crypto, auth, and data operations must be tested
5. **Preserve Context**: Every session should build on previous work

### Development Mindset
```
Before coding: "What doc describes this feature?"
While coding:  "Does this match the spec exactly?"
After coding:  "What did I change that needs documenting?"
```

---

## 2. Step-by-Step Development Process

### Phase 0: Project Setup (One-Time)

```
Step 0.1: Initialize React Native project
Step 0.2: Configure TypeScript strictly
Step 0.3: Set up project structure per architecture doc
Step 0.4: Configure ESLint + Prettier
Step 0.5: Set up native module skeleton (Kotlin)
Step 0.6: Verify build succeeds on Android
```

### Phase 1: MVP Development

```
┌─────────────────────────────────────────────────────────────┐
│                    MVP BUILD ORDER                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. CALCULATOR (No vault yet)                               │
│     ├── 1.1 Calculator UI (display + keypad)                │
│     ├── 1.2 Calculator logic (operations)                   │
│     ├── 1.3 Calculator history                              │
│     └── 1.4 Calculator polish (haptics, animations)         │
│                                                              │
│  2. NATIVE CRYPTO MODULE                                    │
│     ├── 2.1 Tink integration in Kotlin                      │
│     ├── 2.2 Argon2id key derivation                         │
│     ├── 2.3 AES-256-GCM encrypt/decrypt                     │
│     ├── 2.4 Keystore integration                            │
│     └── 2.5 JS bridge (JSI or Bridge)                       │
│                                                              │
│  3. AUTHENTICATION                                          │
│     ├── 3.1 PIN detection in calculator                     │
│     ├── 3.2 PIN storage (hashed)                            │
│     ├── 3.3 PIN verification                                │
│     ├── 3.4 Auth state management                           │
│     └── 3.5 Auto-lock logic                                 │
│                                                              │
│  4. VAULT CORE                                              │
│     ├── 4.1 Vault home screen                               │
│     ├── 4.2 Navigation structure                            │
│     ├── 4.3 Photo gallery (encrypted thumbnails)            │
│     ├── 4.4 Photo viewer (decryption)                       │
│     └── 4.5 Lock/return to calculator                       │
│                                                              │
│  5. FILE OPERATIONS                                         │
│     ├── 5.1 File picker integration                         │
│     ├── 5.2 Import flow (pick → encrypt → store)            │
│     ├── 5.3 Thumbnail generation + encryption               │
│     ├── 5.4 Database metadata storage                       │
│     └── 5.5 Delete flow (file + key + metadata)             │
│                                                              │
│  6. ONBOARDING                                              │
│     ├── 6.1 First-launch detection                          │
│     ├── 6.2 PIN creation flow                               │
│     ├── 6.3 Tutorial screens                                │
│     └── 6.4 First import prompt                             │
│                                                              │
│  7. SETTINGS (Basic)                                        │
│     ├── 7.1 Settings screen structure                       │
│     ├── 7.2 Change PIN                                      │
│     ├── 7.3 Lock timeout setting                            │
│     └── 7.4 Theme toggle                                    │
│                                                              │
│  8. POLISH & TEST                                           │
│     ├── 8.1 Error handling throughout                       │
│     ├── 8.2 Edge case handling                              │
│     ├── 8.3 Performance optimization                        │
│     └── 8.4 Security audit                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Rules for AI-Generated Code

### ALWAYS Do
1. Follow existing code patterns in the project
2. Use TypeScript with strict typing (no `any`)
3. Add error handling for all async operations
4. Use existing utilities rather than creating new ones
5. Match the design system exactly (colors, spacing, typography)
6. Include JSDoc comments for public functions
7. Follow the file/folder structure in architecture doc

### NEVER Do
1. Generate placeholder/TODO code without asking
2. Skip type definitions
3. Use deprecated React patterns (class components, etc.)
4. Add dependencies without explicit approval
5. Modify security-critical code without review
6. Change file structure without approval
7. Remove existing functionality
8. Use `console.log` for debugging (use proper logger)

### Code Quality Checklist
```
Before submitting any code:
□ Types complete and accurate
□ Error handling present
□ No console.log statements
□ Follows existing patterns
□ Matches design system
□ No unused imports/variables
□ No TypeScript errors
□ No ESLint warnings
```

---

## 4. How to Break Features into Prompts

### Good Prompt Structure
```
Feature: [Name from FEATURE_INDEX.md]
Reference: [Which doc section defines this]
Scope: [Exactly what to build]
Not Included: [What to explicitly skip]
Output: [Files to create/modify]
```

### Example: Good Prompt
```
Feature: Calculator Display Component
Reference: 02-UX-Design.md Section 4.1, 03-Design-System.md Section 3
Scope:
- Create Display.tsx component
- Show current input and result
- Show calculation history (last 3)
- Support light/dark theme
Not Included:
- Scientific calculator mode
- Calculator logic (separate task)
Output:
- src/features/calculator/components/Display.tsx
- Update any necessary types
```

### Example: Bad Prompt
```
"Build the calculator"
```
(Too vague - what part? What files? What scope?)

### Prompt Size Guidelines
| Complexity | Lines of Code | Components | Recommended |
|------------|---------------|------------|-------------|
| Simple | < 100 | 1 | Single prompt |
| Medium | 100-300 | 1-2 | Single prompt |
| Complex | 300-500 | 2-3 | 2-3 prompts |
| Large | 500+ | 4+ | Break into features |

---

## 5. Validation & Review Checklist

### Before Accepting Code

#### Functional Checks
- [ ] Code compiles without errors
- [ ] Feature works as specified
- [ ] Edge cases handled
- [ ] Error states handled
- [ ] Loading states present (if async)

#### Quality Checks
- [ ] TypeScript strict mode passes
- [ ] No `any` types
- [ ] Consistent naming conventions
- [ ] No duplicate code
- [ ] Reasonable file size (< 300 lines preferred)

#### Security Checks (for sensitive code)
- [ ] No sensitive data logged
- [ ] Proper input validation
- [ ] Secure random generation used
- [ ] Keys cleared from memory after use
- [ ] Temp files deleted after use

#### UX Checks
- [ ] Matches design system
- [ ] Accessible (proper labels)
- [ ] Responsive to different screen sizes
- [ ] Haptic feedback where specified
- [ ] Animations smooth (60fps)

#### Performance Checks
- [ ] No unnecessary re-renders
- [ ] Large lists use FlashList
- [ ] Images properly cached
- [ ] No blocking operations on main thread

---

## 6. When Refactoring is Allowed vs Forbidden

### Refactoring ALLOWED
- [ ] Fixing TypeScript errors
- [ ] Removing unused code
- [ ] Improving type definitions
- [ ] Extracting repeated code to utilities
- [ ] Performance optimizations with benchmarks
- [ ] Security improvements
- [ ] Bug fixes

### Refactoring FORBIDDEN (without approval)
- [ ] Changing file/folder structure
- [ ] Changing state management approach
- [ ] Changing navigation structure
- [ ] Modifying crypto implementation
- [ ] Changing database schema
- [ ] Adding new dependencies
- [ ] Changing API contracts
- [ ] Renaming public interfaces

### Refactoring Decision Flow
```
Is this a bug fix? → ALLOWED
Is this a security fix? → ALLOWED (but document)
Does it change behavior? → NEEDS APPROVAL
Does it change architecture? → NEEDS APPROVAL
Does it touch crypto? → NEEDS CAREFUL REVIEW
```

---

## 7. Keeping Performance Intact

### Performance Monitoring Points
```
┌─────────────────────────────────────────────────────────────┐
│                 PERFORMANCE CHECKPOINTS                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  STARTUP                                                     │
│  ├── App cold start: Measure from launch to interactive     │
│  └── Target: < 800ms                                        │
│                                                              │
│  VAULT ACCESS                                                │
│  ├── PIN entry to vault visible                             │
│  ├── Includes: key derivation + decryption + navigation     │
│  └── Target: < 300ms                                        │
│                                                              │
│  MEDIA LOADING                                               │
│  ├── Grid of 50 thumbnails                                  │
│  ├── Each thumbnail decryption                              │
│  └── Target: < 50ms per thumbnail                           │
│                                                              │
│  FILE IMPORT                                                 │
│  ├── 10MB file pick to stored                               │
│  ├── Includes: copy + encrypt + thumbnail + metadata        │
│  └── Target: < 3 seconds                                    │
│                                                              │
│  MEMORY                                                      │
│  ├── Idle state (calculator visible)                        │
│  ├── Active state (browsing gallery)                        │
│  └── Target: < 120MB idle, < 200MB active                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Performance Rules
1. Profile before optimizing (don't guess)
2. Cache aggressively, clear aggressively
3. Use pagination/windowing for lists
4. Compress thumbnails before encryption
5. Run crypto operations off main thread
6. Use `React.memo` for expensive components
7. Avoid anonymous functions in render

---

## 8. Keeping Security Intact

### Security Invariants
These must ALWAYS be true:

```
1. Files at rest are ALWAYS encrypted
2. PIN is NEVER stored in plain text
3. Decryption keys are NEVER logged
4. Temp files are ALWAYS deleted on lock
5. Crypto operations use Tink ONLY
6. Key derivation uses Argon2id ONLY
7. Encryption uses AES-256-GCM ONLY
```

### Security Review Triggers
Full security review required when:
- [ ] Any change to crypto module
- [ ] Any change to auth flow
- [ ] Any change to PIN handling
- [ ] Any change to key storage
- [ ] Any change to file encryption
- [ ] Any change to temp file handling

### Security Testing Checklist
```
After security-related changes:
□ PIN brute force protection works
□ Wrong PIN shows no vault hint
□ Decoy PIN works correctly
□ Auto-lock functions properly
□ Temp files cleared on lock
□ Memory cleared after use
□ No sensitive data in logs
```

---

## 9. Session Handoff Protocol

### Starting a New Session
```
1. Read PROJECT_CONTEXT.md (refresher)
2. Read FEATURE_INDEX.md (current status)
3. Read CHANGE_LOG.md (recent changes)
4. Check any in-progress features
5. Resume or start new task
```

### Ending a Session
```
1. Update FEATURE_INDEX.md status
2. Add entry to CHANGE_LOG.md
3. Document any decisions made
4. Note any blockers or questions
5. Commit all changes with clear message
```

### Handoff Note Template
```markdown
## Session Summary - [Date]

### Completed
- [What was finished]

### In Progress
- [What was started but not finished]

### Blocked
- [What couldn't be done and why]

### Decisions Made
- [Any choices that affect future work]

### Next Steps
- [What should happen next session]
```

---

## 10. Emergency Procedures

### If Security Bug Found
1. STOP current work
2. Document the bug privately
3. Assess severity (1-5)
4. If severity 4-5: Flag for immediate fix
5. Do not deploy until fixed

### If Performance Regression Found
1. Identify the change that caused it
2. Measure the impact (before/after)
3. Decide: Fix now or revert?
4. Document in CHANGE_LOG.md

### If Build Breaks
1. Do not add more changes
2. Identify the breaking change
3. Fix or revert
4. Verify build succeeds
5. Then continue

---

## 11. Quality Gates

### Before Marking Feature "Complete"
```
□ All acceptance criteria met
□ Code review completed
□ Tests passing (if applicable)
□ Performance acceptable
□ Security review (if applicable)
□ Documentation updated
□ FEATURE_INDEX.md updated
□ CHANGE_LOG.md entry added
```

### Before Release
```
□ All MVP features complete
□ Full app smoke test
□ Security audit passed
□ Performance benchmarks met
□ No critical bugs open
□ Play Store assets ready
□ Privacy policy updated
```

---

*Document Version: 1.0*
*Last Updated: 2024*
*Purpose: Guide consistent, high-quality development*
