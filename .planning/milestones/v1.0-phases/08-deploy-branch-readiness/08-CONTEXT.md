---
status: complete
phase: 8
---

# Phase 8 Context: Deploy Branch Readiness

## Problem

The local repository branch is `master`, but the deploy workflow only listened for successful CI on `main`.
With no remote configured, there is no authoritative remote default branch yet.
If the eventual remote keeps this branch name, nsite deploy would not run after push.

## Constraints

- Do not rename branches or create a fake remote.
- Keep `main` support because new GitHub repositories commonly use it as the default branch.
- Keep the existing secret guard behavior so missing nsite secrets skip deployment rather than failing CI.

## Chosen Shape

- Add `master` to the CI pull request target branches.
- Add `master` to the nsite deploy workflow-run branch filter.
- Record the remaining external blocker: a real remote and repository secrets are still required.
