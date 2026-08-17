# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — ROADMAP MILESTONE 3
**Updated:** 2026-08-17
**Global authority:** `/workspace/PROTOCOL.md`
**Legacy project-policy layer:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`

## Active Task

### Milestone 3 — Incremental TaskRuntime Cutover

Make the WorkGraph/scheduler lifecycle the authoritative source for TaskRuntime dispatch decisions without moving host/session side effects into the pure scheduler and without deleting proven behavior prematurely.

## Verified Baseline

Milestone 2 is complete; see `agent-archive/2026-08-17-deterministic-scheduler-state-owner.md`. Canonical Mission state now carries optional durable scheduler reservations with exact attempt and host-execution fences, restart quarantine, deterministic admission/fairness and resource/conflict/dependency semantics.

## Scope

1. Build the smallest Mission/Task/Worker -> `SchedulingSnapshot` adapter used by TaskRuntime.
2. Replace duplicated `depsReady` / failed-dependency / topology / resource admission checks with scheduler-owned decisions.
3. Reserve the exact next attempt before host child/session creation.
4. Bind the reservation to the actual host execution after child creation; settle/release it on result, failure, cancellation and recovery boundaries.
5. Preserve existing queue mutation, registry, workspace, model routing, child session execution, evidence, authority and recovery side effects.
6. Prevent legacy and scheduler paths from both dispatching one worker.
7. Keep broad TaskRuntime restructuring out of scope until parity tests prove the cutover seam.

## Acceptance Criteria

- TaskRuntime dispatch readiness is mechanically sourced from the scheduler owner;
- dependency-blocked queued work still transitions exactly once and leaves the queue;
- no worker can be host-spawned without an exact scheduler reservation;
- host/session binding updates the same reservation and stale callbacks cannot settle a newer attempt;
- topology/global/provider/model/write-conflict behavior is parity-equivalent or stricter;
- same-model parallel workers remain supported below ceilings;
- cancellation, runtime failure/fallback, result settlement and restart paths do not leak reservations;
- no duplicate scheduling owner remains in the covered TaskRuntime paths;
- focused integration/parity tests, build and architecture lint pass.

## Constraints

- Preserve unrelated user-owned dirty files exactly.
- Do not reset/clean the working tree.
- Do not touch release/publication validation artifacts.
- No push/tag/release/npm publication.
- `planScheduling()` and lifecycle reducer remain host-neutral/pure; side effects stay in runtime adapters.
- Do not redesign model routing, evidence, authority, skills, team runtime or recovery beyond the minimum scheduler integration seam.

## Required Verification

- new TaskRuntime scheduler-adapter/integration parity tests;
- queue/dependency/failure/cancel tests;
- provider fallback/recovery tests if reservation lifecycle is touched there;
- scheduler lifecycle/planner tests;
- TypeScript build;
- architecture lint;
- scoped diff inspection.

## Exact Next Action

Inspect current `TaskRuntime.canRun`, `queueTask`, `drainQueue`, initial `run()` dispatch, `TaskResultReconciler`, `TaskRecoveryCoordinator` and cancellation paths. Define a narrow runtime scheduler adapter that projects Mission state plus current resource bindings into `SchedulingSnapshot`, computes the exact next attempt identity, and performs reservation/host-binding/release transitions. Add integration tests before replacing legacy readiness checks.
