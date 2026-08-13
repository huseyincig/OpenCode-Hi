# 07 — Human-Readable Template Catalog

Status: TEMPLATE SET V1 CANDIDATE — CANONICAL AUTHORING SHAPES DEFINED

## Purpose

Define the human-facing authoring format for component classes that humans are expected to add or change. Templates are **not a second canonical schema**. They are a readable projection/editor surface that must parse/compile into the machine contract or be generated from it.

## Template rules

1. field labels map one-to-one to machine-contract semantics;
2. no free-text section may secretly grant mechanical authority;
3. deterministic fields use bounded values/IDs rather than prose;
4. prose is reserved for purpose, reasoning guidance, examples and limitations;
5. every referenced Role/Methodology/Capability/Permission/Contract uses canonical ID;
6. host-specific fields live in a host projection block, not the Core identity block;
7. generated files carry a generated/provenance marker and are not hand-edited.

## T01 — Role authoring template

```markdown
# Role: <role-id>

Contract: hi.role/v1
Status: DRAFT

## Purpose
<One bounded responsibility.>

## Select when
- <semantic condition>

## Do not select when
- <negative semantic condition>

## Authority
- Semantic authority: <ids>
- Repository write authority: none | scoped | general
- Obligation authority: <obligation classes>
- Evidence authority: <evidence kinds>
- Completion authority: <none/partial/final scopes>
- Delegation: <allowed role IDs>

## Execution requirements
- Permission profile: <permission-profile-id>
- Required host capabilities: <ids>
- Optional host capabilities: <ids>
- Model requirement profile: <id>
- Compatible methodologies: <ids>
- Preferred methodologies: <ids>
- Forbidden methodologies: <ids>

## Context contract
- Required context kinds: <ids>
- Input contract: <id>
- Output contract: <id>

## Retry / recovery
- Retry policy: <id or none>
- Recovery policy: <id or none>

## Behavioral acceptance
- <acceptance scenario IDs>

## Guidance
<Model-facing role-specific judgment/process guidance only.>

## Provenance
- Source/decision: <ADR/source record>
```

Mechanical parser must reject unknown IDs or missing required structured fields.

## T02 — Methodology authoring template

```markdown
# Methodology: <hi-methodology-id>

Contract: hi.methodology/v1
Status: DRAFT

## Purpose
<Reusable HOW, not policy authority.>

## Trigger contract
- Positive semantic signals: <signal IDs>
- Negative conditions: <signal IDs / structural exclusions>

## Compatible roles
- <role IDs>

## Capability prerequisites
- <host capability IDs>

## Method
1. <procedure>
2. <procedure>

## Resources
- <registered resource ID/path + type>

## Composition
- Cost: low | medium | high
- Conflicts with: <methodology IDs>
- Useful with: <methodology IDs>

## Exit requirements
- <requirement class IDs>

## Exit observability
- <what structured evidence/state proves exit>

## Behavioral tests
- Baseline failure: <scenario>
- Positive scenario: <scenario>
- Negative/counterexample: <scenario>

## Source semantics
- Adopted: <source register IDs>
- Rejected: <source register IDs>
```

Template cannot contain authority grants or fake host tool names.

## T03 — Model capability profile template

```yaml
contract: hi.model-capability/v1
id: <provider/model-or-profile-id>
provider_id: <provider>
model_id: <exact-or-pattern>
variant: <optional>
capabilities:
  reasoning: unknown | low | medium | high
  coding: unknown | low | medium | high
  review: unknown | low | medium | high
  architecture: unknown | low | medium | high
  vision: unknown | false | true
  structured_output: unknown | low | medium | high
  tool_use: unknown | low | medium | high
context:
  capacity: null
  practical_budget: null
operational:
  latency_class: unknown | low | medium | high
  cost_class: unknown | low | medium | high
  expected_turns: null
  reliability: unknown | low | medium | high
role_affinity: []
risk_suitability: []
known_quirks: []
source:
  kind: observed | provider-doc | project-config | user-override
  ref: <reference>
freshness: <timestamp-or-null>
confidence: unknown | low | medium | high
fallback_tier: null
```

`unknown` is an explicit value; authors must not invent precision.

## T04 — Host capability template

```yaml
contract: hi.host-capability/v1
id: <host.capability-id>
host_id: opencode
status: SUPPORTED | DEGRADED | UNSUPPORTED
native_primitive: <real host primitive or null>
adapter_entrypoint: <module/function>
fallback: <bounded fallback or null>
semantic_loss: []
required_permissions: []
version_constraints: null
acceptance_ref: <host acceptance scenario>
forbidden_fake_behavior: <what must never be claimed>
```

## T05 — Permission profile template

```yaml
contract: hi.permission-profile/v1
id: <profile-id>
safety_class: normal | read-only | sensitive | external-effect
rules:
  - capability: <capability-id>
    action: allow | ask | deny
    scope: <optional pattern/scope>
may_be_widened_by_lower_layer: false
host_mapping_requirements: []
```

## T06 — Config option template

```yaml
contract: hi.config-option/v1
id: <config.path>
type: boolean | integer | number | string | enum | object | array
default: <value>
owner: <subsystem>
source_surfaces:
  - config-file
  - setup-cli
precedence_order:
  - safety-constraint
  - explicit-config
  - default
validator: <schema/function ref>
runtime_consumer: <module/function>
executor_effect: <observable effect>
safety_semantics: preference | constraint | authority-boundary | capacity
setup_surface: <optional>
doctor_projection: <optional>
telemetry_projection: <optional>
```

If `runtime_consumer`/`executor_effect` cannot be truthfully filled, do not add a runtime config option.

## T07 — Human decision template

```yaml
contract: hi.human-decision/v1
decision_id: <runtime-generated>
semantic_type: preference | ambiguity | value_judgment | credential_action | authority_request
question: <human-readable question>
reason: <why execution cannot safely proceed without this input>
response_schema: <typed schema ref>
blocking_scope: <mission/task/action ref>
```

Host UI (buttons, picker, text field) is generated/selected after semantic type is known.

## T08 — ADR template

```markdown
# ADR-XXXX — <Title>

Status: PROPOSED | ACCEPTED | SUPERSEDED | REJECTED
Date: YYYY-MM-DD

## Context
<Observed problem and evidence.>

## Decision
<Precise ownership/dependency rule.>

## Alternatives considered
- <alternative + reason rejected>

## Consequences
- Positive:
- Negative/tradeoff:

## Source evidence
- <source records / runtime probes / tests>

## Implementation obligations
- <files/contracts/migrations/acceptance scenarios>

## Supersession
- Supersedes: <ADR or none>
- Superseded by: <ADR or none>
```

## Generated host projection header

Generated OpenCode role/agent projections should contain a machine-readable provenance marker equivalent to:

```text
generated_by: opencode-hi
source_contract: hi.role/<role-id>@<contract-hash>
projection_schema: hi.opencode-agent/v1
DO NOT EDIT — regenerate from canonical contract
```

The exact encoding depends on what the host file format permits. If frontmatter cannot carry non-host fields, the marker belongs in a comment/body header or sidecar receipt, not as invalid host frontmatter.

## Template-to-schema parity

For every template:

```text
Template parser fields ⊆ Canonical Schema fields
Canonical required author fields ⊆ Template fields
```

A template may omit generated fields such as timestamps/hashes. It may not introduce a second semantic field with no machine-contract counterpart.

## Extension acceptance example

A contributor adding a new Role must be able to:

1. copy T01;
2. choose a unique canonical ID;
3. reference existing permission/model/capability/methodology contracts;
4. pass schema and referential-integrity validation;
5. generate a valid OpenCode agent projection;
6. pass projection parity;
7. run a representative role behavioral acceptance scenario;
8. add no hand-maintained duplicate role ID list.

This scenario becomes a required acceptance target in Deliverable 11/17.
