# Milestone 4 — Claim-Linked Evidence + Completion

**Completed:** 2026-08-17
**Checkpoint:** commit containing this record (`architecture: add claim-linked evidence adjudication`)

## Result

- Evidence applicability is claim/obligation/task/scope aware rather than mission-global.
- Worker evidence is bound to the exact host-neutral execution attempt (`worker`, execution unit, attempt/run id, ordinal, generation) plus native session/state provenance when available.
- Wrong-task, wrong-obligation, wrong-attempt and unfenced worker proof cannot satisfy verification claims.
- Known-surface mutation invalidates only overlapping proof; unknown mutation surface remains fail-closed and invalidates all live proof.
- Verification and independent-review claims are re-adjudicated even after their obligation was previously closed, so relevant later mutation reopens completion mechanically.
- Independent review requires exact reviewer-worker provenance when policy requires independent review; parent-authored review proof cannot impersonate it.
- Completion remains blocked by active workers/processes, authority/gates, unresolved results, blockers and unsatisfied claim-linked verification/review evidence.
- Existing evidence producers (worker result, LSP diagnostics, process output, parent verifier) were linked to the strongest available task/obligation/attempt provenance without redesigning host APIs.

## Settlement boundary decision

No separate durable evidence WAL/transaction receipt was added in this milestone. Worker-result evidence ingestion, task/worker result application, obligation reconciliation and scheduler settlement mutate one canonical Mission state during a single runtime event. Persistence occurs only after that event completes, using a temporary file followed by atomic rename. Stale/duplicate callbacks are rejected by the scheduler settlement fence before evidence mutation. Adding another durable receipt owner here would duplicate canonical state without closing an observed partial-commit gap. The existing `ExecutionTransitionReceipt` contract remains available if a future adapter introduces a multi-owner or externally committed settlement boundary.

## Verification

- targeted claim/evidence/completion regression: 35/35 PASS after final compatibility fixes;
- full plugin suite: **895/895 PASS**, 0 fail, 0 cancelled;
- TypeScript build: PASS (included in plugin test prebuild/build path and targeted builds);
- architecture lint: **22/22 PASS**;
- scoped `git diff --check`: PASS.

## Important compatibility decisions

- No verification obligation means there is no verification claim to adjudicate; global policy alone does not invent an orphan claim.
- Legacy source/session/hash-only worker proof is intentionally insufficient after this milestone; exact attempt producer identity is required for worker proof used as claim evidence.
- Mission-global `evidence.fresh` remains as a compatibility projection/status signal, not the completion authority.
