# Git and Remote Delivery Procedures

This document defines the required Git and GitHub procedure for agents working in CAHMLS. It supplements `AGENTS.md`. The default delivery target is a reviewable remote pull request, not an unpushed local branch.

## Delivery Invariants

- Never discard, rewrite, stage, or commit unrelated work from another user or agent.
- Never develop directly on `master` or `main`. If work is already present there locally, create a feature branch at the current commit before adding more changes.
- Never push directly to the default branch. Push a feature branch and use a pull request.
- Never use `git reset --hard`, destructive checkout commands, or an unqualified force push. Rewriting a published branch requires explicit user approval and must use `--force-with-lease`.
- Never include credentials, private keys, invite secrets, decrypted content, local databases, generated browser artifacts, or unrelated planning state in a commit.
- A task described as complete must have focused commits. Unless the user explicitly requests local-only work, it must also have a pushed branch and an open or updated PR, or a clearly reported remote blocker.

## Start-of-Work Synchronization

Before editing:

1. Inspect `git status --short --branch`, the current branch, configured remotes, and existing worktrees.
2. Preserve any pre-existing changes. If they overlap the intended files and cannot be safely separated, stop and ask the user.
3. Run `git fetch --prune origin` when network access is available.
4. Determine the repository's default branch from the remote rather than assuming its name.
5. Start from the current task's intended base. Create a descriptive branch such as `feat/coordinator-profile`, `fix/replayed-room-records`, or `docs/git-procedures`.
6. If the local default branch contains unpublished task commits, branch from that exact commit so they are preserved, then compare the resulting branch with `origin/<default>`.

Do not use `git pull` as a blind synchronization step. Fetch first, inspect divergence, then choose an explicit integration action.

## Commit Procedure and Cadence

Commit at independently verifiable boundaries:

- after a failing regression test captures the defect, when that test is useful on its own;
- after the corresponding implementation and focused checks pass;
- after a bounded UI, documentation, migration, or planning increment is complete;
- before switching responsibility, pausing, or beginning a risky integration step.

Each commit must:

- contain one coherent change and its directly related tests or artifacts;
- use a conventional subject such as `fix(chat): deduplicate replayed messages`;
- reference the relevant requirement, phase, issue, or review finding when one exists;
- pass `git diff --check` and the narrowest relevant verification;
- be inspected with `git diff --cached --stat` and `git diff --cached` before creation.

Agents should normally create several focused commits during a phase. Do not leave completed implementation uncommitted, and do not squash unrelated work merely to reduce commit count.

## Keeping a Feature Branch Current

Before the full verification gate and again immediately before opening or updating a PR:

1. Ensure the worktree is clean and all intended work is committed.
2. Run `git fetch --prune origin`.
3. Inspect `git log --left-right --graph HEAD...origin/<default>`.
4. If the remote default branch advanced, integrate it into the feature branch. Prefer a rebase for an unpublished branch; use a merge when the branch is shared or its published history must remain stable.
5. Resolve conflicts by preserving both the task intent and valid upstream changes. Re-run affected tests after resolution.
6. Re-run the complete required quality gates after integration.

If divergence or conflicts make the correct result ambiguous, do not guess and do not overwrite upstream work. Report the conflicting files, commits, and product decision needed.

## Push Procedure

Push after the first coherent, verified commit so work is backed up remotely, and push subsequent verified commits at meaningful checkpoints:

```bash
git push -u origin HEAD
```

After the upstream is configured, use `git push`. Verify with `git status --short --branch` and compare local `HEAD` with the remote feature-branch ref. A local commit hash alone is not delivery evidence.

If authentication, permissions, branch protection, or network access blocks the push, retain the local commits and report the exact command failure and branch name. Never claim the branch was published.

## Pull Request Procedure

Open a PR once the branch contains a reviewable vertical increment. Use a draft PR when meaningful work is pushed but verification or later planned increments remain. Mark it ready only after the completion gates pass.

Before opening or updating the PR:

- confirm the base branch and inspect the complete `origin/<default>...HEAD` diff;
- run all gates required by `AGENTS.md`, including Cordn upstream interoperability gates when applicable;
- ensure planning, verification, and requirement status accurately match the code;
- confirm there are no accidental generated files, secrets, debug logs, or unrelated edits.

The PR title should use the repository's conventional commit style. The body must include:

- the user-visible outcome and motivation;
- a concise implementation summary;
- requirements, phases, and issues addressed;
- exact verification commands and results;
- security, compatibility, migration, or deployment considerations;
- screenshots or recordings for material UI changes;
- known limitations or blocked external checks.

Create or update the PR with GitHub CLI when available. Do not create a duplicate PR: first inspect `gh pr list --head <branch>`.

After opening the PR:

1. Record its URL and number in `.planning/STATE.md` or the applicable verification/shipping artifact.
2. Monitor required checks to a terminal result.
3. Diagnose failures, commit fixes atomically, push, and update the evidence.
4. Request review or mark ready only when the branch meets the completion standard.
5. Do not merge unless the user explicitly requests merging or the active shipping workflow grants that authority.

## Handling Upstream Changes and Defects

"Upstream" may mean the remote default branch or an external dependency such as Cordn/ContextVM. Treat them separately.

For changes on this repository's default branch:

- integrate the updated base as described above;
- adapt to intentional upstream behavior rather than reverting it;
- preserve local task requirements and add regression coverage for conflict resolutions;
- escalate when two locked requirements conflict or when resolution requires a product decision.

For an external dependency issue:

1. Reproduce it against the currently pinned version and, where practical, the latest upstream revision.
2. Reduce it to a minimal, secret-free example and identify the exact version or commit.
3. Search upstream issues and pull requests for an existing report.
4. Decide whether the local repository can safely contain or adapt to the behavior. Keep defensive local fixes separate from speculative upstream changes.
5. Record links to relevant upstream issues or commits in the local planning/debug artifact and PR.

Do not silently patch vendored or generated dependency code. Prefer a local adapter, a pinned version change with tests, or a reviewed upstream contribution.

## When to Publish a Remote Issue

Publish an issue in this repository when a verified, actionable defect or follow-up remains outside the current PR and at least one of these is true:

- it blocks a requirement, release, deployment, or required quality gate;
- it is reproducible but deliberately deferred from the current scope;
- it represents recurring operational risk that needs an owner and acceptance criteria;
- review or verification found a gap that cannot be responsibly fixed in the current branch.

Do not publish an issue for an unverified suspicion, a transient local-environment failure, a duplicate report, or work already fully handled by the current PR. Search first, include reproduction steps, expected and actual behavior, impact, environment/version, sanitized evidence, and a clear completion condition. Link the originating PR or planning artifact.

Publishing to a third-party upstream repository is external coordination. Do so only when the user explicitly requests upstream reporting or the active task/ship workflow expressly includes it. Otherwise, prepare a ready-to-file report locally and ask for authorization. Never publicly disclose a suspected vulnerability, private data, keys, invite material, or exploit details; use the upstream project's private security-reporting channel and notify the user.

## Completion and Handoff

The final handoff must state:

- branch name and latest commit;
- pushed remote branch, or the exact reason it could not be pushed;
- PR URL and status, or the exact reason no PR was opened;
- checks run and any unresolved failures;
- linked local or upstream issues;
- whether merge or deployment still requires user action.

Do not say “done,” “shipped,” or “complete” when required commits remain only local, CI is still failing, the PR is absent, or a blocking verification result is unresolved.
