# 05 — Hi Component Metamodel

Status: PRELIMINARY DESIGN — SOURCE AND FAILURE GROUNDED

## Objective

Define the component classes, legal dependency directions and four-layer engineering standard that all material OpenCode-Hi subsystems will converge on.

This is not yet an implementation schema. It is the blueprint from which machine schemas, templates, generators and validators will be derived.

## Metamodel principle

For a material component class:

```text
CANONICAL CONTRACT
        ↓
HUMAN TEMPLATE / EXPLANATION
        ↓
RUNTIME OR HOST PROJECTION
        ↓
VALIDATION + BEHAVIORAL ACCEPTANCE
```

Not every class needs a generated Markdown file. Every class does need a clearly identified canonical owner and proof strategy.

## Component categories

### A. Domain identity and responsibility

- `RoleContract`
- `MethodologyContract`
- `ModelCapabilityProfile`
- `HostCapabilityContract`
- `PermissionProfileContract`

### B. Mission execution

- `TaskContract`
- `WorkerContract` / worker runtime state schema
- `ExecutionPlanContract`
- `TopologyContract`
- `TeamContract`
- `RetryAttemptContract`
- `RecoveryContract`

### C. Result and proof

- `WorkerResultContract`
- `EvidenceContract`
- `VerificationEnvelopeContract`
- `ReviewFindingContract`
- `ArtifactContract`

### D. Context and learned project state

- `ContextReferenceContract`
- `SemanticContextContract`
- `ProjectIntelligenceContract`
- optional future Memory Adapter contract (not Core truth)

### E. Human/safety/external effects

- `HumanDecisionContract`
- `AuthorityContract`
- `ExternalActionContract` or typed Authority action value object — final choice pending.

### F. Configuration/projection/governance

- `ConfigOptionContract`
- `HostAgentProjectionContract`
- `ProvenanceRecord`
- `StorageOwnershipContract`
- telemetry/metrics observation responsibility — currently derived from bounded Mission ledger/state; no independent event store
- architecture-decision responsibility — currently durable ADR/project-convention process, not runtime state

## Core legal dependency graph

```text
Domain Ontology
│
├── RoleContract
├── MethodologyContract
├── ModelCapabilityProfile
├── HostCapabilityContract
├── PermissionProfileContract
├── EvidenceContract
└── AuthorityContract
        │
        ▼
Canonical Catalogs / Config Contracts / Runtime Policies
        │
        ├─────────────┬────────────────┬───────────────┐
        ▼             ▼                ▼               ▼
 TaskContract   ExecutionPlan     Routing/Model     Context Selection
        │          /Topology           Policy             Policy
        ▼             │                │                  │
 Worker Runtime ◄─────┴────────────────┴──────────────────┘
        │
        ▼
 Host Projections / Adapter
        │
        ▼
 Native Host Primitive
        │
        ▼
 WorkerResult / Observed Identity / Telemetry
        │
        ├──────────► Evidence / Artifact / PI
        │
        └──────────► Recovery / Completion Reconciliation
```

## Projection rules

### Rule P1 — host projection cannot own domain semantics

OpenCode frontmatter may encode `mode`, `permission`, `model`, `variant`, prompt and steps because OpenCode executes them. It may not be the canonical definition of Hi obligation authority or completion authority.

### Rule P2 — runtime snapshots are not canonical catalogs

`ExecutionProfile`, TaskState and WorkerState may snapshot selected Role/Model/Methodology/Permissions for reproducibility. They reference decisions; they do not define the component class.

### Rule P3 — docs are projections unless explicitly an ADR/constitution

Matrices of roles/methodologies/config options should be generated or parity-validated against canonical contracts when practical.

### Rule P4 — prompts contain judgment/process guidance, not sole mechanical enforcement

If an invariant can be checked deterministically, runtime/schema/validator owns enforcement; prompt text may explain but cannot be the only protection.

## Contract lifecycle

Every cataloged component moves through explicit lifecycle states where useful:

```text
DRAFT
VALIDATED
ADMITTED
PROJECTED
RUNTIME_REACHABLE
BEHAVIOR_VERIFIED
RETIRED
```

Not all runtime value objects require admission lifecycle. Cataloged extensible components (roles, methodologies, model profiles, host capabilities, config options) do.

## Contract reference rules

- References use canonical IDs, never display labels.
- Unknown references fail validation.
- Circular semantic ownership is invalid.
- Cyclic runtime dependency may exist only when modeled as an event/feedback loop, not owner recursion.
- Explicit API inputs are validated against the same invariants as inferred selections.

## Owner uniqueness

Each semantic field must answer one of:

1. **canonical owner** — where the meaning is defined;
2. **projection** — derived host/model-facing shape;
3. **runtime snapshot** — selected/effective state at a point in execution;
4. **observation** — host/worker/telemetry fact.

Two canonical owners for one meaning are invalid.

## Representative component shapes

### RoleContract — candidate shape

```text
id
purpose
use_when / do_not_use_when
role_class
read_only
semantic_authority
repository_write_authority
obligation_authority
evidence_authority
completion_authority
delegation_authority / delegates_to
required_capabilities / optional_capabilities
methodology_compatibility / preferences
model_requirements
context_requirements
permission_profile_ref
input_contract_ref
output_contract_ref
retry_policy_ref
recovery_policy_ref
block/stop/human-escalation conditions
host_projection_requirements
behavioral_acceptance_refs
provenance
```

### MethodologyContract — candidate shape

```text
id / purpose
trigger / do_not_trigger
method
exit_condition / exit_observability
role_affinity / compatible_roles
activation_signals
capability_prerequisites / host_capability_requirements
context_cost / execution_cost
priority / composition_cost
conflicts / useful_coexistence
evidence/exit requirements
resource manifest
provenance/source inspiration
adopted source semantics
intentionally rejected source semantics
behavioral baseline / success / negative tests
admission state
```

### ModelCapabilityProfile — candidate shape

```text
id/provider/family/version
variants
reasoning/coding/review/architecture/vision capability
structured-output/tool reliability
context capacity/overhead
latency + cost
expected turns / expected completion cost
write capability / tool requirements
role/task affinities
risk suitability
quirks/failure modes
observed success/failure/retry feedback
confidence/source/freshness
fallback/escalation tier
```

Unknown capability values are valid and preferred over invented precision.

### ConfigOptionContract — candidate shape

```text
id/type/default
owner
source surfaces
precedence
validator
runtime consumer
executor effect
telemetry/doctor projection
setup surface
current-only semantics
```

A runtime config option without `runtime consumer + executor effect` is invalid.

### HostCapabilityContract — candidate shape

```text
id
host
status: SUPPORTED | DEGRADED | UNSUPPORTED
native primitive
adapter entrypoint
fallback
semantic loss
required by
forbidden fake behavior
acceptance test
observed host/version constraints
```

### RecoveryContract — candidate shape

```text
failure class
entry condition
mission/task/worker/session identity preservation
old executor reconciliation/termination prerequisite
context/evidence carried forward
materially different next action
model/tool/isolation change
max attempts
next state
terminal result
```

## Cross-component invariants

### I1 — Role/Agent parity

A selected Role projected to a host agent must result in the expected actual host agent/mode/permissions, or dispatch fails closed.

### I2 — Role/Obligation parity

No inferred or explicit task binding may assign an obligation outside the selected Role's authority.

### I3 — Methodology capability gate

Methodology presence does not imply host capability. A selected methodology with required unavailable capability must degrade/block according to its contract; never synthesize a fake executor.

### I4 — Safety monotonicity

Safety constraints compose monotonically unless an explicit higher authority contract grants widening.

### I5 — Completion independence

WorkerResult, reviewer verdict or model confidence cannot directly mark Mission complete. Completion consumes obligations/evidence/authority/blockers/freshness.

### I6 — Context explicitness

Artifacts/PI/Semantic Context reach a worker only through structured scoped selection or a documented deterministic relevance relationship. Repository-wide availability is insufficient.

### I7 — Projection integrity

Generated host/docs artifacts must be reproducible from canonical contracts and either hash/compare clean or fail validation.

### I8 — Behavioral admission

Extensible behavioral components (especially Methodologies and host projections) require representative behavioral proof in addition to schema validity.

## Template vs schema vs generator

- **Schema** answers: is the canonical data structurally valid?
- **Template** answers: what information must an engineer/AI author provide and how should it be reasoned about?
- **Generator** answers: which derived artifacts can be created deterministically?
- **Validator** answers: does every projection/consumer preserve the contract?
- **Behavioral acceptance** answers: does real execution have the intended effect?

These are separate responsibilities and should not be collapsed into one mega-script.

## Metamodel extension test

The design is not acceptable until adding a representative new reviewer Role and a representative new Methodology can follow this path:

```text
create canonical contract
→ schema validation reports missing fields/references
→ register/admit
→ generate host projection
→ generate/validate permission/methodology projection
→ run contract parity tests
→ run representative host/runtime behavior test
```

If adding a component still requires hunting for hidden string sets across unrelated TypeScript/Markdown files, the metamodel is incomplete.

## Explicitly deferred design choices

- exact storage path/file format for canonical component contracts;
- JSON Schema vs TypeScript/Effect/Zod as authoring schema source;
- whether schemas are generated from TypeScript or TypeScript is generated from schema;
- which docs projections should be fully generated vs parity-validated hand-written prose;
- ExternalAction as independent component vs Authority value object;
- whether Workflow is a cataloged component or only ExecutionPlan templates.

These choices require Contract/Schema/Generator analysis before implementation.
