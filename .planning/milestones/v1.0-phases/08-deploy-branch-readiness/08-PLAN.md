---
status: complete
---

# Phase 8 Plan: Deploy Branch Readiness

## Goal

Make the deploy workflow ready for the repository's current branch while retaining `main` compatibility.

## Tasks

- Update CI pull request branch filters to include `master`.
- Update nsite deploy workflow-run branch filters to include `master`.
- Leave deploy secret checks unchanged.
- Validate workflow YAML and full local CI.

## Stop Condition

Workflow files support both `main` and `master`, syntax checks pass, and full local CI remains green.
