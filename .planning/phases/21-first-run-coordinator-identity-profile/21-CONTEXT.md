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
