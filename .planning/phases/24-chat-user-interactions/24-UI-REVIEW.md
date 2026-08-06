# Phase 24 — UI Review

**Audited:** 2026-08-06  
**Baseline:** `24-UI-SPEC.md` (approved)  
**Screenshots:** captured at desktop (1440×900), tablet (768×1024), and mobile (375×812) in `.planning/ui-reviews/24-20260806-214022/`. The live dev server stopped at the pre-auth identity screen, so these do not visually evidence the Phase 24 chat surfaces; component code and the focused browser suite were audited instead.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | Ignore disclosure omits its required visible `Show messages` / `Hide messages` action, and the selected highlight is never named in the menu. |
| 2. Visuals | 2/4 | The compact shared surface exists, but the active highlight choice has no visible selected state and the author trigger misses its required touch affordance. |
| 3. Color | 2/4 | Phase 24 menus use undeclared dark surfaces and have no selected highlight-swatch treatment; this does not meet the declared token roles. |
| 4. Typography | 1/4 | All new participant-menu type is materially below the contracted 12/14/16/20px scale, including a 9.3px coordinator label. |
| 5. Spacing | 2/4 | New surface spacing uses arbitrary fractional rem values and a 16px compact gutter where the contract requires 32px. |
| 6. Experience Design | 1/4 | The non-self author trigger has no 44px minimum hit target, blocking reliable touch access to every Phase 24 action. |

**Overall: 10/24**

---

## Top 3 Priority Fixes

1. **BLOCKER — Make every non-self author identity trigger at least 44×44px.** The sole entry point to mention, invite, follow, highlight, and ignore is currently content-sized (`.participant-trigger` has no `min-height` or `min-width`). Add `min-height: 44px; min-width: 44px` while preserving the existing author alignment and streak geometry.
2. **BLOCKER — Replace the sub-12px participant UI scale with the contract’s four sizes.** Map supporting text to 12px/400, action and room rows to 14px/400, section labels to 16px/600, and chooser headings to 20px/600. Do not retain the current `.58rem`–`.78rem` values or 700/760 weights for new Phase 24 UI.
3. **WARNING — Make highlight and ignore state explicit, selected, and contract-copy compliant.** Render `Highlight: {color}` in the menu; give the active palette choice a text/semantic selected state (for example `aria-pressed="true"` plus accent treatment); and put visible `Show messages` / `Hide messages` text on each disclosure, not only in its accessible name.

---

## Detailed Findings

### Pillar 1: Copywriting (2/4)

- **WARNING:** Both panes render only `{name} posted {N} message(s)` for an ignored streak. `Show messages` / `Hide messages` appears only inside `aria-label`, although the contract requires the button’s *visible action* to change. See [ChatRoute.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/ChatRoute.svelte:818) and [HostWorkspace.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/HostWorkspace.svelte:1896).
- **WARNING:** Highlight is always labelled simply `Highlight`; after a selection, the menu exposes no required `Highlight: {color}` label. The off-screen status is useful feedback but is not persistent state communication. See [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:128) and [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:329).
- The required participant action, invite, anonymous-follow, pending/success, empty chooser, and retry-copy strings otherwise match the contract. Focused browser coverage passed 7/7.

### Pillar 2: Visuals (2/4)

- **BLOCKER:** The author identity is the only participant-action trigger but has no 44px minimum dimension. Its padding is only `.18rem .26rem`, so its visual and touch target tracks the small author text rather than the mandated target size. See [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:390).
- **WARNING:** The palette is text-only and every choice has the same appearance; there is no swatch, checkmark, accent row, or selected-state styling. A user cannot inspect the current private highlight after reopening the menu. See [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:331) and [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:399).
- **WARNING:** The live captures show only onboarding because the running server was unauthenticated. The intended participant surfaces therefore need a human visual pass in an authenticated/seeded chat state despite automated behavioural coverage.

### Pillar 3: Color (2/4)

- **WARNING:** The approved secondary surface is `#101614`, but the new menu/chooser is `#0c120f`; active and hover surfaces likewise use undeclared `#101a13` and `#14241a`. This breaks the declared color token contract rather than simply reusing the secondary role. See [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:391) and [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:393).
- **WARNING:** Accent `#7cf59d` is correctly used for focus and hover, and mention `#f1f58f`, divider `#293832`, and error `#ffaaa3` are present. However, the required active highlight choice has no accent application at all; the palette’s own named values are not visually represented in the chooser. See [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:400).
- Phase-specific `MessageGroup` CSS contains 24 literal hex colours plus rgba variants, with no local role variables; this makes the promised 60/30/10 distribution un-auditable and has already allowed role drift.

### Pillar 4: Typography (1/4)

- **BLOCKER:** The contract permits exactly 12px, 14px, 16px, and 20px for new Phase 24 UI. The participant UI instead declares `.58rem` (9.28px), `.62rem` (9.92px), `.72rem` (11.52px), `.78rem` (12.48px), and `.7rem` (11.2px). The chooser heading is 12.48px rather than the required 20px/600; action labels inherit the pre-existing small message scale rather than 14px. See [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:397), [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:400), [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:402), and [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:406).
- **WARNING:** New emphasis uses `font-weight: 700` and `760`, while the approved Phase 24 contract permits only 400 and 600. See [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:402) and [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:419).

### Pillar 5: Spacing (2/4)

- **WARNING:** New menu spacing is built from `.1rem`, `.15rem`, `.16rem`, `.18rem`, `.25rem`, `.35rem`, `.55rem`, `.65rem`, and `.75rem`, rather than the approved 4px scale. Negative guidance margins additionally make the compact surface fragile at larger text settings. See [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:393), [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:397), and [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:399).
- **WARNING:** At ≤520px, the contract requires panels bounded to `calc(100vw - 32px)`. The CSS starts at `calc(100vw - 1rem)` and the overlay directive forces an 8px gutter, equivalent to `calc(100vw - 16px)`. The component can be contained but does not preserve the specified 16px side inset. See [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:393), [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:321), and [viewport-overlay.ts](/Users/sandwich/Develop/cordn-adhoc-cvm/src/lib/viewport-overlay.ts:42).
- Room rows and menu actions do meet 44px minimum height (`2.75rem`); the trigger does not.

### Pillar 6: Experience Design (1/4)

- **BLOCKER:** Because the required single author trigger is smaller than 44px, touch users cannot reliably begin any Phase 24 flow. This violates the participant-trigger accessibility exception and affects host and invitee alike through the shared component. See [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:247) and [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:390).
- **WARNING:** The highlight popover is a plain `div aria-label="Highlight color"` with buttons that do not communicate the active value using `aria-pressed`, `aria-current`, or an equivalent selected semantic. Keyboard and screen-reader users cannot determine the current preference. See [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:329) and [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:331).
- **WARNING:** Compact containment and reduced-motion checks pass at 320px, but the test only asserts containment, not the contract’s 32px panel width/gutter. See [chat-user-interactions.spec.ts](/Users/sandwich/Develop/cordn-adhoc-cvm/tests/e2e/chat-user-interactions.spec.ts:286).
- Positive evidence: menu focus enters Mention, Escape returns to the originating trigger, outside focus/pointer dismisses the surface, disabled anonymous follow has guidance, invite/follow use busy and live status, and host/invitee flows passed 7 focused browser tests.

---

## Files Audited

- `.planning/phases/24-chat-user-interactions/24-UI-SPEC.md`
- `.planning/phases/24-chat-user-interactions/24-CONTEXT.md`
- `.planning/phases/24-chat-user-interactions/24-01-PLAN.md` through `24-04-PLAN.md`
- `.planning/phases/24-chat-user-interactions/24-01-SUMMARY.md` through `24-04-SUMMARY.md`
- `.planning/phases/24-chat-user-interactions/24-REVIEW.md` and `24-REVIEW-FIX.md`
- `src/components/MessageGroup.svelte`
- `src/components/HostWorkspace.svelte`
- `src/components/ChatRoute.svelte`
- `src/chat/chat-participant-preferences.svelte.ts`
- `src/chat/message-presentation.ts`
- `src/lib/viewport-overlay.ts`
- `src/app.css`
- `tests/e2e/chat-user-interactions.spec.ts`

Registry audit: skipped — `components.json` is absent and the approved UI specification declares no third-party registry.
