---
name: hi-workspace-isolation
description: Apply workspace isolation safely when risk justifies it.
---

# Workspace Isolation

## Contract

- **Trigger:** Task risk/concurrency/untrusted execution makes separate workspace materially safer.
- **Do not trigger:** Low-risk local task is safe in current workspace.
- **Exit condition:** Isolation is created only when needed, user changes remain safe, and cleanup/handoff is correct.
- **Role affinity:** working-manager
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Assess whether current-workspace execution is sufficient.
2. Use worktree/stronger isolation only when concurrency, blast radius, or untrusted execution justifies it.
3. Preserve pre-existing user changes.
4. Reconcile cleanup/handoff with mission completion.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
