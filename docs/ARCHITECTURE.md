# OpenCode-Hi Architecture

OpenCode-Hi is a thin execution-control plane over OpenCode native runtime primitives. It preserves the proven mission/evidence/authority/completion semantics of the v58 baseline while adding adaptive execution, bounded context intelligence, privacy, process/isolation policy, human decision routing, and a host semantic boundary.

## Ownership

Hi owns mission interpretation, obligations, task/worker state, execution path, role/skill/topology/model/tool policy, context and isolation policy, evidence requirements/freshness, bounded retry/recovery, continuation, human-decision routing, completion adjudication, and STOP.

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
- Process Governor and Isolation Policy
- Artifact model and optional Memory boundary
- Execution telemetry
- Host capability contract and OpenCode adapter

These are separate responsibilities; no mega orchestrator or mega context manager owns all of them.

## Completion

STOP is allowed only when requested outcome and obligations are satisfied, required evidence is fresh, no blocking evidence or authority decision remains, no required task/worker/child/process/rollback remains pending, and CompletionAdjudicator approves. Agent idle and model “done” messages are not completion evidence.
