---
status: complete
---

# Phase 4 Plan: Runtime Limits & Guarded Options

## Goal

Make the original objective's explicit browser-limit and guarded-config requirements more true while keeping the change narrow and verifiable.

## Tasks

- Extend config validation with `DEFAULT_MAX_USERS`, a browser cap, and active-user guard checks.
- Extend `ConfigStore` with announcement, max-users, active-user count, and coordinator options.
- Render runtime options in the existing guarded relay config panel.
- Pass announcement and max-users options into transport creation.
- Add unit and Playwright regression coverage.

## Stop Condition

The app exposes announcement and max-users controls behind the existing edit guard, rejects invalid max-users values, refuses reductions below active users, and keeps the full CI suite green.
