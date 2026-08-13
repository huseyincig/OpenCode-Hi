# 04 — Hi Domain Ontology

Status: PRELIMINARY CONTRACT CANDIDATE

## Purpose

Define the semantic categories that must remain distinct across OpenCode-Hi. This ontology is not an implementation map. It is the vocabulary that prevents one projection, state object, prompt, host primitive or helper from silently becoming the owner of another concept.

## Foundational distinction

```text
ROLE
!= AGENT
!= MODEL
!= METHODOLOGY
!= TASK
!= WORKER
!= TOPOLOGY
!= WORKFLOW / EXECUTION PLAN
!= HOST PRIMITIVE
```

These entities can be related, selected together and projected into the same host call, but they are not interchangeable.

## Core nouns

### Mission

A durable runtime aggregate representing the user's active objective and its control-plane state: semantic assessment, obligations, tasks, workers, evidence, blockers, authority and completion state.

A Mission is not a workflow definition and is not a transcript.

### Role

A host-independent semantic responsibility and authority boundary. A Role answers:

- what class of judgment/work this participant owns;
- what it may mutate;
- which obligations/evidence it may own;
- when it should or should not be selected;
- what delegation and external-effect authority it has.

A Role is not a host agent name.

### Agent

A host-native execution configuration or executor identity. It may project a Hi Role, but also may be an internal host agent that has no Hi Role equivalent.

OpenCode agent names such as host-native internal agents do not expand the Hi role ontology.

### Model

A provider/model/variant execution capability selected for an agent/worker invocation. Model identity is independent of Role. One Role may run on several Models; one Model may serve several Roles.

### Methodology

A reusable HOW: a behavior-shaping procedure that helps a suitable Role perform work. It does not decide whether the work is authorized, whether a role should exist, or whether the host can execute a primitive.

Canonical separation:

```text
Runtime Policy decides WHETHER.
Methodology describes HOW.
Host Capability proves CAN EXECUTE.
```

### Task

A bounded unit of mission work with objective, scope, constraints, dependencies, obligations, evidence requirements, selected context and execution profile.

A Task is not the worker executing it.

### Worker

A runtime execution identity bound to a Task and a Role, selected Model, methodology set and host child session. Recovery should preserve Worker identity when safe.

### Obligation

A completion-relevant duty that must be satisfied, waived by legitimate policy, or remain blocking. Obligation authority is role-scoped.

### Evidence

Structured proof about a particular state/scope. Evidence can satisfy obligations and therefore must carry producer authority, state/freshness information and invalidation semantics.

```text
PROOF -> Evidence
```

Evidence is not Project Intelligence and not a worker summary.

### Project Intelligence

Durable or semi-durable project facts/patterns used to improve future decisions/context. PI is source/provenance-bound and freshness-aware, but it cannot satisfy proof obligations by itself.

```text
FACT -> Project Intelligence
```

### Artifact

A retained/retrievable result whose body is too long, reusable or lifecycle-significant to live in transient handoff text. Artifact identity is distinct from content hash and provenance.

### Context

Minimum information intentionally supplied to an active reasoning/execution step. Context is consumer-specific and budgeted. Availability does not imply relevance.

### Semantic Context

A bounded structural extraction from source artifacts intended to reduce rereading while preserving relevant code shape. It is context, not proof.

### Runtime Policy

A deterministic or structured control-plane decision that determines whether/which execution behavior is allowed or selected.

```text
CONTROL DECISION -> Runtime Policy
```

### Execution Plan

The structured dependency/barrier/authority/evidence graph for an actual mission trajectory. It may be adaptive and runtime-emergent; it is not required to be a static pipeline.

### Workflow

A reusable named execution-plan pattern only when a stable recurring flow truly exists. A workflow should not be invented for every mission.

### Topology

The shape/capacity relationship between concurrent/sequential workers: single, parallel or bounded team; independence and write-safety are part of topology semantics.

### Team

A bounded group of canonical TaskRuntime workers under one mission/generation. Team is not a second orchestrator or peer-message fantasy layer.

### Recovery

A controlled transition after failure/no-progress that preserves mission/task/worker/session identity where safe and explicitly reconciles old execution ownership before replacement.

### Human Decision

A structured request for user value judgment, preference, ambiguity resolution, credential/action participation or authority. Human interaction UI shape is separate from semantic decision type.

### Authority

Permission for a specific sensitive/external/irreversible action. Authority is action-bound, not inferred from generic agreement language.

### Host Capability

A real primitive or verified degraded fallback available through the current host adapter. Capability status can be SUPPORTED, DEGRADED or UNSUPPORTED.

### Host Projection

A host-specific representation generated/validated from a Hi contract: e.g. OpenCode agent frontmatter, tool permissions, model binding or config projection.

### Permission Profile

A structured capability/authority boundary for read/write/shell/network/external directory/recursive delegation/methodology/secret/external-effect access.

### Config Option

A declared policy/setup input with owner, source, precedence, validator and executable consumer/effect. A field with no executable consumer is not runtime config.

### Review Finding

A structured reviewer claim with causality, scope, confidence, evidence, disposition and blocking semantics.

### Verification Envelope

A structured account of validation that ran, results, evidence, what did not run, why, scope/freshness and limitations.

### Provenance Record

A structured record of where a component/decision/artifact came from: source, revision, hash, owner, time and relevant transformation/admission details.

### Telemetry Event

A bounded structured observation emitted by runtime decisions/executors. Telemetry records facts; it does not become control authority by existing.

## Identity dimensions

A recurring source of defects was collapsing desired identity into actual identity. Component contracts must distinguish these states where relevant:

```text
DECLARED
REQUESTED
SELECTED
PROJECTED
OBSERVED
EFFECTIVE
VERIFIED
```

Example model identity:

- requested: explicit task override;
- selected: model resolver decision;
- projected: model passed to child session/prompt;
- observed: assistant metadata returned by OpenCode;
- effective: model the host actually reports executing;
- verified: observed identity satisfies the selected contract.

Example role/agent identity:

- Role selected: `qa-reviewer`;
- host projection: OpenCode agent config `qa-reviewer`;
- observed host agent: `qa-reviewer`;
- only after observation/parity can runtime claim actual executor identity.

## Semantic dimensions that must not share override semantics

### Preference

A reversible choice used to rank/select among otherwise allowed alternatives.

### Safety constraint

A monotonic restriction. Lower layers may narrow but may not silently widen a higher-level safety restriction.

### Authority

An explicit action-bound permission. Preference does not imply authority.

### Capability

A fact about what a host/model/tool can execute. Authority does not create capability.

### Evidence

A proof record. Capability or authority does not imply evidence that the action succeeded.

### Metadata

Descriptive/provenance information. Metadata must not become operational merely because it is stored.

## State classifications

All stored state should identify lifecycle class:

```text
CANONICAL
DERIVED
CACHE
EPHEMERAL
```

and scope:

```text
PROJECT
GLOBAL
RUNTIME
```

A generated host agent is a projection/derived artifact, not the canonical Role contract.

## Legal ownership direction

Preferred semantic dependency direction:

```text
Product Intent / Domain Ontology
        ↓
Canonical Component Contracts
        ↓
Canonical Catalogs / Runtime Policies
        ↓
Runtime Executors
        ↓
Host Adapters / Projections
        ↓
Native Host Primitives
        ↓
Observed Results / Evidence / Telemetry
```

Observed results may feed future policy as evidence/feedback, but a host projection must never redefine the upstream domain contract.

## Anti-equivalence invariants

- prompt text != policy database;
- agent Markdown != Role contract;
- host config != Hi ontology;
- task state != workflow definition;
- worker result != completion decision;
- Project Intelligence != Evidence;
- remembered context != current fact;
- tool availability != authorization;
- worktree existence != isolated execution;
- process spawn helper != host process lifecycle capability;
- user confirmation UI != external-action authority;
- schema validity != behavioral effectiveness;
- test helper behavior != host-bound operational behavior.

## Open questions before finalization

- Whether `Barrier` should remain an embedded ExecutionPlan value object or become a separately cataloged component type.
- Whether `ExternalAction` belongs under Authority as a value object or deserves an independent contract because of release-chain provenance.
- Whether model capability observations should be Project Intelligence, Telemetry-derived runtime feedback, or a separate bounded `CapabilityObservation` value object.

These questions are deliberately left open until the metamodel dependency analysis determines whether a separate first-class type materially reduces ambiguity.
