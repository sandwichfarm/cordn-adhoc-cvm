# Completion Audit: Cordn Browser

**Audited:** 2026-06-23
**Commit:** `274f97276145f2ede8214d28f2f37c05072e9f8a`
**Remote:** `origin/master`

## Verdict

The browser implementation, tests, upstream method parity, GitHub CI, and push requirements are proven.
The live nsite publication requirement is not proven because deploy secrets are missing.

## Requirement Evidence

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Cordn server runs in browser | Proven | `pnpm run ci` passed build and Playwright on 2026-06-23 |
| Upstream `src/server` method surface | Proven | `pnpm check:upstream` passed: 14 methods match upstream commit `1236d36e0485a129160bb6a995d11b17ef6bfa36` |
| Minimal cypherpunk GUI | Proven | Phase 12 screenshots and visual verdict score 92/100 in `.omx/state/cordn-browser-visual/ralph-progress.json` |
| Pubkey generated on init | Proven | Playwright `generates copyable identity on first load` passed |
| Runtime options: announcement, relays, persistence, max users | Proven | Playwright start/config/persistence tests plus unit config tests passed |
| Optional persistence remembers key | Proven | Playwright encrypted-key reload test passed |
| Coordinator state persistence | Proven | Unit tests and `pnpm run ci` passed for SQLite-WASM snapshot persistence |
| Destroy all state, including caches | Proven | Playwright seeds Cache Storage and verifies confirmed destroy removes it |
| Guarded configuration and browser limits | Proven | Unit config tests and Playwright runtime-option tests passed |
| Svelte 5 + Vite + Tailwind | Proven | `package.json` dependencies and `pnpm build` passed |
| CI workflow | Proven | GitHub CI run `28003837779` passed for commit `274f97276145f2ede8214d28f2f37c05072e9f8a` |
| nsite deploy workflow using marketplace action | Partially proven | GitHub deploy workflow run `28003890153` fired from CI via `workflow_run`; remote workflow uses `sandwichfarm/nsite-action@v0.5.1` |
| Helper script for required secrets | Proven | `scripts/setup-secrets.sh` exists, is executable, and is covered by unit test |
| GSD workflow | Proven | GSD reports 13/13 phases complete before this audit |
| Pushed to remote | Proven | Local `HEAD` and `origin/master` both equal `274f97276145f2ede8214d28f2f37c05072e9f8a` |

## Unproven Stop-Condition Item

Live nsite publish is blocked. GitHub deploy run `28003890153` completed successfully as a guarded skip:

- `NBUNK_SECRET` was empty.
- `NSYTE_RELAY` was empty.
- `BLOSSOM_SERVER_URL` was empty.
- `Deploy to Nostr and Blossom` was skipped.

Local environment check also showed:

- `NBUNK_SECRET=missing`
- `NSYTE_RELAY=missing`
- `BLOSSOM_SERVER_URL=missing`
- `NSITE_NAME=missing`

## Remaining Action

Configure the three required GitHub secrets with `scripts/setup-secrets.sh`, then trigger a new push or rerun the deploy path and verify the `Deploy to Nostr and Blossom` step executes instead of skipping.
