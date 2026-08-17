# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — ROADMAP MILESTONE 5
**Updated:** 2026-08-17
**Global authority:** `/workspace/PROTOCOL.md`
**Legacy project-policy layer:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`

## Active Task

### Milestone 5 — Semantic Progress, Recovery + Economics

Minimize unproductive probabilistic execution by making progress, recovery and resource decisions depend on structured state/evidence gain rather than raw activity or blind retries.

## Verified Baseline

Milestone 4 is complete; see `agent-archive/2026-08-17-claim-linked-evidence-completion.md`. Evidence is claim/obligation/task/scope/attempt-linked, relevant mutation selectively invalidates proof, wrong-attempt proof cannot satisfy claims, and completion re-adjudicates verification/review claims fail-closed. Full plugin suite passed 895/895 with architecture lint 22/22.

## Scope

1. Define a structured semantic progress delta from evidence gain/invalidation, dependency resolution, meaningful task/worker/result state, diff/state identity, failure signature and validated investigation steps.
2. Detect repeated tool/model/failure activity with no material state or evidence gain.
3. Replace blind retry semantics with cause-aware recovery: retry, change context, change role/model, replan, ask, or stop.
4. Require material strategy/state/evidence delta before repeating a failed recovery strategy.
5. Enforce bounded per-mission/per-unit budgets for turns, retries, wall time, workers, context and cost where exact data exists.
6. Separate exact host/provider usage telemetry from heuristic/estimated economics; never present estimates as exact cost.
7. Strengthen model-feedback attribution, confidence and decay only where supported by observed mission data.

## Acceptance Criteria

- repeated identical failure/tool loops terminate, change strategy or replan within deterministic bounds;
- wait/block/permission/provider states are not misclassified as reasoning stagnation;
- recovery never blindly replays ambiguous consequential effects;
- repeated retry requires new information, changed strategy, or a justified bounded exception;
- exact usage telemetry and estimated economics are mechanically distinguishable;
- existing supported recovery flows remain compatible or intentionally stricter with explicit tests;
- an ablation/regression proof demonstrates reduced redundant recovery/work without lowering covered-task correctness.

## Constraints

- Preserve unrelated user-owned dirty files exactly.
- Do not reset/clean the working tree.
- Do not touch release/publication validation artifacts.
- No push/tag/release/npm publication.
- Do not redesign scheduler topology, evidence ownership, skill system, team runtime or host composition in this milestone.
- Progress/recovery/economics decisions remain runtime-owned and host-neutral; model prose is observation, not control authority.
- Do not fabricate token/cost telemetry when the host/provider did not supply exact usage.

## Required Verification

- semantic progress/no-progress invariant tests;
- repeated-strategy/failure-loop adversarial tests;
- wait/provider/permission separation regressions;
- recovery strategy transition tests;
- exact-vs-estimated economics/usage contract tests;
- relevant persistence/contract tests if new durable fields are introduced;
- full plugin test suite when the cutover seam is complete;
- TypeScript build and architecture lint;
- scoped diff inspection.

## Exact Next Action

Inspect existing `ProgressObservation`/Mission continuation state, progress signatures, stagnation accounting, `recoveryPlan`, `TaskRecoveryCoordinator`, model feedback and any usage/cost fields. Build a narrow inventory showing which current signals are true semantic state/evidence deltas versus activity counters or heuristics. Introduce the smallest host-neutral semantic progress observation/reducer with adversarial tests before changing recovery decisions.
