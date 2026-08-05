---
schema_version: 1
open_count: 5
waived_count: 0
fixed_count: 0
total_count: 5
last_updated: 2026-08-05T11:23:07.105Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 15 | deviation | src/identity/anonymous-identity.ts |  | Verified persisted writes through the strict parser | open |  | 2026-08-02T16:00:06.156Z |  |
| 2 | 15 | deviation | src/components/UserProfile.svelte |  | Removed coordinator-to-profile prop path required for durable anonymous identity | open |  | 2026-08-02T16:00:06.218Z |  |
| 3 | 15 | deviation | tests/unit/user-profile.test.ts |  | Avoided raw persisted credential values in assertion diagnostics | open |  | 2026-08-02T16:00:06.284Z |  |
| 4 | 15 | unrun-verify | tests/e2e/phase-one.spec.ts | 406 | Full Playwright suite remains blocked by the unrelated narrow-viewport operator-shell height assertion. | open |  | 2026-08-02T16:26:18.963Z |  |
| 5 | 21 | deviation | tests/e2e/nip07-session-restoration.spec.ts |  | Profile browser suites require a completed-setup fixture after Phase 21 hides UserProfile on incomplete fresh installs. | open |  | 2026-08-05T11:23:07.105Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "15",
    "file": "src/identity/anonymous-identity.ts",
    "line": null,
    "description": "Verified persisted writes through the strict parser",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-02T16:00:06.156Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "15",
    "file": "src/components/UserProfile.svelte",
    "line": null,
    "description": "Removed coordinator-to-profile prop path required for durable anonymous identity",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-02T16:00:06.218Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "15",
    "file": "tests/unit/user-profile.test.ts",
    "line": null,
    "description": "Avoided raw persisted credential values in assertion diagnostics",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-02T16:00:06.284Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "15",
    "file": "tests/e2e/phase-one.spec.ts",
    "line": 406,
    "description": "Full Playwright suite remains blocked by the unrelated narrow-viewport operator-shell height assertion.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-02T16:26:18.963Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "21",
    "file": "tests/e2e/nip07-session-restoration.spec.ts",
    "line": null,
    "description": "Profile browser suites require a completed-setup fixture after Phase 21 hides UserProfile on incomplete fresh installs.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-05T11:23:07.105Z",
    "resolved_at": null
  }
]
````
