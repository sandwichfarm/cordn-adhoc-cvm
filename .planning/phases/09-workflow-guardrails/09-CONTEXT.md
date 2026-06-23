---
status: complete
phase: 9
---

# Phase 9 Context: Workflow Guardrails

## Problem

Phase 8 changed the workflow branch filters to support `main` and `master`, but the existing workflow unit test still only asserted `main`.
That meant the branch-readiness fix could regress without failing local tests.

## Constraints

- Keep tests lightweight and independent of GitHub network state.
- Do not add a YAML parser dependency for this small guard.
- Preserve the existing deploy secret and action assertions.

## Chosen Shape

- Add a unit test for CI pull request filters.
- Extend the nsite deploy workflow test to assert both `main` and `master`.
