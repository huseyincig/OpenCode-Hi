# Milestone 3 — Incremental TaskRuntime Cutover

**Completed:** 2026-08-17
**Project:** `/workspace/OpenCode-Hi`

## Result

TaskRuntime dispatch control is now sourced from the host-neutral WorkGraph/scheduler lifecycle while proven host/session, registry, model routing, evidence, authority and recovery side effects remain in their existing runtime collaborators.

Key mechanics:
- Mission/Task/Worker -> `SchedulingSnapshot` compatibility adapter;
- dependency/topology/resource/write-conflict admission through scheduler policy rather than duplicated TaskRuntime checks;
- exact next-attempt reservation before host spawn;
- host session binding to the same reservation before attempt execution;
- stale attempt/session fencing before result/failure settlement;
- reservation lifecycle integrated across result, cancel, semantic pause/resume, corrective resume, constraint rebase, write-conflict resume, stagnation recovery and provider fallback;
- legacy `ConcurrencyScheduler` retained only as a resource-allocation backstop, not the dispatch decision owner;
- restart restore quarantines durable reservations; explicit restart resume verifies host abort/quiescence, reconciles the old reservation, then reserves the next attempt;
- pre-host crash reservations reconcile as `NOT_STARTED` and do not leak capacity;
- compatibility projection normalizes legacy in-memory Task/Worker fixtures without weakening canonical persistence validators.

## Verification

- focused restart/scheduler/core regression: 33/33 PASS;
- focused cutover/recovery regression after fixes: 35/35 PASS;
- full plugin suite: 889/889 PASS;
- `npm --prefix plugin run architecture:lint`: PASS, 22 rules;
- scoped `git diff --check`: PASS;
- task execution modules contain no direct `ConcurrencyScheduler.canStart()` dispatch decision path.

## Important decisions

A restart quarantine is not equivalent to a free slot. A durable `RECONCILING` reservation remains authoritative until the prior host run is mechanically quiesced/reconciled. Likewise, a pre-spawn reservation with no host binding is explicitly reconciled as `NOT_STARTED` rather than silently discarded.

## Next

Milestone 4 introduces claim/obligation/scope/attempt-linked evidence and fail-closed completion adjudication.
