# Milestone 2 — Deterministic Scheduler State Owner

**Completed:** 2026-08-17
**Project:** `/workspace/OpenCode-Hi`

## Result

Introduced one host-neutral scheduler lifecycle layered on the canonical Mission state without creating a second Task/Worker database. `planScheduling()` remains pure admission policy.

Key mechanics:
- deterministic pre-dispatch attempt/run identity; host execution identity is a separate fence;
- `RESERVED -> RUNNING -> SETTLING` with `RECONCILING` restart quarantine;
- idempotent replay of the same reservation and rejection of competing/newer attempts;
- exact host-execution fencing for settlement/release;
- fairness-ordered admission with topology/global/provider/model capacity simulation;
- deterministic dependency/fan-in/failure/cancel behavior through WorkGraph policy;
- mutable-surface conflict serialization;
- durable optional scheduler state inside Mission execution state; old schema-10 missions without this field remain readable;
- restart quarantines durable reservations instead of redispatching blindly;
- persisted scheduler validator rejects identity drift, ticket rewind, impossible phases and missing host bindings.

## Verification

- `npm --prefix plugin run build` -> exit 0
- focused scheduler/core/persistence tests -> 38 pass, 0 fail
- `npm --prefix plugin run architecture:lint` -> PASS, 22 rules
- scoped `git diff --check` -> exit 0

## Important design correction

Attempt/run identity must exist before host session creation. Therefore `runId` is bound to execution-unit/worker/generation/ordinal, while host session/execution identity is a separate fence. This permits reservation before spawn and prevents double dispatch without coupling core identity to OpenCode Session APIs.

## Next

Milestone 3 incrementally cuts TaskRuntime dispatch decisions over to this scheduler owner while preserving existing execution side effects and parity-testing cancellation/restart/failure behavior.
