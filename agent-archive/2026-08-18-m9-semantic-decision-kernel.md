# M9 — Semantic Decision Kernel + Entry Frugality

Completed: 2026-08-18

## Result

Phase 2 is active. M9 introduced one pure typed semantic decision composition over the retained Phase 1 policies and reduced the unavoidable semantic-assessment entry projection without adding another inference/tool turn or another durable state owner.

## Changed product semantics

- `plugin/src/runtime/decision/semantic-decision.ts` composes adaptive path, topology, minimum-team, model class/category, review assurance, capability intent, provider-surface phase and mission-level isolation candidacy.
- Mission-level isolation can only be `NONE` or `CANDIDATE`; exact Task ownership remains required before native workspace provisioning.
- Exact model/provider/tool/backend availability is not fabricated by the envelope and remains downstream runtime/adapter truth.
- MissionStore consumes the envelope but persists only the already-canonical Phase 1 execution fields; bounded `semantic.decision` ledger events provide explainability.
- `plugin/src/runtime/intent/semantic-assessment-gate.ts` replaces the former inlined verbose system gate with a phase-aware compact projection.
- The 26-entry intent methodology catalog is no longer front-loaded into every semantic gate. `intent_signals` defaults empty and only explicit methodology intent should emit an intuitive exact `intent.<slug>`; parser-side validation remains closed and runtime/surface signals may activate methodologies later.

## Mechanical evidence

Canonical pre-change Phase 1 retained-product semantic gate: `3247` chars.

An earlier `2666` measurement came from the dirty working-tree dist and is discarded as product provenance; it is not used for the product claim.

Final M9 gate: `1866` chars.

Reduction: `42.53%`.

Focused semantic/transform set: `29/29 PASS`.

Exact Phase 1 retained-product overlay (`/workspace/Reference/benchmarks/opencode-hi-8f6b190` + M9 changed source/test files):

- plugin build: PASS
- architecture lint: `22/22 PASS`
- full plugin/node suite: `942/942 PASS`

The full verification ran outside the dirty product working tree under `/tmp/opencode-hi-m9-check`, because the project build deletes/regenerates `plugin/dist` and the user's working tree already owns unrelated dirty dist/source/test/validation files.

## Research basis

Current targeted Phase 2 research is recorded in:

`/workspace/Reference/phase2-autopilot/research-2026-08-18.md`

SHA256 at M9 completion:

`2b226e202fe801c4f1377653b68ed60d7d41e04fbdea666cd732072cae237a3c`

Current observed external heads used for M9/M10 direction:

- OpenCode dev `4e81a0b73f6e614afebf9c7ff8862904a3674455`
- OMO dev `2add2fd5748b0f3ddf69bc655c5e65dd62364257`
- Swarm main `0ba1fd7958a7d31c8dda387d33246928cd380ec5`

OMO's split-first/cheap-first change is retained only as an M11 benchmark hypothesis. Current Microsoft Playwright guidance supports a later browser backend policy that prefers CLI/skills for token-sensitive coding-agent interactions and MCP for persistent specialized loops; Hi will own selection/supervision rather than a browser engine.

## Next milestone

M10 — Dynamic Provider-Visible Surface & Token Frugality.

The first M10 action is measurement, not another static cutover: decompose provider-visible overhead into semantic/system projection, Hi tool schemas, child tool schemas, runtime projection, handoff/context and repeated result payloads; then optimize only components whose repeated end-to-end ablation improves task economics without correctness regression.
