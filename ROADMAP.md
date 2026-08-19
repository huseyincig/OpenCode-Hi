# OpenCode-Hi Architecture Roadmap

**Project:** `/workspace/OpenCode-Hi`
**Updated:** 2026-08-18
**Status:** ACTIVE — PHASE 2 SEMANTIC AUTOPILOT & DECISION INTELLIGENCE
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

---

# Phase 2 — Semantic Autopilot & Decision Intelligence

**Status:** ACTIVE — 2026-08-18

**Phase 1 inheritance:** Milestones 1–8 remain complete. The retained deterministic kernel at `8f6b19098b1db0a739bb97f82537fcdc45896278` is the correctness baseline; Phase 2 may simplify provider-visible orchestration but must not weaken execution identity, scheduler ownership, evidence freshness, authority, recovery fencing, or completion adjudication.

## Product Goal

Turn the Phase 1 deterministic kernel into a high-quality autonomous decision system that chooses the minimum sufficient execution strategy and native/external capabilities for each mission while materially reducing provider-visible context, tool, model-call, and wall-time overhead.

The target is not “more agents.” It is:

```text
user intent
-> semantic decision envelope
-> DIRECT or bounded WorkGraph
-> capability / isolation / model / review policy
-> native or external primitive
-> Hi deterministic supervision
-> fresh evidence / completion
```

Every added decision layer must either improve covered-task correctness/predictability or reduce measured execution overhead. Static prompt/tool cuts that look smaller but regress end-to-end execution are rejected.

## Phase 2 Non-Negotiables

1. Phase 1 deterministic kernel invariants remain authoritative.
2. Native primitive + Hi semantic supervision is preferred over duplicate engines.
3. Decision policy is host-neutral and typed; host API shapes terminate at adapters.
4. No model call is added merely to make a decision that bounded deterministic state can make.
5. DIRECT is the default for clear reversible work; graph/delegation requires a named expected benefit.
6. Parallel fan-out requires independent, useful work and must account for spawn/context/fan-in overhead.
7. Isolation is an explicit policy decision tied to task ownership and mutable surfaces; worktree creation stays native.
8. Model escalation requires a named reason; factual model truth comes from OpenCode/runtime/models.dev, while Hi owns empirical observations.
9. Browser is a capability, not a Hi-owned engine. Hi owns backend selection, attempt/session ownership, evidence/artifacts, bounds, and recovery.
10. Provider-visible tool/context exposure is task/phase scoped wherever the host supports it; no blanket cutover survives without repeated task-level benefit.
11. Fresh review is used only when independence materially improves assurance.
12. Cost claims use exact host/provider observations when available; OpenCode-derived or heuristic values remain explicitly labeled.

# Milestone 9 — Semantic Decision Kernel + Entry Frugality

**Status:** COMPLETE — 2026-08-18

**Goal:** unify Phase 2 execution decisions behind one deterministic typed envelope and reduce unavoidable first-turn semantic-control overhead without changing Phase 1 correctness semantics.

### Scope

- Compose existing adaptive execution, topology, minimum-team, verification, category/model-class, and capability needs into one host-neutral `SemanticDecisionEnvelope`.
- Keep exact model/provider selection and actual tool availability downstream; the envelope expresses intent/policy, not fabricated runtime facts.
- Express whether isolation is `NONE`, `CANDIDATE`, or explicitly required by a later exact task contract; never provision a worktree from a vague mission heuristic.
- Express reviewer need, browser/process/workspace/web eligibility, and minimum provider-visible control-plane phase.
- Replace the verbose semantic-assessment system gate with a compact mechanically equivalent projection.
- Measure entry-gate characters and ensure no extra model/tool call is introduced.
- Record bounded decision reason codes for explainability and later ablation.

### Acceptance

- direct low-risk work remains DIRECT / single / zero-child where existing policy permits;
- high-risk/authority work cannot be downgraded by the envelope;
- real multi-stream work can still select bounded fan-out;
- ambiguous/source-verification work stays evidence-first;
- independent review requirement is preserved;
- isolation is never silently provisioned from mission-level uncertainty alone;
- semantic entry gate preserves multilingual/schema/coherence/authority constraints while reducing provider-visible characters by at least 30% from the canonical Phase 1 retained-product baseline (`3247` chars);
- focused tests prove decision parity and prompt contract;
- no user-owned dirty file is modified.

### Completion evidence

- Added pure host-neutral `SemanticDecisionEnvelope` composition without adding a model/tool/host call or a second durable state owner.
- MissionStore now consumes that envelope while preserving the existing adaptive/topology durable fields and Phase 1 policy reasons.
- Semantic entry gate reduced from `3247` to `1866` characters (`42.53%`) while preserving multilingual, schema/coherence, debugging/diagnosis and authority invariants.
- Exact retained-product overlay verification: build PASS, architecture lint `22/22 PASS`, full plugin/node suite `942/942 PASS`.
- Verification was run in `/tmp/opencode-hi-m9-check` over the exact Phase 1 archive so user-owned dirty generated/dist files in the working tree remained untouched.

# Milestone 10 — Dynamic Provider-Visible Surface & Token Frugality

**Status:** COMPLETE — 2026-08-18

**Goal:** reduce the Phase 1 production provider-visible overhead without repeating the failed static tool-visibility cutover.

### Retained outcome

- Provider-visible accounting was decomposed across semantic gate/system text, parent tool schemas, mission runtime projection, child handoff/context and repeated tool/result payloads.
- Retained common fixes normalize bounded semantic targets, make explicit executable verifier syntax authoritative for low/medium local initial verification, block unrequired broader parent verifiers, reconcile reverted transient mutation ownership against current diff, remove ceremony-only analysis obligations, close bounded DIRECT implementation only from current owned diff + fresh post-mutation required evidence, and project terminal completion to stop redundant follow-up work.
- No extra inference call was added merely to optimize context.

### Browser primary-surface ablation decision

Browser-unavailable primary schema gating reduced the static parent Hi surface `31 -> 23` tools and `7839 -> 6451` proxy chars (`-17.71%`), but V12 repeated real-host task economics regressed despite both arms achieving `3/3 VERIFIED_SUCCESS`:

- wall `+10.26%`;
- model calls `+16.67%`;
- tool calls `+12.20%`;
- input tokens `+36.41%`;
- output tokens `+10.64%`;
- OpenCode-derived cost `+31.87%`;
- first-step input `-3.46%`.

Therefore the browser-unavailable primary schema gating candidate is **REJECTED**. Static schema reduction alone does not earn retention. Future native/dynamic capability-specific exposure may be reconsidered only with repeated task-level benefit.

### Completion evidence

- aggregate: `/workspace/Reference/phase2-autopilot/m10-browser-realhost-v12-aggregate.json`, SHA-256 `d021e26dbdd650a0dbd373faf751619ee9a88f0d811ee2d05f5eb125f7ffced2`;
- retained manifest: `/workspace/Reference/phase2-autopilot/m10-v12-retained-final-manifest.json`, SHA-256 `da47dac4d827165dfce892a7e1030733ae969f4f422dc523567c13919ccc84fe`;
- exact retained-product isolated build PASS + architecture lint `22/22 PASS` + plugin suite `965/965 PASS`;
- all monetary benchmark values are OpenCode-derived, not provider-billed cost.

# Milestone 11 — Adaptive Decomposition, Model & Review Intelligence

**Status:** COMPLETE — 2026-08-19

**Goal:** choose zero/one/many workers and light/heavy model classes from expected completion value rather than ceremony.

### Scope

- bounded decomposition contracts with explicit write/read surfaces, dependencies, verification and fan-in;
- evaluate split-first/cheap-first execution against unsplit comparators instead of adopting ecosystem doctrine by assertion;
- reserve heavy reasoning for work that cannot be safely/economically decomposed or that empirically fails lighter routing;
- confidence-aware empirical routing with exact requested/effective-model attribution;
- user-authoritative OpenCode Go M11 role priors: MiMo-V2.5 primary test engine/dispatcher and routine DIRECT first choice; DeepSeek V4 Flash coder/tool specialist; Qwen3.7 Plus WorkGraph planner; Hy3 verifier/browser supervisor; MiniMax M2.7 synthesis/recovery; Qwen3.6 Plus adversarial validator; MiMo-V2.5-Pro principal fresh reviewer;
- protect narrow model tiers from routine tests; escalation requires semantic/evidence/failure delta;
- fresh reviewer only for material independence/assurance benefit;
- treat model request counts as Hi planning ceilings, never fabricated provider remaining quota; exact provider-side remaining stays unknown unless observed.

### Acceptance

Repeated fixtures show lower unnecessary worker/model overhead without covered-task correctness regression; decomposition never creates overlapping uncontrolled writers or fan-in ambiguity. Model benchmarks cover the declared seven-model role priors with exact requested/effective attribution, bounded escalation, and no claim of provider remaining quota or provider-billed cost that was not observed.

### M11 model-routing checkpoint — 2026-08-18

Model-routing evidence is complete for the declared pool on retained product commit `d0ae806`: exact default-role attribution, controlled role-compatible alternates, mission-local empirical rerank admission, resolution-time unavailable-model fallback, and deterministic runtime recovery/escalation invariants are verified. Archive: `agent-archive/2026-08-18-m11-model-routing-evidence.md`. Authentic runtime provider-failure recovery is not claimed real-host verified because pinned OpenCode 1.18.18 localhost failure probes did not settle within the bounded 20-second probe ceiling. M11 remains ACTIVE for decomposition and fresh-reviewer value.

### Retained checkpoint — role routing v1

- canonical in-memory role priors and `cost-quality` default retained; no silent project routing-policy persistence;
- sparse feedback keeps the prior order, while confidence-admitted bounded feedback may rerank only within the configured/default role set; explicit/fixed model authority stays above empirical feedback;
- common correctness fixes canonicalize verifier-only test targets and make tool-after verification closure exact claim-linked per obligation;
- retained image architecture `22/22 PASS`, plugin suite `974/974 PASS`;
- repeated trivial child comparator: candidate MiMo parent + DeepSeek coder strict `3/3` vs baseline `2/3`; candidate wall `-12.61%`, input `-7.50%`, but model calls `+14.63%`, tools `+12.50%`, OpenCode-derived cost `+74.90%`; retention is correctness/predictability-driven, not a general efficiency claim;
- aggregate SHA-256 `4c72018e3cd07c15d1c1ca4e33a0de6b66c69a0a3ccd95f8f398ef8b04ad534b`; retained manifest SHA-256 `80811c936f1bf8d2ed3bd0e4df8b003eb64a6fa33d0ce6a98d7e92139ffa518d`.

### M11 completion evidence — 2026-08-19

- Final product commit: `1bf47ac4a51f5e30e30ca9269821e369fac9f332`; exact Git-archive verification build PASS + architecture lint `22/22 PASS` + plugin suite `977/977 PASS`.
- Role/model routing, bounded empirical rerank and fallback/escalation evidence are archived in `agent-archive/2026-08-19-m11-adaptive-decomposition-model-review.md` together with exact aggregate hashes.
- Clear local work retains zero-child DIRECT: one child had the same `3/3` correctness but materially higher wall/model/tool/token/cost overhead.
- Generic independent micro fan-out is not preferred: two-child parallel was strict `2/3` vs one-child `3/3` and materially heavier.
- Dependency/fan-in scheduler capability is retained for materially required graphs, not as a micro-task default: one-child and fan-in were both strict `2/3`, while fan-in was materially heavier; dependency failure correctly blocked fan-in admission.
- Reviewer policy is risk-adaptive: low-risk direct review `3/3` with zero child; high-assurance review `3/3` with exactly one fresh MiMo-V2.5-Pro child. Fresh review is retained for assurance/independence, not economics.
- No general model, parallelism, reviewer, or Hi-over-vanilla efficiency superiority claim is made.

# Milestone 12 — Capability & Isolation Intelligence

**Status:** COMPLETE — 2026-08-19

**Goal:** dynamically choose native shell/process/workspace/MCP/browser capabilities while keeping Hi ownership narrow and exact.

### Scope

- capability requirement/availability/semantic-guarantee decision model;
- native workspace isolation only for an exact task with a justified mutable-surface/lifecycle reason;
- process/PTY use only when long-lived interactive lifecycle is actually required;
- MCP activation/exposure only when its tool set is task-relevant and context cost is justified;
- fail-closed degradation when native semantics are insufficient for required ownership/evidence.

### Acceptance

Capability decisions are explainable, task-bound, testable, and do not widen native permissions or create duplicate generic runtimes.

### M12 completion evidence — 2026-08-19

- Final product commit: `72c71504be3b71e82cd45837c0c1db13af68aa7f`; exact Git-archive build PASS + architecture lint PASS + plugin suite `990/990 PASS`.
- Exact isolated workspace reintegration through native OpenCode warp is retained only for justified isolated write tasks; aggregate SHA-256 `0f238e05a4829dd99ef92fc64ff89633b802ee157ab930aec4c33e9cf4dea4c1`.
- Persistent/interactive process capability is retained: candidate selects `interactive-process` `3/3`, pre-policy baseline `0/3`; mechanical decision receipt SHA-256 `42432a093874d75e97c4ae24cac1ca27e590f47c88bfdb635d3301bbf1fb5f23`.
- MCP exposure is native-permission/server scoped with no Hi allow widening; real-host aggregate SHA-256 `5fb4d956a186a41ac2306966d0adabb7d5d5d7c250e2f9afd6375a784b2532a9`.
- Existing bounded browser owner remains unchanged; Browser Autopilot work is deferred to M13 rather than being inferred into M12.
- Detailed provenance: `agent-archive/2026-08-19-m12-capability-isolation-intelligence.md`.

# Milestone 13 — Browser Autopilot

**Status:** COMPLETE — 2026-08-19

**Goal:** evolve browser support from visual-verification executor into task-aware, evidence-producing browser orchestration without building another browser engine.

### Scope

- backend policy for Playwright CLI/skill, MCP/persistent browser, or other host-supported adapters;
- route/navigation/action plan bounded by task objective and allowed origins;
- exact browser session/attempt ownership and cleanup;
- DOM/text/screenshot/network/console evidence as bounded artifacts;
- browser→code feedback loop with claim-linked evidence;
- isolate browser sessions when state/cookie/concurrency semantics require it.

### Acceptance

Representative UI/browser tasks complete with bounded evidence, no cross-task session leakage, deterministic cleanup, and lower context cost for the lightweight backend on tasks where persistence is unnecessary.

### M13 completion evidence — 2026-08-19

- Final retained product commit: `e0cb30f82947a22f0bedec4c69a9da1cf4f0ee1b`; exact immutable-image build PASS + architecture lint `22/22 PASS` + plugin suite `1003/1003 PASS`.
- Exact task-owned browser cleanup is generation/owner fenced; repeated real-browser comparator shows pre-cutover leakage `3/3` and retained cleanup `3/3`, receipt SHA-256 `4dc748b686697572c2d8ca009faa73803228c83405d377887f9f75c4b162b744`.
- Backend selection is task/runtime bound: healthy bounded Playwright remains the lightweight default, while an explicitly selected configured MCP backend becomes native-authoritative without dual browser exposure; repeated real-host receipt SHA-256 `6d4a75200548a75daf767f4a099791f6e52326a7c06ce7442d94c677000dfaa4`.
- Browser navigation/action scope is exact-origin confined; baseline cross-origin navigation succeeds `3/3`, retained candidate blocks both direct and click-induced cross-origin navigation `3/3`, receipt SHA-256 `fd2acab330641d963848be48e374bb1aa50987a0b7b5462c6ec15621dc6d2938`.
- Browser evidence is canonical-observation/attempt linked and stale/ref-less proof fails closed; receipt SHA-256 `82923c4ee69dcc13ebeef3a585927527363a22b391b61c2fa841cc0607aba22d`.
- Browser findings resume the same task/worker correction loop while prior-attempt observations become stale; receipt SHA-256 `73afa336d50c74af64fcde4077867d90aaafca007c1d11bf23365d0b1e9fc8e3`.
- Lightweight context economics are mechanically retained: exact bounded browser surface is `8` tools / `2626` serialized schema bytes versus current `@playwright/mcp` `0.0.79` at `24` tools / `15921` bytes; MCP schema hash is stable across `3/3` independent handshakes, an `83.51%` backend-specific schema-byte reduction. This is a context-load proxy, not token or provider-billed-cost evidence. Receipt SHA-256 `763f3564491bdb2e477c43e85fb9f12e8fe7d79ecdd562548585a96ee928d15d`.
- Detailed provenance: `agent-archive/2026-08-19-m13-browser-autopilot.md`.

# Milestone 14 — Closed-Loop Supervision & Runtime Engineering

**Status:** COMPLETE — 2026-08-19

**Goal:** make decision quality improve from bounded observations while hardening algorithmic/runtime efficiency.

### Scope

- confidence/decay/attribution for routing and procedure learning;
- bounded state indexes instead of repeated broad scans where profiling proves value;
- queue/fairness/backpressure/critical-path improvements only where measurable;
- async cancellation/liveness and memory-retention audit;
- Big-O and allocation profiling on hot runtime paths;
- no broad self-modifying policy without reversible evidence gates.

### Acceptance

Profiling and adversarial tests demonstrate the retained changes improve measured hot paths or decision quality without introducing a second state owner.

### M14 progress — scheduler hot-path checkpoint — 2026-08-19

- Retained product checkpoint `90805398287f86f9596abf16862ee49ced0262b3`: call-scoped prepared scheduling reuses invariant graph/dependency/conflict decisions during simulated admission without adding durable state.
- Exact normalized baseline→candidate scheduler decisions remain equal across independent/conflict/fan-in/dependency fixtures; 128-unit 8-admission median improved `97.1031 -> 11.7242 ms` (`-87.93%`) and 256-unit improved `391.0434 -> 44.1929 ms` (`-88.70%`). Receipt SHA-256 `e1cd9a935adb23a61c8ff04fb14d8f162d0b57fb46e8f8a08195d05a84df3213`.
- Exact Git-archive build PASS + architecture lint `22/22 PASS` + plugin suite `1004/1004 PASS`.
- Baseline decision-quality characterization proved wall-clock age was not used. The retained feedback cutover does not invent a TTL: model feedback now decays across material semantic `amendment`/`constraint` epochs while verification/non-material/stop/resume control events preserve same-task feedback; historical evidence is preserved and fresh same-epoch evidence can re-admit reranking. Exact comparator SHA-256 `5d5b580ce63809f5f0ec1f73981ce8ff5aea8a58338c6b92521b56c6fe76b861`; exact product commit `d90787b06cf6f1fe64e0656b10403825bd4b5114`; plugin suite `1010/1010 PASS`.
- Canonical project methodologies remain explicit hash-bound project policy and are not silently disabled by elapsed wall time; historical derived READY candidates are inert until a fresh evidence-backed observation makes an uncovered candidate actionable again.
- Final liveness/backpressure cutover: exact `d90787b` canonical-topology baseline proves waiter/timer, spawn-dedupe, queued cancel and cancelAll cleanup are bounded, while queue overflow leaves one created task + worker orphan. Retained commit `96267ce857eec53ae31d8549cd52c5eff7d88bf9` removes that orphan transactionally and preserves exact workspace ownership on cleanup failure. Exact comparator SHA-256 `c036d5de206954ce61deacbb01c2208900a8bb24a003495c06fff2eaf5e39e4f`.
- Final exact Git-archive verification: build PASS, architecture lint `22/22 PASS`, M14 rollback `5/5 PASS`, full plugin suite `1015/1015 PASS`. Detailed evidence: `agent-archive/2026-08-19-m14-closed-loop-runtime-engineering.md`.
- **M14 acceptance: COMPLETE.** No second durable state owner or speculative persistent cache/index was introduced.

# Milestone 15 — Broad Production Corpus + Final Phase 2 Cutovers

**Status:** ACTIVE — 2026-08-19

**Goal:** decide whether the Semantic Autopilot is actually better on real work.

### Scope

Use repeated isolated episodes spanning at least localized fixes, diagnosis, multi-module work, decomposition/fan-in, security/authority, context-heavy work, browser/UI, recovery, and capability/isolation decisions. Compare vanilla OpenCode, retained Phase 1 Hi, and Phase 2; add current OMO/Swarm/Ensemble only where the scenario is reproducibly comparable.

### Final Rule

Retain a Phase 2 subsystem only when it improves deterministic correctness/predictability or measured execution efficiency on its relevant task class. Do not claim general Hi superiority from a narrow corpus.
