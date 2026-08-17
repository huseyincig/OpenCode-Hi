# OpenCode-Hi Active Task State

**Project:** `/workspace/OpenCode-Hi`
**Status:** ACTIVE — ROADMAP MILESTONE 7
**Updated:** 2026-08-17
**Global authority:** `/workspace/PROTOCOL.md`
**Legacy project-policy layer:** `/workspace/OpenCode-Hi/PROTOCOL.md`
**Roadmap:** `/workspace/OpenCode-Hi/ROADMAP.md`

## Active Task

### Milestone 7 — Primitive Scope-Down

Delete or thin machinery that duplicates stronger native/ecosystem capabilities, retaining only Hi-specific orchestration semantics with measured justification.

## Verified Baseline

Milestone 6 is complete; see `agent-archive/2026-08-17-host-plugin-composition-hardening.md`. Hi no longer owns host-global primary/depth configuration, V1 config mutation is isolated behind a composition adapter, V2/mixed shapes fail closed without V1 backfill, host/user permission restrictions are monotonic, external primaries/plugins/skills coexist, and transform collisions are observable/idempotent. Full plugin suite passed 932/932 with architecture lint 22/22.

## Scope

1. Inventory the current implementation/state/test surface for six candidate primitive classes: skill filesystem discovery/loading; generic context governor/compaction; project-intelligence memory; browser runtime; TeamRuntime; model quirks/duplicate model metadata.
2. For each candidate classify current code as `REMOVE`, `THIN`, `RETAIN-HI-SEMANTIC`, or `ADAPTER-ONLY` using current OpenCode/native/ecosystem capability evidence and existing product measurements/tests.
3. Skill path: prefer native inventory/loading; retain only shortlist/index/admission logic that measurably reduces prompt/context surface or enforces Hi methodology contracts.
4. Context path: remove generic memory/compaction behavior that duplicates host/external context systems; retain ExecutionUnit context selection/protection/budget semantics needed by Hi control decisions.
5. Project intelligence: retain only orchestration-specific empirical/procedure learning with bounded confidence/provenance; do not grow a generic memory product.
6. Browser: keep backend-neutral capability/verification semantics; remove any generic browser-engine ownership when Playwright/native/external execution can satisfy the host port.
7. TeamRuntime: absorb useful topology/role projection into WorkGraph/scheduler and remove separate durable/state ownership if no independently measured semantics remain.
8. Model quirks/catalog: remove factual folklore/duplicate metadata when live runtime or models.dev/OpenCode metadata exists; retain only bounded empirically observed behavior signals with provenance.

## Acceptance Criteria

- source/state surface is measurably simpler for every removed/thinned primitive;
- no covered behavior regression;
- retained layers each have a named Hi-specific semantic and direct test/benchmark justification;
- no second skill loader, generic memory product, generic browser engine, duplicate team scheduler or duplicate model catalog remains without evidence;
- native/external capability failures remain truthful and fail closed through adapters;
- full relevant plugin suite, TypeScript build and architecture lint pass after cutovers.

## Constraints

- Preserve unrelated user-owned dirty files exactly.
- Do not reset/clean the working tree.
- Do not touch release/publication validation artifacts.
- No push/tag/release/npm publication.
- Do not re-open broad ecosystem discovery; research only a candidate whose current ownership decision depends on changed/uncertain external capability.
- Do not delete functionality merely to reduce LOC; preserve Hi-owned semantics proven useful by tests/benchmarks.
- Keep host/API-specific behavior behind adapters; do not move OpenCode shapes into Hi Core.

## Required Verification

- before/after primitive ownership inventory with source/state/test counts;
- targeted parity tests for each cutover;
- architecture lint and TypeScript build after each meaningful deletion/thinning;
- full plugin suite after the milestone cutovers;
- scoped diff inspection and a short archive record naming every retained/deleted semantic.

## Exact Next Action

Mechanically inventory the six candidate primitive classes using current source, durable state contracts and tests. For each, list exact files, runtime/state owners, direct callers and behavioral proof tests. Compare against the existing upstream audit/ownership matrix and current host capability evidence. Produce a compact decision table before editing; then begin with the lowest-risk/highest-duplication candidate rather than performing a broad rewrite.
