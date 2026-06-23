# Phase 2: Security & Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 2-Security & Persistence
**Mode:** Headless (autonomous — no user present)
**Areas discussed:** KeyStorage API, Passphrase Prompt Flow, Per-Relay Status, Destroy Flow, Persistence UI

---

## KeyStorage API and PBKDF2 Iteration Count

| Option | Description | Selected |
|--------|-------------|----------|
| 100,000 iterations | Satisfies PERSIST-03 minimum | |
| 600,000 iterations | NIST SP 800-132 current recommendation; cited in PITFALLS.md | ✓ |

**Decision:** 600,000 iterations. Satisfies `≥ 100,000` requirement and meets NIST recommendation. Named constant `PBKDF2_ITERATIONS` exported from `key-storage.ts`.

**Notes:** The extra CPU cost (~600ms vs ~100ms) is negligible for a one-time encrypt/decrypt operation. Using the NIST-recommended value is the correct security choice.

---

## Passphrase Prompt Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen replacement | `PassphrasePrompt.svelte` replaces main UI when `loadState === 'prompting'` | ✓ |
| Modal overlay | Dialog layered on top of (greyed-out) main UI | |
| Async init in main.ts | Check storage before mounting App, block mount until resolved | |

**Decision:** Full-screen replacement component. App.svelte conditionally renders `PassphrasePrompt` vs main content based on `coordinatorStore.loadState`.

**Notes:** Consistent with single-screen cypherpunk aesthetic. No modal chrome needed. The "generate new key instead" path is a clear button in the passphrase prompt.

---

## Per-Relay Connection Status

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic tracking | Set statuses based on coordinator lifecycle events | ✓ |
| SDK event wiring | Listen to NostrServerTransport/ApplesauceRelayPool events | (bonus if available) |
| Manual ping | Periodic WebSocket ping to detect disconnection | |

**Decision:** Optimistic tracking as the baseline. Wire SDK events during implementation if `NostrServerTransport` exposes them. STATE.md identifies ApplesauceRelayPool reconnect behavior as unknown — do not assume event availability.

**Notes:** Optimistic model (connecting → connected on start success) satisfies RELAY-06 honestly. ERR-02 (inline relay errors) is covered by setting relays to `error` on transport failure.

---

## Destroy Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Native `<dialog>` element in LifecyclePanel | No new component; browser-native confirm UX | ✓ |
| New DestroyButton.svelte component | Separate component with confirm logic | |
| Custom overlay component | Full custom modal | |

**Decision:** Native `<dialog>` inline in `LifecyclePanel.svelte`. Opened with `.showModal()` for proper focus trap and accessibility.

**Notes:** SEC-02 enforced by ensuring the synchronous destroy block (fill + removeItem) has no `await` between operations. Any async work (stopping the transport) happens before entering the synchronous block.

---

## Post-Destroy State

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh idle with new key | Generate new KeyManager immediately after destroy | ✓ |
| `destroyed` state | New state machine state requiring explicit user action to reset | |
| Page reload prompt | Show "Reload to continue" after destroy | |

**Decision:** Immediate reset to `idle` with a new `KeyManager.generate()`. No `destroyed` state added to the state machine. This matches the requirement "resets UI to initial state" — which is exactly `idle` + new identity.

---

## Persistence Enable/Disable UI

| Option | Description | Selected |
|--------|-------------|----------|
| PersistencePanel.svelte below RelayConfigPanel | Inline expand/collapse form | ✓ |
| Modal triggered from LifecyclePanel | Settings-style modal | |
| Inline in LifecyclePanel | Alongside Start/Stop/Destroy | |

**Decision:** `PersistencePanel.svelte` as a new section in the main layout below `RelayConfigPanel`. Inline expand form for enabling (no modal), "Remove saved key" button when enabled.

---

## Claude's Discretion

All five gray areas were decided autonomously. Key judgment calls:
- 600k PBKDF2 iterations over the 100k minimum
- No `destroyed` state (reset-to-idle is simpler and meets requirements)
- Full-page passphrase prompt instead of modal overlay
- Relay config stays ephemeral (only key persisted, not relay list)
- Native `<dialog>` over custom modal component

## Deferred Ideas

- ApplesauceRelayPool event wiring for true per-relay status — Phase 3 if needed
- Relay config persistence alongside key — no requirement exists; deferred
- Passphrase strength indicator — not required; deferred
- Key backup / nsec export modal — v2 requirement (IMPORT-01/02); deferred
