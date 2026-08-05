# Cordn reaction interoperability

## Status

Resolved and verified.

## Symptom

Messages propagate between CAHMLS and Cordn, but a reaction created in CAHMLS is not rendered by Cordn.

## Root cause

CAHMLS emitted a kind-7 event with only an `e` target tag. Cordn's canonical reaction parser requires the target event, author, and kind through `e`, `p`, and `k` tags. It therefore rejected CAHMLS reactions as malformed.

## Fix contract

- Outbound reactions include `e`, `p`, and `k` target tags.
- Newly created reactions derive target metadata from the stored target message.
- Previously stored CAHMLS reaction mutations remain readable.
- Focused tests prove the canonical outbound wire shape and authenticated round trip.

## Evidence

- Focused protocol/session tests: 12 passed.
- Full unit suite: 250 passed, 3 skipped.
- Pinned upstream Cordn interoperability suite: 3 passed.
- TypeScript, ESLint, production build, and `git diff --check`: passed.
