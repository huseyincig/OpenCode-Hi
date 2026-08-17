# Milestone 1 — Exact Execution Identity + Graph Invariants

Completed: 2026-08-17

## Changes

- Added host-neutral `ExecutionAttemptIdentity` with deterministic `attemptId` and `runId` derived from existing durable Worker fields.
- Added `sameExecutionAttempt(...)` fencing comparison.
- Added narrow `ExecutionTransitionReceipt` contract and deterministic receipt identity for `DISPATCH`, `SETTLEMENT`, and `EVIDENCE_COMMIT` transitions.
- Added structured optional `ProgressDelta` vocabulary without fabricating deltas from legacy state.
- Added multi-node dependency-cycle detection to `validateWorkGraph()`.
- WorkGraph validation now recomputes attempt identity and fails closed on ordinal/generation/identity drift.
- Legacy Mission/Task/Worker persistence schema was not changed; the projection remains the compatibility owner.
- TaskRuntime dispatch semantics were intentionally not migrated in this milestone.

## Verification

- `npm --prefix plugin run build` — rc 0.
- focused core + scheduler + Task/Worker/persistence tests — 28 pass, 0 fail; host process then hit the separately known libuv teardown assertion and returned rc134 after the complete passing summary.
- `npm --prefix plugin run architecture:lint` — PASS, 22 rules, 0 deferred.
- scoped `git diff --check` — rc 0.

## Environment repair

The first build exposed `plugin/node_modules/typescript/bin/tsc` without its executable bit (`664`). The project-local dependency file was corrected to user-executable; no system/Sentinel transport configuration was changed.
