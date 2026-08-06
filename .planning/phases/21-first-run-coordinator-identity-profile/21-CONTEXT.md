# Phase 21: First-Run Coordinator Identity & Profile — Context

**Source:** User-provided goal, 2026-08-05

## Phase Boundary

This phase adds a first-start identity choice and coordinator naming gate, then publishes the chosen coordinator name as canonical Nostr profile metadata for the coordinator's own key. It does not merge operator and coordinator identities, replace existing sign-in mechanisms, or add server-side accounts.

## Locked Decisions

### First-run sequence

- **D-01:** Before the first coordinator start, present identity choice first and coordinator naming second.
- **D-02:** Identity choices reuse all existing supported Nostr sign-in methods and explicitly include durable anonymous operation.
- **D-03:** Authenticated profile display names prefill the coordinator name when available but remain editable.
- **D-04:** Anonymous setup uses a sensible editable default or placeholder.
- **D-05:** A normalized non-empty coordinator name is required before startup.
- **D-06:** Persist both completion and the chosen name; normal restarts must not repeat onboarding.
- **D-07:** Existing installations with a meaningful configured name migrate as complete and avoid unnecessary onboarding.
- **D-08:** Later renaming remains available through the existing settings surface.

### Identity boundary

- **D-09:** Operator sign-in establishes the human-facing operator identity only.
- **D-10:** The coordinator retains its separately generated transport key because NIP-07/NIP-46 signers do not provide the secret key required by the server transport; kind-0 coordinator metadata must be signed by that coordinator key, never by the operator signer.

### Publication and resilience

- **D-11:** Publish through configured shareable relays.
- **D-12:** Preserve existing kind-0 metadata fields when updating the name where possible.
- **D-13:** Republish after a name change.
- **D-14:** Publication failure must expose actionable status and retry without corrupting coordinator state or leaking secrets.
- **D-15:** A rename publishes updated kind-0 metadata immediately. Because the installed transport exposes no supported live setter for MCP initialize metadata, the Cordn server label changes on the next transport creation; a running coordinator must truthfully show that restart is required.
- **D-16:** Publication attempts every currently configured shareable relay. At least one relay acknowledgement counts as published; total failure retains actionable retry state and never rolls back the locally persisted name.

### Integration ownership

- **D-17:** Phase 21 depends on completed Phase 17 and is independently executable without unfinished Phase 18. It integrates with the current Phase 18 shell/profile work in place and must not revert its personal-versus-host control decisions.
- **D-18:** Before editing any already-modified target file, execution must inspect the targeted diff and preserve compatible existing work; incompatible overlap is an explicit escalation point. Executors must never reset or check out another contributor's work.
- **D-19:** The persisted coordinator name is canonical across all coordinator-facing discovery surfaces: coordinator-key kind-0 metadata, the ContextVM kind-11316 announcement `name` tag, and MCP initialize `serverInfo.name`. Invitees must resolve that value as the coordinator label; these surfaces must never fall back to the operator profile name.

### First-start preferences

- **D-20:** After coordinator naming and before the existing start experience, show a setup-path decision. The recommended path is visually primary and explains that it saves the coordinator securely on this device and starts it automatically.
- **D-21:** The recommended path requires passphrase and confirmation fields, enables encrypted coordinator persistence, retains the configured default relays, leaves public announcements off, enables autostart, completes setup, and starts immediately.
- **D-22:** `Advanced setup` is the escape hatch. It presents exactly one decision surface at a time in this order: persistence, relays, announcement, autostart. Back navigation preserves the in-progress draft.
- **D-23:** Advanced persistence defaults to `Persistent`; choosing it requires the same confirmed passphrase before the wizard may finish. `Ephemeral` stores no coordinator secret beyond the current browser session.
- **D-24:** The relay step begins with the product's current default relay set enabled and supports editing, removing, and adding `wss://` relay URLs. At least one enabled valid relay is required.
- **D-25:** Announcement defaults to `No` because it is a public-discovery choice. Autostart defaults to `Yes`, matching the recommended path.
- **D-26:** Name and preference changes remain a local draft until final completion. A failed persistence write or invalid wizard field does not mark setup complete or start the coordinator.
- **D-27:** Completed setup is not shown again on ordinary reload. The existing destructive reset clears its completion marker, encrypted persistence, and preferences so the full first-run flow appears again.
- **D-28:** If final autostart is enabled, completion starts the coordinator in the same session. If disabled, completion reveals the existing guided manual-start state.

## Required Evidence

- Unit tests: validation, persistence/migration, setup completion, metadata merging, coordinator-key signature, relay targeting.
- UI/browser tests: identity choice, anonymous continuation, authenticated prefill, required name, restart bypass, later rename and republish.
- Interoperability evidence: emitted kind-0 event has the coordinator pubkey, selected name, valid signature, and configured shareable relay path.
- Required quality gates: lint, strict TypeScript, unit tests, relevant Playwright, production build, and diff check.

## Out of Scope

- Using an external operator signer as the coordinator transport identity.
- Adding new authentication protocols.
- Server-side profiles, accounts, or secret storage.
- Changing room/chat member identity semantics.
