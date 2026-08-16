# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE
**Updated:** 2026-08-17
**Authority:** `/workspace/OpenCode-Hi/PROTOCOL.md`

## Active Task

### Scheduler Core — Deterministic Scheduling Decisions

Evolve the architecture reset from passive WorkGraph projection into a host-neutral, deterministic scheduling-decision layer without replacing the current TaskRuntime execution path yet.

## Current Objective

Define the minimum scheduler semantics needed to decide **which ExecutionUnits are runnable now, which are blocked, and why**, while preserving the current dependency, bounded-concurrency and write-surface safety behavior.

The scheduler decision must remain separate from provider/model/session execution.

Target flow for this phase:

```text
MissionState
  -> WorkGraph projection
  -> SchedulingSnapshot
  -> deterministic scheduling decision
       |- runnable
       |- waiting-dependency
       |- blocked-dependency
       |- deferred-conflict
       `- deferred-capacity
  -> current TaskRuntime remains execution owner
```

## Architecture Invariants

- Hi owns scheduler semantics; host adapters only execute selected work.
- Scheduling is based on work/dependency state before provider/model allocation.
- One provider/model may serve multiple ExecutionUnits.
- Dependency failure must not leave work queued forever.
- Parallel execution must not permit unsafe overlapping mutable surfaces.
- Read-only work may coexist when safe; do not encode this as transient OpenCode API behavior.
- Capacity/backpressure decisions must be explicit and explainable.
- The scheduling planner must be deterministic and side-effect-free; acquiring/releasing runtime resources remains a separate action.
- Existing `ConcurrencyScheduler`, `parallelSafety`, TaskRuntime queue behavior and dirty-tree user work must be preserved until parity is demonstrated.
- Do not introduce model routing, skill routing, semantic progress governor, or broad TaskRuntime migration into this phase unless strictly required by the scheduler contract.

## Known Baseline

The previous verified milestone added:

- `plugin/src/contracts/orchestration-core.ts`
- `plugin/src/runtime/execution/work-graph-projection.ts`
- `plugin/test/orchestration-core-projection.test.mjs`

with host-neutral WorkGraph/ExecutionUnit/CapabilityPort contracts and lossless projection coverage. See:

`agent-archive/2026-08-17-orchestration-core-contract-extraction.md`

## Acceptance Criteria

This phase is complete only when:

1. A host-neutral scheduling contract exists for scheduling input/snapshot, per-unit disposition, reason codes and bounded capacity state.
2. A pure deterministic planner can classify each non-terminal ExecutionUnit as runnable/waiting/blocked/deferred with explicit reasons.
3. Unknown or failed dependencies fail closed rather than queue indefinitely.
4. Mutable-surface conflict semantics preserve or strengthen current `parallelSafety` behavior.
5. Capacity semantics preserve current global/provider/model ceilings without coupling graph topology to a specific model/provider. Model/provider capacity may be applied only after those resources are resolved.
6. The same provider/model can still back multiple independent units when capacity permits.
7. Current TaskRuntime execution remains unchanged or uses only a narrow parity-safe adapter; no broad runtime rewrite.
8. Targeted tests compare new planner decisions with current scheduler/parallel-safety behavior on representative cases.
9. TypeScript build and architecture lint pass with real exit status / recognized host teardown handling.
10. Existing unrelated release/validation dirty-tree changes remain untouched.

## Required Verification

```text
- new scheduler contract/planner tests
- existing scheduler-hardening tests
- relevant task dependency/queue tests
- TypeScript build
- architecture lint
- scoped git diff inspection
```

## Current Repository State Warning

The repository still contains unrelated user-owned uncommitted release/documentation-validation evidence changes. Do not reset, clean, overwrite, stage, or include them in architecture-reset work.

## Exact Next Action

Inspect `plugin/src/runtime/scheduler/concurrency.ts`, `plugin/src/runtime/scheduler/parallel-safety.ts`, TaskRuntime queue/readiness logic and the new WorkGraph/ExecutionUnit projection. Then define a host-neutral `SchedulingSnapshot` / `SchedulingDecision` contract and implement a side-effect-free planner that reproduces current dependency, conflict and capacity decisions before any TaskRuntime migration.

Do **not** replace TaskRuntime dispatch, add semantic-progress logic, redesign model routing, remove team/skill systems, or enter release/npm/publication work in this phase.
