---
status: complete
---

# Phase 11 Plan: Subscription Limit Truthfulness

## Goal

Make the runtime limit guard truthful by wiring it to the live subscription count and labeling that source accurately.

## Tasks

- Rename the config guard source from active users to active subscriptions.
- Synchronize the guard floor from the resource monitor subscription counter.
- Update the runtime options UI label and limit error copy.
- Update unit and Playwright tests to lock the copy.

## Stop Condition

Tests prove the max-users guard and rendered runtime options refer to active subscriptions, not authoritative users.
