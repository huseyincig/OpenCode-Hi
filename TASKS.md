# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — ROADMAP MILESTONE 4
**Updated:** 2026-08-17
**Global authority:** `/workspace/PROTOCOL.md`
**Legacy project-policy layer:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`

## Active Task

### Milestone 4 — Claim-Linked Evidence + Completion

Make mission completion fail-closed over claim/obligation/scope/attempt-linked evidence so stale or misattributed proof cannot satisfy work.

## Verified Baseline

Milestone 3 is complete; see `agent-archive/2026-08-17-incremental-taskruntime-cutover.md`. TaskRuntime dispatch is scheduler-owned, attempts are reserved/bound/fenced across normal, recovery and restart paths, and the full plugin suite passed 889/889 with architecture lint 22/22.

## Scope

1. Replace mission-global evidence freshness decisions with claim/obligation/scope/dependency-linked applicability.
2. Bind evidence to the exact producing `ExecutionAttempt` and relevant source/diff identity where available.
3. Invalidate only evidence affected by a relevant mutation; unrelated proof remains usable.
4. Add a narrow transaction/settlement receipt only where evidence settlement crosses another correctness-critical transition.
5. Refactor completion evaluation into a fail-closed adjudicator over claims, evidence, active execution, authority and gates.
6. Preserve existing evidence capture sources and worker/result compatibility until parity tests prove safe migration.

## Acceptance Criteria

- mutation invalidates only affected evidence;
- stale, wrong-task or wrong-attempt evidence cannot satisfy a claim;
- malformed/inconclusive reviewer output cannot PASS;
- worker `DONE` cannot bypass required evidence;
- active process/worker/authority/gate obligations block completion;
- existing supported verification flows remain compatible or become intentionally stricter with explicit tests.

## Constraints

- Preserve unrelated user-owned dirty files exactly.
- Do not reset/clean the working tree.
- Do not touch release/publication validation artifacts.
- No push/tag/release/npm publication.
- Do not redesign model routing, scheduler topology, skills or team runtime in this milestone.
- Evidence producer identity and completion decisions remain host-neutral core semantics.

## Required Verification

- evidence freshness/invalidation ordering tests;
- wrong-task/wrong-attempt/claim-linkage adversarial tests;
- completion/evidence bypass and reviewer-output tests;
- relevant persistence/contract tests;
- full plugin test suite when the cutover seam is complete;
- TypeScript build and architecture lint;
- scoped diff inspection.

## Exact Next Action

Inspect current evidence contract/runtime, `verificationSatisfied`, `VerificationEnvelope`, worker-result evidence ingestion and `completion/evaluator.ts`. Map existing evidence fields to claim/obligation/scope/producer identity, identify where mission-global freshness is currently over-broad, then introduce the smallest host-neutral claim-linked evidence applicability layer with tests before changing completion behavior.
