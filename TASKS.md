# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — PHASE 2 / MILESTONE 10
**Updated:** 2026-08-18
**Global authority:** `/workspace/PROTOCOL.md`
**Legacy project-policy layer:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`
**Phase 2 design:** `/workspace/OpenCode-Hi/docs/PHASE2-SEMANTIC-AUTOPILOT.md`
**Phase 2 research:** `/workspace/Reference/phase2-autopilot/research-2026-08-18.md`

## Active Task

### M10 — Dynamic Provider-Visible Surface & Token Frugality

Reduce the current Phase 1 production input/cost overhead by measuring and then eliminating provider-visible orchestration that does not earn task-level value. Do not repeat the rejected M8 blanket primary-tool cutover.

## Completed Phase 2 Checkpoint

M9 is complete; archive: `agent-archive/2026-08-18-m9-semantic-decision-kernel.md`.

M9 evidence:
- pure typed `SemanticDecisionEnvelope` integrated without another model/tool/host call or durable state owner;
- semantic entry gate `2666 -> 1866` chars (`30.01%` reduction);
- focused decision/transform tests `29/29 PASS`;
- exact retained-product overlay build PASS + architecture lint `22/22 PASS` + full plugin/node suite `942/942 PASS`.

## M10 Baseline / Constraints

- M8 final production current Hi remained ~2.46× vanilla wall, ~7.52× input and ~5.64× OpenCode-derived cost.
- The prior static primary Hi-tool visibility cutover reduced schema size but regressed repeated end-to-end wall/input/output/model/tool/cost metrics, so it remains rejected.
- Child execution already supports native per-prompt tool overrides; current OpenCode primary `chat.message` does not expose an equivalent general per-turn tool-set override in the currently observed dev hook surface.
- Current OpenCode documentation warns that MCP tool definitions consume model context; MCP/browser surfaces must be on-demand.
- Preserve Phase 1 settlement/evidence/authority/recovery invariants and the M9 decision envelope.
- Preserve all unrelated pre-existing dirty files, especially user-owned `plugin/src/runtime/routing/execution-mode.ts`, related tests, generated dist, validation/release/script state.
- Use per-command `git -c safe.directory=/workspace/OpenCode-Hi`; do not mutate global Git config.

## Acceptance Criteria

- provider-visible overhead is decomposed into separately measurable components before a new cutover;
- measurement distinguishes system text, tool-schema surface, mission runtime projection, child handoff/context and repeated result/tool payloads;
- any optimization retained in product code has an ablation showing lower relevant overhead with no deterministic correctness regression;
- no claimed provider cost is inferred from OpenCode-derived/heuristic cost;
- no extra model/tool call is introduced merely to optimize context;
- primary static tool removal is not reintroduced without repeated real-host task-level benefit.

## Required Verification

- deterministic surface/accounting tests;
- focused affected runtime tests;
- architecture lint for changed ownership boundaries;
- exact retained-product isolated full suite after a retained M10 cutover;
- repeated real-host comparison for any change expected to affect provider-visible task economics.

## Exact Next Action

Build a read-only provider-surface measurement harness against the exact retained product and M9 overlay. Quantify semantic gate/system projection, registered Hi tool schema surface, role/task child tool surfaces, bounded runtime projection and worker handoff payloads. Use those measurements to choose the first M10 optimization; do not modify primary tool visibility before the measurement identifies the dominant repeated cost.
