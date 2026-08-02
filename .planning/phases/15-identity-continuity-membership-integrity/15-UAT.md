---
status: testing
phase: 15-identity-continuity-membership-integrity
source:
  - 15-01-SUMMARY.md
  - 15-02-SUMMARY.md
  - 15-03-SUMMARY.md
  - 15-VERIFICATION.md
started: 2026-08-02T17:19:02Z
updated: 2026-08-02T17:19:02Z
---

## Current Test

number: 1
name: Rotation progress and recoverable failure
expected: |
  While rotation or recovery is in flight, every dialog action is disabled, the
  primary action and live region communicate progress, Escape/backdrop cannot
  dismiss the dialog, and no identity is published early. A pre-boundary failure
  keeps the dialog open with an actionable alert while preserving the current
  identity and local room authority so the action can be retried.
awaiting: automated browser evidence

## Tests

### 1. Rotation progress and recoverable failure
expected: While rotation or recovery is in flight, controls and dismissal are locked with visible progress and no premature identity change; a pre-boundary failure remains retryable with unchanged identity and authority.
result: [pending]

### 2. Corrupt identity recovery is explicit
expected: Reloading malformed anonymous-identity storage shows mandatory recovery without presenting a coordinator key, legacy room key, or silently generated replacement as the device identity.
result: [pending]

### 3. Composite room reconciliation stays distinct
expected: Same-room-ID records at different coordinators remain separate while verified legacy/v2 aliases render only once per composite identity, and no room secret is promoted into the device identity.
result: [pending]

### 4. Rotation scope, copy, and responsive presentation
expected: Rotation copy does not claim cached or coordinator-hosted data is deleted; NIP-07/NIP-46 identities do not expose anonymous rotation or lose their sessions; key summaries and the dialog fit desktop and narrow viewports without horizontal overflow.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

[none yet]
