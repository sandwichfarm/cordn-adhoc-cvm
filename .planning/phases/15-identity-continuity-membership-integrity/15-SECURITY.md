---
phase: 15
slug: identity-continuity-membership-integrity
status: verified
threats_open: 0
register_authored_at_plan_time: true
asvs_level: 1
created: 2026-08-02
---

# Phase 15 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser storage → identity/room transaction | Persisted values are untrusted until validated and may represent an interrupted rotation. | Anonymous credential material, recovery marker, retirement journal, cached room records. |
| Signer → stored room identity | A send-capable session must prove ownership of the room's immutable member pubkey. | Public-key identity and signing/encryption authority. |
| Live room session → rotation transaction | Queued work must not survive retirement of its signer. | In-flight room writes, MLS state, lifecycle callbacks. |
| Composite room selector → persistence mutation | Identical room IDs from different coordinators must remain isolated. | Coordinator pubkey, room ID, storage aliases, membership state. |
| Secret-bearing runtime → product output | Private material must never reach dialogs, logs, snapshots, or fixtures. | Old, corrupt, staged, and replacement signer bytes. |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-15-01 | Tampering | Identity, recovery, and retirement journals | high | mitigate | Versioned strict parsing; corrupt-present fail-closed state; verified recovery marker and canonical read-back; exact pre-boundary storage rollback. Corruption, rollback, and recovery-boundary tests pass. | closed |
| T-15-02 | Spoofing / Elevation of privilege | Lifecycle registration and restored room attachment | high | mitigate | `requireRoomSigner` rejects retired membership and requires signer pubkey equality with immutable `stablePubkey` before a send-capable session attaches. Mismatch/cache-only tests pass. | closed |
| T-15-03 | Elevation of privilege | In-flight old room sessions and post-destruction restart | high | mitigate | Rotation awaits lifecycle retirement, discards matching sessions, persists the recovery boundary, destroys the old signer, and publishes the replacement only after commit. `BrowserNostrSigner.destroy()` zeroizes its owned buffer and prevents later signing. Held-in-flight and post-boundary browser tests pass. | closed |
| T-15-04 | Tampering | Membership count, reconciliation, retirement, and rollback | high | mitigate | Ownership provenance plus `(coordinatorPubkey, roomId)` scopes reads, writes, list keys, retirement, and alias deletion. Same-ID foreign-coordinator and exhaustive-alias tests pass. | closed |
| T-15-05 | Information disclosure | Dialogs, live regions, logs, tests, and signer buffers | high | mitigate | Product output uses public summaries and generic errors; tests prohibit secret leakage; aborted and retired signer buffers are destroyed/zeroized. | closed |
| T-15-06 | Elevation of privilege | NIP-07/NIP-46 identity variants | high | mitigate | Rotation/recovery is anonymous-only; authenticated sessions carry external ownership provenance and are excluded from anonymous retirement, counting, and recovery. NIP-07/NIP-46 isolation tests pass. | closed |
| T-15-SC | Tampering | Package supply chain | low | accept | Phase 15 introduced no package installation or upgrade and uses existing pinned dependencies and native browser controls. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-15-01 | T-15-SC | No dependency graph change occurred in this phase, so the existing project-wide supply-chain posture is unchanged and outside this phase's implementation scope. | Project workflow | 2026-08-02 |

---

## Verification Evidence

- Final code review: zero critical, warning, or informational findings in `15-REVIEW.md`.
- Identity and room unit gates: 170/170 project unit tests pass; targeted identity/room suites pass.
- Focused browser security gate: 13/13 tests pass across rotation behavior, identity prohibitions, and UI review.
- Static gates: lint, TypeScript, production build, and `git diff --check` pass.
- Code-graph inspection confirmed signer equality enforcement, recovery-marker ordering, durable ownership provenance, and private-key zeroization in the production call paths.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-02 | 7 | 7 | 0 | Codex security verification |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-02
