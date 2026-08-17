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
- strict comparative receipt contract is implemented and checkpointed at `6440520fe623c9a00263226668c41624d72c9d9c`; targeted verification was build PASS + 10/10 receipt-schema tests PASS;
- deterministic in-process benchmark simulations remain regression/ablation guards only and are not comparative real-host product proof;
- first real-host trivial-localized-work pilot completed on `opencode-go/deepseek-v4-flash` variant `low`, 3 repetitions per system: vanilla OpenCode 3/3, pre-reset Hi 3/3, current Hi 3/3 VERIFIED_SUCCESS; every test file remained unchanged and every diff was limited to `src/calc.js`;
- pilot aggregate means: vanilla 25.17s / 16.65k input / 6 model steps / 8 tools; pre-reset Hi 55.77s / 45.03k input / 9.33 model steps / 11.67 tools; current Hi 49.65s / 41.77k input / 8.67 model steps / 10.67 tools;
- on this exact pilot current Hi improved over pre-reset in all 3 repetitions (~11% mean wall-time reduction, ~7% input reduction, ~9.7% OpenCode-derived cost reduction), but remained heavier than vanilla in all 3 repetitions (~1.97x mean wall time, ~2.51x input, ~1.44x model steps); this is an exact-fixture pilot signal, not a general superiority claim;
- current trivial episodes used only `hi_intent_assess` and `hi_direct_progress`, while Hi registers 31 tools globally; exact OpenCode 1.18.18 SDK exposes no dynamic parent `chat.message` tool override, so host-native agent tool filtering is the correct V1 seam rather than a second prompt transport;
- exact-host ablation proved OpenCode 1.18.18 `agent.<name>.tools.<tool>=false` removes disabled tool schemas from the provider-visible catalog: current normal first LLM step was 10867–10871 input tokens across the original 3 runs, while an isolated 29-Hi-tool-off ablation was exactly 8404 input tokens on the first step (~22.7% reduction before model-behavior divergence);
- a coexistence-safe cutover now defaults only 13 provider-irrelevant Hi tools off for built-in `build`/`plan`: 5 diagnostics (`hi_doctor/status/metrics/ledger/readiness`) plus 8 runtime-owned child-visual browser tools. Delegation, process, context, rollback, intent and direct-progress tools remain visible; explicit host/user tool choices are preserved and Hi still does not own `default_agent`;
- one isolated safe-subset real-host probe preserved VERIFIED_SUCCESS and reduced first-step input from 10867 to 9951 (~8.4%), total input 40179 to 28083 and wall time 49.3s to 40.9s on that single run; this is ablation evidence only until repeated after the code checkpoint;
- cutover verification before benchmarking was green: plugin build PASS, focused composition/coexistence 24/24 PASS, affected runtime/tool-surface set 45/45 PASS, architecture lint 22/22 PASS, full plugin suite 906/906 PASS;
- checkpointed cutover `3dcf25dfe1c8dd3fd57163c5aed5a94d909ccefa` then completed 3/3 real-host repetitions successfully, but failed the M8 efficiency-retention rule versus pre-cutover current: mean wall +10.4%, input +3.1%, output +15.9%, model calls +11.5%, tool calls +6.3%, OpenCode-derived cost +4.6%; only repetition 1 improved while repetitions 2 and 3 regressed;
- therefore the primary tool-visibility cutover is REJECTED/REVERTED despite its deterministic first-step schema reduction; the exact-host `tools:false` ablation remains useful host-capability evidence but is not retained product behavior because repeated end-to-end execution did not improve;
- revert verification is build PASS, full plugin suite 903/903 PASS, architecture lint 22/22 PASS; functional plugin source is restored to the pre-cutover current behavior while benchmark receipts remain under `/workspace/Reference/benchmarks/m8-pilot/`.
- M8 independent same-model/disjoint-surface real-host fixture `m8-independent-shared-work-002` is complete for exact final current commit `deb39dc7ec9396362e31a26008373dd3a7915eba`, pre-reset Hi `e8c1a7d77f3546bb2f940f4e7b439ed06a273e83`, and vanilla OpenCode 1.18.18 using `opencode-go/deepseek-v4-flash` variant `low`; aggregate is `/workspace/Reference/benchmarks/m8-parallel/aggregate-r8-r10.json` (sha256 `58c652b34f7e5f5e508c7b7e8dd488e6f244a7e9accb519043ef7de56f2bc9e4`).
- final current r8/r9/r10 is 3/3 VERIFIED_SUCCESS with exactly 2 child workers and peak concurrency 2 in every repetition; mean wall 90.08s, input 89.20k, model calls 20.67, tool calls 29.67, child context 8.41k bytes, OpenCode-derived cost $0.026624. Current variance is material (wall 64.32s–133.46s; input 59.50k–145.75k) and is preserved rather than trimmed.
- vanilla r8/r9/r10 is 3/3 VERIFIED_SUCCESS with mean wall 21.05s, input 14.06k, model calls 5.33, tool calls 10.33 and OpenCode-derived cost $0.003856; current therefore used ~4.28x wall time, ~6.35x input, ~3.88x model calls and ~6.91x OpenCode-derived cost on this exact fixture. Parallel child execution by itself is not treated as a benefit.
- pre-reset Hi r8/r9/r10 is 0/3 VERIFIED_SUCCESS under strict Hi settlement despite all three external targeted tests passing and bounded diffs being correct: it spawned zero child workers and exited with mission status `stopped`, open `o-analysis`, and unresolved planning/debugging methodology needs. This is a control-plane correctness regression, not an external implementation failure.
- the comparative harness was corrected fail-closed during this fixture: Hi episodes with zero task status no longer auto-pass settlement; mission status, blockers, open obligations and methodology needs must also be clean. r8 baseline was recomputed from its preserved artifacts after this harness correction. This harness correction does not alter final-current r8/r9/r10 because those receipts have explicit completed task settlement.
- this fixture demonstrates current-reset control-plane correctness over pre-reset Hi, but does not isolate that gain to WorkGraph/scheduler and does not demonstrate an efficiency advantage over vanilla. Scheduler retention remains provisional pending conflict/dependency scenarios where deterministic coordination can add correctness/predictability value.

## Exact Next Action

Create the next pinned real-host first-wave fixture for **mutable-surface conflict**: two implementation work units whose initially independent-looking scopes deterministically converge on at least one shared mutable file. Use deterministic acceptance that proves both requested behaviors survive reconciliation and that no valid sibling work is overwritten. Run the same OpenCode 1.18.18 + `opencode-go/deepseek-v4-flash` variant `low` protocol through vanilla OpenCode, reproducible pre-reset Hi `e8c1a7d`, and exact current Hi `deb39dc`, minimum 3 repetitions each if mechanically stable. Measure verified success, write-conflict detection/quarantine/serialization, duplicate/stale dispatch, workers/peak concurrency, model/tool calls, exact step-finish usage, wall time, context transferred and bounded final diff. This scenario is the next scheduler-value discriminator: retain conflict scheduling only if it improves correctness/predictability or measured execution efficiency; do not reward extra workers by itself. Keep receipts isolated under `/workspace/Reference/benchmarks/` and label OpenCode monetary cost as derived, not provider-billed.
