# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE
**Updated:** 2026-08-17
**Authority:** `/workspace/OpenCode-Hi/PROTOCOL.md`

## Active Task

### Scheduler Runtime Integration — Parity-Safe Adapter

Connect the verified host-neutral deterministic scheduler planner to the current Mission/Task/Worker runtime through a narrow adapter, without moving execution side effects into the planner and without broad TaskRuntime rewrite.

## Current Objective

Make `TaskRuntime` consume one authoritative scheduler decision path for dependency readiness, topology capacity and resolved resource capacity, while preserving existing queue mutation, session execution, resource acquisition/release, workspace cleanup and failure side effects.

Target flow:

```text
MissionState + current runtime allocations
  -> WorkGraph projection
  -> runtime SchedulingSnapshot adapter
  -> pure planScheduling(...)
  -> one unit decision
  -> TaskRuntime performs existing side effects
```

## Architecture Invariants

- `planScheduling` remains deterministic and side-effect-free.
- Runtime snapshot construction may translate current worker IDs/roles/resource allocations into host-neutral ExecutionUnit semantics, but host-specific client/session objects must not enter core contracts.
- TaskRuntime remains execution owner in this phase.
- Dependency-blocked transitions, queue removal, resource acquire/release, registry changes, session create/abort and workspace cleanup remain runtime side effects.
- Do not silently weaken existing `parallelSafety`, dependency or capacity behavior.
- Remove duplicated legacy readiness helpers only after parity tests prove the planner-backed path is equivalent or stricter.
- Provider/model capacity is a resolved-resource constraint, not work-graph topology.
- Same provider/model must remain usable by multiple independent units when ceilings permit.
- Existing unrelated release/validation dirty-tree work must remain untouched.

## Known Baseline

Verified milestones:

- `agent-archive/2026-08-17-orchestration-core-contract-extraction.md`
- `agent-archive/2026-08-17-deterministic-scheduler-core.md`

Current scheduler core provides:

- `SchedulingSnapshot`
- `SchedulingDecision`
- explicit per-unit disposition/reason codes
- pure `planScheduling(...)`
- dependency/conflict/topology/global/provider/model capacity semantics

## Acceptance Criteria

This phase is complete only when:

1. A narrow runtime adapter builds a valid `SchedulingSnapshot` from current Mission/Task/Worker state plus current resolved/running resource allocations.
2. TaskRuntime readiness/queue-drain decisions consume planner output for the covered semantics instead of independently reimplementing dependency/topology/capacity rules.
3. Runtime side effects remain outside the pure planner.
4. Failed/cancelled dependencies still transition queued dependents to blocked/failed exactly once and do not remain queued.
5. Unknown dependencies remain fail-closed at task preflight/contract boundaries.
6. Unsafe mutable-surface parallel dispatch remains rejected/deferred with no write-conflict widening.
7. Global/provider/model and topology ceilings preserve current behavior, including fallback/rebind safety.
8. Existing scheduler/task tests pass and new integration parity tests demonstrate planner-backed decisions at real TaskRuntime boundaries.
9. No broad team/model/skill/recovery redesign occurs.
10. TypeScript build, architecture lint, targeted tests and scoped diff checks pass.
11. Unrelated dirty-tree release/validation files remain untouched.

## Required Verification

```text
- new scheduler runtime-adapter/integration tests
- scheduler-planner tests
- scheduler-hardening tests
- relevant TaskRuntime dependency/queue tests
- provider fallback/rebind tests if touched
- TypeScript build
- architecture lint
- scoped git diff inspection
```

Known host caveat remains: Node may abort with libuv `EEXIST` after a terminal zero-failure test summary. Distinguish that host teardown mechanically from product failure.

## Current Repository State Warning

The repository contains unrelated user-owned release/documentation-validation evidence changes. Do not reset, clean, overwrite, stage or include them in architecture-reset work.

## Exact Next Action

Inspect `TaskRuntime.canRun`, `drainQueue`, start-time `parallelSafety`, worker/model allocation state and the new `planScheduling` contract. Design the smallest runtime snapshot adapter that maps current state to SchedulingSnapshot, then replace only the duplicated readiness checks with planner-backed decisions under integration tests. Do not migrate execution side effects or redesign unrelated subsystems.
