# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — PHASE 2 / MILESTONE 15
**Updated:** 2026-08-19
**Global authority:** `/workspace/PROTOCOL.md`
**Project policy:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`

## Active Task

### M15 — Broad Production Corpus + Final Phase 2 Cutovers

M14 is complete. Archive: `agent-archive/2026-08-19-m14-closed-loop-runtime-engineering.md`. M15 has retained the TDD-authority correction plus diagnosis-only semantic and parser-diagnostic cutovers. Current final Phase 2 product is `18c9d4501598930d2ec50af224a52b29ee6fe6f9`; exact immutable-image verification is build PASS, architecture lint `22/22 PASS`, focused diagnosis/parser regression PASS, plugin suite `1029/1029 PASS`. Checkpoints: `agent-archive/2026-08-19-m15-tdd-authority-correction.md` and `agent-archive/2026-08-19-m15-diagnosis-and-git-install-compatibility.md`.

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

- Current final Phase 2 product: `18c9d4501598930d2ec50af224a52b29ee6fe6f9`. Exact immutable image: build PASS, architecture `22/22 PASS`, focused diagnosis/parser contract PASS, full plugin suite `1029/1029 PASS`.
- Localized real-production corpus remains complete: vanilla `3/3 VERIFIED_SUCCESS`, retained Phase 1 `8f6b190` `3/3 VERIFIED_SUCCESS`, Phase 2 ancestor `e0f7d91` `3/3 VERIFIED_SUCCESS`. Aggregate: `/workspace/Reference/phase2-autopilot/m15-localized-production-triad-aggregate.json`, SHA-256 `b9c6410ce028d043def55df478d215e272297af44540ed5a6657db71719b4f6d`. Later M15 cutovers do not touch that production-fix execution surface; do not relabel the ancestor receipts as final-product runs.
- Diagnosis/context corpus exposed a real settlement defect. Pre-diagnosis final `e0f7d91` had external diagnosis acceptance `3/3 PASS` but strict Hi `0/3`; first diagnosis cutover `0b48d11` improved to strict `2/3`, with the remaining failure caused by a generic closed-enum error making the model abandon valid `task_kind=diagnosis`. `18c9d45` retains field-scoped parser diagnostics without widening accepted enums. Final real-host rerun is complete: `18c9d45` is `3/3 VERIFIED_SUCCESS`, external diagnosis acceptance `3/3 PASS`, strict Hi settlement `3/3 PASS`. Final aggregate: `/workspace/Reference/phase2-autopilot/m15-diagnosis-context-18c9d45-aggregate.json`, SHA-256 `090b584c30d89481affc06f2d06f72056802e94822e82718b01b5ea59a67a5f3`.
- Final `18c9d45` deterministic component replay preserves context-heavy, authority, provider-recovery, restart-stale and coexistence acceptance against retained Phase 1. Aggregate: `/workspace/Reference/phase2-autopilot/m15-component-replays-18c9d45/aggregate.json`, SHA-256 `d6785aa1a8d18e38e453befe2a459a9eb8704a89fbce52c1795b300ee6000da1`.
- Final `18c9d45` real-host integration preservation: browser backend `3/3 PASS`, workspace reintegration `3/3 PASS`, MCP scope v2 `3/3 PASS`. Aggregate: `/workspace/Reference/phase2-autopilot/m15-final-integration-18c9d45-aggregate.json`, SHA-256 `234c28026ab8b86d67420e61bfdee4e3742273c01ccf3ecc06245574f1e041ac`.
- Git-source package spec is mechanically valid as `opencode-hi@git+https://github.com/huseyincig/OpenCode-Hi.git`: direct npm and Bun Git-dependency installs PASS and contain `plugin/dist/plugin.js`. Exact OpenCode `1.18.18` native Git-plugin loading/install does **not** pass: direct config resolves the GitHub source but exposes no Hi tools, and `opencode plugin <spec>` fails `git dep preparation failed`; removing root `prepack` in an isolated source probe does not change that failure. Compatibility receipt: `/workspace/Reference/git-plugin-compatibility-opencode-1.18.18.json`, SHA-256 `32d9a98ebc4dbfee00f4a55b717aa513111b4b00da1b08f4dcb63921f080bbd5`. Treat the Git config form as a target UX for host versions with exact-host PASS, not supported truth for `1.18.18`.
- Public `origin/main` remains behind local M15 development and must not be described as containing `18c9d45` until an explicitly authorized push occurs.
- Coverage/provenance matrix v4: `/workspace/Reference/phase2-autopilot/m15-corpus-coverage-v4.json`, SHA-256 `ed9c5e7483ce2fe84116f4737d3c1ecc6a23cbcf251def9747cdabf59bcd105f`. Diagnosis/context is complete; `multi-module-decomposition-fanin` is the sole remaining broad comparative gap.
- Active final broad batch: fan-in replay `job_02f741bb3d2c`, using only retained Phase1 `8f6b190` and final Phase2 `18c9d45` for 3 repetitions each; historical vanilla M8 fan-in is reused. Runner: `/workspace/Reference/phase2-autopilot/run_m15_fanin_final_18c9d45.py`, SHA-256 `8ecc9c9cad099b29dbdecd8a09f1efeff0d2eae2d125cc8bc6d1812b3fabcf21`. Do not duplicate this batch.

## Exact Next Action

Collect `job_02f741bb3d2c` only when its result is needed; do not start another model batch. Preserve every Phase1/final fan-in success/failure/timeout repetition, combine them with the existing historical vanilla M8 fan-in arm only where fixture/model/runtime/acceptance provenance remains comparable, and make the final M15 retain/revert decision from that matrix. Keep the OpenCode `1.18.18` Git-plugin resolver failure as an explicit host compatibility boundary; do not claim direct Git config support until exact-host PASS exists. No push/tag/release/npm publish without explicit current authority.
