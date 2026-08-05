# Phase 21: First-Run Coordinator Identity & Profile - Research

**Researched:** 2026-08-05
**Domain:** Browser-resident Nostr coordinator onboarding, identity separation, and profile publication
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### First-run sequence

- Before the first coordinator start, present identity choice first and coordinator naming second.
- Identity choices reuse all existing supported Nostr sign-in methods and explicitly include durable anonymous operation.
- Authenticated profile display names prefill the coordinator name when available but remain editable.
- Anonymous setup uses a sensible editable default or placeholder.
- A normalized non-empty coordinator name is required before startup.
- Persist both completion and the chosen name; normal restarts must not repeat onboarding.
- Existing installations with a meaningful configured name migrate as complete and avoid unnecessary onboarding.
- Later renaming remains available through the existing settings surface.

#### Identity boundary

- Operator sign-in establishes the human-facing operator identity only.
- The coordinator retains its separately generated transport key because NIP-07/NIP-46 signers do not provide the secret key required by the server transport.
- Kind-0 coordinator metadata must be signed by the coordinator key, never by the operator signer.

#### Publication and resilience

- Publish through configured shareable relays.
- Preserve existing kind-0 metadata fields when updating the name where possible.
- Republish after a name change.
- Publication failure must expose actionable status and retry without corrupting coordinator state or leaking secrets.

### the agent's Discretion

No `## the agent's Discretion` section appears in `21-CONTEXT.md`.

### Deferred Ideas (OUT OF SCOPE)

- Using an external operator signer as the coordinator transport identity.
- Adding new authentication protocols.
- Server-side profiles, accounts, or secret storage.
- Changing room/chat member identity semantics.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SETUP-01 | Identity choice before first start, including anonymous operation | Reuse `UserProfileStore` readiness plus a setup-only UI composition; keep the coordinator `KeyManager` separate. [VERIFIED: codebase graph + `src/identity/user-profile.svelte.ts`] |
| SETUP-02 | Required normalized name with editable authenticated prefill/default | Add one shared `normalizeCoordinatorName()` helper (trim + 48 Unicode code points), use `display_name`, then `name`, then `My coordinator`. [VERIFIED: codebase + `21-UI-SPEC.md`] |
| SETUP-03 | Persist completion and migrate meaningful legacy names | Version the existing local config with `setupCompleted`; infer legacy completion only from a normalized non-default stored name. [VERIFIED: `src/config/config.svelte.ts` + `21-UI-SPEC.md`] |
| SETUP-04 | Settings rename without replacing identities | Give `CoordinatorSettings` a draft/save flow and call a coordinator-owned profile publisher after local persistence. [VERIFIED: codebase + `21-CONTEXT.md`] |
| PROFILE-01 | Publish coordinator-key kind-0 metadata to shareable relays | Use the coordinator `KeyManager` bytes with `nostr-tools/pure.finalizeEvent`, then publish through a `SimplePool` to `config.inviteRelayUrls`. [CITED: https://github.com/nostr-protocol/nips/blob/master/01.md] [VERIFIED: local `nostr-tools` types + `src/lib/relay-pool.ts`] |
| PROFILE-02 | Preserve metadata, retry safely, and keep runtime valid | Query newest kind-0 by coordinator pubkey from the target relays, shallow-merge only `name`, persist name before best-effort publication, expose `publishing/published/failed`, and retry with the same key. [CITED: https://github.com/nostr-protocol/nips/blob/master/01.md] [VERIFIED: codebase + `21-UI-SPEC.md`] |
</phase_requirements>

## Summary

Implement this as a small, coordinator-owned setup/profile domain rather than as new authentication. The existing `ConfigStore` already synchronously reads its localStorage record in its constructor, `UserProfileStore` already creates/restores the durable anonymous identity and fetches authenticated kind-0 profiles after a signer is adopted, and `CoordinatorStore` owns the unrelated generated transport key. Phase 21 should connect those existing seams without moving secrets or making an operator signer a transport signer. [VERIFIED: `src/config/config.svelte.ts`, `src/identity/user-profile.svelte.ts`, `src/coordinator/coordinator.svelte.ts`, `src/crypto/key-manager.ts`]

There are two independent names to publish. The current Cordn web client learns its visible coordinator label from the Nostr transport's initialize/discovery `serverInfo.name`, retained in `coordinatorServerInfoStore`; it uses that before its short-pubkey fallback. Separately, NIP-01 kind-0 is a public profile JSON event for the coordinator pubkey. Configure both `McpServer`/`NostrServerTransport.serverInfo.name` at transport creation so fresh Cordn clients see the chosen name, and publish a coordinator-key kind-0 record to shareable relays for general Nostr profile resolution. Do not conflate either with the operator's profile. [VERIFIED: Cordn web commit `cd7fff81864286b857221df670d41e01d944da95`, `src/lib/transport.ts`] [CITED: https://github.com/nostr-protocol/nips/blob/master/01.md]

**Primary recommendation:** Add a pure setup/name + kind-0 publisher module, extend the persisted config with an explicit completion marker, put the blocking UI composition in `HostWorkspace`, and pass the normalized name into transport creation; do not install packages or rely on the SDK's startup-only profile publishing for retryable rename publication. [VERIFIED: local SDK declarations + `21-UI-SPEC.md`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Setup completion/migration/name normalization | Browser / Client | Storage | This is browser-local configuration and must be known before lifecycle controls render. [VERIFIED: `ConfigStore` synchronously reads localStorage] |
| Operator identity selection and authenticated profile prefill | Browser / Client | Nostr relay network | `UserProfileStore` owns NIP-07/NIP-46/anonymous state and fetches kind-0 metadata; the setup view only coordinates it. [VERIFIED: `src/identity/user-profile.svelte.ts`] |
| Coordinator transport key and start rejection | Browser / Client | API / Backend-like coordinator transport | `CoordinatorStore` holds the generated `KeyManager` and is the sole owner of the startup transaction. [VERIFIED: `src/coordinator/coordinator.svelte.ts`] |
| Initialize/discovery label | Frontend Server (transport) | Browser / Client | The transport emits coordinator discovery tags; Cordn web reads them from its coordinator client. [VERIFIED: local ContextVM SDK + Cordn web commit `cd7fff81864286b857221df670d41e01d944da95`] |
| Kind-0 profile publication/metadata merge | Browser / Client | Nostr relay network | The browser signs with the coordinator key and fans the signed event to public, configured relay paths. [CITED: https://github.com/nostr-protocol/nips/blob/master/01.md] |
| Setup and settings feedback | Browser / Client | — | `HostWorkspace` owns first-start gating and `CoordinatorSettings` owns later coordinator identity edits. [VERIFIED: `21-UI-SPEC.md`, `src/components/HostWorkspace.svelte`, `src/components/CoordinatorSettings.svelte`] |

## Project Constraints (from AGENTS.md)

- Treat `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md` as active-scope truth.
- Use codebase-memory graph discovery first; fall back to `rg` only for literal/config gaps.
- Preserve unrelated changes in the shared checkout; do not revert or overwrite other work.
- Use Svelte 5 runes, strict TypeScript, browser-safe APIs, and existing component/state patterns; do not add Node-only runtime dependencies.
- Never log or commit private keys, invite secrets, decrypted messages, raw publication failures, or stack traces.
- Use `apply_patch` for intentional edits.
- Run the narrowest relevant checks while iterating, then `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm test:e2e`, `pnpm build`, and `git diff --check` before shipping.
- If changing `src/cordn/`, coordinator contracts, or chat admission/wire paths, also run `pnpm check:upstream` and `pnpm test:upstream-interop`.

## Standard Stack

### Core

| Library / module | Version | Purpose | Why Standard |
|------------------|---------|---------|--------------|
| Existing `ConfigStore` | in-repo | Versioned browser-local config, migration, completion marker | It is the existing synchronous persistence boundary and already persists coordinator name/relay choices. [VERIFIED: `src/config/config.svelte.ts`] |
| Existing `UserProfileStore` | in-repo | Operator identity, NIP-07/NIP-46/anonymous state, profile lookup | It already adopts signers only after usable identity and resolves kind-0 metadata. [VERIFIED: `src/identity/user-profile.svelte.ts`] |
| Existing `KeyManager` | in-repo | Coordinator transport key | It owns an independent 32-byte key and returns a copied `Uint8Array` for controlled signing. [VERIFIED: `src/crypto/key-manager.ts`] |
| `nostr-tools` | pinned `2.23.5` (current registry: `2.24.1`, published 2026-07-21) | `finalizeEvent`, `verifyEvent`, `SimplePool` | Already installed and used for browser-side signing/relay I/O; no new dependency is needed. [VERIFIED: npm registry + local types] |
| `@contextvm/sdk` | pinned `0.13.10` | Nostr transport and initialize/discovery metadata | Existing `NostrServerTransport` accepts static `serverInfo` at construction. [VERIFIED: local SDK declarations] |

### Supporting

| Library / module | Version | Purpose | When to Use |
|------------------|---------|---------|-------------|
| Existing `shareableRelayUrls` / `ConfigStore.inviteRelayUrls` | in-repo | Deduped public `wss:` relay list excluding localhost | Use as the profile publication target; never use `enabledRelayUrls` because it appends `ws://localhost:4870`. [VERIFIED: `src/lib/relay-pool.ts`, `src/config/config.svelte.ts`] |
| Existing `BrowserNostrSigner` pattern | in-repo | Browser-safe finalization with a private key copy | Follow its `finalizeEvent` and key-zeroization pattern; the coordinator publisher can instead use a short-lived copied secret from `KeyManager`. [VERIFIED: `src/crypto/browser-nostr-signer.ts`] |
| Existing mock relay | in-repo test utility | Event reception and relay-path proof | Extend its observable event fixture only if the existing stored-event interface needs `content`/`sig` visibility. [VERIFIED: `tests/e2e/mock-relay.ts`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dedicated retryable publisher | `NostrServerTransport.profileMetadata` | SDK publishes configured metadata at startup but its metadata is constructor-owned and publication errors are caught/logged internally, so it cannot accurately drive the required rename retry status. [VERIFIED: local ContextVM SDK `AnnouncementManager`] |
| Static per-start `serverInfo.name` | Mutating private transport internals | The installed SDK exposes no public server-info update method; private-field mutation is unsafe and brittle. [VERIFIED: local SDK `.d.ts`] |
| Coordinator-key profile event | Operator signer profile event | Operator signing would publish under the wrong pubkey and violates the locked identity boundary. [CITED: https://github.com/nostr-protocol/nips/blob/master/01.md] [VERIFIED: `21-CONTEXT.md`] |

**Installation:** No package installation. Reuse the pinned dependencies already in `package.json`.

## Package Legitimacy Audit

No external package is installed by this phase; no package addition is recommended. The existing package versions stay pinned. A registry audit was nevertheless run: the current registry releases of `nostr-tools`, `@contextvm/sdk`, and `@contextvm/mcp-sdk` are flagged `SUS` by the automated age/download heuristic, so do not opportunistically upgrade them in this phase. [VERIFIED: package-legitimacy seam, npm registry]

## Architecture Patterns

### System Architecture Diagram

```text
App mount
  |
  +--> ConfigStore synchronous load
  |      |
  |      +--> explicit setupComplete? --yes--> HostWorkspace guided start
  |      |                         |
  |      |                         +--> CoordinatorStore.start validates completion
  |      |
  |      +--> legacy meaningful name? --yes--> normalize + persist completion --> guided start
  |      |                         |
  |      |                        no
  |      v
  |    HostWorkspace blocking setup (no start/wake/room controls)
  |      |
  |      +--> UserProfileStore: NIP-07 / NIP-46 / anonymous
  |      |       |
  |      |       +--> authenticated kind-0 lookup --> display_name | name prefill
  |      |
  |      +--> normalize name --> persist { coordinatorName, setupCompleted }
  |                              |
  |                              +--> ProfilePublisher (best effort)
  |                                      | coordinator KeyManager secret only
  |                                      +--> kind-0 signed event --> shareable wss relays
  |
  +--> Later CoordinatorSettings draft/save --> same ProfilePublisher/retry

CoordinatorStore.start
  +--> TransportFactory(configured normalized name)
         +--> McpServer initialize identity
         +--> NostrServerTransport.serverInfo.name
         +--> Cordn-web coordinatorClient/coordinatorServerInfo display label
```

### Recommended Project Structure

```text
src/
├── config/config.svelte.ts                 # persisted schema + completion/migration API
├── coordinator/coordinator-profile.ts       # pure metadata merge/sign/publish seam (new)
├── coordinator/coordinator.svelte.ts        # start guard + publisher orchestration
├── lib/transport.ts                         # initialize/serverInfo name at creation
├── components/HostWorkspace.svelte          # blocking setup state and start/autostart gate
├── components/CoordinatorSettings.svelte    # name draft, explicit save/retry feedback
└── components/UserProfile.svelte            # reusable signer controls; avoid changing identity semantics
tests/
├── unit/coordinator-profile.test.ts          # new pure publisher/merge/signing tests
├── unit/config-store.test.ts                 # setup completion/migration tests
├── unit/state-machine.test.ts                # start rejection/no transport test
└── e2e/first-run-coordinator-profile.spec.ts # new first-run and rename flow
```

### Pattern 1: One canonical pure name normalizer

**What:** Export `normalizeCoordinatorName(value: unknown): string | null` from the config/setup domain. It must coerce only strings, `trim()`, limit by `Array.from(...).slice(0, 48).join("")`, and return `null` for empty results. Use it for persisted migration, form validation, save, transport options, and metadata publication. [VERIFIED: `21-UI-SPEC.md`; existing config uses `trim()` on persisted values]

**When to use:** Every boundary where a coordinator name enters persistent or public state. Keep a raw UI draft separately so normal typing remains intact until explicit save. [VERIFIED: `21-UI-SPEC.md`]

```ts
export function normalizeCoordinatorName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = Array.from(value.trim()).slice(0, 48).join("");
  return normalized || null;
}
```

### Pattern 2: Explicit setup state, inferred once only for legacy records

**What:** Add `setupCompleted?: boolean` to the persisted config and a reactive, synchronous `setupState`/`isSetupComplete` API. On decoding a pre-marker record only, migrate completion if its normalized name is neither absent nor exactly the legacy untouched default `My coordinator`; persist that migrated marker immediately. Do not infer completion forever from the name. [VERIFIED: `21-UI-SPEC.md`, `src/config/config.svelte.ts`]

**When to use:** On config construction before `HostWorkspace` renders a lifecycle control. A corrupted/blank record stays incomplete and is never silently repaired with a start. [VERIFIED: `21-UI-SPEC.md`]

### Pattern 3: Existing store is the identity state machine; setup is a composition

**What:** Extract or parameterize the signer-action body currently in `UserProfile.svelte` only enough to render it inside setup; do not duplicate NIP-07/NIP-46/QR/bunker state. Advance to naming only after `userProfileStore.hasIdentity`, `initialized`, and a usable method/profile state; anonymous immediately uses the existing durable anonymous signer. [VERIFIED: `src/components/UserProfile.svelte`, `src/identity/user-profile.svelte.ts`, `21-UI-SPEC.md`]

**When to use:** First-run identity selection. Async profile completion may suggest a name only while the field remains untouched and default/empty; a local `nameTouched` boolean is the decisive guard. [VERIFIED: `21-UI-SPEC.md`]

### Pattern 4: Persist first, then independently publish/retry

**What:** `saveCoordinatorName()` validates and persists the normalized name/completion before awaiting the profile publisher. The publisher returns a privacy-safe result, while settings/setup own `idle | publishing | published | failed` UI state. A failed publish must retain the local name and never call stop/restart or regenerate a key. [VERIFIED: `21-CONTEXT.md`, `21-UI-SPEC.md`]

**When to use:** First completion, settings save, and retry. Serialize/ignore concurrent saves so two clicks cannot produce competing status transitions. [VERIFIED: `21-UI-SPEC.md`]

### Pattern 5: Separate initialize metadata from profile metadata

**What:** Pass the normalized name into `new McpServer({ name, version })` and `new NostrServerTransport({ serverInfo: { name, about } })` when a transport starts. Separately, create kind-0 JSON with `name` overwritten and non-name fields preserved, sign it with the coordinator key, and publish to `config.inviteRelayUrls`. [VERIFIED: `src/lib/transport.ts`, local ContextVM SDK declarations, Cordn web commit `cd7fff81864286b857221df670d41e01d944da95`] [CITED: https://github.com/nostr-protocol/nips/blob/master/01.md]

**When to use:** Every transport creation uses the persisted name. Every profile save/rename uses the publisher. These channels intentionally have different consumers and refresh timing. [VERIFIED: local ContextVM SDK + Cordn web sources]

### Recommended publisher seam

```ts
export interface CoordinatorProfilePublisher {
  publish(input: {
    name: string;
    coordinatorPubkey: string;
    getSecretKeyBytes: () => Uint8Array;
    relayUrls: readonly string[];
  }): Promise<void>;
}

// Query kind 0 by coordinator pubkey, parse only a JSON object, merge it, then:
const signed = finalizeEvent({
  kind: 0,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: JSON.stringify({ ...existingMetadata, name }),
}, secretKey);
await Promise.any(pool.publish([...relayUrls], signed));
```

Use `Promise.any` as the success policy: one configured shareable relay accepting the signed event is enough to report success; `AggregateError` means all target attempts failed. Always call `secretKey.fill(0)` and `pool.destroy()` in `finally`. [VERIFIED: local `nostr-tools` API + existing `SimplePoolNostrInstanceNetwork` cleanup pattern] [ASSUMED: one-relay acknowledgement is the product's intended availability threshold; confirm if all-relay acknowledgement is desired]

### Anti-Patterns to Avoid

- **Using `enabledRelayUrls` for public profile publication:** It includes the required local `ws://localhost:4870`, which is not shareable. Use `inviteRelayUrls`. [VERIFIED: `src/config/config.svelte.ts`, `src/lib/relay-pool.ts`]
- **Using `UserProfileStore.activeSigner` to sign coordinator metadata:** It publishes an operator event, violates the key boundary, and can be unavailable after logout. [VERIFIED: `src/identity/user-profile.svelte.ts`, `21-CONTEXT.md`]
- **Publishing on every input event:** It creates public relay churn and prevents draft validation/retry behavior. Publish only after explicit valid save. [VERIFIED: `21-UI-SPEC.md`]
- **Treating the default name as evidence of consent:** Legacy `My coordinator` means setup is still required; only a marker or meaningful legacy name bypasses it. [VERIFIED: `21-UI-SPEC.md`]
- **Letting autostart call `coordinator.start()` before setup resolution:** It would violate the start gate and cause a lifecycle-control flash. [VERIFIED: `src/components/HostWorkspace.svelte`, `21-UI-SPEC.md`]
- **Using the SDK's `profileMetadata` option as the whole solution:** It publishes at startup but catches errors internally and exposes no metadata update API. [VERIFIED: local ContextVM SDK `AnnouncementManager`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NIP-07/NIP-46 connection, QR, bunker cancellation | A second signer/authentication state machine | `UserProfileStore` + the established `UserProfile.svelte` actions | It already handles signer lifecycle, profile lookup, timeout/error states, and cancellation. [VERIFIED: codebase] |
| Nostr event serialization/signature | Custom SHA-256/Schnorr/event serializer | `nostr-tools/pure.finalizeEvent` and `verifyEvent` | NIP-01 requires canonical event serialization and valid Schnorr signatures. [CITED: https://github.com/nostr-protocol/nips/blob/master/01.md] [VERIFIED: local types] |
| Relay protocol/WebSocket management | Direct WebSocket Nostr client | `nostr-tools.SimplePool` | Existing code already uses it for browser Nostr requests/publishing and it returns per-relay promises. [VERIFIED: `src/identity/user-profile.svelte.ts`, local `nostr-tools` types] |
| Public relay filtering | Another URL/localhost filter | `shareableRelayUrls` via `config.inviteRelayUrls` | Existing helper rejects insecure/local URLs and dedupes shareable relay hints. [VERIFIED: `src/lib/relay-pool.ts`] |
| Coordinator private key storage | A profile-specific key or signer persistence | Existing `KeyManager` / key-storage flow | One coordinator key must remain authoritative for transport and its profile. [VERIFIED: `src/crypto/key-manager.ts`, `src/coordinator/coordinator.svelte.ts`] |

**Key insight:** The phase is orchestration of existing identity, config, key, transport, and relay primitives—not a new identity protocol. The only new domain logic should be deterministic setup inference and a narrow coordinator-key kind-0 publisher. [VERIFIED: codebase]

## Common Pitfalls

### Pitfall 1: Solving only kind-0 and leaving `cordn-browser` visible

**What goes wrong:** A valid kind-0 event exists, but Cordn web's coordinator label continues to use transport initialize metadata, so it shows a generic name or fallback. [VERIFIED: Cordn web commit `cd7fff81864286b857221df670d41e01d944da95`]

**How to avoid:** Feed the persisted normalized name to both `McpServer` and `NostrServerTransport.serverInfo` when the coordinator is created, and test the initialized metadata separately from kind-0. [VERIFIED: `src/lib/transport.ts`, local SDK declarations]

**Warning sign:** An integration test can verify a correct kind-0 but cannot observe the expected `serverInfo.name` in a Cordn client. [VERIFIED: Cordn web source]

### Pitfall 2: Assuming a live rename can mutate installed SDK server metadata

**What goes wrong:** The installed `NostrServerTransport` exposes setup methods for extra tags/pricing but no public setter for the constructor-owned `serverInfo` or `profileMetadata`. [VERIFIED: local SDK `.d.ts`]

**How to avoid:** Persist and publish kind-0 immediately; make transport initialize metadata correct for the next transport creation. Do not reach into private SDK fields. Treat an immediate live Cordn-label update without reconnect/restart as an explicit product decision requiring upstream support. [VERIFIED: local SDK declarations] [ASSUMED: no public dynamic setter exists beyond the installed type surface]

### Pitfall 3: Publishing with a stale/corrupt metadata object

**What goes wrong:** Blindly parsing event content can throw or replace all profile fields with `{ name }`. [CITED: https://github.com/nostr-protocol/nips/blob/master/01.md]

**How to avoid:** Select the newest kind-0 event by `created_at`, parse only a non-array JSON object, discard invalid/non-string/value-unsafe fields, merge `{ ...existing, name }`, and fall back to `{ name }`. Preserve fields "where possible," not at the cost of publication. [VERIFIED: existing `parseKindZero()` defensive approach] [ASSUMED: filtering to JSON-safe public metadata is sufficient; user confirmation is not needed because untrusted relay data is never rendered raw]

### Pitfall 4: Autostart bypasses the visual setup gate

**What goes wrong:** `HostWorkspace.onMount` currently calls `coordinator.start()` when autostart is on and presence is not offline. [VERIFIED: `src/components/HostWorkspace.svelte`]

**How to avoid:** Gate both autostart and every wake/start callback on `config.isSetupComplete`; independently guard `CoordinatorStore.start()` before state transition/lease/transport creation. [VERIFIED: `21-UI-SPEC.md`, `src/coordinator/coordinator.svelte.ts`]

### Pitfall 5: Late authenticated lookup overwrites a human draft

**What goes wrong:** `adoptSigner()` awaits `refreshProfile()`, while QR/sign-in UI completion and rendering can still race. [VERIFIED: `src/identity/user-profile.svelte.ts`]

**How to avoid:** Keep `nameTouched` local to setup. Apply `display_name` then `name` only to untouched default/empty draft and announce a suggestion through a polite live region. [VERIFIED: `21-UI-SPEC.md`]

### Pitfall 6: Error details leak secrets or infrastructure

**What goes wrong:** Relay errors can contain URLs or server response detail; NIP-46 data can include bunker URIs/secrets. [VERIFIED: `21-UI-SPEC.md`, `src/components/UserProfile.svelte`]

**How to avoid:** Store a user-safe failure code/message only, log no raw error through UI paths, and never render relay URLs, pubkeys, event JSON, bunker URI, or stack trace in setup/settings. [VERIFIED: `AGENTS.md`, `21-UI-SPEC.md`]

## Code Examples

### Coordinator-key kind-0 merge and signing

```ts
import { SimplePool, type Event as NostrEvent } from "nostr-tools";
import { finalizeEvent, verifyEvent } from "nostr-tools/pure";

export async function publishCoordinatorProfile(input: {
  name: string;
  pubkey: string;
  relays: readonly string[];
  getSecretKeyBytes: () => Uint8Array;
  fetchExisting: (pubkey: string, relays: readonly string[]) => Promise<Record<string, unknown> | null>;
}): Promise<void> {
  const pool = new SimplePool({ enablePing: false, enableReconnect: false });
  const secret = input.getSecretKeyBytes();
  try {
    const previous = await input.fetchExisting(input.pubkey, input.relays);
    const signed = finalizeEvent({
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify({ ...(previous ?? {}), name: input.name }),
    }, secret);
    if (signed.pubkey !== input.pubkey || !verifyEvent(signed)) throw new Error("Profile signing failed");
    await Promise.any(pool.publish([...input.relays], signed));
  } finally {
    secret.fill(0);
    pool.destroy();
  }
}
```

Source pattern: local `BrowserNostrSigner`, `SimplePoolNostrInstanceNetwork`, and NIP-01 kind-0 event requirements. [VERIFIED: codebase + local `nostr-tools` types] [CITED: https://github.com/nostr-protocol/nips/blob/master/01.md]

### Transport configuration at creation

```ts
const server = new McpServer({ name: options.coordinatorName, version: "0.1.0" });
const transport = new NostrServerTransport({
  signer,
  relayHandler,
  serverInfo: {
    name: options.coordinatorName,
    about: `Cordn coordinator running in a browser tab; key package quota ${options.maxUsers} per identity`,
  },
  // Do not use `profileMetadata` for retryable settings publication.
});
```

The production implementation should extend `BrowserCoordinatorOptions` with a validated `coordinatorName`, not read mutable global config mid-creation. [VERIFIED: `src/lib/transport.ts`, local SDK declarations]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard-coded `cordn-browser` transport metadata | Configured `serverInfo.name` passed at transport creation | Phase 21 | Fresh Cordn clients can learn the selected coordinator label from coordinator responses. [VERIFIED: `src/lib/transport.ts`, Cordn web source] |
| Implicit default coordinator name | Explicit completion marker plus one-time legacy migration | Phase 21 | Avoids both onboarding loops and treating an untouched default as consent. [VERIFIED: `21-UI-SPEC.md`] |
| Immediate name persistence on each settings keystroke | Draft + explicit save + separately retryable public publication | Phase 21 | Preserves normal editing and makes relay failure actionable without stopping runtime. [VERIFIED: `src/components/CoordinatorSettings.svelte`, `21-UI-SPEC.md`] |

**Deprecated/outdated:** Treating `serverInfo` as the general Nostr profile is incorrect. The SDK explicitly models it separately from optional kind-0 `profileMetadata`, and Cordn web's coordinator label is sourced from the former. [VERIFIED: local SDK declarations, Cordn web source]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | One accepted shareable relay is the correct success threshold for UI publication success. | Architecture Patterns | Product may expect all configured relays to succeed before success feedback. |
| A2 | The installed SDK has no supported live setter for `serverInfo`/`profileMetadata`; initialize metadata therefore refreshes on a new transport connection. | Common Pitfalls | A missed public SDK API could allow immediate label refresh more cleanly. |
| A3 | Filtering parsed existing metadata to safe JSON-object fields is enough for preserving profile fields where possible. | Common Pitfalls | A more specific metadata-preservation policy may be required. |

## Open Questions

1. **Must a running coordinator's Cordn-web label change immediately after rename?**
   - What we know: current Cordn web uses coordinator initialize/discovery `serverInfo.name`; the installed SDK only exposes static constructor options. [VERIFIED: Cordn web source + local SDK `.d.ts`]
   - What's unclear: whether a client reconnect/new session is acceptable until a future coordinator restart, or whether upstream SDK support is required now.
   - Recommendation: Plan immediate kind-0 publication and next-start initialize metadata; add a plan checkpoint before promising live remote-label refresh without restart.

2. **What acknowledgment policy should public profile publication use?**
   - What we know: `SimplePool.publish()` returns an independent promise per target relay. [VERIFIED: local `nostr-tools` types]
   - What's unclear: one relay vs all relay acknowledgements for a user-visible success state.
   - Recommendation: Use one successful configured shareable relay with a failure retry if none succeed, unless product direction requires stricter replication.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | build/unit tooling | ✓ | project requires `>=22` | — [VERIFIED: `package.json`] |
| pnpm | dependency/test commands | ✓ | package manager `10.17.1` declared | — [VERIFIED: `package.json`] |
| Browser Web Crypto/localStorage | setup/config/key persistence | ✓ in app runtime | browser API | Existing test jsdom/Playwright environments [VERIFIED: codebase] |
| Nostr relay | actual profile publication | configurable | configured `wss:` relays | UI keeps valid local configuration and offers retry. [VERIFIED: `21-UI-SPEC.md`] |

**Missing dependencies with no fallback:** None identified for implementation; public relay reachability is an operational publication condition, not a local build blocker. [VERIFIED: codebase + UI contract]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.9` and Playwright `1.61.0` [VERIFIED: `package.json`] |
| Config file | Existing project defaults/scripts; test directories are `tests/unit` and `tests/e2e`. [VERIFIED: `package.json`, repository layout] |
| Quick run command | `pnpm exec vitest run tests/unit/config-store.test.ts tests/unit/state-machine.test.ts tests/unit/coordinator-profile.test.ts` |
| Full suite command | `pnpm test && pnpm test:e2e` [VERIFIED: `package.json`] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETUP-01 | Anonymous and supported signer setup only advance on usable identity | unit + Playwright | `pnpm exec playwright test tests/e2e/first-run-coordinator-profile.spec.ts` | ❌ Wave 0 |
| SETUP-02 | trim/48-char validation, prefill precedence, late result cannot replace draft | unit + Playwright | `pnpm exec vitest run tests/unit/config-store.test.ts tests/unit/user-profile.test.ts tests/unit/coordinator-profile.test.ts` | partial / ❌ Wave 0 |
| SETUP-03 | marker persistence and meaningful/default/blank migration | unit + Playwright | `pnpm exec vitest run tests/unit/config-store.test.ts` | ✅ extend |
| SETUP-04 | explicit settings save persists then republishes without identity/runtime replacement | unit + Playwright | `pnpm exec playwright test tests/e2e/first-run-coordinator-profile.spec.ts` | ❌ Wave 0 |
| PROFILE-01 | kind-0 name, coordinator pubkey/signature, shareable relays, initialize name | unit + relay-backed integration | `pnpm exec vitest run tests/unit/coordinator-profile.test.ts` | ❌ Wave 0 |
| PROFILE-02 | metadata merge, all-target failure, safe retry, unchanged runtime | unit + Playwright | `pnpm exec vitest run tests/unit/coordinator-profile.test.ts tests/unit/state-machine.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** targeted Vitest file(s), targeted Playwright spec, `pnpm exec tsc --noEmit`.
- **Per wave merge:** `pnpm lint && pnpm test && pnpm build`.
- **Phase gate:** `pnpm test:e2e && git diff --check`; run `pnpm check:upstream` and `pnpm test:upstream-interop` if implementation touches `src/cordn/` or a coordinator contract. [VERIFIED: `AGENTS.md`]

### Wave 0 Gaps

- [ ] `tests/unit/coordinator-profile.test.ts` — test pure merge, malformed metadata fallback, coordinator pubkey/signature verification, shareable target list, one-success/all-fail semantics, zeroization/destroy cleanup.
- [ ] `tests/e2e/first-run-coordinator-profile.spec.ts` — stable selectors from `21-UI-SPEC.md`, initial gate/no flash, anonymous and mocked NIP-07/NIP-46 paths, profile prefill/edit preservation, migration/reload, settings retry.
- [ ] Extend `tests/unit/config-store.test.ts` — explicit marker and all legacy classification cases.
- [ ] Extend `tests/unit/state-machine.test.ts` — incomplete setup rejects before lease/transport and autostart has no bypass.
- [ ] Extend `tests/e2e/mock-relay.ts` only if tests need to inspect stored signed event `content`/`sig`; it currently stores only routing fields. [VERIFIED: codebase]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Reuse existing NIP-07/NIP-46/anonymous store; setup UI is not an auth replacement. [VERIFIED: codebase] |
| V3 Session Management | yes | Keep existing anonymous recovery/rotation/session handling; setup marker does not grant room authority. [VERIFIED: `src/identity/user-profile.svelte.ts`] |
| V4 Access Control | yes | Start gate is defense in depth only; coordinator RPC/admission contracts remain unchanged. [VERIFIED: `21-UI-SPEC.md`] |
| V5 Input Validation | yes | Normalize name at every persistent/public boundary; cap at 48; reject blank strings. [VERIFIED: `21-UI-SPEC.md`] |
| V6 Cryptography | yes | Use existing coordinator key and `nostr-tools/pure.finalizeEvent`; never hand-roll signing. [CITED: https://github.com/nostr-protocol/nips/blob/master/01.md] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Operator/coordinator key confusion | Spoofing / Elevation | Only `CoordinatorStore`/`KeyManager` supplies the signing key for kind-0; tests assert signed pubkey equals coordinator key, never operator pubkey. [VERIFIED: `21-CONTEXT.md`] |
| Metadata from relays is malformed or hostile | Tampering | Parse defensively as bounded JSON object; never inject raw JSON into HTML; overwrite only `name`. [VERIFIED: existing `parseKindZero()` pattern] |
| Relay/local infrastructure disclosure | Information disclosure | Publish only shareable `wss:` URLs; UI hides relay URLs and raw failures. [VERIFIED: `src/lib/relay-pool.ts`, `21-UI-SPEC.md`] |
| Start through a non-UI code path | Elevation / Integrity | Enforce setup completion in `CoordinatorStore.start()` before side effects, not only in the component. [VERIFIED: `21-UI-SPEC.md`] |
| Duplicate save/retry actions | Denial of service / Integrity | Single in-flight promise/state and disabled initiating control; retain focus and safe retry. [VERIFIED: `21-UI-SPEC.md`] |

## Sources

### Primary (HIGH confidence)

- Local codebase graph plus [`src/config/config.svelte.ts`](../../../src/config/config.svelte.ts) — config storage, relay derivation, coordinator-name baseline.
- Local codebase graph plus [`src/identity/user-profile.svelte.ts`](../../../src/identity/user-profile.svelte.ts) — durable anonymous identity, authenticated profile fetch, signer readiness.
- Local codebase graph plus [`src/coordinator/coordinator.svelte.ts`](../../../src/coordinator/coordinator.svelte.ts) and [`src/lib/transport.ts`](../../../src/lib/transport.ts) — startup ownership and static transport metadata.
- [Cordn web upstream](https://github.com/Cordn-msg/cordn-web) commit `cd7fff81864286b857221df670d41e01d944da95` — coordinator label precedence and initialize/discovery metadata collection.
- [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) — signed event structure and kind-0 metadata semantics.

### Secondary (MEDIUM confidence)

- Local installed `@contextvm/sdk` `0.13.10` declarations/source — static `serverInfo`, startup profile publication behavior, and lack of a public dynamic metadata setter in the installed API surface.
- [nostr-tools package documentation](https://www.npmjs.com/package/nostr-tools) and local `2.23.5` types — `finalizeEvent`, `verifyEvent`, `SimplePool.publish` signatures.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all proposed runtime dependencies are already pinned/used in the repo.
- Architecture: HIGH — derived from the real config, coordinator, identity, transport, and canonical Cordn-web source paths.
- Pitfalls: HIGH — direct evidence identifies the autostart call, separate server/profile metadata paths, and installed SDK limitation; the acknowledgment policy is explicitly marked assumed.

**Research date:** 2026-08-05
**Valid until:** 2026-08-12 (fast-moving upstream Cordn/ContextVM API surface)
