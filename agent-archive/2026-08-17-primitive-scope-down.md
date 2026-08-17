# Milestone 7 — Primitive Scope-Down

**Completed:** 2026-08-17
**Checkpoint:** commit containing this record (`architecture: scope down duplicated runtime primitives`)

## Result

The reset removed or thinned six primitive classes that duplicated OpenCode/native/ecosystem ownership while retaining only Hi-specific orchestration semantics.

| Candidate | Decision | Removed / thinned | Retained Hi semantic |
|---|---|---|---|
| Model quirks / duplicate model metadata | **REMOVE** | model-name regex folklore, `ModelQuirkHints`, quirk profile field, handoff injection | OpenCode/models.dev/live model facts + bounded current-mission empirical model feedback |
| TeamRuntime | **REMOVE** | `TeamRuntime`, `TeamContract`, `hi_team_*` tools, active `teamMode` config/state owner | WorkGraph/scheduler parallel topology; legacy persisted `execution_mode: team` is compatibility-normalized to `parallel` only |
| Generic ProjectIntelligence memory | **REMOVE** | generic fact contract/store/retrieval, task prompt injection, storage owner | evidence-backed bounded ProjectMethodologyLearning candidate/provenance/admission only |
| Generic context governor / compression / memory stub | **REMOVE** | generic governor, CompressionArtifact substrate, disabled memory-provider placeholder | bounded Hi mission-survival projection, ContextReference protection/budget semantics, semantic repo context and durable task artifacts |
| Skill loader/catalog | **THIN / NATIVE-OWNED** | generic discovery/index/cache, body/resource reader and recursive resource index | bounded methodology shortlist/admission plus exact requested-name availability/shadow/path-integrity preflight; OpenCode owns native discovery, permission and lazy loading |
| Browser runtime | **ADAPTER-ONLY** | pass-through `BrowserRuntime` wrapper | backend-neutral BrowserExecutor port, task ownership/local-target safety, observation/evidence/artifact policy; Playwright remains an OpenCode boundary adapter while no merged native equivalent is verified |

## Measured simplification

Scoped non-generated M7 diff at completion:

- **67 changed files**;
- **17 files deleted**;
- **177 insertions / 1201 deletions**;
- **net −1024 lines** across source/tests/config/validation/lint metadata;
- removed-primitive source re-scan returned no production hits for TeamRuntime/TeamContract/hi_team_/teamMode, ProjectIntelligenceStore, generic context governor/CompressionArtifact/memory provider, model quirks, BrowserRuntime, SkillCatalogIndex/discoverSkills/resource-reader primitives.

The test-count reduction from the pre-M7 932 suite to 893 is attributable to deletion of obsolete duplicate-primitive tests, not ignored failures. The retained full suite passed 893/893.

## Compatibility decisions

### Team state

New runtime no longer produces `execution_mode: team`. The persisted enum remains temporarily readable for schema compatibility. Restore/routing/topology normalize legacy `team` to scheduler-owned `parallel` and record `execution-mode.compatibility-normalized`.

### Skills

Hi no longer attempts to know every installed skill. It checks only methodology names already selected by Hi policy. A same-name foreign/native shadow or symlink/path escape fails the Hi methodology preflight closed. Arbitrary non-Hi skills remain OpenCode-owned and usable through the host.

### Context

Hi still owns the minimum mission-survival projection needed for deterministic restart/continuation semantics. It no longer presents this as a generic context/memory optimization engine. Task-specific ContextReference selection, freshness/protection/budget and semantic source extraction remain control-plane inputs.

### Project learning

Generic persisted fact memory was removed because production had no writer and only prompt-side retrieval consumers. ProjectMethodologyLearning remains because it has an explicit orchestration-specific lifecycle: repeated evidence -> bounded candidate -> hash/provenance validation -> READY/admission -> native methodology exposure.

### Browser

No current merged OpenCode-native browser engine was verified during this milestone. Browser execution therefore remains behind `BrowserExecutor`, with Playwright as a replaceable OpenCode adapter rather than a Hi core engine. If OpenCode later ships a sufficient native browser executor, this port is the cutover seam.

## Current source basis

Primary sources checked during M7:

- OpenCode current dev model/provider/catalog code and models.dev metadata: https://github.com/anomalyco/opencode and https://github.com/anomalyco/models.dev
- OpenCode native skill discovery/tool/permission code: https://github.com/anomalyco/opencode/tree/dev/packages/opencode/src/skill and related native skill tool/config sources
- OpenCode browser state / proposal evidence and app development guidance: https://github.com/anomalyco/opencode

The architecture decision is based on current upstream source plus actual Hi runtime ownership/callers/tests, not on repository popularity or feature-count parity.

## Threat / architecture proof migration

- Q3 skill path traversal proof now targets requested methodology same-name symlink confinement rather than a removed generic resource reader.
- Q3 project-intelligence poisoning proof now targets retained methodology-learning READY/repeated-evidence/hash-provenance admission rather than the removed generic fact store.
- architecture lint no longer requires deleted TeamContract/TeamRuntime proof files and uses the current 26-option active runtime config surface.

## Verification

- model metadata scope-down focused: **24/24 PASS**
- TeamRuntime cutover focused: **33/33 PASS**
- generic ProjectIntelligence removal focused: **42/42 PASS**
- context/memory scope-down focused: **36/36 PASS**
- skill native-ownership cutover focused: **47/47 PASS**
- browser adapter-focused behavior: PASS; stale ownership wording was migrated to the backend-neutral port contract
- architecture lint: **22/22 PASS**
- final full plugin suite: **893/893 PASS**, 0 fail, 0 cancelled
- scoped `git diff --check`: PASS

## Deliberately retained layers

The following are not generic duplicate primitives and remain intentionally:

- WorkGraph / deterministic scheduler / exact attempts;
- claim-linked evidence and completion adjudication;
- semantic progress and recovery governor;
- mission authority and external-effect fencing;
- ContextReference + mission survival + semantic task context;
- ProjectMethodologyLearning with bounded provenance;
- requested-methodology admission/shadow preflight;
- BrowserExecutor ownership/evidence port;
- empirical current-mission model feedback;
- OpenCode composition/capability adapters.
