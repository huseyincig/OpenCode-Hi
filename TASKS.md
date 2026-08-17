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

## Current Mechanical Evidence

- current host OpenCode is `1.18.18`; project `@opencode-ai/plugin` and `@opencode-ai/sdk` are also `1.18.18`;
- OpenCode Go credential is present for the repo owner as provider `opencode-go` and a real `opencode-go/deepseek-v4-flash` probe completed with `finish=stop`;
- the probe exported exact observed usage of 7333 input / 5 output tokens; its monetary `cost` is OpenCode-calculated and must not be presented as provider-billed cost;
- pre-reset Hi commit `e8c1a7d77f3546bb2f940f4e7b439ed06a273e83` is reproducible in isolated worktree `/workspace/Reference/benchmarks/opencode-hi-e8c1a7d`: clean `npm ci`, plugin suite 848/848 PASS, architecture lint 22/22 PASS;
- strict comparative receipt contract is implemented and targeted verification is build PASS + 10/10 receipt-schema tests PASS; checkpoint pending;
- deterministic in-process benchmark simulations remain regression/ablation guards only and are not comparative real-host product proof.

## Exact Next Action

Checkpoint the strict comparative receipt contract without staging unrelated user-owned dirty validation/release/script files. Then create one pinned trivial-localized-work fixture and execute the same `opencode-go/deepseek-v4-flash` real-host episode through: (1) vanilla OpenCode 1.18.18 with external plugins disabled, (2) reproducible pre-reset Hi `e8c1a7d`, and (3) current Hi checkpoint. Use isolated config/worktree state per episode, capture exact system/model/config identity and raw machine receipts, run deterministic acceptance after each episode, and only then compare correctness/over-orchestration/usage. Do not infer provider-billed cost from OpenCode-derived monetary values.
