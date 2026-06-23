# Feature Research

**Domain:** Browser-based Nostr/MCP coordinator node (self-sovereign, server-free)
**Researched:** 2026-06-23
**Confidence:** HIGH — requirements are well-defined in PROJECT.md; domain is narrow and technical

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Keypair generation | Nostr identity is a keypair; without one the app does nothing | LOW | `@noble/secp256k1` or `nostr-tools` — `@contextvm/sdk` likely wraps this already |
| Coordinator start / stop | Basic lifecycle — users expect to turn a node on and off | LOW | Drives the core state machine: `idle → starting → running → stopping → idle` |
| Running status indicator | Users must know at a glance whether the coordinator is live | LOW | Single status badge; green/red in monospace style; no animated spinners |
| Relay list display | Users need to see which relays the coordinator is connecting through | LOW | Read-only view; always visible regardless of edit-lock state |
| Relay connectivity feedback | Users need to know if individual relays are actually connected | MEDIUM | Per-relay status; poll or subscribe to SDK connection events |
| Error surfacing | Coordinator failures must be visible; silent failures are worse than errors | LOW | Toast/banner or inline error message; no console-only errors |
| npub / pubkey display | Users share the coordinator's pubkey so MCP clients can find it | LOW | Copyable text display; truncated with click-to-expand |
| Destroy action | Users must be able to fully wipe key + state; critical for security UX | MEDIUM | Requires confirmation dialog + zero-fill of key buffer + localStorage.removeItem |

### Differentiators (Competitive Advantage)

Features that set this product apart. Not required by baseline expectations, but high-value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zero-server operation | Entire coordinator runs in the browser tab; no backend dependency | HIGH | This is the product; achieved via `NostrServerTransport` + browser WebSocket |
| Encrypted key persistence | Key survives browser restart without ever leaving the browser unencrypted | MEDIUM | AES-GCM encryption with user passphrase; passphrase never stored; key zero-filled on destroy |
| Guarded config editing | Relay list is read-only while running; explicit unlock prevents accidental wipes | LOW | Confirm-to-edit pattern; lock state bound to coordinator running state |
| Browser resource telemetry | Show subscription count, message rate, memory estimate inside the tab | MEDIUM | `performance.memory` (Chrome) + manual subscription counter; clearly labeled as estimates |
| Nostr-native deployment | The app itself is hosted via nsite/Blossom, not a centralized CDN | HIGH | Aligns ethos with function; nsite deploy handled by CI via `nsyte` |
| Destroy with key zeroing | `Uint8Array.fill(0)` before GC — reduces window for heap extraction attacks | LOW | Non-obvious security property that differentiates from naive implementations |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Server-side relay proxy | Some relays block browser WebSocket connections | Defeats the entire browser-only premise; adds infra costs | Use public relays that allow browser connections; document this constraint |
| Multi-coordinator management | Power users want to run multiple identities | Multiplies state complexity before the single-coordinator UX is validated | Validate v1, defer to v2 |
| Real-time log streaming | Developers want to see raw Nostr events | Clutters the minimal UI; can expose sensitive message content | Surface high-level stats via resource telemetry panel; not raw event logs |
| MCP tool authoring UI | Users want to define tools in the browser | Completely different product surface; coordinators proxy, not author | Out of scope; recommend separate tooling for MCP server authoring |
| NIP-42 paid relay auth | Some performant relays require auth | Adds auth flow before basic relay connectivity is proven | Defer until free-tier relay connectivity is stable |
| QR code for pubkey | Mobile users want to scan the npub | Mobile is not a target platform; adds library dependency for one use case | Plain copyable text + documentation |
| Dark/light theme toggle | User preference | Adds UI complexity for a cypherpunk tool targeting one aesthetic | Dark monospace only; consistent with the brand |
| Mobile-optimized layout | Users may open on phones | Desktop browser is the target; responsive is acceptable, mobile-first is not | Ensure it doesn't break on mobile, but don't design for it |

---

## Feature Dependencies

```
[Key Generation]
    └──required by──> [Coordinator Start]
                          └──required by──> [Resource Telemetry]
                          └──required by──> [Relay Connectivity Feedback]
                          └──required by──> [Relay Config Lock] (locked while running)

[Relay Configuration]
    └──required by──> [Coordinator Start] (relay list must exist before starting)

[Guarded Config Editing]
    └──enhances──> [Relay Configuration] (prevents accidental wipes)
    └──ties to──> [Coordinator State] (lock enforced when running)

[Key Persistence]
    └──enhances──> [Key Generation] (optional encrypted save; unlocks on load)
    └──required by──> [Destroy Action] (destroy must remove persisted key)

[Coordinator Stop]
    └──required by──> [Destroy Action] (must stop before wiping)

[Destroy Action]
    └──clears──> [Key Generation] (zero-fill + GC)
    └──clears──> [Key Persistence] (localStorage.removeItem)
    └──resets──> [Relay Configuration] (returns to default/empty state)
```

### Dependency Notes

- **Relay Configuration requires Key Generation**: the relay list is meaningless before a keypair exists; UI should show relay config only after key is generated (or let key generation and relay config happen in parallel before first start).
- **Destroy requires Coordinator Stop**: cannot wipe state while the coordinator is actively broadcasting; enforce this in the state machine.
- **Resource Telemetry requires Coordinator running**: metrics are only meaningful when the coordinator is live; hide or zero the panel when stopped.
- **Guarded Config ties to Coordinator State**: if the coordinator is running, config must be locked regardless of the edit-unlock state — resuming from a stopped state should re-evaluate lock.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate that a browser tab can function as a reachable Nostr/MCP coordinator.

- [x] **Key generation** — without an identity, nothing works
- [x] **Relay configuration panel** (guarded) — users must be able to supply relay URLs
- [x] **Coordinator start / stop** — the core loop must be togglable
- [x] **Running status indicator + relay connectivity** — users must know the coordinator is reachable
- [x] **npub display** — MCP clients need the pubkey to connect
- [x] **Destroy action** — essential for security-conscious users; builds trust
- [x] **Error surfacing** — coordinator failures must be visible
- [x] **Encrypted key persistence** — opt-in; critical for usability across browser restarts
- [x] **Resource telemetry** — subscription count + message rate; validates browser can sustain load
- [x] **CI workflow** — lint → unit → Playwright; gates correctness before every push
- [x] **nsite deploy** — deploys the app to Blossom/Nostr on push to `main`

### Add After Validation (v1.x)

Features to add once the core coordinator flow is proven stable.

- [ ] **NIP-42 relay authentication** — add when users report rejection from auth-required relays; don't build before that signal
- [ ] **Relay latency display** — per-relay round-trip time; useful once basic connectivity is solid
- [ ] **Import existing nsec** — allow users to bring their own key; defer until there's demand (auto-generated key is sufficient for v1)

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Multi-coordinator management** — only makes sense after v1 UX is validated and users ask for it
- [ ] **MCP tool authoring UI** — separate product surface; not a coordinator concern
- [ ] **Mobile layout** — revisit if usage data shows mobile traffic

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Key generation | HIGH | LOW | P1 |
| Coordinator start / stop | HIGH | LOW | P1 |
| Running status indicator | HIGH | LOW | P1 |
| Relay configuration panel | HIGH | LOW | P1 |
| npub / pubkey display | HIGH | LOW | P1 |
| Destroy action | HIGH | MEDIUM | P1 |
| Error surfacing | HIGH | LOW | P1 |
| Relay connectivity feedback | HIGH | MEDIUM | P1 |
| Encrypted key persistence | HIGH | MEDIUM | P1 |
| Guarded config editing | MEDIUM | LOW | P1 |
| Resource telemetry | MEDIUM | MEDIUM | P2 |
| CI/CD workflow | HIGH | MEDIUM | P1 |
| nsite deploy | HIGH | MEDIUM | P1 |
| NIP-42 relay auth | LOW | HIGH | P3 |
| Relay latency display | LOW | MEDIUM | P3 |
| Import existing nsec | MEDIUM | LOW | P2 |
| Multi-coordinator | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch — gates the v1 deploy
- P2: Should have, add when core is stable
- P3: Nice to have, future consideration

---

## Competitor / Comparable App Analysis

There are no direct competitors — a browser-only Nostr MCP coordinator is novel. The closest analogues:

| Feature | Typical Nostr Client (e.g. Snort) | Nostr Relay Admin (e.g. nostr.watch) | Cordn Browser |
|---------|-----------------------------------|---------------------------------------|----------------|
| Key management | Full wallet UX (NIP-07, bunkers) | Server-side keypair | In-browser generate + optional persist |
| Relay config | Per-user relay list | Admin panel with auth | Guarded edit panel |
| Running status | N/A (client, not server) | Relay health dashboard | Coordinator running state |
| Deploy target | Hosted web app or app store | Self-hosted server | Static nsite/Blossom |
| MCP support | None | None | Core capability |

**Implication:** There's no established UX pattern to copy directly. The closest mental model to borrow from is a VPN client or Tor Browser toggle — one big on/off action with config underneath. This informs the GUI layout: status + toggle front-and-center, config secondary.

---

## Sources

- PROJECT.md requirements and context (authoritative; high confidence)
- ContextVM SDK docs and nostr-tools ecosystem knowledge (training data; medium confidence for SDK internals)
- Nostr NIP registry (NIP-42 auth, NIP-04/44 encryption) — patterns well established
- Browser security model (Web Crypto API, localStorage, performance.memory) — HIGH confidence

---
*Feature research for: Cordn Browser — browser-resident Nostr/MCP coordinator*
*Researched: 2026-06-23*
