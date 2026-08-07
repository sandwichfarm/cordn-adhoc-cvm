# Phase 25 — UI Review

**Audited:** 2026-08-07  
**Baseline:** `25-UI-SPEC.md`  
**Screenshots:** captured — desktop, tablet, and mobile at `.planning/ui-reviews/25-20260807-020832/`; each reaches the unauthenticated identity screen, so authenticated sidebar/invite screenshots could not be compared directly.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Required favorite and offline strings are exact, but non-online states all claim the coordinator is offline. |
| 2. Visuals | 3/4 | Shared favorite rows, selected-state star, neutral disabled invite, and 44px controls are implemented; authenticated screenshot comparison is unavailable. |
| 3. Color | 3/4 | Green stays focused on the active rail, selected star, and focus, but the 60/30/10 distribution was not visually provable from the captured route. |
| 4. Typography | 2/4 | Phase components use weights outside the required 400/600 pair. |
| 5. Spacing | 2/4 | Several Phase 25 controls use off-grid fractional spacing rather than the specified 4px scale. |
| 6. Experience Design | 2/4 | Core offline behavior passes, but no browser proof covers online re-enable or Phase 25 reduced motion. |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **WARNING — Add browser coverage for online → offline → online and reduced-motion behavior.** The current invite test establishes only the offline state; a regression can strand Join disabled after reachability returns. Exercise host and invitee paths, stable bounds, re-enable/click behavior, and `prefers-reduced-motion: reduce`.
2. **WARNING — Conform Phase 25 type weights to 400/600.** Replace 700/620/680/800 weights in sidebar/menu/invite additions with the approved regular or semibold values; this prevents hierarchy from becoming heavier than the contract.
3. **WARNING — Normalize Phase 25 spacing to the 4px grid.** Replace `.1rem`, `.18rem`, `.22rem`, `.35rem`, `.38rem`, `.45rem`, `.55rem`, `.6rem`, `.65rem`, `.7rem`, and `.8rem` declarations on the phase surfaces with 4/8/16/24px-grid equivalents.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- **WARNING:** The menu and star copy match the contract: `Add to favorites` / `Remove from favorites` are first in the menu and star labels are `Favorite # {room}` / `Unfavorite # {room}` ([RoomActionsMenu.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/RoomActionsMenu.svelte:74), [CoordinatorRoomCard.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorRoomCard.svelte:101)). The exact disabled reason is also present in title and accessible text ([MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:293)).
- **WARNING:** `connecting` and `unknown` are correctly disabled but are presented as `Coordinator is offline` because all non-online states share one boolean ([MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:285)). This follows the literal D-06 copy requirement but sacrifices status truthfulness; retain the required offline copy if locked, or extend the contract with accurate connecting/unknown explanations.

### Pillar 2: Visuals (3/4)

- **WARNING:** The same row component renders source and Favorites variants, preserving active rail, badges, avatar, star, and menu parity ([CoordinatorRoomCard.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorRoomCard.svelte:66), [CoordinatorRoomCard.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorRoomCard.svelte:92)). Focused Chromium tests passed for source/duplicate parity, focus return, 44px geometry, and 320px containment (`workspace-lifecycle.spec.ts:727`, `:770`).
- **WARNING:** The captured 1440×900, 768×1024, and 375×812 screenshots show only first-run identity selection, not an authenticated Favorites section or invite card. `needs_human_review: true` — capture the authenticated state with a selected favorite and an offline invite to verify the secondary focal weight, selected-star contrast, and no visual clipping.

### Pillar 3: Color (3/4)

- **WARNING:** Contract roles are implemented in code: green is applied to the active rail and selected star, while ordinary hover is neutral ([CoordinatorRoomCard.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorRoomCard.svelte:141), [CoordinatorRoomCard.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorRoomCard.svelte:146), [CoordinatorRoomCard.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorRoomCard.svelte:150)). The unavailable invite switches to neutral border/background/text and removes hover accent ([MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:438)).
- **WARNING:** Color is hardcoded across all three Phase 25 component styles rather than centralized tokens, and the unauthenticated captures cannot establish the required approximate 60/30/10 surface/neutral/accent distribution. Preserve this manual system only if it is intentional; otherwise expose the reused colors as local design tokens and visually check an authenticated rail.

### Pillar 4: Typography (2/4)

- **WARNING:** The UI-SPEC permits only 400 and 600 weights. Sidebar and menu additions use 700, 620, and 800 ([CoordinatorRoomCard.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorRoomCard.svelte:122), [RoomActionsMenu.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/RoomActionsMenu.svelte:128), [RoomActionsMenu.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/RoomActionsMenu.svelte:135)); invite copy uses 700 ([MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:442)). Replace with 400/600.
- **WARNING:** Several sidebar/menu sizes are fractional rem values (`.48rem`–`.8rem`) rather than the declared 8/10/12/14px scale ([CoordinatorRoomCard.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorRoomCard.svelte:117), [RoomActionsMenu.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/RoomActionsMenu.svelte:140)). Map phase-owned labels/actions explicitly to the approved sizes.

### Pillar 5: Spacing (2/4)

- **WARNING:** Although row/star geometry is correctly 44px (`2.75rem`) and the focused 320px overflow check passed ([CoordinatorRoomCard.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorRoomCard.svelte:135), [workspace-lifecycle.spec.ts](/Users/sandwich/Develop/cordn-adhoc-cvm/tests/e2e/workspace-lifecycle.spec.ts:799)), the Favorites row uses off-grid `.1rem`, `.2rem`, `.35rem`, and `.38rem` gaps/padding ([CoordinatorRoomCard.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorRoomCard.svelte:116), [CoordinatorRoomCard.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorRoomCard.svelte:129)).
- **WARNING:** The menu and invite action continue the off-grid pattern, including `.22rem`, `.55rem`, `.6rem`, `.65rem`, `.7rem`, and `.8rem` ([RoomActionsMenu.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/RoomActionsMenu.svelte:132), [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:436)). These values undermine the stated 4px grid; round to tokens while re-running 320px and overlay bounds checks.

### Pillar 6: Experience Design (2/4)

- **WARNING:** The implementation fails closed by default (`unknown`), resolves the exact coordinator at the workspace, forwards the resolver to both host and invitee renderers, and disables the action except for `online` ([MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:65), [HostWorkspace.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/HostWorkspace.svelte:693), [ChatRoute.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/ChatRoute.svelte:842)). The focused test passes for disabled state, tooltip, accessible description, and `not-allowed` cursor ([workspace-lifecycle.spec.ts](/Users/sandwich/Develop/cordn-adhoc-cvm/tests/e2e/workspace-lifecycle.spec.ts:829)).
- **WARNING:** The Phase 25 availability test only checks initial offline rendering; it does not prove the required online → offline → online transition, unchanged bounds, or restored Join navigation ([workspace-lifecycle.spec.ts](/Users/sandwich/Develop/cordn-adhoc-cvm/tests/e2e/workspace-lifecycle.spec.ts:803)). Add live reachability transition tests for host and embedded invitee paths.
- **WARNING:** The selected-star and disabled-invite transitions are removed under reduced motion ([CoordinatorRoomCard.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorRoomCard.svelte:156), [MessageGroup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/MessageGroup.svelte:453)), but this phase has no test for those surfaces. The menu’s color transition also lacks a reduced-motion override ([RoomActionsMenu.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/RoomActionsMenu.svelte:128)). Add one override and a focused reduced-motion browser assertion.

---

## Files Audited

- `25-UI-SPEC.md`, `25-CONTEXT.md`, `25-01-PLAN.md`, `25-01-SUMMARY.md`
- `src/chat/sidebar-ledger.ts`
- `src/components/CoordinatorRoomCard.svelte`
- `src/components/RoomActionsMenu.svelte`
- `src/components/HostWorkspace.svelte`
- `src/components/MessageGroup.svelte`
- `src/components/ChatRoute.svelte`
- `tests/unit/sidebar-ledger.test.ts`
- `tests/e2e/workspace-lifecycle.spec.ts`

Registry audit: skipped — no `components.json`; the UI-SPEC declares no third-party registry blocks.
