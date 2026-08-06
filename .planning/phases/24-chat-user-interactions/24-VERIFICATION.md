---
phase: 24-chat-user-interactions
verified: 2026-08-06T22:27:24Z
status: human_needed
score: 25/30 must-haves verified
behavior_unverified: 5
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 23/30
  gaps_closed:
    - "Every non-self author exposes one accessible context menu whose actions work identically in host and invitee chat surfaces."
    - "The shared participant interface follows the approved Phase 24 visual/accessibility contract."
    - "Ignore and highlight provide the required visible, persistent presentation feedback."
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Signed recipient metadata produces exact-viewer mention emphasis in both host and invitee chat surfaces."
    test: "Send an authenticated targeted message to an actual host and invitee room identity, then view it as the target and as another member in each surface."
    expected: "Only the exact target sees the Mentioned you label and rail; all other viewers see the ordinary message unchanged."
    why_human: "The focused browser trace executes the invitee render path; the admitted-host browser test executes the shared menu but does not render a targeted message to validate host mention emphasis."
  - truth: "In-room invite targeting sends the selected active room's canonical invite only to the chosen participant."
    test: "From a connected room, choose another active room in the participant chooser and inspect the emitted encrypted kind-9 event."
    expected: "The event contains that room's current canonical invite and exactly one canonical p tag for the selected participant."
    why_human: "The host/guest harness proves the sole-recipient callback contract and source traces to ChatRoomSession.send, but no browser test observes the real encrypted outbound event."
  - truth: "The App lifecycle owns exactly one active-identity kind-3 query/subscription and resets it on identity changes."
    test: "Authenticate, log out, and replace the signer while delayed query/subscription events arrive."
    expected: "One owner exists for the current identity; prior subscriptions close and old events cannot change the current contact state."
    why_human: "The generation-safe store is unit-tested, but no test mounts App's lifecycle effect across authentication and signer changes."
  - truth: "Mention retains structured recipients after the visible token is edited and restores text plus targets after a failed send in both composers."
    test: "Mention a participant in each pane, edit the visible token, force the send to fail, and retry."
    expected: "The edited text and original recipient target are restored; retry sends the canonical p tag despite display-text edits."
    why_human: "Both implementations snapshot and restore state, but focused browser coverage only proves insertion/focus, not edited-text failure recovery."
  - truth: "Ignore disclosures preserve target filtering and all message presentation invariants after expansion in both panes."
    test: "Ignore separated streaks around a non-target tagged invite in host and invitee rooms, then expand each disclosure."
    expected: "Each expands independently while the hidden invite stays absent and chronology, reactions, timestamps, and mention treatment remain unchanged."
    why_human: "The guest regression proves independent local disclosures; no test combines expanded filtering with the authenticated host renderer."
human_verification:
  - test: "Validate targeted mention emphasis in a real host and invitee chat."
    expected: "Only the exact recipient gets Mentioned you presentation."
    why_human: "Host targeted presentation is not browser-exercised."
  - test: "Inspect a real targeted invite event emitted from the chooser."
    expected: "It carries the current selected-room invite and one recipient tag only."
    why_human: "Fixture callbacks are not the production transport event."
  - test: "Change authenticated identities while contact-list transport is active."
    expected: "Prior contact ownership is torn down and late old events are ignored."
    why_human: "App lifecycle transition is not mounted in an automated test."
  - test: "Force mention-send failure after editing a mention in both composers."
    expected: "Text and canonical recipient targeting restore for retry."
    why_human: "No failure-recovery browser test exists."
  - test: "Expand ignored streaks around a filtered invite in authenticated host and invitee chats."
    expected: "Expansion is independent and cannot restore the filtered invite or alter presentation invariants."
    why_human: "Combined host/filter/expansion behavior is not directly exercised."
---

# Phase 24: Chat User Interactions Verification Report

**Phase Goal:** Participants can address, personalize, moderate, invite, and follow people directly from the encrypted conversation without leaking targeted invite presentation to unrelated viewers.
**Verified:** 2026-08-06T22:27:24Z
**Status:** human_needed
**Re-verification:** Yes — after Plan 24-05 gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Non-self authors have one accessible, parity-preserving action menu. | ✓ VERIFIED | Shared `MessageGroup` has the sole trigger; the current browser test proves host/guest 44×44 targets, stable bubble/streak geometry, keyboard entry, focus and dismissal. |
| 2 | Signed kind-9 `p` tags drive mention emphasis and targeted-invite visibility; untagged invites are public. | ✓ VERIFIED | Recipient/projection units plus focused browser trace pass; `protocol.ts` signs canonical recipients and `message-presentation.ts` filters before grouping. |
| 3 | Exact-room ignores collapse reversibly and private highlights survive reload without shared-message changes. | ✓ VERIFIED | Preference-store units and the guest browser persistence/disclosure scenario pass; storage contains only local sparse preference maps. |
| 4 | Another active room can be selected and its current invite sent solely to the chosen participant. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Both parents revalidate the selected room, build `createInviteUrl`, and call `session.send(..., { recipientPubkeys })`; host/guest fixtures prove the sole-recipient callback, not the production event. |
| 5 | The active identity loads and live-maintains only the newest valid self-authored kind-3 event, and follow publication safely preserves its prior contact-list data. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Store tests cover validation, ordering, generations, merge, and acceptance; App identity lifecycle transitions are untested. |
| 6 | Signed recipients round-trip through send, MLS encryption/decryption, persistence, and legacy decoding. | ✓ VERIFIED | `chat-protocol.test.ts` covers canonical signing, MLS round-trip, pending persistence, malformed inputs, and legacy decode. |
| 7 | Recipient mutation fails authentication and reactions cannot carry ordinary recipients. | ✓ VERIFIED | Recipient mutation/reaction-isolation unit cases pass; production auth rejects recipient-bearing reactions. |
| 8 | Mention emphasis is exact-viewer only on the shared renderer. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Shared renderer compares normalized recipients with `viewerPubkey`; only the invitee targeted-rendering path is exercised. |
| 9 | Non-target valid invites disappear before grouping and leave no render/layout artifact. | ✓ VERIFIED | Projection unit and browser adjacency/DOM assertions pass. |
| 10 | Editable names never determine recipients; malformed targets remain legacy-compatible absence. | ✓ VERIFIED | Canonical array-only normalization, source trace, and malformed-input protocol tests pass. |
| 11 | Ignore identity is exactly coordinator + room + participant, with no cross-coordinator collision. | ✓ VERIFIED | Composite-key store implementation and identity-boundary unit test pass. |
| 12 | Default preference state is sparse and clearing removes entries. | ✓ VERIFIED | Unit cases prove record removal and independent map preservation. |
| 13 | Highlights are global-by-participant, palette-constrained, and isolated from ignores. | ✓ VERIFIED | Typed locked palette plus reload/corruption/isolation unit cases pass. |
| 14 | Preference persistence contains no message, invite, transport, decrypted, or signer material. | ✓ VERIFIED | Serializer emits only versioned ignore keys and palette names; sensitive-field assertion passes. |
| 15 | App starts/resets exactly one valid own-kind-3 owner across identity lifecycle changes. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `App.svelte` owns start/stop wiring and store generation tests pass, but the component transition is not mounted. |
| 16 | Empty ingress stays reconnectable and failed refresh preserves validated contact state. | ✓ VERIFIED | Focused social-store empty/refresh tests pass. |
| 17 | Only valid, own, current-generation kind-3 events enter state, in deterministic order. | ✓ VERIFIED | Signature/author/generation/order unit cases pass. |
| 18 | Follow serializes refresh, lossless merge, canonical dedupe, newer signing, and relay-accepted commit. | ✓ VERIFIED | Serialized follow, pending echo, failure, and replacement-generation tests pass. |
| 19 | Anonymous viewers cannot imitate a follow locally and receive sign-in guidance. | ✓ VERIFIED | Shared menu disables Follow and shows the exact guidance; browser test passes. |
| 20 | Every visible non-self streak has one trigger; self streaks have none. | ✓ VERIFIED | Shared self branch and browser self-trigger assertion pass. |
| 21 | Menu ordering, focus entry, dismissal, and focus restoration are correct. | ✓ VERIFIED | Current browser spec covers order, Enter, outside focus/click, Escape, chooser success, and focus return. |
| 22 | Mention preserves structured targets through text editing and failed sends in both composers. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Host and invitee snapshot/restore `composer` and `pendingRecipientPubkeys`, but no test drives edit + failure + retry. |
| 23 | Ignore generates independent reversible disclosures without changing shared room data. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Local projected expansion and guest independent disclosures are tested; the combined host/filter/expansion invariant is not. |
| 24 | Follow UI reports pending/error/success only from the acceptance-aware API. | ✓ VERIFIED | Host/guest fixture covers pending, success, generic retry; social tests cover relay acceptance. |
| 25 | Highlight applies privately and persists without replacing Mentioned you or reducing message text contrast. | ✓ VERIFIED | Shared highlight rail, private store, persistence flow, and selected-state browser assertions pass. |
| 26 | Participant trigger and interface meet the approved 44px accessibility contract. | ✓ VERIFIED | `.participant-trigger` has 44px min dimensions; browser checks both panes and no geometry shift. |
| 27 | Participant UI uses the locked visual token contract. | ✓ VERIFIED | Current computed-style browser test proves 12/14/20px roles, 400/600 weights, declared surfaces, and 16px compact side insets. |
| 28 | Ignore/highlight selection feedback is visibly present and persistent. | ✓ VERIFIED | Visible Show/Hide copy, `Highlight: {Name}`, `aria-pressed`, Selected marker, focus return, reopen/reload, and Default clear are browser-tested. |
| 29 | No targeted-invite capability or private material is rendered or logged by Phase 24 UI. | ✓ VERIFIED | Visibility-first projection, no Phase-24 logging path, privacy tests, and anti-pattern scan pass. |
| 30 | Self-directed participant actions are never exposed. | ✓ VERIFIED | Shared `mine` branch omits the trigger/menu and browser coverage verifies it. |

**Score:** 25/30 truths verified (5 present and wired but behavior-unverified).

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/chat/protocol.ts` | Signed canonical recipient metadata | ✓ VERIFIED | Substantive production normalization/auth/event conversion; tested through MLS. |
| `src/chat/room-store.ts` | Queued recipient-aware send | ✓ VERIFIED | Normalizes inside `runExclusive`, signs/encrypts, persists, and is used by both panes. |
| `src/chat/message-presentation.ts` | Visibility-first and ignore projection | ✓ VERIFIED | Both renderers call it before keyed rendering; dynamic room messages and local preferences flow into it. |
| `src/chat/chat-participant-preferences.svelte.ts` | Private exact-room/global preference store | ✓ VERIFIED | Defensive sparse localStorage record; no shared data source or wire writes. |
| `src/invites/nostr-social.svelte.ts` | Valid kind-3 state and safe follow | ✓ VERIFIED | Generation-aware reducer and relay-acceptance gated follow are production-wired. |
| `src/App.svelte` | Identity lifecycle binding | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Substantive/wired effect; lifecycle transition lacks direct behavior test. |
| `src/components/MessageGroup.svelte` | Shared participant surface | ✓ VERIFIED | Host/guest use one component; corrected target, menu, chooser, feedback, palette, and overlay wiring are browser-tested. |
| `src/components/HostWorkspace.svelte` / `src/components/ChatRoute.svelte` | Parity callbacks and presentation | ✓ VERIFIED | Each passes the same shared callbacks, projection, preferences, and visible disclosure copy. |
| `tests/e2e/chat-user-interactions.spec.ts` | Phase browser evidence | ✓ VERIFIED | Eight focused tests pass on the current revision. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `room-store.ts` | `protocol.ts` | `send` normalization/sign/encrypt | ✓ WIRED | `recipientPubkeys` stays inside the serialized send operation. |
| `protocol.ts` | `MessageGroup.svelte` | Stored decrypted recipients → exact viewer comparison | ✓ WIRED | Both panes pass room messages to the shared renderer. |
| `message-presentation.ts` | host/invitee logs | Pre-layout visibility and ignore projection | ✓ WIRED | Both call `projectMessagePresentation` before keyed streak blocks. |
| preferences store | parents / `MessageGroup` | Local ignores and global highlight prop | ✓ WIRED | Parents query exact-room ignores; shared renderer receives typed highlight. |
| `App.svelte` | social store | authenticated effect start/cleanup | ✓ WIRED | Calls `startContactList` and cleanup `stopContactList`; transition behavior is flagged above. |
| social store | Nostr relays | validate/reduce/publish acceptance | ✓ WIRED | `verifyEvent` and `Promise.any(pool.publish(...))` are on the production path. |
| shared menu | both chat parents | mention/invite/ignore/highlight/follow callbacks | ✓ WIRED | One typed contract; no pane-specific participant component. |
| host/invitee parent | `room-store.ts` | selected room invite → sole recipient send | ✓ WIRED | Candidate revalidation, canonical URL creation, and normalized single recipient are present in both. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `MessageGroup.svelte` | `message.recipientPubkeys` | signed/decrypted stored envelope | Canonical authenticated metadata | ✓ FLOWING |
| host/invitee logs | projected streaks | room messages → visibility filter → ignore predicate | Stored chat data plus private preferences | ✓ FLOWING |
| participant chooser | `participantRooms` | active `listRooms()` choices | Current stored room metadata, revalidated on dispatch | ✓ FLOWING |
| social store | selected kind-3/following | verified query/subscription reducer | Valid self-authored events only | ✓ FLOWING |
| preferences | ignore/highlight maps | versioned browser storage | Sparse local-only record | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase 24 browser behavior | `CI=1 PLAYWRIGHT_PORT=4189 pnpm exec playwright test tests/e2e/chat-user-interactions.spec.ts --workers=1` | 8 passed | ✓ PASS |
| Recipient, presentation, preferences, social, overlay units | `pnpm exec vitest run tests/unit/chat-protocol.test.ts tests/unit/message-presentation.test.ts tests/unit/chat-participant-preferences.test.ts tests/unit/nostr-invites.test.ts tests/unit/viewport-overlay.test.ts` | 52 passed | ✓ PASS |
| Full browser suite | `CI=1 PLAYWRIGHT_PORT=4189 pnpm test:e2e` | 107/107 passed (current completion evidence supplied with this re-verification) | ✓ PASS |
| Lint, types, production build, diff integrity | `pnpm lint && pnpm exec tsc --noEmit && pnpm build && git diff --check` | Passed; upstream dependency annotation/chunk-size warnings only | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| USER-01 | 24-04/24-05 | Shared accessible participant actions | ✓ SATISFIED | Shared menu, 44px parity/geometry test, keyboard/focus coverage. |
| MENTION-01 | 24-01/24-04 | Editable signed mention | ⚠️ NEEDS HUMAN | Signed protocol path is proven; edited failure recovery remains unexercised. |
| MENTION-02 | 24-01 | Exact-viewer emphasis in both panes | ⚠️ NEEDS HUMAN | Shared renderer and invitee trace pass; host targeted rendering remains unexercised. |
| INVMSG-01 | 24-01 | Public/targeted invite projection | ✓ SATISFIED | Unit and browser no-artifact projection evidence. |
| IGNORE-01 | 24-02/24-04/24-05 | Exact-room reversible disclosures | ⚠️ NEEDS HUMAN | Persistence and visible feedback pass; combined authenticated host/filter expansion lacks direct test. |
| INVUSER-01 | 24-04 | Selected-room targeted invite | ⚠️ NEEDS HUMAN | Wiring/fixture callback pass; production encrypted event not observed. |
| FOLLOW-01 | 24-03 | Valid live kind-3 lifecycle | ⚠️ NEEDS HUMAN | Store safety passes; App identity lifecycle is unmounted in tests. |
| FOLLOW-02 | 24-03 | Safe serialized follow publication | ✓ SATISFIED | Validated merge/ordering/acceptance/failure unit coverage. |
| HILITE-01 | 24-02/24-04/24-05 | Private persisted highlight | ✓ SATISFIED | Palette/store plus persistent named selected-state browser evidence. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| Phase 24 production/test files | — | `TBD` / `FIXME` / `XXX` | ✓ NONE | No unresolved debt marker found. |
| Build dependencies | — | Rolldown pure-annotation / chunk-size notices | ℹ️ INFO | Build exits successfully; warnings are upstream/pre-existing and do not affect Phase 24 behavior. |

### Human Verification Required

1. **Targeted mention host parity**

   **Test:** Send a targeted message in a real authenticated room and view it from host, target invitee, and another member.
   **Expected:** Only the target sees `Mentioned you` and the mention rail.
   **Why human:** Current browser evidence covers target rendering only for the invitee path.

2. **Targeted invite transport**

   **Test:** Send an invite using the chooser and inspect the actual encrypted kind-9 event.
   **Expected:** The selected room's canonical URL and one selected recipient p tag are emitted.
   **Why human:** The fixture intercepts callbacks rather than observing production transport.

3. **Identity lifecycle**

   **Test:** Switch or log out identities while kind-3 fetch/subscription work is outstanding.
   **Expected:** Previous ownership closes and late events cannot mutate the new identity.
   **Why human:** This App-level state transition is not mounted in an automated test.

4. **Mention send recovery**

   **Test:** Edit an inserted mention, fail Send, then retry in both panes.
   **Expected:** Text and recipient target restore, and retry keeps the canonical target.
   **Why human:** This failure path is unexercised.

5. **Expanded ignore invariants**

   **Test:** Expand separated ignored streaks around a non-target tagged invite in both live panes.
   **Expected:** Each disclosure acts independently and the hidden invite never returns.
   **Why human:** No test executes the combined authenticated host/filter/expansion scenario.

### Gaps Summary

All four blocking findings from the prior report are closed by the current code and focused browser evidence: the author trigger is touch-accessible, the approved visual-token/compact-gutter contract is asserted, and ignore/highlight feedback is visible, selected, and persistent. No failed must-have, missing artifact, broken link, debt-marker blocker, or deferred later-phase item remains.

The status is `human_needed`, not `passed`, because five behavior-dependent invariants are present and wired but not directly exercised. This is an Escalation Gate: resolve the listed runtime checks before claiming the phase fully proven.

---

_Verified: 2026-08-06T22:27:24Z_
_Verifier: the agent (gsd-verifier)_
