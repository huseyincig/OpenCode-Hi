# 13 — Migration Matrix

Status: V1 ORDERED MIGRATION PLAN — IMPLEMENTATION NOT STARTED

## Purpose

Move the current runtime to the component metamodel without breaking proven behavior or preserving obsolete duplicate owners. Migration is ordered by dependency direction and risk, not by file convenience.

## Rules

- one semantic owner class migrates at a time;
- old and new owners may coexist only inside a bounded parity phase;
- parity phase ends by deleting/reclassifying the old owner, not by permanent dual truth;
- every phase has structural, projection and behavioral gates;
- current 458/458 controlled baseline remains regression evidence, not proof of future migration behavior;
- no broad real-host/release work until deterministic/local contract migration is coherent.

## Current observed debt relevant to this program

| Debt | Current surface | Classification | Target |
|---|---|---|---|
| Role semantics mixed with host agent frontmatter/prompt | `roles/*.md` | DUPLICATE/WRONG OWNER RISK | canonical RoleContract -> generated role/OpenCode projections |
| Role IDs/classes/obligation ownership hand-maintained separately | `plugin/src/runtime/roles/catalog.ts` | DUPLICATE SEMANTIC TRUTH | generated runtime Role catalog from RoleContract |
| Methodology has strong canonical JSON but structured facts also repeated in SKILL and role permissions | `data/hi-methodologies.json`, `skills/*/SKILL.md`, `roles/*.md` | PARITY-MANAGED MULTI-SURFACE | one MethodologyContract -> generated native skill/mechanical permissions |
| Host capability is runtime boolean inventory + degraded strings | `plugin/src/opencode/capabilities.ts` | INCOMPLETE CONTRACT MODEL | HostCapabilityContract registry with status/loss/acceptance |
| Config options are typed/defaulted but not contract-cataloged | `plugin/src/config/*` | GOVERNANCE GAP | ConfigOptionContract + executor-effect lint |
| Agent binding validates packaged projection derived from role Markdown | `agent-binding.ts`, generated agent config | PROJECTION SOURCE GAP | bind projection generated from RoleContract |
| Native agent reuse audit exists as helper with no verified production policy owner | `runtime/routing/agent-reuse.ts` | DECISION WITHOUT VERIFIED EXECUTOR/CALLSITE | integrate as explicit design policy or remove/reclassify |
| Storage ownership lives primarily in docs/runtime-specific modules | storage docs + runtime services | VALIDATION GAP | machine StorageOwnershipContract/lint |
| Existing validator is powerful but monolithic/ad-hoc | `scripts/validate.py` + generator checks/tests | GOVERNANCE SCALING GAP | contract-aware layered validator while preserving current checks |

## Migration phases

### M0 — Constitution foundation

**State:** documentation/design phase active.

Deliverables 01–16 define ontology/contracts/templates/schemas/generator/validation/acceptance/host/migration decisions.

Exit:

- docs internally consistent;
- no stale PENDING status for completed design deliverables;
- local constitution-foundation checkpoint commit.

### M1 — Common contract primitives and provenance

Implement:

- canonical ID/schema/lifecycle primitives;
- ProvenanceRecord;
- contract parse/validation framework;
- projection receipt type/hash utility.

Do **not** migrate role behavior yet.

Gates:

- schema negative tests;
- deterministic hash/receipt tests;
- no runtime behavior change;
- full controlled suite unchanged.

### M2 — RoleContract canonical owner

Implement canonical contracts for all current 8 roles preserving existing behavior.

Initial migration source:

- `roles/*.md` mechanical fields;
- `runtime/roles/catalog.ts` role class/read-only/reviewer/obligation ownership;
- existing routing/runtime tests.

Generate:

- runtime Role catalog/types;
- OpenCode agent projection;
- role human/prompt projection or validated guidance body;
- methodology permission contribution.

Parity window:

1. new contract generated output compared to current packaged agents/runtime catalog;
2. all role tests/agent-binding tests pass;
3. BA01 fixture extension passes;
4. delete hand-maintained runtime role arrays/obligation map and mechanical role frontmatter ownership.

Exit requires no two canonical Role owners.

### M3 — PermissionProfileContract

Extract mechanical role permissions into reusable profiles/overlays where doing so reduces duplication without hiding role-specific restrictions.

Do not over-normalize: a one-off rule may remain in a role's contract if it is genuinely role-specific.

Gates:

- read-only roles cannot gain edit;
- safety monotonicity negative tests;
- project methodology extension remains the only tolerated role binding extension unless explicitly expanded by ADR.

### M4 — MethodologyContract normalization

Preserve all 27 current methodologies and signal/exit ownership.

Migrate authored structured fields so one canonical MethodologyContract owns:

- purpose/trigger/negative trigger;
- roles;
- activation signals;
- exit requirements;
- costs/composition/resources/provenance.

Generate/compile:

- native `SKILL.md` structured contract sections/frontmatter where appropriate;
- runtime methodology policy;
- role native skill permissions.

Human Method body remains authorable through T02 but cannot own mechanical role/capability/authority facts.

Gates:

- current methodology count/names unchanged unless separate ADR;
- selected != loaded behavior preserved;
- project admission/collision/provenance tests pass;
- BA02 passes.

### M5 — ConfigOptionContract and executable-effect lint

Catalog every current `HiConfig` runtime option:

```text
executionPolicy
primaryMode
compatibility.*
routing.*
execution.*
models.*
parallel.*
teamMode.*
profile.*
```

For each, prove consumer/effect or remove/reclassify.

Specific audits:

- `execution.maxAgents` vs topology/scheduler effect;
- `parallel.max/providers/models` resource ceilings;
- `teamMode` enabled/member/wall limits;
- `models.mode/default/roles` actual resolver usage;
- routing strategies/fallback/provider denial;
- compatibility mode/version behavior.

Gates: BA03 representative config effect tests + HI003 lint fatal for migrated options.

### M6 — ModelCapabilityProfile / model observation

Create model capability/profile input separate from Role. Preserve current resolver and effective-model reconciliation.

Gates:

- requested/selected/projected/observed/effective identities explicit;
- mismatch blocks/degrades correctly;
- BA04 passes;
- model quirks that are purely model-ID technical facts either gain capability metadata or remain documented technical fallback, never user semantic routing.

### M7 — HostCapabilityContract registry

Replace/augment boolean capability inventory with contract-backed statuses while preserving adapter behavior.

Map every current capability. Explicitly classify process lifecycle and workspace isolation binding without fake support.

Gates:

- doctor reports status/semantic loss;
- unsupported negative acceptance;
- BA05 passes at controlled tier;
- no host method-name existence alone upgrades status to behaviorally verified.

### M8 — Task/Worker/Result/Evidence contract extraction

Mission types are currently a large central type owner. Split reusable domain contracts where this reduces ownership ambiguity without destabilizing Mission aggregate semantics.

Priorities:

1. WorkerResult boundary;
2. Evidence/VerificationEnvelope/ReviewFinding;
3. Task and Worker runtime state contracts;
4. ExecutionPlan/Topology/Team/Recovery references.

Gates: BA07–BA09 plus existing task/recovery/team tests.

### M9 — Context / Artifact / PI / Human / Authority / Storage contracts

Normalize existing proven implementations into the common contract system. This is primarily ownership/schema/validation migration, not a rewrite.

Gates:

- Context remains consumer-scoped;
- PI cannot become Evidence;
- HumanDecision remains separate from Authority;
- exact external actions remain authority-bound;
- one storage writer per data class;
- BA06, BA10, BA11 pass.

### M10 — Common generator and architecture lint closure

Consolidate independent generation checks into the target generator/validator graph.

Gates:

- generator idempotence BA12;
- generated tree clean after build;
- owner/reference/config/executor/projection/storage rules fatal for migrated classes;
- legacy owner files removed/reclassified;
- docs/status/proof ledger generated or parity checked where appropriate.

### M11 — Deterministic full regression closure

Run:

- build;
- current validator + new contract validators;
- full controlled deterministic plugin suite;
- generator idempotence;
- architecture lint;
- targeted negative tests.

Historical 458/458 is baseline only. New count becomes closure evidence.

### M12 — Real-host acceptance

Only after M11.

Exercise material OpenCode primitives and record version/identity/artifacts. Harness timeout is classified separately from product failure.

### M13 — Release readiness

Not executed unless explicitly requested. Push/tag/publish/release/deploy remain authority-bound external actions.

## Replacement matrix

| Old owner/surface | New owner | During parity | End state |
|---|---|---|---|
| `roles/*.md` mechanical frontmatter | RoleContract + PermissionProfile | compare generated projection byte/semantic parity | Markdown is generated/guidance projection only |
| `runtime/roles/catalog.ts` hand lists/maps | generated Role runtime catalog | import new catalog in tests first | hand-maintained IDs/maps removed |
| role skill permission maps | Methodology/Role contract projection | parity tests | generated only |
| methodology structured fields in SKILL | MethodologyContract | compile and compare | SKILL structured section generated/validated; Method body authorable |
| capability booleans | HostCapability registry + derived convenience view | adapter exposes both temporarily | boolean view derived only |
| config schema/default-only governance | ConfigOption catalog + generated/validated schema/default | parity resolver tests | catalog owns semantics; runtime schema is projection/consumer |
| ad-hoc ownership docs | StorageOwnershipContract + generated docs/parity | compare matrix | docs generated or validator-backed |

## Rollback strategy

Migration rollback means reverting the **current coherent local commit** if its acceptance gates fail and repair cannot be made safely in-place. It does not mean retaining old semantic owners indefinitely.

Pre-existing user work and dirty files remain protected; generated files may be regenerated, user-authored canonical contracts may not be discarded without explicit diff review.
