---
phase: 15
slug: identity-continuity-membership-integrity
status: complete
audited: 2026-08-02
baseline: 15-UI-SPEC.md
screenshots: captured
overall_score: 14/24
---

# Phase 15 — UI Review

**Audited:** 2026-08-02  
**Baseline:** approved `15-UI-SPEC.md` design contract  
**Screenshots:** captured via Playwright at 1440×900 and 375×812 in `.planning/ui-reviews/15-20260802-1725/`

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | Failure copy exposes arbitrary implementation errors instead of the contract’s recovery-safe message. |
| 2. Visuals | 2/4 | The confirmation dialog omits the required close affordance and therefore does not fully match the established dialog structure. |
| 3. Color | 2/4 | Accent use diverges from the reserved 10% map: the open trigger is muted, while busy status is accent-colored. |
| 4. Typography | 2/4 | New/affected profile UI uses several undeclared fractional-rem sizes rather than the four locked sizes. |
| 5. Spacing | 3/4 | Core dialog geometry is correct, but new controls/error treatment introduce non-token spacing values. |
| 6. Experience Design | 3/4 | Native modal, busy lock, recovery lock, focus and method isolation are sound; the missing explicit close control weakens the non-destructive exit pattern. |

**Overall: 14/24**

---

## Top 3 Priority Fixes

1. **Normalize dialog failures to the approved message** — raw/internal recovery and rotation errors can confuse users at a privacy boundary — render exactly `Unable to rotate your identity. Your current identity and local room access are unchanged. Try again.` for recoverable failures, while retaining only the non-dismissable recovery surface after the durable boundary.
2. **Add the specified 44px close control to the confirm dialog** — keyboard/pointer users lack the established header dismissal affordance — add an accessible close button to `IdentityRotationDialog`, disable it while busy, omit/disable it for recovery, and preserve focus return to `.user-trigger`.
3. **Apply the locked token/color rules to the identity menu and dialog** — selected identity state is visually under-signalled and token drift reduces the contract’s deliberate terminal hierarchy — use the accent border for `[aria-expanded="true"]`, keep busy text secondary, and replace fractional font/spacing values with the declared 10/12/14/18px and 4px-grid tokens.

---

## Detailed Findings

### Pillar 1: Copywriting (2/4)

- **WARNING — Contract error copy is not enforced.** `IdentityRotationDialog` renders the thrown error verbatim (`src/components/IdentityRotationDialog.svelte:40`). `rotateAnonymousIdentity()` can throw implementation-specific messages such as acknowledgement failures (`src/identity/user-profile.svelte.ts:150`), while recovery falls back to a different unapproved message. This violates the canonical error-state copy and can describe an unrecoverable post-boundary condition as a retryable one.
- **PASS evidence:** initiating CTA, title, empty heading/body, impact singular/plural wording, recovery title/body, busy labels, and completion announcement match the contract (`src/components/IdentityRotationDialog.svelte:19-21, 61, 66, 70-75, 80-82`; `src/components/UserProfile.svelte:124-128, 201-203`). No Phase 15 CTA is labelled `Cancel`.

### Pillar 2: Visuals (2/4)

- **WARNING — The new confirm dialog has no explicit close button.** The established native-dialog pattern has a labelled 44px header close control (`src/components/RoomRemovalDialog.svelte:73-79`); `IdentityRotationDialog` renders only a header text block (`src/components/IdentityRotationDialog.svelte:57-63`). This misses the UI spec’s explicit close-control sizing requirement and makes the non-destructive exit less discoverable, especially after the profile menu has been obscured by the modal.
- **PASS evidence:** screenshot review found no clipping in the 375px shell capture. The CAHMLS camel and wordmark remain visible and aligned in the affected shell (`src/components/WorkspaceNav.svelte:459-463`); no Phase 15 header control or duplicate identity surface was added.

### Pillar 3: Color (2/4)

- **WARNING — Open identity trigger does not use the required accent border.** The contract reserves `#87ff9f` for the selected/open profile trigger, but `[aria-expanded="true"]` uses muted `#34483a` (`src/components/UserProfile.svelte:313-314`). The open state is therefore visually weaker than specified.
- **WARNING — Accent is used for busy status outside the declared role.** `.live` uses `#87ff9f` (`src/components/IdentityRotationDialog.svelte:99`) even though the contract reserves accent for focus, selected trigger, and non-destructive action hover/focus. Busy status should use secondary body/status color so destructive action remains the focal point.
- **PASS evidence:** the dialog’s dominant/surface/destructive colors are otherwise contract-aligned (`src/components/IdentityRotationDialog.svelte:88-90, 98, 103-107`).

### Pillar 4: Typography (2/4)

- **WARNING — The affected profile surface violates the locked type scale.** The phase contract permits only 10px, 12px, 14px, and 18px in new Phase 15 UI. The profile/menu styles use values including `.68rem`, `.5rem`, `.8rem`, `.58rem`, `.56rem`, `.72rem`, and `.65rem` (`src/components/UserProfile.svelte:317-335`), yielding fractional rendered sizes such as 10.88px and 12.8px. This undermines the specified utility/body/emphasis hierarchy.
- **PASS evidence:** dialog heading/body/impact correctly use 18px/12px/14px and locked weights (`src/components/IdentityRotationDialog.svelte:92-97, 102`).

### Pillar 5: Spacing (3/4)

- **WARNING — New dialog micro-spacing is not consistently on the 4px scale.** The error treatment uses `.65rem .75rem` (10.4px/12px), and CTA horizontal padding uses `.8rem` (12.8px) (`src/components/IdentityRotationDialog.svelte:98, 102`). The contract requires declared multiples of 4, so these values should become 12px/12px or 8px/16px as appropriate.
- **PASS evidence:** required responsive constraints are implemented: `width: min(29rem, calc(100vw - 1rem))`, `max-height: calc(100dvh - 1rem)`, grid header/body/footer, and body-only vertical scrolling (`src/components/IdentityRotationDialog.svelte:88-100`). The mobile screenshot shows no horizontal overflow.

### Pillar 6: Experience Design (3/4)

- **WARNING — Non-destructive dismissal is functional but incomplete.** Escape and backdrop dismissal are guarded by busy/recovery state (`src/components/IdentityRotationDialog.svelte:28-30, 53-55`) and default focus correctly lands on `Keep current identity` (`src/components/IdentityRotationDialog.svelte:23-26`), but the absent close control leaves the required pointer-accessible header dismissal path unimplemented.
- **PASS evidence:** confirm and recovery use native modal dialogs with labels/descriptions; busy disables every rendered action and provides a polite status (`src/components/IdentityRotationDialog.svelte:47-55, 75, 80-82`). Recovery is non-dismissable, focus returns to the trigger after confirm dismissal/error (`src/components/UserProfile.svelte:301-305`), and rotate is isolated to anonymous mode (`src/components/UserProfile.svelte:190-203, 236-245`). Targeted browser evidence also checks default focus and recovery Escape resistance (`tests/e2e/nip07-session-restoration.spec.ts:271-280`; `tests/e2e/stale-local-sessions.spec.ts:330-335`).

---

## Registry Safety

Registry audit: skipped — `components.json` is absent and `15-UI-SPEC.md` declares no third-party registries.

---

## Files Audited

- `15-01-SUMMARY.md`, `15-02-SUMMARY.md`, `15-03-SUMMARY.md`
- `15-01-PLAN.md`, `15-02-PLAN.md`, `15-03-PLAN.md`, `15-CONTEXT.md`, `15-UI-SPEC.md`
- `src/components/IdentityRotationDialog.svelte`
- `src/components/UserProfile.svelte`
- `src/components/RoomRemovalDialog.svelte`
- `src/components/WorkspaceNav.svelte`
- `src/components/HostWorkspace.svelte`, `src/App.svelte`, `src/app.css`
- `src/identity/user-profile.svelte.ts`
- `tests/e2e/nip07-session-restoration.spec.ts`, `tests/e2e/stale-local-sessions.spec.ts`, `tests/unit/user-profile.test.ts`
