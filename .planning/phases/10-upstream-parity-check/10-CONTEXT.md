---
status: complete
phase: 10
---

# Phase 10 Context: Upstream Parity Check

## Problem

The objective explicitly references Cordn upstream `src/server`.
The browser implementation registered the upstream method surface, but local tests only checked internal consistency.
They did not provide a repeatable operator command for checking browser method keys against live upstream.

## Constraints

- Use only existing tools: git, bash, and Node.
- Do not add package dependencies.
- Keep network-dependent upstream checks out of default CI.
- Use `/tmp` for transient upstream checkout work.

## Chosen Shape

- Add `scripts/check-cordn-upstream-parity.sh`.
- Sparse-clone upstream Cordn `src/server` and `src/contracts`.
- Extract upstream `COORDINATOR_METHODS.<key>` usage.
- Extract browser `COORDINATOR_METHODS` keys.
- Fail if either side has missing or extra method keys.
