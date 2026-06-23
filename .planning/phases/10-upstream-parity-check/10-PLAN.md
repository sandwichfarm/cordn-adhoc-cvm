---
status: complete
---

# Phase 10 Plan: Upstream Parity Check

## Goal

Give operators a repo-local command that verifies the browser method surface against live Cordn upstream.

## Tasks

- Add a shell script that sparse-clones Cordn upstream.
- Compare upstream and browser coordinator method keys using a Node parser.
- Print the upstream commit in the success output.
- Add a package script for the check.
- Run the check against live upstream.

## Stop Condition

`pnpm check:upstream` passes against live Cordn upstream and reports the checked commit.
