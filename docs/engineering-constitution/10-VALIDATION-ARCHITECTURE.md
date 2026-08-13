# 10 — Validation and Architectural Linting

Status: V1 TARGET ARCHITECTURE — VALIDATOR CLASSES DEFINED

## Purpose

Make wrong architecture mechanically difficult. Validation must cover more than schema syntax: ownership, references, executor reachability, projection parity, state/storage ownership and behavioral evidence.

## Existing verified validation assets

Current project already has useful checks:

- `scripts/validate.py` validates product identity, exact docs/data sets, methodology catalog/package parity, methodology signal/exit catalogs and role-methodology permission consistency;
- `scripts/generate_methodology_policy.py` performs source parity and catalog integrity checks;
- `plugin/test/agent-binding-contract.test.mjs` proves canonical OpenCode agent names fail closed on prompt/mode/permission collisions;
- `plugin/test/role-skill-permission-sync.test.mjs` checks native methodology permission reachability;
- build/test suites exercise runtime behavior.

The target architecture generalizes these into one constitutional validator graph rather than adding more isolated ad-hoc checks.

## Validation layers

### V1 — Structural schema validation

Checks each canonical contract and runtime boundary object against its schema.

Examples:

- unknown Core fields rejected;
- enum/status shape valid;
- bounded arrays/strings;
- HostCapability discriminated status invariants;
- WorkerResult untrusted-boundary limits.

### V2 — Referential integrity

Checks all canonical IDs and refs:

- Role -> PermissionProfile;
- Role -> compatible Methodologies;
- Methodology -> Role/Capability/exit requirement;
- Task -> Role/Methodology/Context/Obligations;
- Authority -> ExternalAction;
- Evidence -> subject/obligation/artifact where applicable.

Unknown refs fail closed.

### V3 — Ownership lint

Every material semantic field is classified as:

```text
CANONICAL OWNER
DERIVED PROJECTION
RUNTIME SNAPSHOT
OBSERVATION
```

Validator/lint rules detect known duplicate-owner patterns, including:

- manual role arrays when RoleContract catalog exists;
- methodology compatible-role truth duplicated in role source after permission generation exists;
- same config option independently defaulted in multiple modules;
- multiple canonical storage writers for one data class.

This layer may combine declarative ownership metadata with targeted AST/static checks. It must not rely on naming heuristics alone for semantic ownership.

### V4 — Config executable-effect lint

For every runtime ConfigOptionContract:

```text
catalog entry -> resolver -> production consumer -> declared executor effect
```

A field accepted by schema/setup but never read in production is `CONFIG_WITHOUT_EXECUTABLE_EFFECT` and fails the constitutional check unless explicitly classified as documentary/setup metadata.

### V5 — Executor reachability lint

A material runtime decision needs a reachable executor.

Representative chains:

```text
Role selected -> TaskRuntime -> host session create/prompt -> observed agent
Topology parallel -> scheduler dispatch capacity -> concurrent workers
HostCapability SUPPORTED -> adapter method -> native primitive
Authority granted -> exact ExternalAction executor -> result Evidence
```

This layer uses production call-graph assertions/targeted tests rather than pretending TypeScript imports prove reachability.

### V6 — Projection parity

Checks canonical contract vs generated artifacts vs host binding.

Role example:

```text
RoleContract
-> generated OpenCodeAgentProjection
-> PACKAGED_HI_AGENTS
-> bound config.agent
-> observed host agent identity
```

Methodology example:

```text
MethodologyContract
-> native SKILL projection
-> generated runtime policy
-> role skill permissions
-> native load eligibility
```

Drift fails closed.

### V7 — Safety monotonicity

Checks that lower-precedence config/projection cannot widen safety constraints.

Examples:

- read-only Role cannot receive `edit=allow` through project/user extension accepted by Hi binding;
- external-effect denial cannot become allow through a preference profile;
- project methodology extension cannot change unrelated Role permissions;
- generic confirmation does not produce Authority.

### V8 — Storage ownership lint

Uses StorageOwnershipContract to assert:

- one canonical write owner per data class/scope;
- project-local state remains under intended `.opencode/hi` surfaces;
- generated/cache/ephemeral data is not mistaken for canonical;
- no nested/leaked runtime state contaminates product source;
- retention/privacy boundaries are respected.

### V9 — Current-only lint

Detects forbidden legacy product files, stale schema owners, compatibility shims and retired component IDs that survive without an accepted current requirement.

Existing `scripts/validate.py` already performs some of this; the target validator moves semantic cases into contract-aware rules.

### V10 — Behavioral-proof linkage

An ADMITTED material contract that claims executable behavior must reference at least one behavioral acceptance scenario. Schema/projection-only proof is insufficient.

## Validator command architecture

Target commands:

```text
npm run contracts:validate
npm run contracts:generate
npm run architecture:lint
npm run projections:check
npm run behavior:accept
npm run check
```

`npm run check` composes all deterministic/local gates appropriate for ordinary development. Real-host/network/release acceptance remains separately gated and cannot be silently treated as local deterministic proof.

## Failure output standard

Every architectural failure should report:

```text
RULE_ID
component/field
canonical owner expected
observed conflicting/missing surface
why this is unsafe/wrong
repair direction
```

Example:

```text
CONFIG_EXECUTOR_MISSING
config: executionPolicy.costSensitivity
owner: ConfigOptionContract/execution policy
observed: parsed and defaulted, no production executor consumer
repair: wire into model policy or remove/reclassify option
```

## Target rule IDs

Initial constitutional rule set:

```text
HI001 DUPLICATE_CANONICAL_OWNER
HI002 UNKNOWN_CONTRACT_REFERENCE
HI003 CONFIG_EXECUTOR_MISSING
HI004 DECISION_EXECUTOR_MISSING
HI005 HOST_CAPABILITY_FAKE
HI006 HOST_PROJECTION_DRIFT
HI007 SAFETY_CONSTRAINT_WIDENED
HI008 AUTHORITY_SCOPE_MISMATCH
HI009 EVIDENCE_FRESHNESS_INVALID
HI010 STORAGE_OWNER_CONFLICT
HI011 GENERATED_ARTIFACT_DIRTY
HI012 GENERATED_ARTIFACT_HAND_EDIT
HI013 ROLE_AGENT_IDENTITY_UNVERIFIED
HI014 METHODOLOGY_PERMISSION_DRIFT
HI015 COMPLETION_BYPASS
HI016 LEGACY_CURRENT_ONLY_VIOLATION
HI017 BEHAVIORAL_PROOF_MISSING
HI018 WORKER_RECOVERY_OWNERSHIP_CONFLICT
HI019 CONTEXT_CONSUMER_MISSING
HI020 ARTIFACT_IDENTITY_COLLISION
```

## Natural-language boundary

Architectural validation must never implement user semantic/authority classification with language-specific keyword dictionaries or regexes. Regex remains legal for technical syntax/protocol facts (IDs, file formats, command technical structure, source parsing where no richer parser exists).

## Migration discipline

Validators become strict in phases:

1. report current debt without breaking unrelated work;
2. migrate one owner class;
3. make corresponding rule fatal;
4. remove old owner;
5. prove behavior;
6. proceed to next class.

No permanent warning mode for a constitutional invariant after migration closure.
