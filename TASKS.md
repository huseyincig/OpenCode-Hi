# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — PHASE 2 / MILESTONE 15
**Updated:** 2026-08-19
**Global authority:** `/workspace/PROTOCOL.md`
**Project policy:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`

## Active Task

### M15 — Broad Production Corpus + Final Phase 2 Cutovers

M14 is complete. Archive: `agent-archive/2026-08-19-m14-closed-loop-runtime-engineering.md`. M14 final product was `96267ce857eec53ae31d8549cd52c5eff7d88bf9`. M15 corpus exposed and retained one semantic-authority correction; current final Phase 2 product is `e0f7d9118bfe729e35520ec01c5ac8ac41e424c8`, exact immutable-image verification build PASS, architecture lint `22/22 PASS`, focused authority regression `5/5 PASS`, plugin suite `1020/1020 PASS`. Checkpoint: `agent-archive/2026-08-19-m15-tdd-authority-correction.md`.

M15 must decide whether retained Phase 2 semantics improve deterministic correctness/predictability or measured execution efficiency across a broader comparable real-work corpus. It must not convert narrow fixture wins into a general Hi-superiority claim.

## M15 Corpus Scope

At minimum cover or explicitly account for:
- localized production fix;
- diagnosis/root-cause work;
- multi-module/decomposition/fan-in work;
- security/authority-sensitive work;
- context-heavy investigation;
- browser/UI verification/correction;
- provider/model/runtime recovery;
- capability/isolation decisions.

## Comparison Rules

- compare vanilla OpenCode, retained Phase 1 Hi and final Phase 2 Hi only where task/model/provider/runtime/config provenance is materially comparable;
- reuse existing exact M8/M10–M14 receipts when they already satisfy the same provenance and acceptance contract; do not rerun expensive model episodes merely to recreate evidence;
- when a required corpus cell is missing or incomparable, create the smallest new repeated isolated episode that closes that cell;
- correctness/settlement remains primary; economics are interpreted only after correctness comparability;
- OpenCode-derived monetary values are never called provider-billed cost;
- preserve raw variance and failed/blocked episodes rather than trimming inconvenient runs;
- external OMO/Swarm/Ensemble comparison is optional and only valid for reproducibly equivalent scenarios.

## Final Retain Rule

Retain a Phase 2 subsystem only when it improves deterministic correctness/predictability or measured execution efficiency on its relevant task class. Revert or narrow any subsystem that fails its relevant corpus evidence. No general superiority claim from a narrow corpus.

## Required Verification

- hash-bound system/model/config/fixture identity for every newly executed episode;
- repeated runs for probabilistic/model-driven comparisons;
- deterministic acceptance independent of model prose;
- exact requested/selected/effective model attribution where model routing matters;
- architecture lint + exact isolated full plugin suite after any retained final M15 product cutover;
- preserve unrelated dirty validation/release/script/routing/test files.

## Current Mechanical Evidence

- Final Phase 2 product remains `e0f7d9118bfe729e35520ec01c5ac8ac41e424c8`; exact product verification remains build PASS, architecture `22/22 PASS`, M15 authority regression `5/5 PASS`, full plugin suite `1020/1020 PASS`.
- Localized real-production corpus is complete: vanilla `3/3 VERIFIED_SUCCESS`, retained Phase 1 `8f6b190` `3/3 VERIFIED_SUCCESS`, final Phase 2 `e0f7d91` `3/3 VERIFIED_SUCCESS`. Aggregate: `/workspace/Reference/phase2-autopilot/m15-localized-production-triad-aggregate.json`, SHA-256 `b9c6410ce028d043def55df478d215e272297af44540ed5a6657db71719b4f6d`. This cell proves correctness parity only; no general superiority claim.
- Final `e0f7d91` deterministic component replay preserves context-heavy, authority, provider-recovery, restart-stale and coexistence acceptance against retained Phase 1. Aggregate SHA-256 `4aa00988e3ea7e90d2da2d492c82812fb773bbdb2ddc938cbe83e96d4421196d`.
- Final `e0f7d91` real-host integration replay: workspace reintegration `3/3 PASS` (aggregate SHA-256 `3ae4de372070dd43eb42b26eec8f4e2b1c95392a3c5086279308ae704c495b1e`), browser backend `3/3 PASS` (aggregate SHA-256 `dc19782f834ac7a23488a40ec3d52969af17f8b8398c6994426cbaf5d26106f4`), MCP scope v2 `3/3 PASS` (aggregate SHA-256 `d715ed319942673c51bab6e6a885894b6050483fd37203371fc47ef92de18a7a`). The older immediate-read MCP v1 failure receipt is retained as a harness-observation race; no product change was made.
- Coverage/provenance matrix v3: `/workspace/Reference/phase2-autopilot/m15-corpus-coverage-v3.json`, SHA-256 `365859214da6fa3d84ab33b2610a5a518b1e6d7c67f8270b6228f5705c433fdd`.
- Active broad model batch: combined diagnosis/root-cause + context-heavy investigation, three repetitions each across vanilla / retained Phase 1 / final Phase 2, using pinned OpenCode `1.18.18`, `opencode-go/deepseek-v4-flash`, variant `low`, deterministic structured diagnosis acceptance. Background job `job_d87a7a0d27b9`; do not duplicate or rerun while its artefacts/job result exist.

## Exact Next Action

Collect the existing `job_d87a7a0d27b9` diagnosis/context result when needed; do not poll or launch a duplicate. Preserve every success/failure/timeout repetition. If the batch is complete, build one hash-bound aggregate and update the M15 coverage matrix. Only then decide whether the remaining `multi-module-decomposition-fanin` broad gap justifies the already-prepared `/workspace/Reference/phase2-autopilot/run_m15_fanin_final.py` replay. Do not start fan-in before the diagnosis/context result is evaluated.
