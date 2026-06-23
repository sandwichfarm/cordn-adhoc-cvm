---
status: complete
---

# Phase 9 Plan: Workflow Guardrails

## Goal

Make the local test suite protect CI/deploy branch readiness.

## Tasks

- Add a unit test that reads `.github/workflows/ci.yml` and asserts `main` plus `master` pull request filters.
- Extend the deploy workflow test to assert `main` plus `master` workflow-run filters.
- Keep the existing nsite action and secret guard assertions.
- Run targeted and full validation.

## Stop Condition

The workflow test fails if either branch filter drops `master`, and full local CI passes.
