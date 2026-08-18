# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** COMPLETE — ROADMAP MILESTONE 8 / ARCHITECTURE RESET
**Updated:** 2026-08-18
**Global authority:** `/workspace/PROTOCOL.md`
**Legacy project-policy layer:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`
**Benchmark design:** `/workspace/Reference/upstream-audit/benchmark-plan.md`

## Active Task

### None — Milestone 8 and the architecture reset roadmap are complete

Milestone 8 final comparative evidence and cutover decisions are complete. `ROADMAP.md` defines no subsequent numbered milestone. Do not activate deferred release/publication or broad research work without a new explicit user objective.

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
- this fixture demonstrates current-reset control-plane correctness over pre-reset Hi, but does not isolate that gain to WorkGraph/scheduler and does not demonstrate an efficiency advantage over vanilla. Scheduler retention remained provisional pending conflict/dependency scenarios where deterministic coordination could add correctness/predictability value.
- M8 mutable-surface conflict exposed a concrete task-scope admission defect: parent `hi_task_start` calls used semicolon-separated multi-path scopes, while the runtime previously treated each scalar as one literal path. That hid the shared `src/shared.js` overlap from scheduler admission and also made valid worker diffs appear outside declared scope.
- commit `42c1cd6e70c124c7c2aebc133bf968eae53bbea2` fixes that seam by canonicalizing exact semicolon-separated multi-path scope strings while preserving fail-closed rejection of ambiguous prose; focused scheduler/write-conflict/tool-surface tests passed 19/19, and the exact archived commit `/workspace/Reference/benchmarks/opencode-hi-42c1cd6` passed the full `npm run check` at 926/926 tests.
- natural-language conflict pilots r3-r6 were methodology/semantic-classification confounded and r7 had incomplete queued-child economics; they are retained as pilot evidence but excluded from final comparison. The final r8-r10 fixture is explicitly a **synthetic scheduler stress/ablation** with pinned semantic classification, not a natural-routing or natural-language efficiency claim.
- final conflict fixture `m8-mutable-shared-work-003` uses fixture sha256 `19f6c7dd7a016f9e1aae14ecaf8229fdde664135575a94a19421530d2b8f3525`; aggregate is `/workspace/Reference/benchmarks/m8-conflict/aggregate-r8-r10.json` (sha256 `82cc1fc201971a0a861a1c1b4801ea36b724017d13b64d50334c42afcf1fc944`).
- exact current `42c1cd6` is 3/3 VERIFIED_SUCCESS. Every repetition created two dependency-free task contracts with canonical scopes `[src/alpha.js, src/shared.js]` and `[src/beta.js, src/shared.js]`; both tasks completed, workers spawned=2, and peak concurrency=1 in every repetition, mechanically demonstrating mutable-surface serialization. Current means: wall 123.70s, input 104.29k, output 9.06k, model calls 21.0, tool calls 39.67, child context 8.67k bytes, OpenCode-derived cost $0.030480.
- reproducible pre-reset Hi `e8c1a7d` is 0/3: all three repetitions timed out at ~300s with deterministic acceptance FAIL after only `src/alpha.js` and `src/shared.js` were changed; beta work never completed. Means: wall 300.12s, input 127.78k, model calls 36.0, tool calls 58.67, OpenCode-derived cost $0.045471.
- vanilla OpenCode 1.18.18 is 3/3 VERIFIED_SUCCESS with the exact expected three-file diff and unchanged tests. Means: wall 71.51s, input 27.61k, model calls 8.67, tool calls 16.0, OpenCode-derived cost $0.009210. Vanilla used the native `task` tool in the final runs, but the harness exported no child-session telemetry, so these receipts prove external acceptance and observed economics, not equivalent runtime-owned mutable-surface admission semantics.
- **conflict scheduler RETAIN:** correctness/predictability justifies retaining deterministic mutable-surface admission. Current eliminates the reproducible pre-reset failure and enforces non-overlap mechanically. This is not an efficiency win over vanilla: current is ~1.73x slower, ~3.78x higher input, ~2.42x model calls, ~2.48x tool calls and ~3.31x OpenCode-derived cost on this exact synthetic fixture. Do not generalize this result into global Hi-vs-vanilla superiority.

- M8 dependency/fan-in final scheduler ablation `m8-dependency-fanin-004` uses final fixture sha256 `c2b2c6f70804f1003e0d9b354bdfa7bb2613a7001bac6e286c4c898c4946bdd5`; aggregate is `/workspace/Reference/benchmarks/m8-fanin/aggregate-r11-r13.json` (sha256 `e82679dcea1975fbe3a64f5d859e53ffa3c8735dbbf857c917ef5ea7ff17edf4`). Pilots r1-r10 are excluded from final comparison: r1 was sequential-methodology-confounded; r8-r10 allowed workspace isolation and r9 exposed an unrelated workspace-create transport confound. Final r11-r13 explicitly disable worktree/workspace isolation and use exact durable A+B -> C dependency/timing checks.
- exact current Hi `42c1cd6` is 3/3 VERIFIED_SUCCESS in final fan-in repetitions. Every run created exactly three task contracts, A and B had no dependencies, C had exactly `[A_task_id,B_task_id]`, C worker `started_at` was after both prerequisite `completed_at` values, duplicate worker dispatch count was zero, workers spawned=3 and peak concurrency=2. Current means: wall 110.31s, input 109.75k, model calls 25.0, tool calls 39.33, child context 11.75k bytes, OpenCode-derived cost $0.031735.
- reproducible pre-reset Hi `e8c1a7d` is 0/3 on final fan-in: all three runs timed out at ~300s with acceptance FAIL; r11/r13 changed only upstream left/right while downstream join never completed, and r12 made no production diff. Pre-reset also showed malformed scalar-scope handling in r11 and unresolved methodology/control-plane state. Mean wall 300.13s; success 0/3.
- vanilla OpenCode 1.18.18 is 3/3 external VERIFIED_SUCCESS on the same final fixture with expected three-file diff and unchanged tests; mean wall 85.88s, input 26.11k, model calls 8.33, tool calls 15.0, OpenCode-derived cost $0.009565. Vanilla used native `task`, but the harness exports no equivalent durable dependency-admission timestamps/graph semantics, so these receipts prove external acceptance/economics rather than equivalence to Hi runtime-owned fan-in ordering.
- **dependency/fan-in scheduler RETAIN:** exact current Hi mechanically enforces fan-in order and eliminates the reproducible pre-reset downstream-stall failure. This is not a Hi-over-vanilla efficiency claim: current is ~1.28x slower, ~4.20x higher input, 3.0x model calls, ~2.62x tool calls and ~3.32x OpenCode-derived cost versus vanilla on this exact synthetic fixture.

- M8 deterministic misleading-DONE/evidence-provenance fixture `m8-misleading-done-005` is complete against exact archived current `42c1cd6` and pre-reset `e8c1a7d`. Fixture sha256 `78c0f19fe56aeea16f0d4724d602b303d8a902f448531075fda93d5730a4da12`; aggregate `/workspace/Reference/benchmarks/m8-misleading-done/aggregate.json` sha256 `c9d41e6f6fce243bffce7638fd91fed95f10ce789c215f51e2b9550ffea658a4`; both receipts validate rc=0.
- current Hi is VERIFIED_SUCCESS: a worker `DONE` with no evidence remains blocked; passing evidence from the wrong task remains blocked; passing evidence from a previous worker attempt remains blocked; exact current-task/current-attempt evidence completes the positive control. false_completion=0, wrong_task_accepted=0, wrong_attempt_accepted=0.
- pre-reset Hi is VERIFIED_FAILURE: missing evidence correctly blocks, but passing worker evidence from unrelated Task B falsely satisfies Task A's verification claim, and attempt-1 proof falsely satisfies attempt-2 `DONE`. false_completion=2, wrong_task_accepted=1, wrong_attempt_accepted=1. This is an exact deterministic control-plane regression, not a model-behavior result.
- **claim-linked evidence/completion RETAIN:** current exact task/session/attempt/obligation provenance eliminates two mechanically reproduced false-completion classes. Vanilla is intentionally excluded because it has no mechanically equivalent Hi claim-linked evidence adjudicator contract; forcing a vanilla receipt would compare different semantics. No provider/model execution or monetary cost occurred in this fixture.

- M8 mutation-after-verification deterministic fixture `m8-mutation-freshness-006` is complete. Fixture sha256 `3b7abaf47157f234254987c254a4dc8c42a06a98866e974419e4e235c2544554`; aggregate `/workspace/Reference/benchmarks/m8-mutation-freshness/aggregate.json` sha256 `12403aac5b7eaf8aee01829a1e95b59206ab3f72b556fca3df39f5a64d372581`; baseline/current receipts both validate rc=0.
- current Hi is VERIFIED_SUCCESS 7/7: initial proof completes; relevant mutation blocks and reopens the affected verification obligation plus gate; unknown mutation fails closed; unrelated known-surface mutation preserves independent proof; fresh re-verification restores completion. false_completion=0 and mechanically identified redundant actions=0.
- pre-reset Hi is VERIFIED_FAILURE 4/7: relevant and unknown mutations do block stale completion and recovery works, but the persisted verification obligation/gate remain closed after invalidation and every known-surface mutation blanket-invalidates all evidence, so an unrelated `src/b` mutation unnecessarily destroys `src/a` proof. false_completion=0 but mechanically identified redundant actions=1.
- **scoped evidence freshness / claim reopening RETAIN:** current preserves correctness while making durable claim/gate state coherent and avoiding unnecessary re-verification on unrelated surfaces. Vanilla is excluded because it has no mechanically equivalent Hi evidence-freshness/claim-gate state contract. No provider/model execution or monetary cost occurred.

- M8 deterministic provider/child recovery fixture `m8-provider-recovery-007` is complete. Fixture sha256 `ae9d584f952dd711378dd8c73730e69b568750a520d75707660aa94146679406`; aggregate `/workspace/Reference/benchmarks/m8-provider-recovery/aggregate.json` sha256 `568f24680004f9897a796bad82762fa7996d0ed1914bd166b4b5c20b51aee7f9`; both receipts validate rc=0.
- current Hi is VERIFIED_SUCCESS 8/8 recovery assertions after injected fallback-prompt failure plus recovery-child abort failure: original failed child abort occurs once; one recovery child is created; recovery-child abort is attempted; unconfirmed-live child remains tracked `busy/running`; scheduler reservation remains retained; precise recovery-abort blocker is emitted; no second fallback child is spawned. duplicate_dispatch=0, retries=1.
- pre-reset Hi is VERIFIED_FAILURE: original child is aborted twice, two recovery children are spawned, neither recovery child is quiesced, scheduler running count falls to zero while worker remains `busy` on `recovery-2` and task is `blocked`; duplicate_dispatch=1, mechanically redundant actions=1, unquiesced/orphan-cleanup failures=2, retries=2.
- **provider/child recovery ownership RETAIN:** current fails closed when recovery-child termination cannot be verified and prevents overlapping replacement execution. Vanilla is excluded because this fixture directly exercises Hi TaskRuntime/scheduler recovery ownership. No provider/model inference or monetary cost occurred.

- M8 deterministic restart/stale-callback fixture `m8-restart-stale-008` is complete. Fixture sha256 `c77b51bc731e4f236296675922846e4a1045701428e7839c1676f49974fc8ee2`; aggregate `/workspace/Reference/benchmarks/m8-restart-stale/aggregate.json` sha256 `28f77822d55d9cf77a0bfc5146d4b99c387e1a52f574b921dbe76f791606bc90`; both receipts validate rc=0.
- current Hi is VERIFIED_SUCCESS: unclean restore quarantines the old child; when abort capability is unavailable explicit resume is refused, no prompt is sent, `restart_reconcile_pending` remains true, late callback disposition remains non-accepting, and a durable `scheduler.restart-reconcile-blocked` reason is recorded. duplicate_dispatch=0, stale_callback_accept=0.
- pre-reset Hi is VERIFIED_FAILURE: it initially restores quarantine correctly but then resumes the same unverified `child-old` without abort, sends a prompt, clears restart pending and changes callback disposition to `accept`. duplicate_dispatch=1, stale_callback_accept=1, retries=1.
- **restart reconciliation / stale-callback fencing RETAIN:** current requires verified host quiescence before a new attempt and keeps attempt ownership fail-closed. Vanilla is excluded because this fixture is Hi durable restart/callback ownership semantics. No provider/model execution or monetary cost occurred.

- M8 deterministic authority/ambiguous-replay fixture `m8-authority-replay-009` is complete. Fixture sha256 `fe14c844a3f91e891c21ae34374d05b64122536fcaed367717a7425b51128fe7`; aggregate `/workspace/Reference/benchmarks/m8-authority-replay/aggregate.json` sha256 `1df6aaea835fab06dacb084773c767ae0ccc34c12da291766d87a7a0654daad4`; baseline/current receipts validate rc=0 and are both VERIFIED_SUCCESS.
- both exact systems pass 6/6: approval remains exact action+cwd hash-bound; unknown ACK is not completion; retry/new action is blocked while execution outcome is unresolved; wrong reconciliation is rejected; exact reconciliation records one-shot completion/idempotency; STOP preserves unresolved executing state. ambiguous_side_effect_replay_count=0 for both.
- **exact-action authority RETAIN_UNCHANGED:** `runtime/safety/authority.ts` has no diff between pre-reset `e8c1a7d` and current `42c1cd6`; benchmark confirms the safety invariant survived reset but does not establish a reset-specific improvement. Vanilla is not used because no real external effect is executed and this fixture checks Hi exact authority state semantics.

- M8 deterministic context-heavy bounded-handoff fixture `m8-context-heavy-010` is complete. Fixture sha256 `171b8e7e8373aebbab0c6a462862c3339c410c5e897efb053d5b58800828a720`; aggregate `/workspace/Reference/benchmarks/m8-context-heavy/aggregate.json` sha256 `348d4cb3b8cdbfd193a72bd11952b818d6c917c799b5c09ab30d1e9ff5f93539`; both receipts validate rc=0.
- current Hi is VERIFIED_SUCCESS 6/6: child handoff stays under budget, scoped TypeScript semantic target survives, oversized explicit context is replaced by native summary, selected artifact survives, unselected artifact/full transcript are excluded, and no generic project-memory noise is injected. Handoff=3293 bytes.
- pre-reset Hi is VERIFIED_FAILURE 5/6: the same required context survives and budget is respected, but coarse same-file ProjectIntelligence retrieval injects 4 objective-irrelevant synthetic records. Handoff=4307 bytes. Current therefore reduces this exact handoff by 23.54% while preserving all required markers.
- **scoped semantic/artifact/native-summary context RETAIN; generic ProjectIntelligence injection KEEP_REMOVED:** reset scope-down is mechanically supported by lower context transfer with no deterministic information loss in this fixture. No provider/model inference or monetary cost occurred.

- M8 deterministic plugin/config coexistence fixture `m8-plugin-config-coexistence-011` is complete. Fixture sha256 `69ccadf595b8f7a0fff53c8d41b3f5f71c4086089fe3ee875984cc7c9239f6d9`; aggregate `/workspace/Reference/benchmarks/m8-coexistence/aggregate.json` sha256 `c60a20622b49c53340a9b870c46cc6905bdade112b03ea8a20f70a18297ad9a6`; baseline/current receipts validate rc=0.
- current Hi is VERIFIED_SUCCESS 16/16: V2-shaped foreign config is rejected with an explicit adapter diagnostic and remains byte/JSON-identical with no V1 backfill; V1 foreign plugin/skill/MCP/custom-agent/unknown sections are preserved; `default_agent` remains unowned; foreign message/system/compaction content is preserved and each canonical Hi projection is added exactly once across repeated hooks. redundant actions=0.
- pre-reset Hi is VERIFIED_FAILURE 9/16: V2-shaped config is silently mutated with V1 `hi/agent/default_agent/subagent_depth/permission` fields, `default_agent=working-manager` is claimed, foreign message marker suppresses the canonical Hi parent contract, and repeated system/compaction hooks duplicate canonical projections. redundant actions=10. V1 foreign plugin/skill/MCP/custom-agent/unknown fields themselves are preserved.
- **composition adapter + idempotent coexistence transforms RETAIN; `default_agent` ownership KEEP_REMOVED:** reset hardening prevents host/plugin config corruption and duplicate/suppressed projections. Vanilla is excluded because this fixture measures Hi additive composition semantics. No provider/model inference or monetary cost occurred.

- M8 production external-validity task `m8-prod-opencode-unicode-012` is final on `anomalyco/opencode` `ab7cbc808f61e062af20d9a9a838ae93ed8f940d -> 6c035e1fd79ede42506eda9a04cab07cb1e502e7`; final fixture sha256 `3936f2a4d1353f09b0969cd84dae1795831a7e2548867e6333ffe5be5df69b79`, runner sha256 `845e11ad0d88df298166db81b3587d79edf402bbd31d6088d2743e7c728a8075`, aggregate `/workspace/Reference/benchmarks/m8-production/aggregate-r8-r10.json` sha256 `3a1dbea06117e6ae9cc555ffe91dee749eb1a1ea345866f25f5bf6bb0dc47c7a`. Full-repo porcelain acceptance allows exactly `packages/core/src/ripgrep.ts`; the target regression test is hash-bound unchanged; only canonical OpenCode-generated `.opencode/*` runtime paths are ignored.
- exact retained current product `8f6b19098b1db0a739bb97f82537fcdc45896278` is 3/3 VERIFIED_SUCCESS and 3/3 strict Hi settlement on final production r8/r9/r10. Current means: wall `103.63s` (range `72.73–121.56s`), input `114.50k`, output `3.13k`, model calls `11.33`, tool calls `12.67`, OpenCode-derived cost `$0.0290923`; all three external acceptance checks pass with unchanged test and exact one-file production diff.
- reproducible pre-reset Hi `e8c1a7d` is 0/3 strict success but 3/3 external acceptance on the same production task: all three correct implementations stop with `o-analysis` still open; r8 additionally leaves `hi-debugging-root-cause`, r10 leaves `hi-debugging-root-cause` plus `hi-regression-review`. This is repeated control-plane settlement failure, not implementation/test failure.
- vanilla OpenCode 1.18.18 is 3/3 external VERIFIED_SUCCESS on the exact task. Means: wall `42.08s`, input `15.23k`, output `0.85k`, model calls `7.0`, tool calls `6.33`, OpenCode-derived cost `$0.0051614`. Current is therefore ~`2.46x` vanilla wall, ~`7.52x` input, ~`1.62x` model calls, `2.0x` tool calls and ~`5.64x` OpenCode-derived cost on this production fixture. **No general Hi-over-vanilla efficiency claim is supported.**
- the production task exposed and drove three scoped runtime fixes rather than harness bypasses: `bf20eac` makes direct completion state truthful and suppresses clear DIRECT over-debugging; `2da7d7a` rejects incoherent single-target `multi-file + sequential` semantics while preserving real sequential/ambiguous work; `8f6b190` suppresses debugging signals not backed by diagnosis capability while retaining real `repository-analysis` debugging.
- benchmark-plan Architecture-ablation coverage was mechanically searched before rerun; the five requested fields lacked final M8 comparative receipts, so one minimum deterministic synthetic policy-ablation fixture was run against exact `8f6b190`. Aggregate `/workspace/Reference/benchmarks/m8-architecture-ablations/aggregate.json` sha256 `53786945dd0fcba8cf2d396b06489e9761cae2d9cbf4a35d9f32592ab96de460`; all five POLICY_ABLATION receipts validate under the exact `42c1cd6` comparative contract.
- **direct-vs-graph RETAIN adaptive DIRECT:** clear local independent work selects DIRECT; forced-graph comparator adds at least one child dispatch/context boundary. Receipt sha256 `b754016f8bd98b85ad2705321ed56ffaaf17d836b104876edce3b1e8603cf6d0`. Structural ablation only; no wall/provider-cost claim.
- **semantic no-progress governor RETAIN:** semantic comparator has 0 false positives / 0 false negatives and preserves 2/2 recovery events; naive state-change ablation has 2 false-progress positives. Receipt sha256 `0be749c6ca64e0bbb1083e45773a56e132aa32d516938ced4b34cbd8e84c3f9c`.
- **empirical model feedback RETAIN:** identical deterministic inventory selects heuristic `p/model-a` without feedback and medium-confidence empirical `p/model-b` after four A failures/four B successes. Receipt sha256 `070980dd874073da4c68e86fbef5a69f46a252ee21a89f1c88290193c5d0a24a`; this is routing-policy evidence, not live provider superiority.
- **skill shortlist/lazy exposure RETAIN:** exact 27-entry built-in catalog is 13777 metadata / 36437 SKILL-body bytes; two-methodology shortlist is 1013 / 2765 bytes, reductions `92.65%` and `92.41%`. Receipt sha256 `9d19276c8ed04d9e00d5a32d7600f9d13fed06ca96ee1404ac5df2b50e72a1da`.
- **fresh reviewer default RETAIN:** exact child-creation seam has no implementation-session fork for fresh review; contaminated comparator explicitly forks `implementation-session`. Synthetic contamination oracle finds the seeded defect only fresh, but this is not a measured LLM defect-detection rate. Receipt sha256 `79127c8a9ba193be9fac3b581b9900634ca507b14891e7823c973bbb4116b2d5`.
- final isolated retained-product verification at `/workspace/Reference/benchmarks/opencode-hi-8f6b190`: plugin build PASS, architecture lint PASS, full node/plugin suite `934/934 PASS`; `plugin/dist/plugin.js` sha256 `66980d0546f69c9b32a045291fa9601289dcc31422ab8a6c493b94c702689bea`, comparative contract sha256 `0ede93af9fff359ac1f071c71a2abd19587c59f7a420d0bcf4a544e4d7cbc009`.
- broader root validation is intentionally not green-washed: `docs:check` still expects 8 owner files removed/thinned in prior scope-down, and git-archive `check:evidence` cannot satisfy ancestry checks while committed validation records also contain pre-existing drift/removed-owner references. The user explicitly prohibited unrelated validation/release/script work, so those surfaces remain untouched. Required M8 product verification is green.
- final decision/archive is `agent-archive/2026-08-18-m8-final-comparative-benchmark.md`. Milestone 8 is complete; `ROADMAP.md` defines no M9.

## Exact Next Action

No authorized roadmap milestone remains. Preserve the completed M8 evidence and retained product state. Wait for a new explicit user objective; do not infer release/publication, broad documentation certification, or new research work from the completed roadmap.
