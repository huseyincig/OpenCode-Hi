# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — ROADMAP MILESTONE 8
**Updated:** 2026-08-17
**Global authority:** `/workspace/PROTOCOL.md`
**Legacy project-policy layer:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`
**Benchmark design:** `/workspace/Reference/upstream-audit/benchmark-plan.md`

## Active Task

### Milestone 8 — Comparative Product Benchmark + Final Cutovers

Decide which reset architecture components are measurably better. Benchmark results, not architecture aesthetics or feature count, determine final subsystem retention/simplification.

## Verified Baseline

Milestone 7 is complete; see `agent-archive/2026-08-17-primitive-scope-down.md`. Duplicate primitive ownership was removed/thinned across model metadata, TeamRuntime, generic ProjectIntelligence, generic context/memory, skill loading and browser runtime. The scoped non-generated diff removed a net 1024 lines; final full plugin suite passed 893/893 and architecture lint passed 22/22.

## First-Wave Baselines

Required where reproducible:

1. vanilla OpenCode exact supported runtime;
2. a mechanically reproducible pre-reset/current Hi baseline commit;
3. current new Hi control plane.

Competitor baselines (OMO/Swarm/Ensemble) are optional per scenario only when current, reproducibly installable and semantically comparable. Do not force competitors into unrelated task classes.

## Scenario Classes

Use the benchmark plan. First wave must cover deterministic adversarial/control-plane cases before expensive production episodes:

- trivial localized work / over-orchestration;
- dependency/fan-in and independent same-model parallel work;
- mutable-surface conflict;
- misleading DONE / incomplete or stale evidence;
- mutation-after-verification freshness;
- provider/child failure and recovery;
- restart/stale callback/duplicate dispatch;
- authority/ambiguous external-action replay;
- context-heavy bounded investigation;
- plugin/config coexistence preservation.

Then add pinned real production-commit tasks for external validity when the runtime/baseline harness is mechanically reproducible.

## Primary Metrics

Correctness first:

- deterministic acceptance/check success;
- evidence completeness/freshness;
- false completion;
- duplicate/stale dispatch acceptance;
- wrong-task/wrong-attempt evidence acceptance;
- recovery correctness;
- ambiguous side-effect replay;
- deadlock/stall/orphan/cleanup failures.

Efficiency second, only with truthful provenance:

- exact input/output/reasoning/cache tokens when host supplies them;
- provider-billed exact cost only when actually supplied;
- OpenCode-derived cost separately labeled;
- wall time, model/tool calls, workers, retries/replans/polling;
- context transferred and mechanically identifiable redundant work.

## Acceptance / Final Cutover Rule

- no deterministic correctness regression on covered task classes;
- zero known false completion in exact adversarial completion/evidence fixtures;
- zero duplicate side-effect execution in exact-attempt/restart fixtures;
- measurable reduction in unnecessary execution on relevant trivial/single-worker or recovery cases;
- routing/context/skill/scheduler optimizations survive only if benefit is demonstrated or correctness requires them;
- remove/simplify any subsystem that does not improve correctness, predictability or measured execution efficiency for its relevant task class.

## Constraints

- Preserve unrelated user-owned dirty files exactly.
- Do not reset/clean the working tree.
- Do not touch release/publication validation artifacts unless a benchmark specifically requires a new isolated receipt outside those user-owned files.
- No push/tag/release/npm publication.
- Existing local performance/resource scripts are regression guards, not comparative product proof.
- Do not fabricate exact token/cost values; estimates remain separately labeled.
- Do not claim competitor superiority/inferiority without reproducible comparable episodes.
- Do not start broad ecosystem discovery unless a benchmark exposes a concrete unexplained gap.

## Required Verification

- benchmark harness/receipt schema tests;
- deterministic adversarial first-wave episodes with exact baseline/system identity;
- baseline reproducibility proof before any comparative claim;
- confidence/variance preservation for repeated real episodes;
- architecture ablation receipts for retained Hi subsystems where applicable;
- full plugin suite/build/architecture lint after any final cutover;
- scoped diff inspection.

## Exact Next Action

Inspect the current benchmark/telemetry harness, `/workspace/Reference/upstream-audit/benchmark-plan.md`, available OpenCode runtime binaries/SDK, Git history/checkpoints and any existing benchmark receipts. Establish which vanilla OpenCode and pre-reset Hi baselines are mechanically runnable on this host. Define and test a strict comparative episode/receipt schema before running or claiming comparisons. Keep deterministic in-process policy simulations explicitly separate from real host/product episodes.
