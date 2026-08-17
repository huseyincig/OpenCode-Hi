# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — ROADMAP MILESTONE 2
**Updated:** 2026-08-17
**Global authority:** `/workspace/PROTOCOL.md`
**Legacy project-policy layer:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`

## Active Task

### Milestone 2 — Deterministic Scheduler State Owner

Evolve the current pure `planScheduling()` admission policy into one canonical scheduler lifecycle without creating a second Task/Worker state machine.

## Verified Baseline

Milestone 1 is complete; see `agent-archive/2026-08-17-exact-execution-identity-graph-invariants.md`. Core now provides exact attempt/run identity, attempt fencing comparison, dependency-cycle validation, narrow transition-receipt identity and structured progress-delta vocabulary.

## Scope

1. Keep `planScheduling()` pure and side-effect-free.
2. Define the smallest canonical scheduler state for ready/admitted/running/settling execution units.
3. Add exact dispatch claim/reservation ownership bound to `ExecutionAttemptIdentity`.
4. Prevent double dispatch and stale settlement using attempt generation/run fencing.
5. Model dependency readiness/failure propagation and fan-in without duplicating TaskRuntime task state.
6. Integrate resource/write-set admission, topology/global/provider/model capacity and cancellation/backpressure inputs.
7. Define deterministic fairness/starvation behavior; priority/critical-path inputs only if they materially improve policy.
8. Keep recovery as a bounded interface; do not duplicate recovery logic inside scheduler.
9. Provide restart/reconciliation semantics for scheduler-owned reservations before broad TaskRuntime cutover.

## Acceptance Criteria

- no double dispatch under concurrent/replayed admission;
- cyclic/invalid graph cannot enter scheduler lifecycle;
- stale attempt/run cannot settle a newer reservation;
- dependency failure/cancel propagation is deterministic;
- independent same-model units can run concurrently below ceilings;
- conflicting mutable work cannot be admitted concurrently;
- fairness prevents an older runnable unit from being permanently starved by later equivalent work;
- scheduler state remains host-neutral and does not own OpenCode Session/Task transport;
- TaskRuntime is not broadly cut over until scheduler state-machine tests pass.

## Constraints

- Preserve all unrelated user-owned dirty files exactly.
- Do not reset/clean the working tree.
- Do not touch release/publication validation artifacts.
- No push/tag/release/npm publication.
- Do not create a second canonical task/worker database or broad WAL.
- Use narrow transition receipts only around real dispatch/settlement ambiguity.

## Required Verification

- scheduler state-machine unit tests;
- duplicate/replayed admission adversarial tests;
- stale settlement/fencing tests;
- dependency/fan-in/failure propagation tests;
- fairness/backpressure/resource conflict tests;
- build + architecture lint + scoped diff inspection.

## Exact Next Action

Inspect `TaskRuntime` queue/drain/start/result paths, `ConcurrencyScheduler`, `parallelSafety`, `BackgroundRegistry`, task result reconciliation, and restart handling. Identify the minimum state transitions currently distributed across those modules, then define a host-neutral scheduler lifecycle/claim contract and pure transition reducer before wiring any side effects.
