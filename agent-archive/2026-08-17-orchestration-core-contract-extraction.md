# Orchestration Core Contract Extraction

**Date:** 2026-08-17
**Status:** VERIFIED COMPLETE
**Baseline HEAD:** `e8c1a7d77f3546bb2f940f4e7b439ed06a273e83`

## Completed scope

- Added host-neutral orchestration contracts: `WorkGraph`, `WorkNode`, `DependencyEdge`, `ExecutionUnit`, `ExecutionAttempt`, `ProgressObservation`, `CapabilityPort`, capability resolution semantics.
- Added mechanical `WorkGraph` invariant validation and fail-closed capability-resolution validation.
- Added side-effect-free projection from current durable `MissionState` / Task / Worker state into the new core graph.
- Preserved task DAG, role/category, same-model multi-unit allocation, model identity/fallback data, authority state, evidence/freshness, continuation/progress state, write-set, recovery attempt and task result projection.
- No existing runtime execution path was replaced.

## Files

- `plugin/src/contracts/orchestration-core.ts`
- `plugin/src/runtime/execution/work-graph-projection.ts`
- `plugin/test/orchestration-core-projection.test.mjs`
- canonical generated runtime outputs under `plugin/dist/` for the two new source modules

## Verification

- `npm --prefix plugin run build` -> exit 0.
- Targeted Node tests covering new projection plus existing task/worker, scheduler and evidence contracts -> 25 tests, 25 pass, 0 fail, 0 cancelled. Host emitted the known post-summary libuv `EEXIST` teardown assertion; wrapper accepted it only after the terminal zero-failure summary.
- `npm run architecture:lint` -> `ARCHITECTURE LINT PASS`, 22 rules.
- Core contract imports no OpenCode client/session/host API types.

## Important decision

The new core is an additive compatibility projection, not a replacement runtime. Migration must proceed only after deterministic parity is demonstrated for each next control-plane layer.
