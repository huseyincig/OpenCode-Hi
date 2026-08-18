# OpenCode-Hi Architecture Roadmap

**Project:** `/workspace/OpenCode-Hi`
**Updated:** 2026-08-17
**Status:** ACTIVE ARCHITECTURE RESET
**Research basis:** `/workspace/Reference/upstream-audit/`

## Product Direction

OpenCode-Hi is an adaptive execution control plane for OpenCode: a deterministic runtime that turns intent into bounded execution and decides when work is safe, productive, sufficiently evidenced, and complete.

The architecture is **native-first, not native-dependent**. OpenCode or composable ecosystem tools own generic execution primitives when semantically sufficient. Hi owns narrower orchestration semantics: work graph, exact execution identity, scheduler policy, mission authority, progress/recovery, evidence and completion.

This roadmap does not claim those concepts are unique. The engineering target is a **smaller, more predictable canonical state model with lower execution waste and better composition** than feature-heavy orchestrators.

## Non-Negotiable Architecture Rules

1. Work graph precedes agent/model topology.
2. Provider/model allocation happens after ExecutionUnit definition.
3. One provider/model may serve many parallel or role-separated units.
4. Runtime owns lifecycle, progress, recovery, budgets, evidence and completion; worker prose does not.
5. Hi Core contracts must not be shaped like transient OpenCode APIs.
6. Generic skill loading, model catalog truth, transcript compaction, generic memory, worktree/process primitives and browser engines are not Hi Core ownership targets.
7. Native execution may be supervised only for an explicit, mechanically testable Hi semantic.
8. Preserve one canonical mission/execution state owner. Add narrow receipts/WAL only for real crash windows; do not create parallel ledgers/state machines.
9. Plugin/config integration must be additive and non-destructive; Hi must not assume ownership of default agents or unrelated host config.
10. No subsystem survives on architectural taste alone; comparative or adversarial verification must prove value.

## Research-Gate Verdicts

- `b034d308051d1405090beb4558dd8aa4b5eff470` — **KEEP + EXTEND**
- `ea1a71d04319ec3b6cec8f4173ea3a8d012f0b27` — **REWORK**; retain `planScheduling()` as a pure admission-policy component, not the complete scheduler owner.

Supporting decisions:
- generic browser automation: native/external backend + Hi supervision;
- generic memory/context compaction: native/external, not Hi Core;
- model facts: OpenCode runtime/Catalog/models.dev; Hi retains empirical behavior only;
- skill discovery/loading: native; Hi may own bounded shortlist/exposure policy;
- bounded mission ledger: observability only, not correctness WAL;
- exact mission authority, evidence freshness and completion remain Hi-owned semantics.

---

# Milestone 1 — Exact Execution Identity + Graph Invariants

**Goal:** make the host-neutral core strong enough to be the single semantic target for scheduler and runtime migration.

### Scope

- Extend `ExecutionAttempt` with exact attempt/run identity and generation/fencing semantics.
- Separate current attempt from attempt history/receipts where needed without duplicating Worker state ownership during migration.
- Add dependency-cycle detection to `validateWorkGraph()`.
- Define narrow transition receipt contracts for host-dispatch/settlement/evidence crash windows; no broad event-sourcing rewrite.
- Extend `ProgressObservation` with structured state/evidence/failure/execution deltas required by later semantic-progress work.
- Keep `projectMissionToWorkGraph()` lossless for current runtime behavior.
- Begin reducing direct core dependence on legacy Task/Worker status/result types only where it can be done without a big-bang migration.

### Acceptance

- malformed cyclic graphs fail closed;
- stale generation/attempt results cannot be represented as current ownership;
- attempt identity survives projection/restart-compatible state representation;
- transition receipts are idempotently attributable to one mission/node/unit/attempt/generation;
- existing projection semantics remain mechanically covered;
- no OpenCode host/client API leaks into core contracts.

### Verification

Focused contract/projection tests, property/invariant tests for DAGs and identity, TypeScript build/typecheck/architecture boundary checks.

---

# Milestone 2 — Deterministic Scheduler State Owner

**Goal:** evolve the current admission classifier into a real scheduler without creating a second competing task system.

### Scope

- Retain `planScheduling()` as pure policy.
- Add canonical ready/admitted/running/settling lifecycle owned by one scheduler service.
- Exact dispatch claim/reservation/lease or equivalent single-owner protocol using Milestone 1 attempt identity.
- Dependency readiness/failure propagation and fan-in.
- Resource/write-set conflict admission.
- topology/global/provider/model ceilings.
- priority/critical-path inputs only where demonstrably useful.
- fairness/starvation prevention.
- backpressure and cancellation.
- stale-attempt detection and crash/restart reconciliation.
- bounded interface to recovery/replan, not recovery logic duplicated inside scheduler.

### Acceptance

- no double-dispatch under concurrent admission;
- no cyclic graph admission;
- no mutual conflict deadlock;
- bounded liveness/fairness scenarios pass;
- stale attempt cannot settle a newer run;
- dependency failure/cancel propagates deterministically;
- same-model parallel workers work below capacity limits.

### Verification

Concurrency/adversarial tests, failure injection, restart/reconcile tests, scheduler invariants and deterministic replay of admission decisions.

---

# Milestone 3 — Incremental TaskRuntime Cutover

**Goal:** make the new WorkGraph/scheduler the execution-control source without deleting proven behavior prematurely.

### Scope

- Adapt existing Mission/Task/Worker runtime into scheduler inputs/outputs.
- Move dependency/capacity/conflict dispatch decisions out of oversized `TaskRuntime` into the scheduler owner.
- Preserve existing worker lifecycle, model resolver, failure classifier, authority and evidence behavior through compatibility adapters.
- Remove old duplicated scheduling decisions only after parity tests pass.

### Acceptance

- existing supported mission flows preserve intended behavior;
- new scheduler owns dispatch decisions mechanically;
- old and new paths cannot both dispatch the same work;
- cancellation/restart/failure behavior is parity-tested or intentionally changed with explicit tests.

---

# Milestone 4 — Claim-Linked Evidence + Completion

**Goal:** make mission completion exact enough that stale or misattributed proof cannot complete work.

### Scope

- Replace mission-global freshness with claim/obligation/scope/dependency-linked evidence.
- Bind evidence to exact ExecutionAttempt producer and relevant state/diff identity.
- Precise invalidation after relevant mutation rather than invalidating unrelated proof globally.
- Narrow transaction receipt where evidence settlement crosses another correctness-critical state transition.
- Refactor completion evaluator into a fail-closed adjudicator over claims, evidence, active execution, authority and gates.

### Acceptance

- mutation invalidates only affected evidence;
- stale/wrong-task/wrong-attempt evidence cannot satisfy a claim;
- malformed/inconclusive reviewer output cannot PASS;
- worker `DONE` cannot bypass required evidence;
- active process/worker/authority/gate obligations block completion.

---

# Milestone 5 — Semantic Progress, Recovery + Economics

**Goal:** minimize unproductive probabilistic execution while preserving productive recovery.

### Scope

- Structured progress delta from evidence, failure signatures, meaningful state/diff, dependency resolution and validated investigation steps.
- Detect repeated tool/model activity with no state/evidence gain.
- Cause-aware recovery policy: retry, change context, change role/model, replan, ask, stop.
- Require material strategy/state/evidence delta before repeated retry.
- Enforce per-mission/per-unit budgets for turns, retries, wall time, workers, context and cost when exact data exists.
- Replace arbitrary execution-cost heuristics with exact host/provider usage plus clearly separated estimates.
- Strengthen model-feedback attribution/confidence/decay.

### Acceptance

- repeated identical failure/tool loops terminate or replan within bounds;
- wait/block states are not misclassified as reasoning stagnation;
- recovery never replays ambiguous consequential effects;
- exact usage is never mixed with heuristic cost as factual telemetry;
- ablation shows the governor reduces waste without lowering covered-task correctness.

---

# Milestone 6 — Host/Plugin Composition Hardening

**Goal:** make Hi coexist rather than own the OpenCode environment.

### Scope

- Rework `open-code-hooks.ts` away from broad shared-config mutation.
- Remove unconditional `default_agent`, canonical global agent-name and unrelated config ownership where not required.
- Stable 1.18.18 + dev/V2 capability probes and adapter guarantees.
- Prefer V2 transform/registration boundaries when available.
- Preserve unknown-but-host-valid provider/MCP/plugin fields.
- Preserve native permission inheritance and user/plugin ordering.
- Collision diagnostics for mutually exclusive context/transform ownership.

### Acceptance

Coexistence tests cover representative external-agent/plugin/config shapes and prove no unrelated config deletion, permission widening or namespace takeover.

---

# Milestone 7 — Primitive Scope-Down

**Goal:** delete or thin machinery that duplicates stronger native/ecosystem capabilities.

### Scope

- Skill filesystem discovery/loading → native inventory/loading; retain only measured shortlist/index value.
- Generic context governor/compaction → remove or reduce to ExecutionUnit context-selection policy.
- Broad project-intelligence memory → scope to orchestration-specific empirical/procedure learning or external memory port.
- Browser runtime → backend-neutral capability port; use Playwright/native/external execution.
- TeamRuntime → absorb useful topology/role semantics into WorkGraph/scheduler; remove separate state owner if no measured value.
- Model quirks/duplicate catalog config → remove factual folklore where runtime/catalog metadata exists.

### Acceptance

- simpler code/state surface;
- no regression in covered behavior;
- each retained layer has a named semantic and benchmark/verification justification.

---

# Milestone 8 — Comparative Product Benchmark + Final Cutovers

**Status:** COMPLETE — 2026-08-18

**Goal:** decide which reset architecture components are actually better.

Use `/workspace/Reference/upstream-audit/benchmark-plan.md`.

### First-wave baselines

- vanilla OpenCode;
- reproducible pre-reset/current Hi baseline;
- new Hi control plane;
- OMO/Swarm/Ensemble only for comparable scenarios where reproducible.

### Primary metrics

- deterministic task success;
- evidence completeness/freshness;
- false completion;
- duplicate/stale dispatch acceptance;
- recovery correctness;
- context/tokens/cost/wall time;
- unnecessary workers/retries/polling;
- stalls/orphans/cleanup.

### Final rule

Remove or simplify any subsystem that does not improve correctness, predictability or measured execution efficiency on its relevant task class.

### Completion evidence and decision

- Final production external-validity aggregate: `/workspace/Reference/benchmarks/m8-production/aggregate-r8-r10.json` sha256 `3a1dbea06117e6ae9cc555ffe91dee749eb1a1ea345866f25f5bf6bb0dc47c7a`; exact retained product code `8f6b19098b1db0a739bb97f82537fcdc45896278` is 3/3 strict success, pre-reset Hi is 0/3 strict settlement but 3/3 external correctness, and vanilla is 3/3 external success.
- Final required Architecture ablations are under `/workspace/Reference/benchmarks/m8-architecture-ablations/aggregate.json` sha256 `53786945dd0fcba8cf2d396b06489e9761cae2d9cbf4a35d9f32592ab96de460`; validated POLICY_ABLATION receipts cover direct-vs-graph, semantic no-progress, empirical model routing, skill shortlist, and fresh-context review.
- Retain correctness/predictability mechanisms on the task classes where they were mechanically justified: bounded scheduler conflict/fan-in admission, claim-linked evidence/freshness, recovery and restart fencing, exact authority, adaptive direct execution, semantic no-progress, bounded empirical model feedback, shortlist/lazy methodology exposure, fresh reviewer default, bounded context selection and coexistence hardening.
- Keep generic ProjectIntelligence injection removed and keep the broad primary tool-visibility cutover rejected/reverted. Do not claim general Hi-over-vanilla efficiency: vanilla remained materially lighter on final production and several real-host fixtures.
- Exact isolated retained-product verification is build PASS + architecture lint PASS + full plugin suite `934/934 PASS`. Final archive: `agent-archive/2026-08-18-m8-final-comparative-benchmark.md`.
- No later numbered roadmap milestone is defined. Completion does not authorize deferred publication/release work.

---

## Deferred / Not Roadmap Drivers

These do not define the architecture reset unless separately requested:
- npm publication/release/tagging;
- generic memory product;
- generic browser engine;
- second skill loader;
- second provider/model catalog;
- feature-count parity with competitors;
- broad documentation/certification rewrites unrelated to changed public behavior.

## Research Reopen Triggers

Reopen targeted ecosystem research only when:
- a repeated implementation defect suggests a known external solution may exist;
- OpenCode ships a materially changed capability used by a current adapter;
- a benchmark exposes an unexplained regression/opportunity;
- a concrete composition conflict appears;
- a new capability class becomes necessary for an authorized milestone.

Do not restart broad repository discovery merely to increase source count.
