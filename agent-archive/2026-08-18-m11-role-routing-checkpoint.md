# M11 Checkpoint — OpenCode Go Role Routing Priors

**Date:** 2026-08-18
**Parent commit:** `e22e79b7783c80d2960bd5d819859951014258a2`
**Milestone:** M11 remains ACTIVE.

## Retained decision

Retain the first M11 role-routing cutover for **correctness/predictability**, not as a general cost-efficiency claim:

- canonical in-memory OpenCode Go role priors when no explicit project role mapping exists;
- no silent project routing-policy persistence;
- explicit user/fixed project model authority remains above empirical routing;
- sparse feedback does not change the configured/default role order;
- confidence-admitted bounded feedback may rerank only candidates already inside the configured/default role prior set;
- default strategy becomes `cost-quality`;
- current user override makes MiMo-V2.5 the default test/controller/dispatcher prior and DeepSeek V4 Flash the coder primary prior.

## Common correctness fixes discovered by the benchmark

The routing benchmark exposed two control-plane defects that are retained independently in both benchmark arms:

1. Existing targeted-test/spec paths are verifier-only material unless explicit `intent.tdd` makes them implementation targets. Incoherent `local + sequential`, or `multi-file + sequential` with one actual material target, is canonicalized to one local independent work unit without another model turn. Genuine multi-target sequential work is preserved.
2. `tool-after` verification closure is claim-linked per obligation ID. Worker evidence linked only to implementation can no longer globally close a parent-owned verification claim. Parent executable verification closes only its exact open verification obligation.

## Mechanical benchmark

Final runner:
`/workspace/Reference/phase2-autopilot/run_m11_routing_compare_v5.py`
SHA-256 `f0440fb4aa125d180143a40b8f52a93c4956980db67cd67175282655e4e2aab1`

Aggregate:
`/workspace/Reference/phase2-autopilot/m11-routing-compare-v5-aggregate.json`
SHA-256 `4c72018e3cd07c15d1c1ca4e33a0de6b66c69a0a3ccd95f8f398ef8b04ad534b`

Retained manifest:
`/workspace/Reference/phase2-autopilot/m11-role-routing-v1-retained-manifest.json`
SHA-256 `80811c936f1bf8d2ed3bd0e4df8b003eb64a6fa33d0ce6a98d7e92139ffa518d`

Candidate image:
`/workspace/Reference/phase2-autopilot/opencode-hi-m11-routing-v8`
- architecture lint `22/22 PASS`
- plugin suite `974/974 PASS`
- check log SHA-256 `bfd14c847e79209870ec68cab717ede0ff2b531d97dc937fe7aaeb6a39e65e5d`

Comparator contract:
- parent is exact `opencode-go/mimo-v2.5` in both arms;
- one coder child owns only `src/value.js` and does not run the test;
- MiMo parent owns `node --test test/value.test.js` verification;
- no explicit child model, so default role routing is the independent variable;
- strict success requires external acceptance, exact one-file diff, clean mission settlement, exactly one completed/DONE task and worker, and requested/effective model identity agreement;
- all failure repetitions retained.

### Repeated result

Baseline retained-M10 routing + common M11 fixes:
- strict child settlement `2/3`;
- external acceptance `3/3`;
- effective child model `opencode/laguna-s-2.1-free` in all 3;
- r3 child made the correct edit but returned Markdown bullet `## WorkerResult` instead of canonical parseable structured result, so strict parser correctly marked task/worker FAILED.

M11 role-routing candidate:
- strict child settlement `3/3`;
- external acceptance `3/3`;
- effective coder model exact `opencode-go/deepseek-v4-flash` `3/3`;
- parent effective model exact `opencode-go/mimo-v2.5` `3/3`.

Candidate mean deltas vs baseline:
- wall `-12.61%`;
- input tokens `-7.50%`;
- model calls `+14.63%`;
- tool calls `+12.50%`;
- output tokens `+21.84%`;
- cache-read tokens `+53.98%`;
- reasoning tokens `-93.46%`;
- OpenCode-derived cost `+74.90%`.

The candidate is therefore retained because it improved strict contract adherence/predictability on this task class. It is **not** evidence of lower general cost. All monetary values are OpenCode-derived, not provider-billed.

## Model/runtime provenance

Pinned OpenCode runtime: `1.18.18`.
Authenticated runtime inventory and the current official model endpoint both confirmed the seven user-selected `opencode-go/*` model IDs were present on 2026-08-18.

The user's request-count matrix remains Hi planning/routing authority. OpenCode's current Go documentation describes actual limits in dollar-usage terms and request counts as estimates that may change; unobserved provider remaining quota remains `UNKNOWN`.

## Next M11 work

M11 remains open. Next coverage must include:
- primary role attribution for repository-explorer/MiMo, architect/Qwen3.7 Plus, QA reviewer/Hy3, security reviewer/MiMo-V2.5-Pro;
- controlled compatible fallback/alternate attribution for MiniMax M2.7 and Qwen3.6 Plus rather than inventing permanent roles;
- real-host empirical rerank/escalation evidence;
- zero/one/many decomposition economics and fan-in safety;
- fresh reviewer only when independence materially helps.

No push, tag, release, npm publish or deployment was performed.
