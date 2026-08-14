# 08 — Machine Schema Catalog

Status: SCHEMA ARCHITECTURE V1 CANDIDATE — IMPLEMENTATION PENDING

## Purpose

Define the machine-readable schema architecture that will become the canonical validation layer for component contracts. This document does **not** claim the schemas are implemented yet. It fixes ownership, composition and validation rules before code generation begins.

## Schema principles

1. one schema owner per semantic component class;
2. strict objects by default (`additionalProperties: false` / equivalent) at Core contract boundaries;
3. explicit `extensions` namespace is the only generic extension escape hatch;
4. IDs and references are distinct types;
5. structural validation and semantic/referential validation are separate stages;
6. runtime snapshots use separate schemas from canonical catalog entries;
7. host projection schemas contain only host-valid fields;
8. unknown/uncertain model capability values are first-class, not parse failures;
9. Authority, Evidence and Safety constraints use closed discriminated unions;
10. schema success alone never proves executable behavior.

## Target schema modules

Suggested implementation location:

```text
plugin/src/contracts/
  common.ts
  role.ts
  permission-profile.ts
  methodology.ts
  model-capability.ts
  host-capability.ts
  config-option.ts
  task.ts
  worker.ts
  execution-plan.ts
  topology.ts
  team.ts
  recovery.ts
  worker-result.ts
  evidence.ts
  verification-envelope.ts
  review-finding.ts
  artifact.ts
  context.ts
  semantic-context.ts
  project-intelligence.ts
  human-decision.ts
  authority.ts
  external-action.ts
  provenance.ts
  storage-ownership.ts
  telemetry.ts
  adr.ts
  host/
    opencode-agent-projection.ts
```

Exact path may change by ADR, but semantic ownership must not collapse back into `mission/types.ts` merely for convenience.

## S00 — common primitives

Canonical shared value types:

```text
CanonicalId
SchemaVersion
ContractStatus
LifecycleClass: CANONICAL | DERIVED | CACHE | EPHEMERAL
StorageScope: PROJECT | GLOBAL | RUNTIME
Confidence: unknown | low | medium | high
CapabilityLevel: unknown | low | medium | high
TriStateCapability: unknown | false | true
Timestamp
ContentHash
SourceRef
```

IDs use language-neutral technical syntax validation only. Natural-language semantic routing is outside schemas.

## S01 — RoleContractSchema

Closed Core fields matching C01. Important constraints:

- `id` unique across Role Catalog;
- `role_class=primary` and `role_class=child` are explicit;
- all referenced permission/methodology/capability/model/output/input contracts resolve;
- completion/evidence/obligation authority are closed known classes;
- host projection requirements cannot contain arbitrary host frontmatter blobs in Core.

## S02 — PermissionProfileSchema

- rules are ordered/explicit;
- action enum `allow|ask|deny`;
- `may_be_widened_by_lower_layer` defaults false and cannot override constitutional safety classes;
- host adapter maps rules to native permission shape.

## S03 — MethodologyContractSchema

Migration source: current `data/hi-methodologies.json`.

Must preserve current 27-methodology semantic truth while adding normalized contract fields only through an explicit migration matrix.

Validation includes:

- canonical `hi-*` ID policy;
- max/compatibility composition metadata;
- role/capability references resolve;
- resource manifest cannot escape admitted methodology directory;
- behavioral acceptance refs required for admitted project-created methodologies after authoring workflow is implemented;
- selected/loaded state is **not** stored in catalog schema.

## S04 — ModelCapabilityProfileSchema

Uses explicit unknowns. Numeric values such as context capacity/cost may be nullable. Source/freshness/confidence required when nontrivial capability claims are made.

No role may hard-code a concrete model unless the RoleContract explicitly declares it as a requirement rather than an affinity.

## S05 — HostCapabilitySchema

Discriminated by `status`:

```text
SUPPORTED -> native_primitive + adapter_entrypoint + acceptance_ref required
DEGRADED -> fallback + semantic_loss + acceptance_ref required
UNSUPPORTED -> forbidden_fake_behavior required; native execution fields absent/null
```

This prevents `UNSUPPORTED` from accidentally carrying an executor-shaped configuration.

## S06 — ConfigOptionSchema

Runtime options require:

```text
runtime_consumer
executor_effect
safety_semantics
```

A documentary/setup-only value uses a different classification rather than fake runtime fields.

Referential linter flags every source code config property that lacks a catalog entry and every catalog runtime option with no production consumer.

## S07 — TaskSchema / S08 — WorkerStateSchema

Task is canonical mission work intent; WorkerState is runtime execution state. They are separate schemas.

Task stores selected refs/snapshots needed for reproducibility. WorkerState stores observed/effective execution identity and attempt/session lifecycle.


Current-only runtime validation is owned by canonical TaskContract/WorkerContract validators. Persistence consumes those validators rather than maintaining a second task/worker schema. Task mission identity and external-action requirements are explicit snapshots. Worker `attempt`, generation, lifecycle timestamps, native diff snapshots, fallback history, recovery flags and effective-model evidence are validated fail-closed; unknown top-level task/worker fields are rejected.

## S09 — ExecutionPlanSchema / S10 — TopologySchema / S11 — TeamSchema

- dependency graph references known Task IDs;
- cycles are invalid unless explicitly modeled as retry/recovery transitions outside the task DAG;
- topology parallelism is a positive bounded integer;
- single execution mode implies parallelism 1;
- Team members reference canonical TaskRuntime tasks/workers rather than defining second-class tasks.

## S12 — RecoverySchema

Old executor reconciliation is mandatory for replacement paths capable of overlapping mutation. Terminal states are explicit. Retry budget is bounded.

## S13 — WorkerResultSchema

Boundary-untrusted. Bounded lengths/counts. Unknown keys rejected. Evidence claims are claims/references, not canonical Evidence until admitted/reconciled.

## S14 — EvidenceSchema

Use discriminated evidence kinds. Every kind defines its required subject/result/source fields. Freshness/invalidation semantics are mandatory for evidence used to close an obligation whose underlying state can change.

## S15 — VerificationEnvelopeSchema

```text
result: passed | failed | pending | environment-issue | not_run
```

`not_run` requires an explanation/limitation. `pending` and `environment-issue` remain distinct from product failure. A `passed` check requires an explicit canonical Evidence result and evidence reference; omitted/outcome-less evidence cannot silently become PASS. Freshness is derived separately so an executed-but-stale check is not misreported as `not_run`. Empty check arrays cannot satisfy nonempty verification requirements.

## S16 — ReviewFindingSchema

Severity/disposition/blocking are closed enums. `blocking=true` requires evidence or an explicit rule reference; pure prose cannot create a deterministic blocker class.

## S17 — ArtifactSchema

`artifact_id`, `content_hash` and provenance are distinct fields. Retention/privacy classes are explicit. Large content may be externalized behind a content reference.

## S18 — ContextReferenceSchema / S19 — SemanticContextSchema

Consumer reference is required. ContextReference is strict/current-only: Task snapshots accept canonical consumer-bound references, not raw mission availability handles. Durable sources may snapshot Artifact freshness/privacy/content hash at selection, while live Artifact freshness remains authoritative at consumption; non-durable freshness is `UNKNOWN`. SemanticContext uses a safe technical `source_ref` (currently `file:<project-relative-path>` for TypeScript) plus source hash to tie extraction to source freshness. It is derived/non-persisted, binds the exact consumer Task, validates exact selected source ranges and budget usage, and may keep `relationships[]` empty when no relationship extractor exists. A live source file is not converted into a fake Artifact merely to satisfy schema shape. Context items do not have Evidence-compatible discriminators.

## S20 — ProjectIntelligenceSchema

Project Intelligence is a strict current-only fact/pattern contract. It requires one or more safe project-relative `file:` source refs with lowercase SHA-256 hashes, confidence in `[0,1]`, explicit freshness/lifecycle, at least one consumer domain, and a finite positive update timestamp. Unknown fields, duplicate source refs, unsafe paths, invalid hashes and invalid confidence fail closed. Runtime `task-context` retrieval admits only `ACTIVE + FRESH + task-context` records whose source files intersect the requested Task scope.

Promotion destinations remain typed and separate:

```text
proof -> Evidence (separate admission)
reusable HOW + repeated independent observations -> ProjectMethodologyCandidate
control decision -> Runtime Policy
fact/pattern -> Project Intelligence
```

The PI schema deliberately does not invent `observation_count`, `independence` or generic `admission_status` when no production fact-observation producer owns those semantics. Schema must not encode these domains as interchangeable variants of one generic `memory` object.

## S21 — HumanDecisionSchema / S22 — AuthoritySchema

HumanDecision semantic type is a closed union. UI type is optional projection metadata.

Authority is a separate schema with exact `action_type + target/scope`. Only an Authority record matching an ExternalAction may authorize execution.

No schema accepts natural-language yes/no strings as an authority token unless they are already wrapped in a host/user event that the authority boundary has explicitly bound to the exact action.

## S23 — ExternalActionSchema

Action types remain closed/current-only. The current set includes:

```text
git-push
release-create
package-publish
deploy
```

Adding an action type requires Authority handling, executor mapping and acceptance coverage.

## S24 — ProvenanceSchema

Supports source/revision/hash plus optional per-file hashes. Hash algorithm is explicit. Provenance does not imply trust/admission; admission status belongs to the owning component.

## S25 — StorageOwnershipSchema

Every data class has one canonical write owner. Validator rejects overlapping canonical owners for the same scope/data class.

## S26 — TelemetryEventSchema

Event payloads are bounded and privacy-classified. Telemetry schemas are append/observation contracts; they do not expose control-authority fields.

## S27 — OpenCodeAgentProjectionSchema

Derived schema matching the actual supported OpenCode agent surface studied from upstream:

```text
name
description?
mode: primary | subagent | all
hidden?
temperature?
topP?
permission
model?: { providerID, modelID }
variant?
prompt?
options
steps?
```

Projection generator may use only fields supported by the pinned/current OpenCode integration. Hi-only metadata goes to a sidecar projection receipt, not invalid frontmatter.

## Catalog container schemas

Each extensible catalog uses an explicit versioned container, e.g.:

```json
{
  "schema_version": 1,
  "items": { "<canonical-id>": { "...": "..." } }
}
```

The map key and contained `id` must match when both are present. Duplicate canonical identity across project/builtin layers follows per-component admission policy; it never silently overwrites canonical built-ins.

## Validation pipeline

```text
raw file
  -> parse
  -> structural schema validation
  -> normalize technical syntax only
  -> referential-integrity validation
  -> semantic constitutional invariants
  -> provenance/admission checks
  -> projection generation
  -> projection schema validation
  -> projection parity validation
  -> behavioral acceptance
```

The primary model may produce structured semantic assessments used by runtime policy, but schema validation itself never uses language-specific keyword heuristics.

## Schema evolution policy

Current-only product policy means:

- schema versions exist to identify the current contract and detect stale data;
- compatibility/migration code is not automatically retained;
- when a schema changes, migration is implemented only if current product requirements explicitly need it;
- otherwise stale persisted/project state fails closed with a clear repair/regeneration path.

## Generated schema documentation

Human field-reference tables should be generated from schema metadata where practical. Handwritten architecture documents explain semantics and invariants; they should not duplicate every enum/default indefinitely.

## Implementation gate

This deliverable becomes `IMPLEMENTED` only when:

1. schema modules exist;
2. representative Role/Methodology/Model/HostCapability/ConfigOption contracts parse;
3. cross-reference validator exists;
4. current catalogs are migrated without semantic loss;
5. OpenCode projection validates against actual host-compatible shape;
6. negative tests prove unknown fields/references, safety widening and fake capability states fail;
7. no duplicate old schema owner remains active.
