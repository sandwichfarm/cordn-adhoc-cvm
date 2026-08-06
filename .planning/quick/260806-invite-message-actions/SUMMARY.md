# Invite Message Actions — Summary

Requirement CHAT-04 is implemented.

- Canonical invite metadata now carries a bounded optional coordinator display name and preserves it in joined-room storage.
- Only complete message content accepted by `parseInviteUrl` becomes an invite action; malformed or mixed prose remains plain text.
- The shared host/guest message renderer shows `Join {group} on {coordinator} by {host avatar} {host}` and omits the raw capability URL from rendered message copy.
- Activation reconstructs the invite on the active shell origin and enters the established `autojoin=1` workflow.

## Verification

- `pnpm lint` — pass
- `pnpm exec tsc --noEmit` — pass
- `pnpm check:upstream` — pass, 11 methods and 7 schemas
- `pnpm test:upstream-interop` — pass, 3 tests
- `pnpm test` — pass
- `pnpm build` — pass
- `pnpm test:e2e` — pass, 96 tests
- `git diff --check` — pass

The browser scenario proves encrypted cross-client delivery, contextual group/coordinator/host presentation, host avatar presence, raw-link suppression, and canonical same-shell auto-join activation. Unit coverage proves coordinator-name round-tripping, strict complete-message recognition, malformed/mixed-text rejection, and current-origin URL reconstruction.
