---
phase: 18
slug: unified-presence-notifications-controls
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-06
---

# Phase 18 — Security

> Verification of the plan-time STRIDE register against the implemented notification, invitation, presence, and shell controls.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|---|---|---|
| Relay to trusted invitation state | Untrusted events require sender and payload validation before becoming actionable. | Signed relay events and decoded invite metadata |
| Live invite to browser persistence | Capability-bearing links remain live-only; persistence stores allowlisted notification and resolution data. | Invite IDs, safe labels, timestamps |
| Feed to browser notification API | Desktop projection requires explicit permission plus enabled category/cadence gates. | Privacy-safe notification copy |
| Personal preference to coordinator authority | Presence and channel preferences must not mutate coordinator lifecycle or host authority. | Local preference enums |
| Overlay to background workspace | Modal and viewport overlays must isolate background activation and preserve focus. | Pointer and keyboard input |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|---|---|---|---|---|---|---|
| T-18-01 | Spoofing | Invite ingress | high | mitigate | Followed-sender, payload, and resolution checks remain in `NostrSocialStore`. | closed |
| T-18-02 | Information Disclosure | Notification persistence | critical | mitigate | `normalizeEvent` persists an allowlisted safe schema; capabilities and message bodies are excluded. | closed |
| T-18-03 | Tampering | Resolution ledger | high | mitigate | Stable ID/timestamp records, resolution-before-removal, and fixed retention are unit tested. | closed |
| T-18-04 | Denial of Service | Feed/desktop queues | medium | mitigate | Category/key upsert, bounded feed, one cadence timer, and invitation-preserving eviction are tested. | closed |
| T-18-05 | Repudiation | Read vs. resolution | medium | mitigate | Read and invitation resolution remain independent records with regression coverage. | closed |
| T-18-06 | Elevation of Privilege | Invite accept | high | mitigate | Accept requires a matching trusted live invitation and existing same-shell validation. | closed |
| T-18-07 | Spoofing | Invite presentation | high | mitigate | Actionability is joined to a validated live invite ID rather than persisted presentation alone. | closed |
| T-18-08 | Repudiation | Invite dismiss | medium | mitigate | Explicit confirmation and resolution-before-removal behavior are browser tested. | closed |
| T-18-09 | Information Disclosure | Feed/settings DOM | medium | mitigate | Only normalized labels/keys render; capability values are absent from persisted entries. | closed |
| T-18-10 | Denial of Service | Permission prompt | medium | mitigate | Only the named enable action requests permission; opening settings is prompt-free. | closed |
| T-18-11 | Tampering | Modal background | low | mitigate | Viewport overlay, scrim, Escape, focus return, and compact containment regressions pass. | closed |
| T-18-12 | Denial of Service | Presence handler | high | mitigate | Presence persistence/social publication remains separate from lifecycle calls and is tested. | closed |
| T-18-13 | Elevation of Privilege | Host badge editor | high | mitigate | Host mutation remains confined to locally controlled coordinator settings. | closed |
| T-18-14 | Spoofing | Presence indicator | medium | mitigate | Visual and accessible status derive from the same persisted enum. | closed |
| T-18-15 | Tampering | Lifecycle controls | medium | mitigate | `LifecyclePanel` remains the sole lifecycle owner across breakpoints. | closed |
| T-18-16 | Repudiation | Compact actions | low | mitigate | Explicit names, focus management, and established destructive confirmations remain covered. | closed |

## Accepted Risks Log

No accepted risks.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|---|---:|---:|---:|---|
| 2026-08-06 | 16 | 16 | 0 | Codex inline audit (subagent dispatch unavailable by policy) |

## Sign-Off

- [x] All threats have a disposition
- [x] Accepted risks documented
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-06
