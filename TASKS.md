# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — PHASE 2 / MILESTONE 11
**Updated:** 2026-08-18
**Global authority:** `/workspace/PROTOCOL.md`
**Legacy project-policy layer:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`
**Phase 2 design:** `/workspace/OpenCode-Hi/docs/PHASE2-SEMANTIC-AUTOPILOT.md`

## Active Task

### M11 — Adaptive Decomposition, Model & Review Intelligence

Choose zero/one/many workers and light/heavy model classes from expected completion value rather than ceremony. WorkGraph/ExecutionUnit semantics precede exact model choice; empirical routing may override priors only from exact requested/effective-model evidence.

## Completed Phase 2 Checkpoint — M10

M10 is complete; archive: `agent-archive/2026-08-18-m10-provider-surface-frugality.md`.

Final M10 evidence:
- retained common frugality/correctness fixes: bounded semantic target normalization, syntax-driven explicit verifier ownership, minimum-sufficient parent verification admission, current-diff reconciliation for reverted transient mutations, minimum-sufficient analysis obligations, fresh post-mutation claim-linked DIRECT completion, and terminal-overrun guards;
- browser-unavailable primary schema gating reduced the static parent surface `31 -> 23` tools and `7839 -> 6451` proxy chars (`-17.71%`) but was mechanically **REJECTED** because repeated task economics regressed;
- V12 repeated real-host DeepSeek V4 Flash comparison: both arms `3/3 VERIFIED_SUCCESS`; candidate vs common mean wall `+10.26%`, model calls `+16.67%`, tool calls `+12.20%`, input tokens `+36.41%`, output tokens `+10.64%`, OpenCode-derived cost `+31.87%`; first-step input alone improved `-3.46%`;
- final aggregate: `/workspace/Reference/phase2-autopilot/m10-browser-realhost-v12-aggregate.json`, SHA-256 `d021e26dbdd650a0dbd373faf751619ee9a88f0d811ee2d05f5eb125f7ffced2`;
- final retained manifest: `/workspace/Reference/phase2-autopilot/m10-v12-retained-final-manifest.json`, SHA-256 `da47dac4d827165dfce892a7e1030733ae969f4f422dc523567c13919ccc84fe`;
- exact retained-product isolated verification: build PASS, architecture lint `22/22 PASS`, plugin suite `965/965 PASS`; log SHA-256 `e0272adeac774245e40aa6b9f6643630c9eb017a60648a56bd8617c7c0443404`.

All monetary M10 values above are **OpenCode-derived**, not provider-billed cost.

## M11 User-Override Model / Quota Planning Matrix

Use exact OpenCode config IDs `opencode-go/<model-id>`. The user override below is the project routing/test planning authority for M11 unless explicitly superseded. Current model presence was revalidated on 2026-08-18 against `https://opencode.ai/zen/go/v1/models`.

| Model | Exact ID | 5h planning requests | weekly | monthly | Initial M11 role prior |
| --- | --- | ---: | ---: | ---: | --- |
| MiMo-V2.5 | `opencode-go/mimo-v2.5` | 30,100 | 75,200 | 150,400 | **Primary test engine + fast dispatcher**; default unit/regression/CI/benchmark controller, DIRECT execution, initial intent filtering |
| DeepSeek V4 Flash | `opencode-go/deepseek-v4-flash` | 7,600 | 18,900 | 37,800 | agile coder + tool/PTY specialist + routine worker |
| Qwen3.7 Plus | `opencode-go/qwen3.7-plus` | 4,300 | 10,800 | 21,600 | WorkGraph planner + dependency architect |
| Hy3 | `opencode-go/hy3` | 4,300 | 10,750 | 21,500 | verifier + browser/tool supervisor + context summarization |
| MiniMax M2.7 | `opencode-go/minimax-m2.7` | 3,400 | 8,500 | 17,000 | synthesis + documentation + semantic recovery |
| Qwen3.6 Plus | `opencode-go/qwen3.6-plus` | 3,300 | 8,200 | 16,300 | adversarial tester + edge-case/coexistence validator |
| MiMo-V2.5-Pro | `opencode-go/mimo-v2.5-pro` | 3,250 | 8,150 | 16,300 | principal fresh reviewer + critical replan/recovery/final assurance |

OpenCode currently documents Go enforcement as dollar usage (`$12 / 5h`, `$30 / week`, `$60 / month`) and describes request counts as estimates that may change. Therefore the table above is a **user-authoritative Hi planning matrix**, not a claim of literal provider request counters or current remaining quota. Server-side remaining quota stays `UNKNOWN` unless mechanically observed.

## M11 Routing Rules

- Strict cost frugality: use `opencode-go/mimo-v2.5` first for test execution/control, routine DIRECT work and benchmark orchestration unless the experiment specifically measures another exact model.
- Role-based defaults: dispatcher/test engine MiMo-V2.5; planner Qwen3.7 Plus; coder DeepSeek V4 Flash; verifier/browser Hy3; synthesis MiniMax M2.7; adversarial validator Qwen3.6 Plus; principal reviewer MiMo-V2.5-Pro.
- Protect narrow/high-cost tiers from routine test load; escalation requires a named semantic/evidence/failure delta.
- Collect latency, input/output/cache/reasoning tokens, tool/model calls, verified success, recovery/stagnation and exact requested/effective model attribution. Feed only bounded, reversible observations into empirical routing confidence.
- Fallback is staged rather than blind: MiMo first for routine work; escalate only after classified failure/stagnation/assurance need. A requested model switch is not evidence of an effective model switch.
- Do not mix a model change into a non-model ablation; exact comparator provenance must keep all other variables fixed.

## Acceptance Criteria

- repeated fixtures demonstrate lower unnecessary worker/model overhead without covered-task correctness regression;
- decomposition never creates overlapping uncontrolled writers or ambiguous fan-in;
- empirical routing covers the declared seven-model role priors with exact requested/effective attribution;
- fresh reviewers are used only when material independence/assurance benefit exists;
- model escalation is bounded and justified by semantic/evidence/failure delta;
- no provider remaining quota or provider-billed cost is fabricated from local estimates.

## Required Verification

- deterministic decomposition/routing/reviewer contract tests;
- architecture lint for any new routing/ownership boundary;
- exact isolated full plugin suite for retained product changes;
- repeated real-host model/decomposition comparisons with hash-bound fixtures, exact requested/effective model attribution and failure repetitions preserved.

## Exact Next Action

Mechanically characterize the current M11 routing/decomposition implementation and the retained M8 empirical-routing ablation. Verify the live OpenCode Go inventory contains the seven override models. Then define a hash-bound M11 benchmark contract in which MiMo-V2.5 is the default test/dispatcher engine, role-model changes are the explicit independent variable, and requested/effective model plus task-level correctness/economics are recorded before retaining any routing change.
