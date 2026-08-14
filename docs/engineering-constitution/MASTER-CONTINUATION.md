# OpenCode-Hi — Living Continuation Ledger

Status: ACTIVE REPOSITORY CONTINUATION ENTRYPOINT

> This file is a navigation/checkpoint ledger, **not** a second canonical architecture database.
> Real repository state wins over this file. Component truth remains in its canonical contract/catalog/runtime owner.

```yaml
continuation_schema: 1
repository: OpenCode-Hi
repository_root: /workspace/OpenCode-Hi
baseline_before_this_ledger_commit: 6a481f7
active_program: Engineering Constitution / Metamodel Migration
active_phase: M9
active_phase_name: Context / Artifact / Project Intelligence / Human Decision / Authority / Storage
phase_status: PARTIAL_PASS
working_tree_expectation: clean
last_verified_full_suite:
  total: 528
  pass: 528
  fail: 0
last_verified_validator: PASS
external_release_actions_authorized: false
next_contract_owner: AuthorityContract / ExternalActionContract
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

Last M9 verification after HumanDecision:

```text
focused HumanDecision/authority/continuation/persistence: 36/36 PASS
controlled full plugin suite: 528/528 PASS
standalone validator: PASS
git diff --check: clean
backup count: 0
```

## Still-open M9 work

In order:

1. **AuthorityContract / ExternalActionContract**
   - audit current `runtime/safety/authority.ts`, command classifier, release-chain and project-authority state;
   - keep exact action-hash protocol separate from HumanDecision;
   - remove duplicate authority/external-action truth only after real owner/executor mapping is proven;
   - generic user continuation must never authorize a privileged action;
   - unknown execution outcome must remain reconciliation-gated;
   - ExternalAction vocabulary remains current-only (`git-push`, `release-create`, `package-publish`, `deploy`) unless source/runtime evidence proves another canonical action.
2. **StorageOwnershipContract**
   - audit `.opencode/hi` and host-native `.opencode/skills/hi-project-*` ownership;
   - one canonical writer per data class;
   - do not relocate host-native skills into Hi internal storage for directory neatness.
3. Close M9 only after both are contract-backed and proven.

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

Start **AuthorityContract / ExternalActionContract source-first audit**.

Before mutation:

```text
git status --short
git log -5 --oneline
```

Then inspect at minimum:

```text
plugin/src/runtime/safety/authority.ts
plugin/src/runtime/safety/command-classifier.ts
plugin/src/runtime/safety/project-authority.ts
plugin/src/runtime/safety/release-chain.ts
plugin/src/runtime/gates/gates.ts
plugin/src/runtime/mission/types.ts
plugin/src/hooks/tool-before.ts
plugin/src/hooks/tool-after.ts
relevant authority/release tests
```

Do not redesign Authority from the HumanDecision schema. HumanDecision tells the system **why/how human interaction is needed**; Authority owns **what exact privileged action is permitted**.
