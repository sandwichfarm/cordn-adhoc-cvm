---
status: resolved
trigger: "Production startup reaches 100%, shows Coordinator online and Encrypted room delivery is ready, but remains stuck on the startup overlay; development does not reproduce."
created: 2026-08-06
updated: 2026-08-06
---

# Production Startup Stuck Complete

## Symptoms

- Expected: once coordinator startup and encrypted room delivery reach completion, the startup overlay dismisses and the host workspace becomes usable.
- Actual: production remains on the startup screen at 100%, with `Coordinator online`, `Encrypted room delivery is ready.`, and `6/6` visible.
- Errors: none shown in the supplied screenshot.
- Timeline: observed in the deployed production build; not observed in development.
- Reproduction: start the persisted production coordinator and wait for the six-step startup operation to complete.

## Current Focus

- hypothesis: A duplicate message id in restored/live production room state throws from the keyed chat render immediately after startup completes, leaving the last successful 100% startup frame visible.
- test: Reproduce a successful fresh production startup, trace the first post-start render, and exercise its shared message projection with non-adjacent duplicate ids.
- expecting: Fresh production state succeeds while duplicate live room data violates Svelte's keyed-each uniqueness requirement at the chat handoff.
- next_action: ship the render-boundary uniqueness invariant and monitor the production rollout
- reasoning_checkpoint: The deployed bundle starts successfully with fresh state. Both host and invitee chat routes use the same message-streak projection, making it the narrowest durable boundary for enforcing render keys.

## Evidence

- timestamp: 2026-08-06
  observation: Production screenshot shows the terminal 100%, 6/6, online, and delivery-ready presentation while the full startup overlay remains mounted.
- timestamp: 2026-08-06
  observation: A fresh anonymous coordinator completed startup against the exact deployed production bundle and rendered the ready workspace; only expected localhost relay failures appeared.
- timestamp: 2026-08-06
  observation: Persisted hydration deduplicates message ids, but the live `groupMessageStreaks` projection accepted raw arrays and fed them into keyed Svelte blocks in both chat routes.

## Eliminated

- The production bundle itself is stale or different: its asset hash matches the local build.
- Coordinator startup universally fails in production: a fresh production coordinator transitioned to online successfully.
- The state machine cannot transition from starting to running: the transition is valid and covered by existing unit tests.

## Resolution

- root_cause: Production room recovery can expose duplicate versions of a message id from historical state or live replay. The first chat render keyed those raw messages by id, so Svelte aborted the render after the progress panel had already reached 100%, making startup appear stuck.
- fix: Deduplicate messages in the shared streak projection before either chat route reaches a keyed block, preferring the confirmed or highest-cursor version.
- verification: Added a regression covering non-adjacent pending/confirmed duplicates; run unit, type, lint, build, E2E, and diff gates before shipping.
- files_changed: `src/chat/message-presentation.ts`, `tests/unit/message-presentation.test.ts`
