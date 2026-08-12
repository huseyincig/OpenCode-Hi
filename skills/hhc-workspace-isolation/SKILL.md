---
name: hhc-workspace-isolation
description: Use when independent work needs an isolated Git worktree/workspace to avoid write conflicts, preserve a dirty user checkout, or safely compare branches.
---

# Workspace Isolation

Use native Git/OpenCode worktree context only when isolation materially reduces conflict or protects user-owned changes.

## Method
1. Confirm isolation is actually needed; do not create worktrees for ordinary single-chain tasks.
2. Preserve the user’s current dirty checkout and never move/revert their changes to create isolation.
3. Choose a bounded branch/worktree path and verify repository/worktree identity before writes.
4. Keep HHC routing/state scoped to the active native worktree.
5. Reconcile/merge only after deterministic verification and current diff ownership checks.
6. Clean up only HHC-owned isolation artifacts when safe; never delete an unknown/user-owned worktree.

Workspace isolation is an execution environment technique, not a replacement for HHC scheduler or Team Mode.
