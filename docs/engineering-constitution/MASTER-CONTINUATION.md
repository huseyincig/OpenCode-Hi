# OpenCode-Hi — Living Continuation Ledger

Status: ACTIVE REPOSITORY CONTINUATION ENTRYPOINT

> This file is a navigation/checkpoint ledger, **not** a second canonical architecture database.
> Real repository state wins over this file. Component truth remains in its canonical contract/catalog/runtime owner.

```yaml
continuation_schema: 1
repository: OpenCode-Hi
repository_root: /workspace/OpenCode-Hi
baseline_before_this_ledger_commit: 52c6be4
active_program: Engineering Constitution / Metamodel Migration
active_phase: M12
active_phase_name: Real-host acceptance
phase_status: PENDING
working_tree_expectation: clean
last_verified_full_suite:
  total: 540
  pass: 540
  fail: 0
last_verified_validator: PASS
external_release_actions_authorized: false
next_contract_owner: Real-host acceptance receipts
```

## Continuation protocol

When a new chat is told to continue OpenCode-Hi from this file:

1. Read this file completely.
2. Inspect real repository truth before mutation:
   - `git status --short`
   - `git log -5 --oneline`
3. If repository state conflicts with this ledger, **repository state wins**. Reconcile the ledger before new product mutation.
4. Read the canonical documents listed below for the active phase.
5. Preserve all existing uncommitted work; never blind-reset/stash/checkout user-owned changes.
6. Continue from `Next action`, not from conversational memory.
7. Every coherent mutation-bearing continuation ends in a **local commit** after verification.
8. Do not push/tag/publish/release/deploy or mutate a real external project unless the user explicitly authorizes it.
9. Test-local ephemeral git remotes/registries remain deterministic fixtures, not release authority.
10. Update `17-IMPLEMENTATION-PROOF.md` and this ledger when the active checkpoint materially changes.

## Canonical reading order

For continuation, read only what is needed in this order:

1. `docs/engineering-constitution/MASTER-CONTINUATION.md` — current checkpoint/navigation only.
2. `docs/engineering-constitution/17-IMPLEMENTATION-PROOF.md` — implementation/proof truth.
3. `docs/engineering-constitution/06-CONTRACT-CATALOG.md` — component semantic contracts.
4. `docs/engineering-constitution/08-SCHEMA-CATALOG.md` — machine-schema rules.
5. `docs/engineering-constitution/13-MIGRATION-MATRIX.md` — phase ordering/dependencies.
6. Relevant ADR(s) and production source for the active component.

Do **not** load all constitution/source-study files into context unless the current decision actually requires them.

## Current committed checkpoint chain

Recent architecture migration checkpoints:

```text
811ee7f  ArtifactContract
3e8ab72  ContextReferenceContract
eb81d13  ContextReference proof provenance
b7e51cc  SemanticContextContract
d45b7ba  SemanticContext proof provenance
e2d021b  ProjectIntelligenceContract
961736a  ProjectIntelligence proof provenance
46fc7b7  HumanDecisionContract
6a481f7  HumanDecision proof provenance
da67329  AuthorityContract / ExternalActionContract
ea6c236  StorageOwnershipContract
4602907  M10 common generator / architecture lint graph
```

Earlier M8/M7/M6/M4/M2/M1/M0 checkpoints remain recorded in `17-IMPLEMENTATION-PROOF.md`.

## M9 current truth

### ArtifactContract — PASS

Canonical code checkpoint: `811ee7f`.

- artifact identity is independent from content hash/provenance;
- content hash verifies content;
- source linkage is provenance/freshness, not identity;
- privacy/retention/consumer refs are explicit;
- current-only storage validation is fail-closed.

### ContextReferenceContract — PASS

Canonical code checkpoint: `3e8ab72`.

- Mission context inventory availability != Task selection;
- selected references bind exact Task consumer;
- durable Artifact consumer refs are updated;
- non-durable freshness is `UNKNOWN`;
- live Artifact freshness is checked again at consumption.

### SemanticContextContract — PASS

Canonical code checkpoint: `b7e51cc`.

- derived/non-persisted;
- safe `file:<project-relative-path>` source ref + source SHA-256;
- exact Task consumer;
- exact selected source ranges and rendered-character budget;
- no fabricated dependency graph/relationships;
- live source file is not wrapped in a fake Artifact.

### ProjectIntelligenceContract — PASS

Canonical code checkpoint: `e2d021b`.

- PI is project FACT/PATTERN state, not generic memory;
- strict `source_refs[]` combine safe file refs with exact SHA-256;
- confidence/freshness/lifecycle/consumer domain explicit;
- TaskRuntime consumes only `ACTIVE + FRESH + task-context + scope-intersecting` PI;
- mutation/hash drift invalidates freshness;
- PI never becomes Evidence;
- repeated independent reusable-HOW evidence remains owned by `ProjectMethodologyCandidate`.

### HumanDecisionContract — PASS

Canonical code checkpoint: `46fc7b7`.

- latest human decision is persisted/restart-safe;
- all direct `waiting-user + user.action.required` producers route through one runtime owner;
- semantic types include `operational_action` for provider/permission/runtime/precondition cases;
- exact Mission/Task/Worker blocking scope and response protocol are structured;
- duplicate open decisions preserve identity and do not duplicate interaction events;
- non-authority follow-up may resolve a decision;
- `authority_request` cannot be resolved by generic continuation;
- HumanDecision is a completion/progress/status input;
- HumanDecision does **not** grant Authority.

### AuthorityContract / ExternalActionContract — PASS

Canonical code checkpoint: `da67329`.

- canonical ExternalAction vocabulary is exactly `git-push | release-create | package-publish | deploy`;
- technical command kinds map into that vocabulary rather than becoming duplicate Core action types;
- exact Authority identity binds semantic action + command + cwd target into one deterministic hash/ID;
- persisted Authority state is strict/current-only and rejects malformed or ambiguous active lifecycle state;
- HumanDecision remains interaction state only and generic continuation remains non-authoritative;
- unknown execution outcome remains in-flight/reconciliation-gated and cannot be blindly replayed;
- project-native persistent `always` grants use the same four semantic classes: `git-push` does not imply `release-create`;
- current classifier/projection parity includes `yarn npm publish` and `kubectl delete`;
- explicit deny monotonicity, force-push ask behavior, parent-only external effects and release-chain remote proof remain preserved.

Last M9 verification after StorageOwnership:

```text
focused storage/doctor/methodology/authority/routing: 66/66 PASS
controlled full plugin suite: 538/538 PASS
standalone validator: PASS
python storage-uninstall behavior scenario: PASS
python source syntax compile: PASS
pytest full Python harness: NOT RUN — pytest module absent on host

git diff --check: clean
backup count: 0
real external actions: none (test-local deterministic fixtures only)
```

### StorageOwnershipContract — PASS

Canonical code checkpoint: `ea6c236`.

- machine-readable catalog enforces one canonical `scope + data_class` owner;
- current `.opencode/hi/**`, OS runtime state and `.opencode/skills/hi-project-*` classes have explicit owner/lifecycle/path/write/read/retention/privacy mapping;
- routing command surfaces share one logical project-routing owner rather than becoming duplicate truths;
- setup uninstall no longer deletes independently-owned routing/Authority policy or project knowledge/artifact/skill state;
- project methodology skill storage remains OpenCode-native `.opencode/skills/hi-project-*`;
- doctor validates runtime state against canonical `RUNTIME_STATE_SCHEMA` instead of stale schema `3`;
- M9 BA06/BA10/BA11 behavior remains green in the 538-test controlled suite.

## M9 closure

M9 is **PASS — CONTRACT OWNERSHIP CLOSED** at T1/T2. Artifact, ContextReference, SemanticContext, ProjectIntelligence, HumanDecision, Authority/ExternalAction and StorageOwnership all have canonical runtime/schema owners and current proof checkpoints.

## M10 current truth

Canonical code checkpoint: `4602907`.

- build composes canonical role/agent/methodology projections and postbuild generates 30 deterministic ProjectionReceipts using the existing M1 receipt contract;
- BA12 is executable: repeated identical generation is byte-identical, and one RoleContract purpose mutation changes only its declared role projections;
- `architecture_lint.mjs` emits every HI001–HI020 rule ID and fails migrated-class ownership/reference/host projection/storage/generated artifact/role-agent/methodology/current-only/proof-link drift;
- runtime-behavior rules are explicitly LINKED to controlled tests rather than represented as fake static proof;
- HI003 remains explicitly DEFERRED with the existing M5 ConfigOptionContract host-policy blocker; this is not an M10 PASS claim for unmigrated config;
- integrated deterministic check is 540/540 PASS + architecture lint PASS + standalone validator PASS.

M10 status: **PASS — MIGRATED CLASSES CLOSED; HI003 DEFERRED WITH M5**.

## M11 current truth

M11 status: **PASS — DETERMINISTIC CLOSURE COMPLETE**.

- integrated committed-state closure: 540/540 PASS;
- targeted BA12/contract/authority/storage/host-capability negative set: 62/62 PASS;
- architecture lint: PASS, 20 rule IDs, HI003 explicitly deferred with M5;
- standalone validator: PASS;
- `git diff --check`: clean; backup count: 0;
- M11 found one cwd-dependent host-capability acceptance test assumption; checkpoint `52c6be4` makes acceptance source resolution test-file-relative and invocation-location independent;
- no real external release action was executed.

## Open earlier migration blockers / partials

Do not silently declare these closed:

- **M3 PermissionProfile** — prior SentinelX policy blocked direct permission-catalog mutation. Current runtime permissions remain operational but full canonical PermissionProfile migration is open.
- **M5 ConfigOptionContract** — prior host policy blocked direct config-catalog mutation.
- **M6 ModelCapabilityProfile** — host inventory normalization/identity contract is operational; requested/projected WorkerState snapshot wiring remains previously deferred/blocked.
- **M7 HostCapability** — local contract registry PASS; real-host T3 acceptance remains M12 work.

## Core invariants that remain binding

- Hi decides; host executes the richest valid native primitive.
- Prompt text/frontmatter/generated config are projections, not canonical semantic truth.
- ROLE != AGENT != MODEL != METHODOLOGY != TASK != WORKER != TOPOLOGY != WORKFLOW != HOST PRIMITIVE.
- PROOF -> Evidence; FACT/PATTERN -> Project Intelligence; reusable HOW -> Methodology; control decision -> Runtime Policy.
- Natural-language semantic routing belongs to structured host-primary semantic assessment, not regex/keyword dictionaries.
- Exact safety protocol tokens remain a separate deterministic Authority boundary.
- Config/state fields without a real producer/consumer/executor are defects, not architecture.
- No fake host capability, no fake visual/browser/process/isolation PASS.
- Completion remains deterministic and evidence/authority/freshness scoped.
- Selected methodology != loaded methodology.
- Minimum sufficient compute/context/topology is preferred over agent/prompt proliferation.
- Current working tree is truth; never blind rollback.

## Next action

Start **M12 real-host acceptance** only at T3 boundaries described by `13-MIGRATION-MATRIX.md` and the host projection/behavioral acceptance documents.

Before any host exercise:

```text
git status --short
git log -5 --oneline
```

Read the minimum canonical host acceptance surfaces:

```text
docs/engineering-constitution/12-HOST-PROJECTION-ARCHITECTURE.md
docs/engineering-constitution/11-BEHAVIORAL-ACCEPTANCE.md
docs/engineering-constitution/13-MIGRATION-MATRIX.md   # M12
plugin/src/contracts/host-capability.ts
plugin/src/opencode/capabilities.ts
existing real-host/OpenCode CLI harnesses and receipts
```

Requirements:

1. bind every T3 claim to the actual OpenCode version/identity and captured artifact/receipt;
2. exercise only material native primitives needed to validate current HostCapability claims;
3. classify harness timeout/transport failure separately from product failure and inspect produced artifacts before verdict;
4. do not infer T3 support from local mocks/bare remotes/fixtures;
5. **do not push/tag/release/publish/deploy** and do not perform any other real external mutation without explicit user authorization;
6. keep M3/M5/M6 partial/blocker state explicit.
