# 06 — Component Contract Catalog

Status: CONTRACT SET V1 CANDIDATE — OWNER/EXECUTOR/PROOF DEFINED

## Purpose

Translate the domain ontology and component metamodel into explicit component contracts. This document defines **what must exist semantically** before machine schemas, generators and host projections can be considered valid.

A contract entry must answer:

1. who owns the meaning;
2. which fields are canonical;
3. which fields are derived/snapshotted/observed;
4. who consumes the contract;
5. which executor makes it material;
6. what proof demonstrates executable effect;
7. what may never be inferred from it.

## Universal contract header

Every cataloged extensible component uses this common envelope where applicable:

```text
id                    canonical stable ID
schema_version        contract schema version
status                DRAFT | VALIDATED | ADMITTED | RETIRED
purpose               bounded semantic purpose
owner                 canonical subsystem owner
provenance             source/revision/hash/admission record
extensions             explicitly namespaced non-Core metadata only
```

Runtime value objects that are not extensible catalog entries may omit admission/provenance fields but must still have one type/schema owner.

## Contract families

### C01 — RoleContract

**Canonical owner:** future Role Catalog/Role Contract module; until migration, role IDs and executable facts are distributed across `roles/*.md`, role routing, generated OpenCode agents and mission/runtime policy.

**Purpose:** host-independent semantic responsibility, authority and execution requirements for a Hi role.

**Required fields:**

```text
id
purpose
role_class: primary | child
use_when[]
do_not_use_when[]
permission_profile_ref
semantic_authority[]
repository_write_authority
obligation_authority[]
evidence_authority[]
completion_authority[]
delegation: { may_delegate, allowed_role_refs[] }
required_capabilities[]
optional_capabilities[]
methodology_policy: { compatible[], preferred[], forbidden[] }
model_requirements_ref or inline bounded requirement set
context_requirements[]
input_contract_ref
output_contract_ref
retry_policy_ref?
recovery_policy_ref?
host_projection_requirements[]
behavioral_acceptance_refs[]
```

**Derived/projection fields:** OpenCode `mode`, prompt body, native permission map, model binding and task delegation permissions.

**Consumers:** role selection/routing, TaskRuntime, TeamRuntime, model resolver, methodology selection, host agent generator/validator.

**Executor:** selected TaskRuntime/primary runtime plus host adapter invoking the projected native agent.

**Proof:** selected role -> projected agent -> observed host agent identity -> allowed tools/permissions -> expected WorkerResult/Evidence behavior.

**Forbidden inference:** host agent name or prompt text may not redefine Role authority.

### C02 — PermissionProfileContract

**Canonical owner:** permission-profile catalog.

**Purpose:** reusable mechanical boundary for read/write/edit/bash/network/external-directory/delegation/methodology/secret/external-effect permissions.

**Required fields:**

```text
id
rules[]: { capability, action: allow|ask|deny, scope/pattern? }
safety_class
may_be_widened_by_lower_layer: false by default
host_mapping_requirements[]
```

**Consumer/executor:** host projection and runtime pre-execution gates.

**Proof:** host/native permissions and Hi pre-execution gate reject disallowed representative operations.

**Invariant:** a lower-precedence preference/config overlay may narrow a safety rule but may not silently widen it.

### C03 — MethodologyContract

**Canonical owner:** methodology catalog (`data/hi-methodologies.json` is current canonical truth and migration source).

**Purpose:** reusable HOW procedure with explicit activation, resource, exit and behavioral proof semantics.

**Required fields:**

```text
id
purpose
trigger_contract
negative_trigger_contract
method_summary
compatible_role_refs[]
preferred_role_refs[]
required_host_capabilities[]
required_context[]
resource_manifest[]
composition: { cost, conflicts[], useful_with[] }
exit_requirements[]
exit_observability[]
behavioral_acceptance_refs[]
provenance
```

**Derived:** host skill frontmatter/body/resource projections, selected/loaded runtime snapshots.

**Consumers:** semantic assessment/composition, native methodology loader, role projection permission generation.

**Executor:** active role/model using native host skill capability/resources; exit requirements reconcile into Mission obligations/evidence.

**Proof:** negative baseline -> activation -> host native load -> scenario behavior -> exit evidence; selected != loaded remains observable.

**Forbidden inference:** methodology cannot grant Authority or create Host Capability.

### C04 — ModelCapabilityProfile

**Canonical owner:** model capability catalog/runtime resolver input.

**Purpose:** represent known model execution capabilities and uncertainty without hard-coding role identity to model names.

**Required fields:**

```text
id
provider_id
model_id_pattern_or_exact_id
variant?
capabilities: { reasoning?, coding?, review?, architecture?, vision?, structured_output?, tool_use? }
context: { capacity?, practical_budget?, overhead? }
operational: { latency_class?, cost_class?, expected_turns?, reliability? }
role_affinity[]
risk_suitability[]
known_quirks[]
source
freshness
confidence
fallback_tier?
```

Unknown values are legal and preferable to invented precision.

**Consumers:** model resolver/scorer and doctor diagnostics.

**Executor:** TaskRuntime/host child invocation applies selected provider/model/variant.

**Proof:** requested -> selected -> projected -> observed/effective model identity plus feedback events.

### C05 — HostCapabilityContract

**Canonical owner:** host adapter capability registry.

**Purpose:** truthfully state what a host can execute.

**Required fields:**

```text
id
host_id
status: SUPPORTED | DEGRADED | UNSUPPORTED
native_primitive
adapter_entrypoint
fallback?
semantic_loss[]
required_permissions[]
version_constraints?
acceptance_ref
forbidden_fake_behavior
```

**Consumers:** runtime policy, methodology eligibility, isolation/process/team decisions, doctor.

**Executor:** host adapter/native primitive.

**Proof:** direct host acceptance test or an explicitly classified degraded fallback test.

### C06 — ConfigOptionContract

**Canonical owner:** config contract catalog/schema.

**Required fields:**

```text
id
type
default
owner
source_surfaces[]
precedence_order[]
validator
runtime_consumer
executor_effect
safety_semantics: preference | constraint | authority-boundary | capacity
setup_surface?
doctor_projection?
telemetry_projection?
```

**Proof:** changing the option changes the declared executor behavior or it must be removed/reclassified as metadata.

**Invalid state:** `CONFIG_WITHOUT_EXECUTABLE_EFFECT`.

### C07 — TaskContract

**Canonical owner:** mission/task planning boundary.

**Required fields:**

```text
id
mission_id
objective
scope
constraints[]
dependencies[]
obligation_refs[]
evidence_requirements[]
selected_role_ref
selected_methodology_refs[]
selected_context_refs[]
execution_profile_ref or snapshot
write_set_claim?
external_action_requirements[]
```

**Executor:** TaskRuntime/Worker.

**Proof:** task launch uses the selected execution profile and completion reconciles exactly its obligations/evidence.

### C08 — WorkerContract / WorkerState

**Canonical owner:** TaskRuntime worker state.

**Required runtime fields:**

```text
worker_id
task_id
attempt
role_ref
model_selection
methodology_refs
host_session_id
status
started_at/updated_at/completed_at
observed_agent?
observed_model?
write_claims[]
```

**Invariant:** recovery preserves worker identity when safe; a new host session does not silently become a new semantic Task.

### C09 — ExecutionPlanContract

**Canonical owner:** runtime planning/topology policy.

**Required fields:**

```text
mission_id
nodes: Task refs
edges/dependencies
barriers[]
parallel_groups[]
authority_requirements[]
evidence_gates[]
completion_gate
```

This is an actual mission trajectory graph, not a mandatory static workflow catalog.

### C10 — TopologyContract

**Canonical owner:** topology policy.

**Required fields:**

```text
mode: single-agent | multi-agent
execution_mode: single | parallel
parallelism
agent_count
independence_evidence
write_safety
reason
```

**Executor:** TaskRuntime scheduler/capacity gates.

**Proof:** actual concurrent dispatch never exceeds topology bound and explicit single-agent cannot produce parallel child dispatch.

### C11 — TeamContract

**Canonical owner:** TeamRuntime as bounded projection over TaskRuntime.

**Required fields:**

```text
team_id
mission_id
generation
member_task_refs[]
member_role_refs[]
capacity
status
created_at/shutdown_at?
```

**Forbidden:** second mailbox/board/task runtime unless a future real host primitive and ADR establish it.

### C12 — RetryAttemptContract

**Canonical owner:** retry/recovery policy.

**Required fields:**

```text
worker_id
attempt
failure_class
reason
action
model_change?
methodology_change?
context_change?
created_at
```

Retry attempts cannot own final failure classification or completion.

### C13 — RecoveryContract

**Canonical owner:** recovery runtime/policy.

**Required fields:**

```text
failure_class
entry_condition
identity_preservation
old_executor_reconciliation
abort/termination_requirement
replacement_policy
retry_budget
model_escalation_policy
context_adjustment_policy
methodology_adjustment_policy
terminal_conditions
human_escalation_conditions
```

**Critical invariant:** replacement execution cannot begin while prior execution ownership remains unresolved when both could mutate the same task scope.

### C14 — WorkerResultContract

**Canonical owner:** mission result boundary/schema.

**Purpose:** bounded untrusted child result.

**Required fields:**

```text
status
summary
changed_files[]
evidence_claims[]
limitations[]
blockers[]
external_action_results[]
```

WorkerResult never directly marks Mission complete.

### C15 — EvidenceContract

**Canonical owner:** Evidence ledger/type system.

**Required fields:**

```text
id
kind
subject/scope
producer_role
producer_worker?
source
result
created_at
freshness/invalidation_key
artifact_ref?
command/check metadata?
limitations[]
```

**Consumers:** obligation reconciliation, review/completion, telemetry/reporting.

**Invariant:** Project Intelligence and summaries cannot be silently coerced into Evidence.

### C16 — VerificationEnvelopeContract

**Required fields:**

```text
checks[]: { kind, subject, result: passed|failed|pending|environment-issue|not_run, evidence_refs[], explanation? }
scope
freshness
limitations[]
independent_review?
```

No omitted check may be represented as passed. VerificationEnvelope is deterministically derived from canonical Evidence + VerificationPolicy + obligation state; it is not a second persisted verification truth. Stale evidence may preserve an executed check result while freshness independently prevents completion.

### C17 — ReviewFindingContract

**Required fields:**

```text
id
reviewer_role
subject
severity
causality
scope
evidence_refs[]
confidence
disposition
blocking
```

Review finding prose may elaborate, but disposition/blocking semantics are structured.

### C18 — ArtifactContract

**Canonical owner:** ContextArtifactStore/artifact service.

**Required fields:**

```text
artifact_id
kind
content_ref/body location
content_hash
producer
provenance
created_at
retention_class
privacy_class
consumer_refs[]
```

**Invariant:** artifact ID != content hash; metadata generation cannot change identity.

### C19 — ContextReferenceContract

**Required fields:**

```text
id
source_ref
consumer_ref
reason
priority
protection
budget_cost
freshness
retention
privacy_class
```

Context is selected per consumer; availability is not selection.

### C20 — SemanticContextContract

**Required fields:**

```text
source_artifact_ref
source_hash
language_adapter
symbols[]
relationships[]
selected_ranges[]
consumer_task_ref
budget
created_at
```

It is context, never proof.

### C21 — ProjectIntelligenceContract

**Required fields:**

```text
id
fact/pattern
source_refs[]
observation_count
independence
confidence
freshness
admission_status
consumer_domains[]
```

Reusable HOW is promoted to Methodology; proof is stored as Evidence; control decisions remain Runtime Policy.

### C22 — HumanDecisionContract

**Required fields:**

```text
decision_id
semantic_type: preference | ambiguity | value_judgment | credential_action | authority_request
question
options/response_schema
reason
blocking_scope
host_ui_projection?
status
response
created_at/resolved_at?
```

### C23 — AuthorityContract

**Required fields:**

```text
authority_id
action_type
target/scope
requested_by
required_reason
grant_source
exact_grant_token_or_structured_event
expires/one_shot
consumed_at?
```

**Invariant:** generic yes/continue/confirm does not grant unrelated authority.

### C24 — ExternalActionContract

Current action values include material external effects such as git push, release creation, package publish and deploy.

Required semantics:

```text
action_type
target
requested_explicitly
required_authority_ref
executor
result_evidence_ref
```

### C25 — HostAgentProjectionContract

**Canonical owner:** host adapter/generator; derived from RoleContract + PermissionProfile + model/config policy.

**OpenCode projection includes only valid host fields:**

```text
name
description
mode
permission
model?
variant?
prompt?
temperature/topP?
steps?
options?
```

Hi-only metadata must not leak into host frontmatter.

### C26 — ProvenanceRecord

```text
source_type
source_id
source_revision?
source_hash?
transform/admission
owner
created_at
file_hashes[]?
```

Used by project methodologies, generated projections, artifacts and imported/derived components where material.

### C27 — StorageOwnershipContract

```text
data_class
canonical_owner
scope: project|global|runtime
lifecycle: canonical|derived|cache|ephemeral
path/provider
schema_ref
write_owner
readers[]
retention
privacy
```

Two canonical writers for the same data class are invalid.

### C28 — TelemetryEventContract

```text
event_type
occurred_at
mission/task/worker refs?
decision/executor
structured_fields
source
privacy_class
```

Telemetry is observation, never authority.

### C29 — ArchitectureDecisionContract

```text
adr_id
title
status
context
decision
alternatives
consequences
supersedes/superseded_by
source_evidence_refs[]
implementation_refs[]
```

## Referential integrity rules

1. all `*_ref` values use canonical IDs;
2. unknown references are schema/semantic validation failures;
3. Role references a PermissionProfile, never embeds a second independent permission truth unless explicitly declared as a derived resolved snapshot;
4. Methodology role/capability refs must resolve before admission;
5. ConfigOption is invalid when `runtime_consumer` or `executor_effect` is absent for a runtime option;
6. HostProjection must identify the source contract/hash used to generate it;
7. Worker/Task snapshots may retain resolved values for reproducibility but remain classified DERIVED/RUNTIME;
8. safety constraints compose monotonically; preference precedence cannot override them;
9. Authority is consumed only by the matching ExternalAction scope;
10. Evidence freshness/invalidation must be checked before obligation closure.

## Extension standard

A new material component class is not accepted by merely adding a TypeScript interface. It must provide, in order:

```text
ontology placement
-> canonical contract/schema
-> human template (if authored by humans)
-> owner + storage classification
-> consumers
-> executor/projection
-> validator
-> representative behavioral acceptance
-> migration/provenance entry
```

This sequence is the basis for the generator and architectural validator deliverables.
