---
phase: 24-chat-user-interactions
verified: 2026-08-06T20:47:20Z
status: gaps_found
score: 23/30 must-haves verified
behavior_unverified: 6
overrides_applied: 0
gaps:
  - truth: "Every non-self author exposes one accessible context menu whose actions work identically in host and invitee chat surfaces."
    status: failed
    reason: "The sole shared author trigger has no 44px minimum touch target, contrary to the approved UI contract; this prevents reliably accessing every participant action by touch."
    artifacts:
      - path: "src/components/MessageGroup.svelte"
        issue: "`.participant-trigger` at line 390 has only content-sized padding and no min-height/min-width."
    missing:
      - "Make the shared non-self author trigger at least 44×44px without changing streak alignment."
  - truth: "The shared participant interface follows the approved Phase 24 visual/accessibility contract."
    status: partial
    reason: "New participant controls use sub-12px typography, unapproved spacing/colors and a 16px compact gutter instead of the specified 32px panel inset."
    artifacts:
      - path: "src/components/MessageGroup.svelte"
        issue: "Participant UI styles at lines 393-406 use .58rem-.78rem, fractional spacing, and `calc(100vw - 1rem)` rather than the locked token scale."
      - path: "src/lib/viewport-overlay.ts"
        issue: "Default 8px gutters yield a 16px compact-panel inset rather than the contract's 16px-per-side/32px-total inset."
    missing:
      - "Apply the UI-SPEC 12/14/16/20px type roles, approved color/spacing tokens, and compact 32px total panel gutter."
  - truth: "Ignore and highlight provide the required visible, persistent presentation feedback."
    status: partial
    reason: "Ignore disclosures expose Show/Hide only in aria-labels; the menu never displays `Highlight: {color}` or a selected palette state."
    artifacts:
      - path: "src/components/HostWorkspace.svelte"
        issue: "Ignored disclosure at lines 1896-1898 omits visible Show messages/Hide messages copy."
      - path: "src/components/ChatRoute.svelte"
        issue: "Ignored disclosure at lines 818-820 omits visible Show messages/Hide messages copy."
      - path: "src/components/MessageGroup.svelte"
        issue: "Highlight control and palette at lines 329-336 have no named current value or selected semantic/visual treatment."
    missing:
      - "Show the disclosure action visibly and surface the current highlight name with an accessible selected state."
behavior_unverified_items:
  - truth: "Signed recipient metadata produces exact-viewer mention emphasis in both host and invitee chat surfaces."
    test: "Render a genuinely authenticated targeted message in both a host and an invitee room."
    expected: "Only the targeted viewer sees the Mentioned you rail and label; the other surface renders the ordinary message."
    why_human: "The browser tracer proves the invitee surface only; shared-component source wiring does not execute the host presentation path."
  - truth: "In-room invite targeting sends the selected active room's canonical invite only to the chosen participant."
    test: "From a real connected host and invitee chat, choose a second active room and inspect the resulting encrypted message from target and non-target viewers."
    expected: "It contains the current selected-room invite and exactly one recipient tag; only the selected participant receives its join presentation."
    why_human: "The E2E harness proves the callback contract and sole recipient argument, but the real pane test intentionally fails before transport and does not observe the canonical outbound event."
  - truth: "The App lifecycle owns exactly one active-identity kind-3 query/subscription and resets it on identity changes."
    test: "Mount App authenticated, then log out and replace the signer while delayed query/subscription events arrive."
    expected: "One owner exists for the current identity; old subscriptions close and no late old-identity event changes contact state."
    why_human: "Store-level generation tests pass, but no test mounts the App effect across those lifecycle transitions."
  - truth: "Mention keeps structured recipients if editable text changes and restores text plus targets after a failed send in both composers."
    test: "Mention a participant in each pane, edit the visible token, force send failure, and retry."
    expected: "The original text and recipient target return after failure, and retry sends the canonical recipient tag despite text edits."
    why_human: "The browser test checks insertion/focus only; it does not exercise edited text, a failing send, or recovery."
  - truth: "Ignore disclosures preserve target filtering and all message presentation invariants after expansion in both panes."
    test: "Ignore multiple separated streaks around a non-target targeted invite, expand each disclosure in host and invitee panes."
    expected: "Each disclosure expands independently without restoring the hidden invite or changing chronology, reactions, timestamps, or mention treatment."
    why_human: "Guest-only browser coverage proves independent local collapse but does not execute the combined target-filter/expanded-host paths."
  - truth: "The participant interface is visually usable in an authenticated chat at desktop and compact widths."
    test: "Open participant menus and chooser in a real authenticated chat at desktop and 320px widths."
    expected: "Targets are at least 44px, selected highlight is legible, all locked copy is visible, and the surfaces remain contained."
    why_human: "Focused browser assertions prove containment, not the approved visual contract; the UI review's live screenshots stopped before chat authentication."
---

# Phase 24: Chat User Interactions Verification Report

**Phase Goal:** Participants can address, personalize, moderate, invite, and follow people directly from the encrypted conversation without leaking targeted invite presentation to unrelated viewers.
**Verified:** 2026-08-06T20:47:20Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Non-self authors have one accessible, parity-preserving action menu. | ✗ FAILED | Shared menu is wired in both panes, but its only trigger has no 44px minimum target (`MessageGroup.svelte:390`). |
| 2 | Signed kind-9 `p` tags drive mention emphasis and targeted-invite visibility; untagged invites are public. | ✓ VERIFIED | `protocol.ts:84-103,280-315,369-444`; recipient/unit tests and focused browser projection test pass. |
| 3 | Exact-room ignores collapse reversibly and private highlights survive reload without shared-message changes. | ✓ VERIFIED | Local-only preference store, post-filter projection, unit persistence tests, and guest browser reload test pass. |
| 4 | Another active room can be selected and its current invite sent solely to the chosen participant. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Both controllers build `createInviteUrl` and send normalized sole recipients, while fixture browser tests prove callback inputs; real transport/event output is not exercised. |
| 5 | The active identity maintains only the newest valid own kind-3 event and follows safely. | ✓ VERIFIED | Generation-aware reducer, signature/auth checks, accepted-relay commit gate, and 10 focused social unit tests pass. |
| 6 | Signed recipients round-trip through send, MLS encryption/decryption, persistence, and legacy decoding. | ✓ VERIFIED | `protocol.ts:250-360`, `room-store.ts:310-343`; recipient protocol test passes. |
| 7 | Recipient mutation fails authentication and reactions cannot carry ordinary recipients. | ✓ VERIFIED | `protocol.ts:280-318,375-386`; recipient protocol test passes mutation/reaction cases. |
| 8 | Mention emphasis is exact-viewer only on the shared renderer. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Shared `MessageGroup` compares canonical recipients with viewer identity (`MessageGroup.svelte:271-273`); the browser tracer runs only the invitee path. |
| 9 | Non-target valid invites disappear before grouping and leave no render/layout artifact. | ✓ VERIFIED | `message-presentation.ts:25-33`; pure unit and browser projection tests pass. |
| 10 | Editable names never determine recipients; malformed targets remain legacy-compatible absence. | ✓ VERIFIED | Structured options normalize at `room-store.ts:314-317`; protocol malformed-input tests pass. |
| 11 | Ignore identity is exactly coordinator + room + participant, with no cross-coordinator collision. | ✓ VERIFIED | `chat-participant-preferences.svelte.ts:70-75`; identity-boundary unit tests pass. |
| 12 | Default preference state is sparse and clearing removes entries. | ✓ VERIFIED | Store persistence at lines 136-150; sparse-clear unit tests pass. |
| 13 | Highlights are global-by-participant, constrained to the locked palette, and isolated from ignores. | ✓ VERIFIED | Typed palette/store plus palette/reload/corruption unit coverage pass. |
| 14 | Preference persistence contains no message, invite, room-transport, decrypted, or signer material. | ✓ VERIFIED | Store serializes only identity keys/palette names; sensitive-field unit assertion passes. |
| 15 | App starts/reset exactly one valid own-kind-3 owner over identity lifecycle changes. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `App.svelte:39-50` wires start/stop; lifecycle transitions are tested at store level but not through App. |
| 16 | Empty ingress stays reconnectable and failed refresh preserves validated contact state. | ✓ VERIFIED | `nostr-social.svelte.ts:258-280`; focused unit test passes. |
| 17 | Only valid, own, current-generation kind-3 events enter state, in deterministic order. | ✓ VERIFIED | `nostr-social.svelte.ts:283-290,357-364`; invalid/foreign/equal-time/race tests pass. |
| 18 | Follow serializes refresh, lossless merge, canonical p-tag dedupe, strictly newer signing, and relay-accepted commit. | ✓ VERIFIED | `nostr-social.svelte.ts:293-354`; preservation/concurrency/acceptance/failure tests pass. |
| 19 | Anonymous viewers cannot imitate a follow locally and receive sign-in guidance. | ✓ VERIFIED | Disabled UI plus exact guidance at `MessageGroup.svelte:326-327`; browser test passes. |
| 20 | Every visible non-self streak has one trigger; self streaks have none. | ✓ VERIFIED | Shared branch at `MessageGroup.svelte:238-265`; guest/host browser coverage passes. |
| 21 | Menu ordering, focus entry, dismissal, and focus restoration are correct. | ✓ VERIFIED | `MessageGroup.svelte:92-110,168-200,314-340`; focused browser tests pass. |
| 22 | Mention preserves structured targets through text editing and failed sends in both composers. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Implementation snapshots/restores state (`HostWorkspace.svelte:1281-1297`, `ChatRoute.svelte:564-583`), but no behavioral failure/edit test exists. |
| 23 | Ignore generates independent reversible disclosures without changing shared room data. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Both panes project after filtering and retain local expansion sets; guest collapse/reload is tested, but combined expanded/filter and host paths are not. |
| 24 | Follow UI reports pending/error/success only from the acceptance-aware API. | ✓ VERIFIED | `MessageGroup.svelte:132-142`; host/guest fixture plus social acceptance tests pass. |
| 25 | Highlight applies privately and persists without replacing Mentioned you or reducing message text contrast. | ✓ VERIFIED | Shared rail CSS and preference store; reload browser test and unit palette tests pass. |
| 26 | Participant trigger and interface meet the approved 44px accessibility contract. | ✗ FAILED | Trigger is content-sized with no `min-height`/`min-width`. |
| 27 | Participant UI uses the locked visual token contract. | ✗ FAILED | New menu/chooser typography, spacing, colors, and compact gutter contradict `24-UI-SPEC.md`. |
| 28 | Ignore/highlight selection feedback is visibly present and persistent. | ✗ FAILED | Required Show/Hide and Highlight: color/selected state are absent from rendered controls. |
| 29 | No targeted-invite capability or private material is rendered or logged by Phase 24 UI. | ✓ VERIFIED | Filtering precedes rendering; source scan found no Phase-24 console output or secret-capability presentation, and focused privacy/projection tests pass. |
| 30 | Self-directed participant actions are never exposed. | ✓ VERIFIED | Exact self branch in shared renderer and guest browser self-trigger assertion pass. |

**Score:** 23/30 truths verified (6 present, behavior-unverified; 1 core menu-access truth and 3 UI-contract truths failed).

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/chat/protocol.ts` | Canonical signed kind-9 recipients | ✓ VERIFIED | 541 substantive lines; normalization, auth template, event conversion, encryption/decryption are used. |
| `src/chat/room-store.ts` | Recipient-aware queued send and exact room identity | ✓ VERIFIED | Send normalizes inside `runExclusive`, persists pending messages, and is called by both panes. |
| `src/chat/message-presentation.ts` | Visibility-first and ignore disclosure projection | ✓ VERIFIED | 56-line pure, used by both host and invitee before keyed rendering. |
| `src/chat/chat-participant-preferences.svelte.ts` | Defensive private exact-room/global preference store | ✓ VERIFIED | 161 substantive lines; browser storage is the only data source. |
| `src/invites/nostr-social.svelte.ts` | Valid live kind-3 state and safe follow publication | ✓ VERIFIED | Generation-safe owner, reducer, serialized relay-acceptance path. |
| `src/App.svelte` | Earliest identity-ready contact lifecycle wiring | ✓ VERIFIED | Effect starts/stops the social owner from authenticated identity state. |
| `src/components/MessageGroup.svelte` | Shared participant interaction surface | ⚠️ PARTIAL | Functional/wired, but misses approved target, visual-token, and persistent-feedback contracts. |
| `src/components/HostWorkspace.svelte` | Host callbacks/composer/room targeting/disclosure state | ✓ VERIFIED | Uses shared projection and callbacks; data flows from `listRooms` to `session.send`. |
| `src/components/ChatRoute.svelte` | Invitee parity callbacks/composer/disclosure state | ✓ VERIFIED | Uses the same shared contracts and local preference source. |
| Phase 24 unit and browser tests | Behavioral regression evidence | ✓ VERIFIED | All declared test files are substantive and execute in focused runs. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `room-store.ts` | `protocol.ts` | `ChatRoomSession.send` recipient normalization/sign/encrypt | ✓ WIRED | `recipientPubkeys` is normalized inside `runExclusive`. |
| `protocol.ts` | `MessageGroup.svelte` | Decrypted recipient metadata → viewer comparison | ✓ WIRED | Both logs pass stored messages to the shared component. |
| `message-presentation.ts` | host/invitee logs | Viewer-aware projection before render | ✓ WIRED | Both call `projectMessagePresentation`. |
| preferences store | room identity / MessageGroup | Exact ignores and global highlights | ✓ WIRED | Parents query store; renderer receives highlight only. |
| `App.svelte` | social store | Identity-ready start/cleanup | ✓ WIRED | Effect calls `startContactList` / `stopContactList`. |
| social store | `nostr-tools` / social relays | verify/reduce / `Promise.any(publish)` | ✓ WIRED | Candidate validation and acceptance gate are in production path. |
| shared menu | host/invitee callbacks | Mention/invite/ignore/highlight/follow parity | ✓ WIRED | One prop contract; no pane-specific menu component exists. |
| host/invitee | `room-store.ts` | active room chooser → canonical invite → sole recipient send | ✓ WIRED | Both revalidate candidate and call `session.send(inviteUrl, { recipientPubkeys })`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `MessageGroup.svelte` | `message.recipientPubkeys` | Signed/decrypted `ChatEnvelope` persisted by `ChatRoomSession` | Canonical metadata, not display-text parsing | ✓ FLOWING |
| host/invitee logs | projected streaks | `room.messages` → visibility filter → ignore predicate | Stored/decrypted room messages and local preferences | ✓ FLOWING |
| participant chooser | `participantRooms` | `listRooms()` filtered by status/composite identity | Stored active rooms; candidate revalidated at dispatch | ✓ FLOWING |
| social store | `selectedContactEvent`, `following` | Validated relay query/subscription reducer | Verified kind-3 events only | ✓ FLOWING |
| highlights/ignores | local preference maps | Versioned localStorage record | Sparse private data only | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Recipient, presentation, preferences, and kind-3 safety | `pnpm exec vitest run tests/unit/chat-protocol.test.ts tests/unit/message-presentation.test.ts tests/unit/chat-participant-preferences.test.ts tests/unit/nostr-invites.test.ts` | 46 passed | ✓ PASS |
| Phase 24 browser behavior | `CI=1 PLAYWRIGHT_PORT=4189 pnpm exec playwright test tests/e2e/chat-user-interactions.spec.ts --workers=1` | 7 passed | ✓ PASS |
| Lint, types, full unit suite | `pnpm lint && pnpm exec tsc --noEmit && pnpm test` | 345 passed, 3 skipped | ✓ PASS |
| Full browser suite | `CI=1 PLAYWRIGHT_PORT=4189 pnpm test:e2e` | Interrupted after >3 minutes; last-run status `interrupted` | ⚠️ INCOMPLETE |
| Build | `pnpm build` | Passed (upstream dependency annotation/chunk-size warnings only) | ✓ PASS |
| Upstream parity | `pnpm check:upstream` | 11 methods and 7 schemas match pinned Cordn commit | ✓ PASS |
| Upstream interop | `pnpm test:upstream-interop` | 3 passed | ✓ PASS |
| Diff integrity | `git diff --check` | Exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| USER-01 | 24-04 | ✗ BLOCKED | Keyboard menu parity exists, but the only trigger violates the approved 44px accessibility minimum. |
| MENTION-01 | 24-01/24-04 | ⚠️ NEEDS HUMAN | Protocol send/encrypt/auth tests pass; composer edited-text/send-failure integration is unexercised. |
| MENTION-02 | 24-01 | ⚠️ NEEDS HUMAN | Exact viewer logic is shared and invitee browser evidence passes; host mention presentation is not executed. |
| INVMSG-01 | 24-01 | ✓ SATISFIED | Public/targeted filtering is pure-tested and browser-tested before grouping. |
| IGNORE-01 | 24-02/24-04 | ⚠️ NEEDS HUMAN | Exact private persistence and guest disclosures pass; host/expanded target-filter combination lacks behavioral evidence. |
| INVUSER-01 | 24-04 | ⚠️ NEEDS HUMAN | Candidate selection/sole target callback passes, but no real outbound canonical invite event is observed. |
| FOLLOW-01 | 24-03 | ✓ SATISFIED | Valid current-generation reducer and deterministic selection unit coverage passes. |
| FOLLOW-02 | 24-03 | ✓ SATISFIED | Serialization, preservation, signing, relay acceptance, and failure tests pass. |
| HILITE-01 | 24-02/24-04 | ⚠️ NEEDS HUMAN | Private palette persistence and rails work, but selected-state/persistent named feedback violates UI contract. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- |
| `MessageGroup.svelte` | 390 | No minimum author-trigger target | 🛑 BLOCKER | Sole action entry point is not reliably touch-accessible. |
| `MessageGroup.svelte` | 393-406 | Subcontract typography/spacing/colors | 🛑 BLOCKER | Approved frontend design contract is not delivered. |
| `HostWorkspace.svelte` / `ChatRoute.svelte` | 1896 / 818 | Show/Hide action only in aria label | ⚠️ WARNING | Required visible disclosure feedback is absent. |
| `MessageGroup.svelte` | 329-336 | No selected highlight state/name | ⚠️ WARNING | Current private presentation choice cannot be inspected on reopening the menu. |
| Phase-modified files | — | `TBD`/`FIXME`/`XXX` | ✓ NONE | No unresolved debt markers found. |

### Prohibition Review

Code-level review found no violation of the seven plan prohibitions: recipient intent is structured rather than name-derived; non-target invite filtering occurs before layout; preferences remain local; kind-3 ingress validates author/signature/generation; follow success waits for relay acceptance; sensitive material is not presented by the participant UI; and self authors have no action trigger. This is non-authoritative static/test evidence; the behavior-unverified items above retain the required human review path.

### Behavior Evidence Still Needed

The six `behavior_unverified_items` in frontmatter require the concrete host/invitee, real-transport, lifecycle, failure-recovery, combined-disclosure, and authenticated visual checks described there. They are preserved even though the blocking UI gaps take precedence in the overall status.

### Gaps Summary

Phase 24 has functional protocol, persistence, filtering, social-state, and focused browser evidence, but it has not achieved the approved user-facing delivery contract. The shared trigger is below the required accessible target size, the participant surface violates locked visual tokens, and the visible selected/disclosure feedback is incomplete. These are current-phase gaps; the roadmap contains no later phase that explicitly defers them. The full browser suite was also interrupted, so it cannot be used as shipping evidence.

---

_Verified: 2026-08-06T20:47:20Z_
_Verifier: the agent (gsd-verifier)_
