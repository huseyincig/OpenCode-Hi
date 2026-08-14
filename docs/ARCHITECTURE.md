# OpenCode-Hi Architecture

OpenCode-Hi is a thin execution-control plane over OpenCode native runtime primitives. It preserves mission/evidence/authority/completion semantics while adding adaptive execution, bounded context intelligence, privacy, structured human-decision semantics, shell safety, and a host semantic boundary.

## Ownership

Hi owns mission interpretation, obligations, task/worker state, execution path, role/methodology/topology/model/tool policy, context policy, evidence requirements/freshness, bounded retry/recovery, continuation, structured human-decision state, completion adjudication, and STOP. Unsupported host process-control or workspace-isolation capabilities are reported rather than faked.

OpenCode owns native sessions, child sessions, agent/model/provider execution, permissions/approvals, tools, filesystem and shell primitives, events, diffs, and compaction primitives. Skills own methodology only.

**HI decides; OpenCode executes native host primitives.** Hi may restrict host authority and never expands explicit host denial.

## Core responsibility families

- Mission / Obligation / Task / Worker
- Evidence and freshness
- Authority and external-action transaction semantics
- Completion and deterministic STOP
- Autopilot / Continuation
- Adaptive Execution and Topology Policy
- Context Governor, Project Intelligence, Semantic Context, Privacy Boundary
- Human Decision semantics
- Mission Budget and Failure Classification
- Shell safety and host process/isolation capability boundary
- Artifact model and optional Memory boundary
- Execution telemetry
- Host capability contract and OpenCode adapter

These are separate responsibilities; no mega orchestrator or mega context manager owns all of them.

## Completion

STOP is allowed only when requested outcome and obligations are satisfied, required evidence is fresh, no blocking evidence or authority decision remains, no required task/worker/child/process/rollback remains pending, and CompletionAdjudicator approves. Agent idle and model “done” messages are not completion evidence.

## Workspace isolation contract boundary

W1 defines strict Hi `IsolationDecision` and `WorkspaceLease` contracts as durable fields of the existing Mission execution slice. `IsolationDecision` records only required/reason/strategy/scope/requested-by policy output; `WorkspaceLease` binds lease/mission/task identity, repository root, base ref, workspace path, optional host workspace/branch identity, exact source baseline, lifecycle status, and separate cleanup state. W2 adds a single `WorkspaceExecutor` port, `OpenCodeWorkspaceAdapter`, and `WorkspaceRuntime`. Provisioning uses OpenCode’s official workspace API with builtin type `worktree`; the adapter binds an exact creation-time Git object baseline, canonical registered worktree path and Git common-repository identity, while `ChildExecutionCoordinator` remains the sole child-session owner and passes/validates `workspaceID + directory` on every fresh child path including runtime fallback and constraint rebase. Terminal/cancel/STOP cleanup is separate from child abort, and restart reconciliation adopts or quarantines without recreation. W3 proves that complete create/bind/write/verify/cleanup/restart/orphan chain on exact OpenCode 1.18.18, so `workspace-isolation-binding` is promoted only for the Hi-owned isolation surface and remains receipt-bound to the exact tested source/host version.

## Process lifecycle contract boundary

Hi defines a host-independent `ProcessContract` for owned long-running process identity and lifecycle: mission/task/worker ownership, host, SHA-256 command identity, cwd, PID/process-group identity, lifecycle timestamps/status, bounded output artifact references, authority reference, and cleanup state. The contract deliberately contains no raw stdout/stderr buffer.

P2 introduced the host-independent `ProcessExecutor` port; P3 completes the Hi-owned lifecycle through `ProcessRuntime` and `OpenCodePtyAdapter`. Raw PTY output remains outside `ProcessContract`; reads are bounded cursor windows and process observations become hash-bound pending Evidence rather than automatic verification PASS. Ownership binds the OpenCode-observed PID, cwd, and native command identity. WAIT is the native exit promise, STOP terminates and separately cleans all owned processes before worker reconciliation, restart re-adopts only exact owner identity, and mismatches become quarantined `ORPHANED` state without signalling. OpenCode native `ask` is preserved through `ToolContext.ask()` and one-shot exact grants never become persistent allow. Exact OpenCode 1.18.18 T3 acceptance closes `process-lifecycle` as `SUPPORTED` for this Hi-owned surface.
