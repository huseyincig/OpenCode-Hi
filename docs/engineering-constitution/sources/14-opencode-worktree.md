# opencode-worktree

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `kdcokenny/opencode-worktree`
- Reference action: ADAPT

## Source surfaces inspected

- `src/plugin/worktree.ts`
- supporting state/launch-context/terminal imports visible from source.

## Verified source facts

- Worktree execution has explicit branch-name validation, path/error types, config schema, persistent state, launch context and terminal integration.
- It validates that the launch binary/profile required to enter an isolated workspace still exists before claiming launchability.
- Missing resources and permission errors are distinguished; failures are surfaced rather than silently treated as absence.

## Useful engineering patterns

- Workspace isolation is not merely `git worktree add`; it includes identity, state, launch binding and cleanup.
- Host/workspace launch capability must be proven before claiming subsequent execution is isolated.
- Security/path validation belongs at the execution boundary.

## Foreign / accidental semantics to reject

- Hi must not claim workspace isolation merely because it can create a worktree directory.
- OCX-specific launch/profile machinery is host/tool-specific.

## Hi mapping

- Confirms the prior removal of fake `WorktreeRuntime` from operational claims.
- Supports restoring `hi-workspace-isolation` as HOW methodology only when HostCapabilityContract proves a real execution binding primitive/fallback.
