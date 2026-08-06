# Phase 21 — UI Review

**Re-audited:** 2026-08-06  
**Baseline:** `21-UI-SPEC.md` (draft design contract)  
**Screenshots:** captured from `http://localhost:5173` at desktop, tablet, and mobile; stored in `.planning/ui-reviews/21-20260806-reaudit/` (gitignored)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Contract CTA and identity-separation helper now match exactly. |
| 2. Visuals | 4/4 | Captured desktop/mobile views meet the focal-pane, hierarchy, and responsive composition requirements. |
| 3. Color | 3/4 | Generic choice hover still applies mint selection styling. |
| 4. Typography | 4/4 | Touched setup UI uses only the specified 10/12/18/28px sizes and 400/600 weights. |
| 5. Spacing | 3/4 | Fluid `5vh` panel padding can resolve to a non-token value. |
| 6. Experience Design | 4/4 | Signer busy labels/ARIA state and sticky footer action address the previously missing feedback and short-height reachability. |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **WARNING — Keep mint out of generic choice hover.** `.choice:hover` still uses the selected mint border/fill. Use only a quiet border/background hover; keep mint for selected choices and keyboard focus.
2. **WARNING — Replace fluid panel padding with declared spacing tokens.** `clamp(1.5rem, 5vh, 3rem)` can compute to values outside the 4px scale. Use a token-based responsive rule (for example 24px, 32px, or 48px at defined breakpoints).
3. **Minor verification recommendation — Add an automated signer-busy assertion.** The implementation now exposes `Connecting…` and `aria-busy`; add a browser assertion so this accessibility feedback cannot regress.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- **PASS:** The name-stage primary CTA is now the required `Save and continue` at [CoordinatorSetup.svelte:218](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorSetup.svelte:218).
- **PASS:** The settings helper exactly matches the required identity-separation copy at [CoordinatorSettings.svelte:209](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorSettings.svelte:209).
- The identity, name, validation, publication, retry, and error copy remains aligned with the contract.

### Pillar 2: Visuals (4/4)

- **PASS:** The focal pane is now `min(34rem, calc(100% - 32px))`, matching the contract at [CoordinatorSetup.svelte:273](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorSetup.svelte:273). Fresh desktop, tablet, and 375px mobile captures show a centered, square, near-black/deep-green setup surface with no room rail.
- **PASS:** Footer action groups are sticky at [CoordinatorSetup.svelte:293](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorSetup.svelte:293), keeping the primary path reachable when advanced content scrolls.

### Pillar 3: Color (3/4)

- **WARNING:** Generic `.choice:hover` still gets the mint selected-state border and fill at [CoordinatorSetup.svelte:286](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorSetup.svelte:286). This is broader than the contract's reserved selected/action/focus use of `#7cf59d`.
- **PASS:** Shared signer hover is now quiet, while mint is restricted to `:focus-visible` at [OperatorIdentityChoices.svelte:130](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/OperatorIdentityChoices.svelte:130) and [OperatorIdentityChoices.svelte:131](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/OperatorIdentityChoices.svelte:131). Non-final advanced navigation no longer inherits the accent action styling at [CoordinatorSetup.svelte:290](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorSetup.svelte:290).

### Pillar 4: Typography (4/4)

- **PASS:** The setup now uses only 10px utility labels, 12px body/helper text, 18px choice titles, and 28px headings; choice titles are corrected to 18px/600 at [CoordinatorSetup.svelte:288](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorSetup.svelte:288).

### Pillar 5: Spacing (3/4)

- **WARNING:** The panel padding remains `clamp(1.5rem, 5vh, 3rem)` at [CoordinatorSetup.svelte:273](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorSetup.svelte:273). Although its endpoints are approved 24px/48px tokens, a 5vh computed value is often not a multiple of four.
- **PASS:** Other touched setup/signer gaps and padding now resolve to the declared 4px scale: 4/8/12/16/24/48px at [CoordinatorSetup.svelte:280](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorSetup.svelte:280), [CoordinatorSetup.svelte:285](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorSetup.svelte:285), and [OperatorIdentityChoices.svelte:128](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/OperatorIdentityChoices.svelte:128). Controls retain the 44px hit-area minimum.

### Pillar 6: Experience Design (4/4)

- **PASS:** Busy signer buttons now expose `aria-busy` and replace their visible label with `Connecting…` at [OperatorIdentityChoices.svelte:95](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/OperatorIdentityChoices.svelte:95) and [OperatorIdentityChoices.svelte:112](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/OperatorIdentityChoices.svelte:112). NIP-46 cancellation remains operable while waiting at [OperatorIdentityChoices.svelte:108](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/OperatorIdentityChoices.svelte:108).
- **PASS:** Existing setup gates, required-name validation, publication retry feedback, and settings 44px actions remain intact.

### Verification

- Screenshot capture completed at 1440×900, 768×1024, and 375×812.
- A focused Playwright run exercised current first-run/profile flows. Nine scenarios passed in the re-audit run; one settings-restart scenario timed out and the first run also encountered a transient mock-relay port collision. These are test-environment failures (`EADDRINUSE` / preview connection refusal), not a visual finding. The immediately preceding baseline focused suite passed 12/12; this review does not represent the flaky rerun as full passing evidence.
- Registry audit: skipped — `components.json` is absent, so shadcn/third-party registry audit does not apply.

---

## Files Audited

- `21-UI-SPEC.md`, `21-CONTEXT.md`, Plans 01–06, and execution summaries 01–04
- [CoordinatorSetup.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorSetup.svelte)
- [OperatorIdentityChoices.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/OperatorIdentityChoices.svelte)
- [HostWorkspace.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/HostWorkspace.svelte)
- [CoordinatorSettings.svelte](/Users/sandwich/Develop/cordn-adhoc-cvm/src/components/CoordinatorSettings.svelte)
- [first-run-coordinator-profile.spec.ts](/Users/sandwich/Develop/cordn-adhoc-cvm/tests/e2e/first-run-coordinator-profile.spec.ts)
- [coordinator-profile-settings.spec.ts](/Users/sandwich/Develop/cordn-adhoc-cvm/tests/e2e/coordinator-profile-settings.spec.ts)
