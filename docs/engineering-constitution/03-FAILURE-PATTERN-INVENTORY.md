# 03 — Engineering Failure-Pattern Inventory

Status: PRELIMINARY — HISTORICAL DEFECTS CLASSIFIED

## Purpose

Turn recurring defects discovered during OpenCode-Hi evolution into architectural constraints. A constitution is useful only if it prevents classes of mistakes already observed in the product.

## Failure taxonomy

### F01 — CONFIG_WITHOUT_EXECUTABLE_EFFECT

**Observed examples**

- `teamMode.auto` existed without a production consumer.
- profile `parallelThreshold`, `costSensitivity`, `qualityFloor` existed without executor effect.
- `allowMultiRoleAgent` changed `roleReuse` metadata that no worker executor consumed.
- setup-only `modelPolicy` / `adaptiveRoles` were exposed as if they were runtime routing policy.

**Root cause**

Config type/schema was treated as sufficient declaration; owner/consumer/executor were not required fields of a common ConfigOption contract.

**Constitution response**

Every runtime config option must declare owner, source/precedence, validator, runtime consumer, executor effect and observability. No executor effect → not runtime config.

---

### F02 — DECISION_WITHOUT_EXECUTOR

**Observed examples**

- old adaptive policy returned a `skills` decision that nothing consumed.
- `executionDepth/contextDepth/isolationDepth` were persisted as if operational but had no executor.
- ContextGovernor initially existed only in tests/benchmarks.
- shell policy initially existed only as policy/test code before being bound to OpenCode tool-before.

**Root cause**

A policy return value was mistaken for a product capability.

**Constitution response**

Policy outputs must be consumed by a runtime or host projection. Architectural validation should detect declared decision fields without production consumers.

---

### F03 — FAKE_CAPABILITY

**Observed examples**

- `ProcessGovernor` could spawn its own test process even though Hi could not control ordinary OpenCode bash PIDs.
- `WorktreeRuntime` could create a git worktree but could not prove later OpenCode child execution was bound to it.

**Root cause**

Local implementation ability was confused with host-bound product capability.

**Constitution response**

HostCapability contract needs `SUPPORTED | DEGRADED | UNSUPPORTED`, native primitive, fallback, semantic loss, forbidden fake behavior and acceptance proof.

---

### F04 — DUPLICATE_SEMANTIC_TRUTH

**Observed examples**

- topology mode and execution mode could contradict one another.
- role IDs/read-only/reviewer sets were duplicated across runtimes/hooks.
- role prompts specified an output format that conflicted with WorkerResult.
- mission primary role could claim `manager` while actual OpenCode primary remained `working-manager`.
- role/category selection logic had dead competing owners.

**Root cause**

Projections and runtime snapshots were allowed to become independent canonical owners.

**Constitution response**

One canonical component contract. Prompts/frontmatter/docs/runtime snapshots are generated projections or mechanically checked consumers.

---

### F05 — HOST_PROJECTION_DRIFT

**Observed examples**

- existing OpenCode agent config with same canonical name could differ from Hi packaged contract while Hi still dispatched that name.
- a methodology identifier appeared under `permission.bash` instead of the skill permission namespace.

**Root cause**

Host agent name equality was assumed to imply contract equality.

**Constitution response**

HostAgentProjection needs canonical identity, exact meaningful permission/mode/model projection, admitted extension policy and fail-closed collision validation.

---

### F06 — AUTHORITY_BYPASS_BY_EXPLICIT_INPUT

**Observed example**

Explicit task `obligation_ids` could bind a coder to review authority or a reviewer to implementation authority because inferred obligations were checked but explicit IDs were not.

**Root cause**

API override path bypassed the same domain invariant enforced in automatic selection.

**Constitution response**

Domain invariants belong in canonical contract validation and must apply to inferred and explicit paths equally.

---

### F07 — SAFETY_CONSTRAINT_REPLACEMENT

**Observed example**

Project model routing could replace higher-level `deniedModels` / provider restrictions, potentially weakening safety.

**Root cause**

Preference precedence and safety-constraint composition used the same override semantics.

**Constitution response**

Distinguish selection preferences from monotonic safety constraints. Deny sets compose by union; multiple allow constraints narrow by intersection unless an explicit authority model says otherwise.

---

### F08 — FICTIONAL_IDENTITY

**Observed examples**

- mission primary mode recalculated from config instead of observed host agent.
- restart restore could overwrite persisted observed primary identity.

**Root cause**

Desired policy identity was confused with observed executor identity.

**Constitution response**

Contracts distinguish requested/selected/projected/observed/effective identity. Runtime evidence from the host is authoritative for actual executor identity.

---

### F09 — CONTEXT_BROADCAST

**Observed example**

The latest eight mission context artifacts were automatically injected into every child regardless of task relevance.

**Root cause**

Availability was treated as relevance.

**Constitution response**

TaskContract explicitly selects context/artifact references. Default is minimum context; relevance is structured or explicitly selected, not inferred by broad transcript copying.

---

### F10 — DUPLICATE_STORAGE_OWNER

**Observed examples**

- a generic ArtifactStore existed separately from mission context artifacts and had no production consumer.
- generic Project Intelligence prose query API existed only in tests while real runtime retrieval needed file-scoped semantics.

**Root cause**

A useful concept was implemented as a new store/API before ownership and consumer path were defined.

**Constitution response**

Storage contract must declare producer, consumer, owner, lifecycle, canonical/derived/cache/ephemeral class, invalidation and retention before introducing another store.

---

### F11 — ARTIFACT_IDENTITY_COLLISION

**Observed example**

Durable artifact ID originally depended only on content hash; identical content with different source-file provenance could alias.

**Root cause**

Content integrity identity and semantic/provenance identity were conflated.

**Constitution response**

ArtifactContract separates artifact identity from content hash and provenance/source binding.

---

### F12 — INERT_TEAM_SURFACE

**Observed example**

Team mailbox/inbox/board tools mutated in-memory state but child sessions had no executable path to receive those messages. Config limits existed only for that inert surface.

**Root cause**

State mutation was mistaken for agent communication.

**Constitution response**

TeamContract contains only lifecycle/worker-group capabilities backed by TaskRuntime/host execution. Messaging requires a real delivery primitive and behavioral proof.

---

### F13 — RECOVERY_DUAL_OWNERSHIP

**Observed example**

Runtime provider fallback could create a fresh recovery child without proving the failed child session had actually been aborted.

**Root cause**

Recovery transition did not encode cleanup/ownership preconditions.

**Constitution response**

RecoveryContract must specify old-executor termination/reconciliation, identity preservation, new executor creation conditions, max attempts and terminal result.

---

### F14 — TEST_GREEN_WITH_WRONG_HARNESS

**Observed behavior**

Several tests assume `plugin/` as `process.cwd()`. Running the same glob from repository root creates false file-path failures. Real npm registry acceptance is also not part of the deterministic local suite.

**Root cause**

Test environment contract was implicit.

**Constitution response**

BehavioralAcceptance/TestSuite contracts must declare working directory, required env isolation, network/external dependencies, determinism class and release-only gates.

---

### F15 — METHODOLOGY/POLICY CONFLATION

**Observed example**

`hi-workspace-isolation` was retired because isolation selection belongs to the control plane, overlooking that safe isolation HOW can still be a methodology.

**Root cause**

`whether`, `how`, and `can execute` were conflated.

**Constitution response**

Canonical separation:

```text
Runtime Policy decides WHETHER.
Methodology describes HOW.
Host Capability proves CAN EXECUTE.
```

---

### F16 — METHODOLOGY_SCHEMA_WITHOUT_BEHAVIORAL_PROOF

**Risk identified from source comparison**

Methodology admission can prove schema/provenance/hash and repeated observation without proving the methodology changes model behavior usefully.

**Constitution response**

Methodology authoring needs baseline behavior, success behavior and negative/do-not-trigger acceptance where practical.

---

### F17 — NATURAL_LANGUAGE_AUTHORITY_CLASSIFIER

**Rejected source pattern**

OpenAgentsControl demonstrates keyword-list approval detection. It is attractive because it is simple, but language/negation/context ambiguity makes it unsuitable for Hi authority.

**Constitution response**

Natural-language semantic interpretation belongs to the primary model structured semantic contract; authority for sensitive/external actions uses explicit bounded action binding.

---

## Meta-patterns

Most historical defects reduce to five deeper causes:

1. **Missing canonical component contract.**
2. **Projection mistaken for truth.**
3. **State existence mistaken for executable behavior.**
4. **Preference/metadata/authority/safety semantics collapsed into one field.**
5. **Tests validated local helper behavior but not the real host-bound path.**

These five causes are the primary design targets of the metamodel.
