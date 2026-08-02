---
status: resolved
trigger: "CAHMLS is still not remembering that I was logged in between sessions. Page loads anonymous; logging in with NIP-07 succeeds with the correct avatar, name, and profile; refreshing returns to anonymous. It needs to remember that I had a session."
created: 2026-08-02
updated: 2026-08-02
---

# Debug Session: NIP-07 session not restored

## Symptoms

- expected: After a successful NIP-07 sign-in, refreshing or reopening CAHMLS should restore the user's NIP-07 session and profile without requiring another manual login.
- actual: NIP-07 login succeeds and renders the correct avatar, name, and full profile, but a refresh resets the identity to anonymous.
- errors: No error message was reported.
- timeline: Present in the current build.
- reproduction: Load the app, authenticate using NIP-07, confirm the resolved profile, then refresh the page; the identity returns to anonymous.

## Current Focus

reasoning_checkpoint:
  hypothesis: "NIP-07 state is lost because `connectNip07` stores the signer and method only in memory; every subsequent `UserProfileStore` begins anonymous and no mounted component calls a restoration operation."
  confirming_evidence:
    - "The complete store module contains no browser-storage reads or writes and instantiates the exported store with anonymous defaults."
    - "`connectNip07` → `adoptSigner` mutates only in-memory fields; the graph has no inbound startup caller of `connectNip07`."
    - "The existing unit suite covers only helpers and all four tests pass without a reload restoration case."
  falsification_test: "After successful NIP-07 connection, a new store given the same browser storage must restore NIP-07 method and pubkey; pre-fix, the expected storage marker is absent and the test fails."
  fix_rationale: "Persist only an explicit versioned `nip07` selection after authentication, restore it in a browser lifecycle hook by rebuilding the extension signer, and clear it on logout. This restores the selected session without persisting signer material or NIP-46 secrets."
  blind_spots: "The test uses a mocked extension and metadata pool; live-extension permission behavior and page-level timing still require manual browser verification."
  candidate_causes:
    - "code: no durable selection and no hydration call (confirmed)"
    - "config: browser storage policy could clear a marker, but no marker exists pre-fix (eliminated)"
    - "environment: extension injection may be unavailable at startup, but the application never attempts startup restoration (eliminated as root cause)"
    - "data: malformed stored marker could be ignored, but no stored session schema exists pre-fix (eliminated)"
  and_gate: "no — the confirmed code defect alone deterministically produces the symptom."

- bug_class: bohrbug
- test: Terminal deterministic browser verification completed.
- expecting: The persisted NIP-07 selection restores the same identity/profile on a fresh page load.
- next_action: Session resolved: the authorized browser-level regression replaced manual UAT.

## Evidence

- timestamp: 2026-08-02
  checked: durable debug knowledge-base fallback
  found: `.planning/debug/knowledge-base.md` does not exist.
  implication: no keyword-matched prior resolution is available; semantic recall availability remains to be checked.

- timestamp: 2026-08-02
  checked: semantic knowledge-base recall
  found: `mempalace` is not installed on this environment.
  implication: semantic recall is unavailable; the absent durable knowledge-base is the logged fallback result.

- timestamp: 2026-08-02
  checked: codebase graph identity/session discovery
  found: NIP-07 identity behavior is concentrated in `src/identity/user-profile.svelte.ts`; the graph identifies `connectNip07`, `adoptSigner`, `setAnonymous`, and `refreshProfile` on `UserProfileStore`.
  implication: inspect this store and its startup callers first; the earlier storage search was invalid because its alternation was treated literally and will be rerun correctly if needed.

- timestamp: 2026-08-02
  checked: `UserProfileStore` implementation and inbound call graph
  found: The store declares `method = "anonymous"`, empty `pubkey`, and `signer = null`; `connectNip07` constructs an `ExtensionSigner` and `adoptSigner` only assigns in-memory fields before fetching the profile. No constructor or public hydration method connects a NIP-07 signer. The graph shows no inbound startup caller for `connectNip07`.
  implication: the observed refresh behavior follows directly from re-creating this store; verify the missing persistence contract and test gap before recording the root cause.

- timestamp: 2026-08-02
  checked: full identity module and current unit coverage
  found: `src/identity/user-profile.svelte.ts` contains no `localStorage`, `sessionStorage`, or other persistence access, and ends by creating `userProfileStore = new UserProfileStore()`. `tests/unit/user-profile.test.ts` has four helper-only tests and no store/session restoration coverage.
  implication: a fresh module necessarily starts anonymous and no existing test detects the missing NIP-07 restoration behavior.

- timestamp: 2026-08-02
  checked: existing user-profile unit baseline
  found: `pnpm vitest run tests/unit/user-profile.test.ts` passed all 4 helper tests in 772ms.
  implication: SBFL is skipped: there is no failing test and no per-test coverage spectrum for this issue. A new specified-oracle regression test is required.

- timestamp: 2026-08-02
  checked: profile-component mount points
  found: `UserProfile.svelte` is rendered in both `ChatRoute.svelte` and `HostWorkspace.svelte`; its current `onMount` registers only keyboard cleanup and does not restore identity.
  implication: adding a guarded restoration call to `UserProfile` reaches the normal page shells without forcing an automatic extension connection for users who never selected NIP-07.

- timestamp: 2026-08-02
  checked: agent-authored NIP-07 persistence regression test
  found: The new specified-oracle test is RED: after `connectNip07`, `cordn:v1:nip07-session` is `null`; a new store also has no `restoreNip07Session` method. The boundary tests for absent/malformed markers fail for the same missing API.
  implication: the test reproduces the reported loss of NIP-07 session before any production behavior changes.

- timestamp: 2026-08-02
  checked: targeted regression after the implementation
  found: `pnpm vitest run tests/unit/user-profile.test.ts` passed all 8 tests in 649ms, including the new selected-session, absent-marker, malformed-marker, and logout cases.
  implication: the specified oracle is green and the marker/hydration contract holds under a fresh store instance.

- timestamp: 2026-08-02
  checked: no-op detector, mutation availability, and adjacent automated checks
  found: The scoped diff only adds the marker/hydration behavior and tests; `git diff --check` is clean. No Stryker package or configuration exists. `pnpm test` passed 20 files/135 tests, `pnpm lint` passed, and `pnpm build` passed (with pre-existing dependency/chunk warnings only).
  implication: the diff is not behavior-deleting, mutation checking is unavailable, and adjacent functionality remains green. The worktree contains unrelated user changes, so causality will use a scoped reversible patch rather than `git stash`.

- timestamp: 2026-08-02
  checked: scoped revert of the runtime fix
  found: With only the marker, restoration API, and lifecycle call removed (the regression test preserved), the target suite failed exactly as before: no marker was written and `restoreNip07Session` was absent.
  implication: the original defect returns when this exact runtime change is removed, so the fix has causal evidence rather than a coincidental green test.

- timestamp: 2026-08-02
  checked: scoped reapplication of the runtime fix
  found: After reapplying the identical marker, restoration API, and lifecycle call, `pnpm vitest run tests/unit/user-profile.test.ts` again passed all 8 tests in 661ms.
  implication: the revert-and-reconfirm signal passes: the bug returns on revert and is fixed on reapply.

- timestamp: 2026-08-02
  checked: human-verification checkpoint response
  found: The reporter authorized replacing manual UAT with a deterministic browser-level regression that injects a mock NIP-07 extension, signs in via UI, reloads, and asserts profile restoration.
  implication: browser-level regression and relevant validation can provide the terminal verification signal without a further manual checkpoint.

- timestamp: 2026-08-02
  checked: Playwright harness and NIP-07 presentation flow
  found: `playwright.config.ts` runs isolated Chromium specs against a Vite preview; `UserProfile.svelte` calls `restoreNip07Session` on mount and exposes the NIP-07 action as `NIP-07 browser signer`. Existing specs inject browser APIs with `page.addInitScript`, so the mock extension and deterministic kind-0 WebSocket response can be installed before every page navigation.
  implication: a browser-level test can exercise the actual visible sign-in, persisted selection, reload lifecycle, signer re-creation, and profile rendering without needing a human extension or public relay.

- timestamp: 2026-08-02
  checked: initial focused Playwright invocation
  found: `pnpm exec playwright test tests/e2e/nip07-session-restoration.spec.ts` stopped before executing a test because the configured `webServer` command exited with code 2.
  implication: the E2E assertion has not run yet; determine whether the build failure is caused by the new spec or existing dirty worktree state before changing the test.

- timestamp: 2026-08-02
  checked: configured web-server build command
  found: `pnpm build` failed only on the new spec's mock `CloseEvent` cast (`TS2352`); the object needs an explicit intermediate `unknown` conversion because the mock supplies just the `message` field consumed by `nostr-tools`.
  implication: the preview-server failure is a type-only issue in the new browser mock, not a production build regression; the minimal cast was corrected before retrying.

- timestamp: 2026-08-02
  checked: focused deterministic NIP-07 browser regression
  found: After `pnpm build` passed, `pnpm exec playwright test tests/e2e/nip07-session-restoration.spec.ts` passed in Chromium. It injects a mock `window.nostr`, performs the visible NIP-07 sign-in, verifies the selection marker, reloads, and confirms the same signed kind-0 display name, NIP-05, about text, and authenticated menu rather than the anonymous connect option.
  implication: the former manual-only workflow now has an end-to-end specified-oracle regression covering the page lifecycle and browser storage boundary.

- timestamp: 2026-08-02
  checked: adjacent NIP-07 unit suite and project lint
  found: `pnpm vitest run tests/unit/user-profile.test.ts` passed all 8 tests. `pnpm lint` failed solely in the new E2E mock because `_url` was unused in `MockWebSocket`.
  implication: the product behavior remains green, but terminal validation is not yet accepted until the test fixture itself is lint-clean.

- timestamp: 2026-08-02
  checked: corrected test fixture validation
  found: After deliberately consuming the mock WebSocket URL, `pnpm lint` passed and the focused Chromium regression passed again (1 test, 3.8s).
  implication: the test artifact is valid under project lint and continues to exercise the intended browser lifecycle after the fixture-only correction.

- timestamp: 2026-08-02
  checked: complete Playwright suite
  found: `pnpm test:e2e` ran 35 Chromium tests: the new NIP-07 regression passed and 33 other tests passed. One existing `phase-one` test failed while waiting for its `My coordinator` channel-browser control, a path that does not use the NIP-07 profile mock or session-restoration flow.
  implication: the requested focused NIP-07 acceptance signal remains green; the unrelated phase-one UI failure is recorded for separate follow-up and is not used as evidence for this session's fix.

## Eliminated

- hypothesis: Browser configuration or storage policy clears a persisted NIP-07 selection.
  evidence: The entire profile-store module neither reads nor writes browser storage, so there is no selection for a policy to remove.
  timestamp: 2026-08-02

- hypothesis: The NIP-07 extension is unavailable during startup.
  evidence: A fresh `UserProfileStore` has no startup call to construct `ExtensionSigner`; extension availability cannot be the cause of a call path that never runs.
  timestamp: 2026-08-02

- hypothesis: A malformed saved session is ignored on reload.
  evidence: The profile store defines no serialized session contract or parser.
  timestamp: 2026-08-02

## Resolution

- root_cause: `UserProfileStore.connectNip07` records the authenticated identity only in memory. The module creates each new store with `method = "anonymous"` and provides no persisted NIP-07 selection or browser-startup hydration path, so reload deterministically discards the app session.
- oracle_type: specified
- fix: Added a versioned `cordn:v1:nip07-session` marker written after NIP-07 signer adoption; added guarded `restoreNip07Session`, cleared the marker on logout or NIP-46 adoption, and call restoration from `UserProfile` on mount.
- verification:
  target_test:
    result: pass
    suite: tests/unit/user-profile.test.ts
    tests: 8
  mutation_check:
    result: skipped
    reason_if_skipped: no Stryker package or configuration exists in this repository
  no_op_deletion:
    result: pass
    deletion_justified_by_rca: false
  adjacent_tests:
    result: pass
    suites_run:
      - pnpm test (20 files, 135 tests)
      - pnpm lint
      - pnpm build
  revert_and_reconfirm:
    result: pass
    bug_returned_on_revert: true
    fixed_on_reapply: true
  guardrail_verdict: accepted
  browser_regression:
    result: pass
    suite: tests/e2e/nip07-session-restoration.spec.ts
    assertion: mock window.nostr sign-in via UI persists the versioned selection, and reload restores the signed kind-0 identity/profile rather than the anonymous connection state
  final_validation:
    build: pass
    focused_e2e: pass
    nip07_unit_suite: pass (8 tests)
    lint: pass
    complete_e2e_suite: 34 passed; one unrelated phase-one channel-browser expectation failed
  terminal_verdict: accepted — deterministic browser regression is authorized to replace manual UAT
- files_changed:
  - src/identity/user-profile.svelte.ts
  - src/components/UserProfile.svelte
  - tests/unit/user-profile.test.ts
  - tests/e2e/nip07-session-restoration.spec.ts
