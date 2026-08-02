---
status: resolved
trigger: "When I redeem an invite, I see the select identity screen for a couple seconds. This should only be shown if I don't already have an identity; anonymous is still an identity. If I am already authenticated, I should not see the identity selection screen."
created: 2026-08-02
updated: 2026-08-02
---

# Debug Session: Invite identity screen flashes for established users

## Symptoms

- expected: Redeeming an invite with any established identity—anonymous, NIP-07, or NIP-46—must proceed without ever rendering the identity-selection screen. The selector is only for users who truly have no identity.
- actual: During invite redemption, the identity-selection screen is visible for a couple of seconds even when an identity already exists.
- errors: No error message was reported.
- timeline: Present in the current build after identity/session work.
- reproduction: Establish an anonymous or authenticated identity, redeem an invite, and observe the identity-selection screen before the existing identity is recognized.

## Current Focus

- bug_class: bohrbug
reasoning_checkpoint:
  hypothesis: "ChatRoute displays the identity selector because a valid `autojoin=1` route initially has `room === null`, and the `onMount` hook does not start joining until after the selector branch has already rendered."
  confirming_evidence:
    - "InviteInbox and InviteRedeemer both append `autojoin=1` before navigating to ChatRoute."
    - "ChatRoute's template selects the identity form whenever `invite` exists and `room` is null; it has no autojoin/pending branch."
    - "The immediate Playwright assertion after redemption observed the selector exactly once before the room connected."
  falsification_test: "If the selector is absent immediately after an unchanged `autojoin=1` redemption, or the template already has a pending-autojoin branch, this hypothesis is false."
  fix_rationale: "Render a neutral joining state for a valid autojoin request until a room is attached; after an error, fall back to the existing selector so users can choose another identity."
  blind_spots: "A cached room with its saved anonymous key attaches synchronously and cannot exercise the first-render join path. Verification will use a fresh room after anonymous identity establishment, plus a NIP-07 identity restored at application startup."
  candidate_causes:
    - "code: ChatRoute lacks a rendering state for the autojoin transition."
    - "config: an omitted autojoin parameter could select the form path, but both real redemption entry points append it."
    - "environment: relay latency extends the duration of the flash but cannot cause the selector's first render."
  and_gate: "no — the missing pending-render state alone produces the observable first paint; network latency only amplifies its duration."
next_action: "Change the anonymous browser regression to redeem a fresh second room after the first anonymous join, then run it and the restored-NIP-07 regression before implementing the UI state."

## Evidence

- timestamp: 2026-08-02
  checked: Phase-0 knowledge-base lookup and configured project skills
  found: No debug knowledge base, project skill directory, or debugger-specific configured skill is present.
  implication: No prior resolution or additional project rule changes the initial investigation.

- timestamp: 2026-08-02
  checked: Codebase graph architecture and identity/invite symbol search
  found: The client is a Svelte/TypeScript app with an invites-to-identity boundary; relevant modules include ChatRoute, App, NostrSocialStore, and UserProfileStore.
  implication: The reported transient view is likely in a Svelte route conditional or in the order of state initialization.

- timestamp: 2026-08-02
  checked: src/components/ChatRoute.svelte and src/identity/user-profile.svelte.ts
  found: A new invite starts with `room === null`, so the selector renders. Its `onMount` only calls `join(activeSigner)` or `joinAnonymous()` in the `autojoin=1` branch; non-autojoin invites have no existing-identity path. The profile store exposes an active signer only after NIP-07/NIP-46 adoption.
  implication: The selector is not a hydration fallback; normal invite redemption currently omits the required established-identity transition.

- timestamp: 2026-08-02
  checked: invite navigation callers and available test suite
  found: InviteInbox explicitly appends `autojoin=1` before navigation. The suite contains unit and Playwright tests but no currently failing test for this symptom, so spectrum-based fault localization is not applicable. `restoreNip07Session` is exercised by unit tests but no application caller was found in the initial call search.
  implication: The deterministic symptom most likely occurs on in-app acceptance: `autojoin` starts only after initial render, and lacks test coverage. Persistent NIP-07 restoration is a separate possible issue, not yet proven to cause the reported flash.

- timestamp: 2026-08-02
  checked: src/components/InviteInbox.svelte and src/components/InviteRedeemer.svelte
  found: Both in-app delivery and manual redemption append `autojoin=1` to the same-shell invite route.
  implication: The state-transition branch is exercised consistently by the user action described; an immediate UI assertion can directly falsify or confirm the rendering hypothesis.

- timestamp: 2026-08-02
  checked: Playwright scenario "in-session invite redemption preserves the running home coordinator"
  found: The newly added immediate assertion failed with `Expected: 0; Received: 1` for the identity-selection copy immediately after valid invite redemption.
  implication: The selector flash is reliably reproduced and is caused by the first-render path, not by a missing navigation parameter or an intermittent relay response.

- timestamp: 2026-08-02
  checked: Cached-room anonymous re-redemption browser scenario
  found: The cached room's stored anonymous secret produces a synchronous attachment, so the selector is already gone when the immediate browser assertion runs.
  implication: A cached room is not a valid regression fixture for the reported fresh-invite autojoin transition; the anonymous test must use a new room after identity establishment.

## Eliminated

- hypothesis: A redemption caller omits `autojoin=1`, selecting the manual identity form.
  evidence: Both InviteInbox and InviteRedeemer add `autojoin=1` before navigation.
  timestamp: 2026-08-02

- hypothesis: Relay or browser timing is the root cause of the selector flash.
  evidence: The form is selected by the initial template condition before the asynchronous room join; the reproducible test observes it on the local mock-relay path.
  timestamp: 2026-08-02

## Resolution

- root_cause: ChatRoute has no pending state for `autojoin=1`; its initial `room === null` branch renders the identity selector before `onMount` begins the asynchronous join, even for users with an established identity.
- fix:
  - App now owns a memoized identity bootstrap and gates invite consumption on its terminal ready state.
  - ChatRoute renders a neutral opening state while identity restoration and automatic join complete; it only renders identity choices when the resolved store truly has no identity.
  - Anonymous, restored NIP-07, and saved room signers all take their established-identity paths without a selector paint.
- verification:
  - `pnpm exec playwright test tests/e2e/nip07-session-restoration.spec.ts` — 2 passed.
  - Full Playwright run — 37/37 passed, including direct, legacy, and in-session invite paths without an identity chooser regression.
- files_changed:
  - src/App.svelte
  - src/components/ChatRoute.svelte
  - src/identity/user-profile.svelte.ts
  - tests/e2e/nip07-session-restoration.spec.ts
  - tests/unit/user-profile.test.ts
