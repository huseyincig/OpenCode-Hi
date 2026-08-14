# OpenCode-Hi — Canonical Continuation, Coverage, and Product-Closure Ledger

Status: **ACTIVE SINGLE CONTINUATION ENTRYPOINT**

> This file is the canonical **work/navigation ledger** for continuing OpenCode-Hi.
> It consolidates the two pre-MASTER working sources, the Engineering Constitution migration program, and the verified live repository state.
> It is not a replacement for component-owned canonical data/contracts. **Live repository state always wins over this ledger when they conflict.**

```yaml
continuation_schema: 2
repository: OpenCode-Hi
repository_root: /workspace/OpenCode-Hi
coverage_reconciliation_baseline_head: 8ba9eb561332eebc3b6bded90a1c0d2da501d1ed
active_program: OpenCode-Hi Product Closure after Constitution Migration
active_phase: P7
active_phase_name: Real-host reacceptance for changed host-bound surfaces
phase_status: OPEN
working_tree_expectation: clean
last_verified_full_suite:
  total: 563
  pass: 563
  fail: 0
last_verified_architecture_lint: "PASS rules=21 deferred=0 linked=8"
last_verified_validator: PASS
current_projection_receipts: 32
external_release_actions_authorized: false
next_contract_owner: registry-latest OpenCode host -> changed adapter/control surfaces -> exact-version T3 receipt
```

---

## 1. How to continue from this file

Every future continuation MUST begin here and follow this exact discipline:

1. Read this file completely.
2. Inspect real repository truth before mutation:
   ```bash
   cd /workspace/OpenCode-Hi
   git rev-parse HEAD
   git status --short --branch
   ```
3. If repository state conflicts with this file, **repository state wins**. Reconcile this ledger after the source truth is understood.
4. Read only the canonical owners and proofs needed by the current `Next action`; do not flood context with every architecture document.
5. Trace every material change as:
   `declaration -> canonical owner -> producer -> consumer -> executor/host action -> observed result -> state/evidence -> completion effect`.
6. Do not call a capability complete because a file, interface, generated artifact, prompt, or green unit test exists.
7. Preserve user work. Never blind reset/stash/checkout/restore an unknown dirty tree.
8. Use isolated writable `HOME`/XDG paths for controlled plugin suites. `/root/.local/state` EACCES is known harness noise, not product evidence.
9. End every coherent mutation-bearing checkpoint with verification and a **local commit**.
10. Never push, tag, create a real release, publish a real package, or deploy without explicit user authorization. Test-local ephemeral remotes/registries remain valid deterministic fixtures.

### Evidence tiers

- **T0** — static/schema/validator proof.
- **T1** — deterministic unit/contract proof.
- **T2** — in-process integration/runtime wiring proof.
- **T3** — exact-version real-host acceptance.
- **T4** — real external publication/release proof; requires explicit authority.

### Completion vocabulary used in this ledger

- **CLOSED** — owner, producer, consumer/executor, and sufficient current proof exist.
- **CLOSED / PERMANENT INVARIANT** — current implementation is closed, but the rule remains continuously binding as the product evolves.
- **SUBSUMED** — the semantic requirement is implemented under another natural owner; no second standalone subsystem should be created merely to match an old filename suggestion.
- **PARTIAL** — meaningful implementation exists but a required producer/consumer/proof link is still missing.
- **OPEN** — a concrete product gap remains.
- **HOST-LIMITED** — the product truthfully exposes a host capability as DEGRADED/UNSUPPORTED; do not manufacture support.
- **NOT REQUESTED** — work is intentionally outside current authority/scope.
- **HISTORICAL** — superseded checkpoint text retained only for provenance, not current work.

---

## 2. Source authority consolidated into this MASTER

This ledger was rebuilt after a one-time full comparison of two pre-MASTER sources against the live repository.

### Source A — Engineering Constitution Raw Recovery Appendix

Historical source artifact: `OpenCode-Hi_ENGINEERING_CONSTITUTION_RAW_RECOVERY_2026-08-14.md`.

It contains the recovered Constitution contract/schema/proof material, especially:

- C01–C29 Component Contract Catalog;
- S00–S27 Machine Schema Catalog;
- the historical Implementation/Proof Ledger snapshot;
- the rule that design/ADR/schema prose is **not** runtime implementation proof.

This source remains authoritative for semantic intent where current canonical owners do not supersede it. Its old status banners such as `IMPLEMENTATION PENDING` are historical and must not override newer executable proof.

### Source B — Canonical Checkpoint Override

Historical source artifact: `OpenCode-Hi_Canonical_Checkpoint_OVERRIDE_2026-08-13_1918.md`.

It contains the broader product-development contract:

- product mission and no-legacy policy;
- host-portable Core / OpenCode-primary adapter boundary;
- language-agnostic structured semantic assessment;
- methodology lifecycle/admission/learning/composition/exit rules;
- role/agent/model/topology distinctions;
- minimum-sufficient computation;
- evidence, completion, STOP, authority, privacy and storage rules;
- Stage 1–10 roadmap;
- Section 90 blind spots A–N;
- local commit discipline and no-real-release restriction.

The append-only later override in that source supersedes its earlier conflicting `do not commit` statement: coherent mutation-bearing work now **must end in a local commit**. Push/tag/release/publish/deploy remain separately unauthorized.

### Precedence after this reconciliation

```text
explicit new user instruction
  > real current repository state
  > current canonical component owners / executable contracts
  > this MASTER continuation ledger
  > live explanatory architecture documents
  > historical Source A / Source B checkpoint wording
  > conversational memory
```

Do not use this precedence to silently weaken a permanent safety/product invariant. If a newer implementation appears to contradict one, trace the owner/executor chain and record the deliberate decision.

---

## 3. Permanent product invariants — never mark these “finished and forgotten”

These rules remain binding across every future phase:

- Hi decides product semantics; the host executes the richest correct native primitive.
- OpenCode is the primary/reference host, not the Hi ontology.
- Hi Core semantic contracts must remain host-portable; OpenCode-specific fields stay at adapter/projection boundaries.
- `ROLE != AGENT != MODEL != METHODOLOGY != TASK != WORKER != TOPOLOGY != TEAM`.
- Methodology is a reusable Hi HOW; OpenCode skill is the current host-native load primitive.
- Available methodology != activated methodology; selected methodology != loaded methodology.
- Natural-language user semantics are model-understood then submitted as bounded structured Hi state; no expanding per-language keyword/regex authority.
- Technical command/path/protocol parsing may remain deterministic where it is genuinely language-neutral.
- Read intent != mutation authority. Generic continuation != external-action approval.
- Host/native permission may be narrowed by Hi but never silently widened by a lower layer.
- No fake host capability. DEGRADED/UNSUPPORTED is preferable to fabricated support.
- Config without a real consumer/executor effect is invalid runtime config.
- State without a producer or consumer is a defect, not architecture.
- Prompt-only safety/policy is insufficient when a deterministic control-plane gate is possible.
- Evidence != Project Intelligence != Methodology != Policy != temporary context.
- Model/worker prose saying DONE is not proof; green tests alone are not whole-system proof.
- Completion requires current obligations, evidence freshness, methodology exits, review, authority, pending work, rollback and user-stop state to reconcile deterministically.
- STOP is authoritative; do not continue speculative work after deterministic completion.
- Use minimum sufficient model/context/topology/verification; optimization overhead must not exceed expected benefit.
- Preserve user-owned dirty files and exact authority boundaries.
- Repository/internal artifacts stay English; user conversation language is unrestricted.
- README English is canonical user documentation; translations must not invent behavior.
- No obsolete internal compatibility aliases/migrations unless a current product requirement explicitly needs them.
- No real push/tag/release/package publish/deploy without explicit authority.

---

## 4. Verified constitution-migration history

The Constitution design plus its M0–M12 migration/acceptance track is materially implemented. This does **not** mean the broader Source-B product roadmap is fully closed.

| Track | Current truth | Key closure |
|---|---|---|
| M0 | Constitution documentation foundation | PASS |
| M1 | common/provenance primitives | PASS |
| M2 | RoleContract owner/generator | PASS; general permission residue later closed by M3 |
| M3 | PermissionProfile | **CLOSED** at `9801382`; 7 profiles, exact native permission parity, Markdown no longer mechanical permission owner |
| M4 | Methodology normalization | PASS; 27 built-ins, generated mechanical SKILL contract |
| M5 | ConfigOptionContract | **CLOSED** at `d53fe31`; 32 exact leaves, 29 runtime + 2 diagnostic + 1 schema marker, HI003 fatal PASS |
| M6 | Model capability / worker execution identity | **CLOSED for worker execution identity** at `ec2bdd3`; requested/selected/projected/observed-effective chain persisted and reconciled |
| M7 | HostCapability registry | local PASS; real-host material verification completed by M12; process/workspace limitations remain truthful |
| M8 | Task/Worker/Result/Evidence/Review/Verification contracts | PASS |
| M9 | Context/Artifact/PI/Human/Authority/ExternalAction/Storage ownership | PASS for migrated owners |
| M10 | common generator / architecture-lint closure | PASS |
| M11 | deterministic full closure | PASS; cwd-dependent test harness defect fixed |
| M12 | OpenCode real-host acceptance | **PASS_MATERIAL_WITH_LIMITATIONS** on OpenCode 1.18.16/aarch64 |
| M13 | release readiness / T4 | **NOT REQUESTED** |

Recent closure checkpoints:

```text
9801382  refactor: migrate role permissions to canonical profiles
13a546c  docs: record M3 permission profile closure
d53fe31  refactor: formalize executable config option contracts
318d1cc  docs: record M5 config option closure
ec2bdd3  refactor: persist model execution identity snapshots
8ba9eb5  docs: record M6 model identity closure
f8c9f24  fix: enforce primary direct implementation authority
dc8c59c  test: lock primary model as host-selected
05724b1  fix: bind methodologies to host execution capability
```

Current deterministic baseline before this coverage-ledger rewrite:

```text
controlled full suite: 563/563 PASS
architecture lint: PASS rules=21 deferred=0 linked=8
validator: PASS
projection receipts: 32
backup count: 0
```

---

## 5. Constitution C01–C29 / S00–S27 live coverage map

The old schema catalog listed suggested filenames. **Filename parity is not the goal. Semantic owner/executor/proof parity is.** A missing suggested module is a defect only when its semantic responsibility lacks a real owner or validation boundary.

| Contract / schema | Live owner / implementation | Status | Remaining truth |
|---|---|---|---|
| C01 / S01 RoleContract | `data/hi-roles.json`, `contracts/role.ts`, generated role/agent projections | **CLOSED** | Primary direct implementation authority is now enforced from canonical `repositoryWriteAuthority` at the `hi_direct_progress` control-plane boundary. |
| C02 / S02 PermissionProfile | `data/hi-permission-profiles.json`, `contracts/permission-profile.ts` | **CLOSED** | Safety monotonicity and read-only edit denial executable. |
| C03 / S03 MethodologyContract | `data/hi-methodologies.json`, generated policy/SKILL projections, runtime catalog | **CLOSED current scope** | Mandatory resource requirements are canonical `host-capability:<id>` references consumed by selection/preflight; unsupported executor resources fail closed. |
| C04 / S04 ModelCapabilityProfile | `contracts/model.ts`, model resolver, WorkerContract snapshots | **CLOSED current claims** | Child/worker constrained identity is reconciled; primary Hi agents intentionally do not constrain model/variant, leaving primary selection host-owned and preventing fake primary model state. |
| C05 / S05 HostCapability | `contracts/host-capability.ts`, OpenCode detector/doctor | **CLOSED registry / HOST-LIMITED capabilities** | Process lifecycle DEGRADED; workspace isolation UNSUPPORTED; browser execution explicitly UNSUPPORTED until a deterministic executor adapter exists. |
| C06 / S06 ConfigOption | `data/hi-config-options.json`, `contracts/config-option.ts`, generated defaults | **CLOSED** | 32 leaves, real effect/diagnostic classification, HI003 fatal. |
| C07 / S07 TaskContract | `contracts/task.ts`, TaskRuntime | **CLOSED** | Task identity/obligations/context/external-action snapshots current-only. |
| C08 / S08 WorkerContract | `contracts/worker.ts`, TaskRuntime, persistence | **CLOSED for workers** | Includes attempts/recovery/model identity/native diff state. |
| C09 / S09 ExecutionPlan | Mission Task DAG + dependencies + gates + obligations + topology form the live trajectory | **SUBSUMED / DERIVED — CLOSED** | Persistence now rejects duplicate/unknown/self/cyclic task dependencies; no second plan store is required. |
| C10 / S10 Topology | `runtime/execution/topology-policy.ts`, MissionState topology, TaskRuntime scheduler | **DERIVED / CLOSED current execution path** | Decision owns agent count/parallelism/reason; persisted snapshot validates bounded parallelism and `single => 1`; scheduler executes it. |
| C11 / S11 TeamContract | `contracts/team.ts` + `runtime/team/team-runtime.ts` bounded projection over TaskRuntime | **CLOSED current semantics** | Team projection is intentionally process-ephemeral; strict contract binds generation/member Task/role/capacity/terminal state while durable Task/Worker/obligation/evidence identity owns restart continuity. |
| C12 RetryAttempt | Worker `attempt`, `fallback_history`, recovery ledger/events | **SUBSUMED** | No second RetryAttempt store needed unless a real independent consumer appears. |
| C13 / S12 RecoveryContract | TaskRuntime provider/stagnation/restart recovery + continuation recovery | **CLOSED operationally / SUBSUMED** | Old-executor abort/reconciliation and bounded fallback are executable; keep role/task identity invariant. |
| C14 / S13 WorkerResult | `contracts/worker-result.ts` | **CLOSED** | Boundary-untrusted structured result. |
| C15 / S14 Evidence | `contracts/evidence.ts`, evidence runtime | **CLOSED** | Freshness/ownership/obligation scope enforced. |
| C16 / S15 VerificationEnvelope | `contracts/verification-envelope.ts`, derived verification policy | **CLOSED** | Derived, not second persisted truth. |
| C17 / S16 ReviewFinding | `contracts/review-finding.ts`, TaskRuntime reviewer reconciliation | **CLOSED** | Structured finding authority/evidence. |
| C18 / S17 Artifact | `contracts/artifact.ts`, ContextArtifactStore | **CLOSED** | Identity != content hash != provenance. |
| C19 / S18 ContextReference | `contracts/context-reference.ts`, Task snapshots | **CLOSED** | Availability != selection. |
| C20 / S19 SemanticContext | `contracts/semantic-context.ts`, TypeScript bounded extractor, TaskRuntime consumer | **CLOSED current TypeScript adapter** | Other language adapters are future capability, not fabricated current support. |
| C21 / S20 ProjectIntelligence | `contracts/project-intelligence.ts`, durable store + invalidation + TaskRuntime consumer | **CLOSED current scope** | Reusable HOW remains methodology candidate, not PI. |
| C22 / S21 HumanDecision | `contracts/human-decision.ts`, runtime owner, persistence | **CLOSED** | Operational/user/authority decisions remain distinct. |
| C23 / S22 Authority | `contracts/authority.ts`, authority runtime/hooks | **CLOSED** | Exact action hash/scope; generic continuation cannot grant authority. |
| C24 / S23 ExternalAction | `contracts/external-action.ts`, release/authority command boundary | **CLOSED local architecture** | Real external execution remains authority-bound; T4 not requested. |
| C25 / S27 HostAgentProjection | role/permission/methodology generators + `opencode/agent-binding.ts` + receipts | **SUBSUMED / CLOSED projection** | Generated host surface is source-bound and collision-checked; no independent handwritten projection truth. |
| C26 / S24 Provenance | `contracts/provenance.ts`, projection/project-methodology/release provenance | **CLOSED** | Provenance does not imply admission. |
| C27 / S25 StorageOwnership | `data/hi-storage-ownership.json`, contract/resolver/doctor | **CLOSED** | One canonical writer per class; host-native project skills remain outside internal Hi store. |
| C28 / S26 TelemetryEvent | bounded Mission ledger/state + `runtime/ledger/metrics.ts`; deterministic benchmarks remain offline simulation | **SUBSUMED / DERIVED DIAGNOSTICS** | No independent event-store consumer exists; metrics are read-only projections and telemetry never owns authority. |
| C29 ArchitectureDecision | Engineering Constitution/ADR convention + `hi-architecture-decisions` methodology | **DOCUMENTARY / PROCESS — CLOSED classification** | No runtime machine consumer exists; durable rationale stays in project ADR convention rather than invented runtime state. |
| S00 common primitives | `contracts/common.ts` + shared strict validators | **CLOSED current primitives** | Do not create aliases merely to mirror an old type list. |
| S26/S27 note | See C28/C25 above | **CLOSED classification** | S26 is deliberately derived diagnostics; S27 is generated/receipt-bound host projection. |

### Important status-banner note

P4 reconciled the historical `06-CONTRACT-CATALOG.md` / `08-SCHEMA-CATALOG.md` candidate/pending banners to current responsibility classification. The catalogs now distinguish standalone machine contracts from derived/subsumed runtime validation and documentary/process owners; executable repo proof still wins over explanatory text.

---

## 6. Source-B Sections 1–93 coverage map

This section exists so no requirement from the broad working checkpoint disappears merely because the Constitution migration finished.

| Source-B section(s) | Requirement family | Current status |
|---|---|---|
| 1 | Git/release restriction | **CLOSED / PERMANENT INVARIANT** — local commits required by later override; real external mutations unauthorized. |
| 2 | no legacy compatibility | **CLOSED / PERMANENT INVARIANT** — current-only schema/persistence policy. |
| 3–5 | Hi/Core vs host-native boundary, portability, upstream reality | **CLOSED current architecture / PERMANENT REVALIDATION** — historical M12 was bound to OpenCode 1.18.16; current host work must first resolve the registry `latest` version and revalidate against that exact version. |
| 6–8 | minimum sufficient topology, independent axes, compute economics | **CLOSED current policy / PERMANENT INVARIANT**. |
| 9–10 | documentation truth + English internal language | **PERMANENT INVARIANT**. |
| 11–13 | language-agnostic semantics, assessment gate, follow-up quarantine | **CLOSED current runtime** — structured semantic state; fresh-session constraint rebase; no language dictionary authority. |
| 14 | authority semantics | **CLOSED / PERMANENT INVARIANT**. |
| 15–17 | repository reality audit, executable graph, owner map | **PERMANENT DEVELOPMENT STANDARD** — this reconciliation is the current full pass. |
| 18 | role system | **CLOSED current role/model claims** — P0 direct authority and P1 primary host-selected model truth are closed; P2 remains a host capability/tool-surface concern. |
| 19–36 | methodology terminology/catalog/signals/selection/load/exit/learning/admission/authoring | **CLOSED core lifecycle; PARTIAL capability eligibility** — P2 closes role/host-capability executability for mandatory methodology exits. |
| 37 | Project Intelligence | **CLOSED current scope**. |
| 38–40 | evidence, completion/STOP, tests-not-product | **CLOSED current architecture / PERMANENT STANDARD**. |
| 41 | source-first/zero-debug audit | **PERMANENT DEVELOPMENT STANDARD**. |
| 42 | configuration reality | **CLOSED by M5 / PERMANENT INVARIANT**. |
| 43–44 | adaptive topology; role/agent/model separation | **CLOSED current path / PERMANENT INVARIANT**. |
| 45 | context | **CLOSED current Stage-3 implementation** — governor is consumed by mission compaction snapshot; TaskRuntime uses bounded artifact/SemanticContext/PI/native-summary paths. |
| 46 | storage ownership | **CLOSED**. |
| 47 | privacy/provider boundary | **CLOSED current boundary / PERMANENT INVARIANT**. |
| 48 | process/shell/isolation | **PARTIAL / HOST-LIMITED** — shell policy operational; process lifecycle DEGRADED; workspace isolation binding UNSUPPORTED. |
| 49 | release safety | **CLOSED local architecture / NOT AUTHORIZED externally**. |
| 50–55 | historical stage order, Stage-1 work, validation model | **HISTORICAL + CURRENT STANDARD** — Stage 1 later closed; declaration->host-bound proof taxonomy remains binding. |
| 56 | upstream/third-party source use | **PERMANENT INVARIANT**. |
| 57–59 | no-false-pass + final invariants + optimization target | **PERMANENT INVARIANT**. |
| 60 | old continuation directive | **HISTORICAL**, superseded by later append-only updates and this MASTER. |
| 61–70 | semantic contract hardening updates | **CLOSED current Stage-1 implementation**, except any future contradictory source evidence. |
| 71–73 | historical checkpoint/local commit discipline/Stage-1 closure | **HISTORICAL + COMMIT DISCIPLINE PERMANENT**. |
| 74–89 | Stage-2 role/topology/model/host rules and generated/release test boundaries | **mostly CLOSED; remaining items are explicitly enumerated in Section 7 below**. |
| 90 | explicit blind spots A–N | **mixed** — all A–N are individually classified with source evidence and closure requirements in Section 7 below. |
| 91–92 | old validation baseline and continuation order | **HISTORICAL**, superseded by 563/563 baseline and current roadmap. |
| 93 | anti-drift rules | **PERMANENT INVARIANT**, absorbed into Sections 1–3 and verification protocol here. |

---

## 7. Section 90 blind spots A–N — exact current truth

This is the key correction to the previous narrow MASTER. **Do not declare product completion while an OPEN/PARTIAL item below remains unresolved or deliberately reclassified with evidence.**

### A. Primary direct-action authority — **CLOSED at `f8c9f24`**

Proven facts:

- canonical RoleContract says `manager` is read-only with `repositoryWriteAuthority=none`;
- `working-manager` has scoped write authority;
- routing/minimum-team correctly sets forced manager `direct=false`;
- OpenCode manager native permissions deny `edit` and `bash`;
- however `plugin/src/plugin.ts` `hi_direct_progress` can close an implementation obligation after mutation/diff checks **without consulting `MissionState.primary_mode` / canonical primary RoleContract write authority**.

Closure proof:

1. `primaryRoleCanDirectImplementation()` derives direct implementation authority from the generated canonical RoleContract fields (`roleClass`, `readOnly`, `repositoryWriteAuthority`) rather than a duplicated role-name rule;
2. `hi_direct_progress` now rejects implementation closure before mutation/evidence processing when the active primary lacks canonical write authority;
3. direct review behavior remains separately governed by review policy and fresh review evidence;
4. actual tool-path acceptance proves forced read-only `manager` cannot close implementation even when mutation evidence is injected, while existing working-manager direct paths remain green;
5. full controlled suite after the change: **551/551 PASS**, architecture lint PASS (20 rules, deferred=0), validator PASS, backup count 0.

### B. Primary effective-model evidence — **CLOSED at `dc8c59c` as host-selected/unconstrained**

Child/worker model truth is now strong after M6, but primary model truth is not equivalent:

- `bindObservedPrimary()` records host-observed **agent role**, not model/variant;
- WorkerState model identity fields apply to child workers;
- no current production state proves a constrained primary model/variant from host metadata.

Closure proof:

1. At P1 closure, OpenCode plugin/sdk/binary were exact version 1.18.16 in the controlled environment; that is historical proof, not a permanent supported-version pin;
2. OpenCode `chat.message` exposes host-selected primary `model`/`variant` metadata, but canonical Hi primary agent projections contain no `model` or `variant`;
3. Hi model routing/config consumers are child TaskRuntime/model-resolver paths, not primary-agent projection;
4. canonical Hi agent binding fails closed if a host/user injects a model constraint into a canonical primary agent definition;
5. primary chat model metadata therefore remains host-selected observation and is not manufactured into Mission/Worker primary model state or a completion claim;
6. focused P1 set 13/13 PASS; full controlled suite **553/553 PASS**, architecture lint PASS, validator PASS, backup count 0.

### C. Methodology compatibility vs executable capability — **CLOSED at `05724b1`**

Closure proof:

- `resource_requirements` is now a strict technical `host-capability:<id>` reference surface for built-in and admitted project methodologies;
- `resolveSkillPlan()` rejects a role-compatible methodology as `resource-unavailable` when its required HostCapability is not `SUPPORTED`;
- TaskRuntime converts completion-relevant resource failure into deterministic `RESOLVE` before native child spawn;
- role compatibility, native skill permission and host/resource availability are therefore separate executable conditions;
- methodology exits are no longer allowed to become active merely from role compatibility when their mandatory executor resource is absent.

### D. Visual/browser capability — **CLOSED current truth / HOST-LIMITED at `05724b1`**

- `hi-browser-testing` and `hi-visual-qa` canonically require `host-capability:browser-execution`;
- the then-current OpenCode 1.18.16 audit exposed dynamic tool inventory, but Hi had no deterministic browser executor adapter that could bind arbitrary MCP/tool IDs to browser evidence semantics; current/latest host behavior must be revalidated before changing this status;
- `browser-execution` is therefore explicitly `UNSUPPORTED`, not inferred from prompts, screenshots, MCP naming or tool presence;
- mandatory browser/visual methodology dispatch fails deterministically before native child creation;
- no new host primitive was claimed, so P2 required no new T3 support-claim acceptance.

### E. Host-specific tool drift (`scout`) — **CLOSED at `05724b1`**

- the then-current installed OpenCode plugin/sdk 1.18.16 source/type surface contained no native `scout` tool contract; later host versions must be re-audited rather than assumed identical;
- stale `scout: allow` rules were removed from canonical primary PermissionProfiles and regenerated agent projections;
- architecture lint `HI021 EXECUTION_SURFACE_PERMISSION_DRIFT` now fails if any canonical Hi agent permission key is not represented by Core execution-surface reasoning;
- current architecture lint: **21 rules, deferred=0, linked=8**.

### F. Team Mode role/obligation/model/evidence authority — **CLOSED current in-process chain**

- TeamRuntime accepts only canonical child roles;
- every member delegates through the single TaskRuntime;
- TaskRuntime owns role/obligation authority, permission surface, model selection, WorkerResult and Evidence reconciliation;
- Team membership does not define a second task/authority system.

Do not add a second Team authority layer. Keep this as a permanent regression invariant.

### G. Retry/fallback role identity — **CLOSED**

Provider/model fallback and recovery preserve semantic Task/Worker role identity; only model/session/attempt state changes. Fresh-session recovery resets loaded methodology state. Keep as permanent invariant.

### H. Project methodology hot admission — **CLOSED**

TaskRuntime refreshes admitted project methodology permissions before same-process task selection. Admission remains policy+skill+hash-provenance coherent; explicit deny and collision safety are preserved.

### I. Foreign OpenCode agent coexistence — **CLOSED**

Canonical Hi name collision fails closed through `bindHiOpenCodeAgents`; unrelated foreign agents coexist. Only bounded admitted `hi-project-*` skill permission extension is tolerated on canonical agents.

### J. Config field reality matrix — **CLOSED by M5**

All 32 current leaves are classified and generated; every runtime option names a real consumer/effect, diagnostic fields do not claim fake runtime effect, and HI003 is fatal.

### K. Role prompt vs Core contract drift — **CLOSED mechanical owner / PERMANENT semantic invariant**

Canonical role identity/authority/permission relationships drive generated policy/agent preamble and are tested. Human prompt prose still requires review whenever role semantics change; do not create a second prose-derived authority parser.

### L. Restore / compaction / follow-up — **CLOSED current semantics at `3837318`**

Closed parts:

- observed primary role survives restore rather than being recomputed from config;
- Task/Worker identity and current-only contract validation survive persistence;
- structured follow-up preserves task identity;
- constraint rebase uses a fresh child and clears `loaded_methodologies`;
- compaction survival preserves blockers/next action/STOP state;
- in-process Team semantic generation is adopted deliberately.

Closure proof:

- C11 defines TeamRuntime as a bounded projection over the single canonical TaskRuntime; no second mailbox/task runtime exists;
- strict current TeamContract now carries `team_id`, `mission_id`, generation, member Task/role refs, capacity, status and terminal timestamp semantics;
- TeamRuntime validates member Task/role/Worker bindings against MissionState after projection mutations;
- Team projection is intentionally process-ephemeral: restore emits `team.projection-reset`, degrades execution mode to single, and preserves durable Task/Worker/obligation/evidence identities;
- in-flight native child sessions are quarantined with `restart_reconcile_pending` and cannot callback before explicit reconciliation;
- in-process semantic follow-up adopts the new TeamContract generation without replacing member Task/Worker identity;
- focused P3 set 21/21 PASS; full controlled suite **561/561 PASS**, architecture lint 21 rules / deferred=0, validator PASS, backup count 0.

### M. Role cost / minimum-sufficient computation — **CLOSED current policy / PERMANENT INVARIANT**

Minimum-team routing, topology benefit gating, context governor, expected-completion-cost-aware model selection and deterministic benchmarks exist. Continue measuring without optimizing for raw test/agent/token count.

### N. OpenCode host source verification — **VERSION-BOUND CLOSED / PERMANENT REVALIDATION**

M12 binds material acceptance to OpenCode 1.18.16/aarch64 and exact tested source artifacts. Revalidate host semantics whenever the supported OpenCode version or relevant primitive behavior changes. Do not infer a new host version from old receipts.

---

## 8. Stage 1–10 roadmap after full source/repo reconciliation

The old stage order remains useful as a product-coverage lens, but later Constitution work subsumed several stages out of sequence. Current truth:

| Stage | Current status | Meaning |
|---|---|---|
| Stage 1 — Methodology + semantic prerequisite ownership | **CLOSED** | 27 methodologies, structured semantics, activation/selection/load/exit/learning/admission lifecycle operational. P2 is a Stage-2 host-capability eligibility edge, not a reopening of semantic Stage 1. |
| Stage 2 — Role/topology/generated agents/model/host policy | **CLOSED current supported claims** | P0 authority, P1 primary host-selected model truth and P2 methodology/host execution-surface truth are closed; browser execution remains explicitly host-limited/UNSUPPORTED rather than falsely supported. |
| Stage 3 — Context Governor | **CLOSED current scope** | `governContext` is consumed by mission compaction snapshot; TaskRuntime has bounded context/artifact/PI/SemanticContext/native-summary paths. |
| Stage 4 — Project Intelligence / Semantic Context / knowledge lifecycle | **CLOSED current implemented scope** | Durable PI reload/invalidation, SemanticContext contract/consumer, methodology learning/admission separation operational. |
| Stage 5 — Human Decision / process / shell / isolation | **PARTIAL / HOST-LIMITED** | HumanDecision and shell policy operational. Process lifecycle DEGRADED; workspace isolation binding UNSUPPORTED. These must remain explicit release/support limitations unless future host support closes them. |
| Stage 6 — Team / concurrency / crash recovery / fallback | **CLOSED current semantics** | Team is a strict process-ephemeral projection over durable Task/Worker state; restart reconciliation, concurrency, fallback and semantic generation behavior are deterministic. |
| Stage 7 — Storage / setup / docs / packaging / release architecture | **CLOSED local architecture, docs-status residue** | Storage/provenance/release guards operational locally. Historical 06/08 status banners are stale. No real release authority. |
| Stage 8 — independent subsystem/integration tests | **CLOSED current T1/T2 baseline** | 563/563 controlled suite plus architecture lint/validator. Tests remain evidence, not sole product proof. |
| Stage 9 — Linux/OpenCode representative real-host acceptance | **PASS_MATERIAL_WITH_LIMITATIONS** | M12 OpenCode 1.18.16/aarch64 verified material primitives; process DEGRADED, workspace UNSUPPORTED, one independent-review terminal scenario was harness/model-behavior incomplete. Re-run targeted T3 after host-bound changes. |
| Stage 10 — real release/publication acceptance | **NOT REQUESTED** | Requires explicit user authority and T4 receipts. |

---

## 9. Truthful host limitations and non-fake capability policy

These are current product truths, not reasons to manufacture PASS:

### Process lifecycle — DEGRADED

The P5 audit on OpenCode 1.18.16 exposed a separate PTY lifecycle, but Hi did not route ordinary model-facing bash through that executor. Ordinary bash therefore still lacks Hi-owned PID/job wait/kill/process-exit lifecycle; shell safety and bounded runtime recovery must not be represented as a richer process governor.

### Workspace isolation binding — UNSUPPORTED

The P5 audit on OpenCode 1.18.16 exposed workspace/session `workspaceID`, warp and worktree primitives, but Hi had no canonical isolation selection/provisioning/cleanup executor and no T3 proof that subsequent child/tool execution was bound to an alternate workspace. Related host primitives are therefore not promoted to product support.

### Browser / visual — HOST-LIMITED / contract-bound

`browser-execution` is an explicit HostCapability and remains `UNSUPPORTED` until current/latest-host T3 evidence disproves that claim. The P5 OpenCode 1.18.16 audit exposed MCP/tool discovery, but Hi had no deterministic browser executor/evidence adapter; browser/visual methodologies therefore fail deterministic preflight before child spawn. Do not infer support from MCP/tool naming, prompts, screenshots, or inventory alone.

### Semantic Context adapters

Current first-class semantic extraction is TypeScript. Do not claim language-generic semantic AST support until a real adapter exists. Normal bounded file/context retrieval remains available for other languages.

### Telemetry

Current efficiency metrics are deliberately derived from bounded Mission ledger/state; benchmark telemetry is deterministic offline simulation. There is no separate first-class TelemetryEvent store because no product consumer requires one.

---

## 10. Remaining product roadmap — dependency-safe order

This is now the authoritative work queue. **Do not skip ahead because a later change is easier to test.**

### P0 — Primary direct-action authority closure — **CLOSED at `f8c9f24`**

Owner: `RoleContract -> primary runtime -> hi_direct_progress`.

Closure:

- canonical helper derives implementation-direct authority from RoleContract write semantics;
- read-only manager is fail-closed at the control-plane tool even if mutation evidence exists;
- working-manager direct implementation and direct review behavior remain intact;
- focused P0 set 23/23 PASS; full controlled suite 551/551 PASS; architecture lint and validator PASS.

Exit satisfied: a primary control-plane API cannot close implementation work that the actual primary RoleContract is forbidden to own.

### P1 — Primary model truth closure — **CLOSED at `dc8c59c`**

Owner: primary host session/message observation boundary + model contract.

Closure:

- the P1 OpenCode 1.18.16 source/type surface exposed primary model/variant metadata at the host chat boundary; current/latest host reacceptance must reconfirm this before a new support claim;
- canonical Hi primary agents intentionally omit model/variant constraints;
- host-side model injection into a canonical Hi primary agent fails binding as a collision;
- no producerless primary model fields were added to Mission/Worker state;
- focused P1 set 13/13 PASS; full controlled suite 553/553 PASS.

Exit satisfied: Hi makes no constrained primary model/variant claim and does not invent verification state for a host-selected primary model.

### P2 — Methodology/host capability and execution-surface closure — **CLOSED at `05724b1`**

Owners: MethodologyContract + HostCapability + effective execution surface.

Closure:

- mandatory methodology resource references use the strict `host-capability:<id>` vocabulary;
- selection consumes actual `SUPPORTED` HostCapability contracts, not prompt assumptions;
- mandatory unavailable resource becomes `resource-unavailable` and TaskRuntime preflight `RESOLVE` before child spawn;
- browser/visual execution is truthfully `UNSUPPORTED` until a deterministic OpenCode browser executor adapter exists;
- stale unsupported `scout` permission was removed after the then-current OpenCode 1.18.16 source audit; current/latest host reacceptance must reconfirm whether the host surface changed;
- `HI021` generically rejects future permission/execution-surface drift;
- focused P2 set 31/31 PASS; full controlled suite **556/556 PASS**; architecture lint **21 rules, deferred=0**; validator PASS; backup count 0.

Exit satisfied: permission/compatibility/methodology selection cannot expose an execution or exit-proof surface that Core cannot reason about or the host cannot execute.

### P3 — Team restart / semantic identity closure — **CLOSED at `3837318`**

Owner: TeamContract semantics + Mission/Worker persistence/recovery.

Closure:

- TeamContract is a strict bounded projection over canonical TaskRuntime, not a second runtime;
- Team projection is intentionally process-ephemeral while Task/Worker/obligation/evidence identity remains durable;
- restart explicitly emits `team.projection-reset`, degrades to single, quarantines in-flight child ownership, and preserves durable semantic identity;
- semantic follow-up adopts Team generation without replacing member Task/Worker refs;
- focused P3 set 21/21 PASS; full controlled suite **561/561 PASS**; architecture lint 21 rules / deferred=0; validator PASS; backup count 0.

Exit satisfied: restart does not silently recreate a weaker unrelated Team trajectory and does not leave old executor ownership unquarantined.

### P4 — Residual contract/schema reality closure — **CLOSED at `b2a097a` + classification checkpoint**

Closure classification:

- C09/S09 ExecutionPlan is the live Mission Task DAG/gates/authority/evidence trajectory, not a second workflow object; P4 added fail-closed persisted Task identity/dependency/DAG validation;
- C10/S10 Topology is a derived `decideTopology()` decision plus continuation-relevant Mission snapshot; persistence now validates bounded parallelism and `single => 1`;
- C11/S11 Team remains the strict ephemeral TaskRuntime projection closed in P3;
- C12 RetryAttempt is subsumed by Worker attempt/fallback/recovery state plus ledger;
- C13/S12 Recovery is subsumed by TaskRuntime/continuation recovery and Worker recovery fields with abort/reconciliation invariants;
- C25/S27 HostAgentProjection is generated, source-receipt-bound and collision-checked; no handwritten host truth exists;
- C28/S26 TelemetryEvent is deliberately **SUBSUMED / DERIVED DIAGNOSTICS**: bounded Mission ledger/state is canonical operational history and `hi_metrics` derives read-only metrics; benchmark telemetry remains explicitly offline simulation;
- C29 ArchitectureDecision is deliberately **DOCUMENTARY / PROCESS**: ADR/project convention plus `hi-architecture-decisions` methodology owns durable rationale; no runtime machine consumer justifies a second persisted entity;
- stale `06`/`08` candidate/implementation-pending banners and target-file-tree implications were reconciled to current ownership classification.

Proof: focused trajectory/topology set 44/44 PASS; full controlled suite **563/563 PASS**; architecture lint 21 rules / deferred=0; validator PASS; diff check clean; backup count 0.

Exit satisfied: every C01–C29/S00–S27 responsibility is executable, deliberately derived/subsumed, documentary, host-limited, or explicitly unsupported — none remains missing by accident.

### P5 — Host-limited capability release/support decision — **CLOSED at `e789e92`**

The historical P5 OpenCode 1.18.16 source/type and controlled-host audit established:

- **process lifecycle remains DEGRADED**: OpenCode exposes a separate PTY lifecycle, but ordinary model-facing bash is not routed through an Hi-owned PTY executor, so PID/job wait/kill/exit ownership is not claimed;
- **workspace isolation binding remains UNSUPPORTED**: OpenCode exposes workspace/session `workspaceID`, warp and worktree primitives, but current Hi has no canonical isolation selection/provisioning/cleanup executor and no real-host proof that child/tool execution is bound to an alternate workspace;
- **browser execution remains UNSUPPORTED**: MCP/tool discovery exists, but no deterministic browser executor/evidence adapter binds arbitrary host tools to browser/visual proof semantics;
- doctor now reports all three product-level limitations explicitly;
- README/HOSTS/verification/implementation/host-projection docs distinguish related host primitive presence from actual Hi product ownership rather than saying the SDK lacks every related primitive;
- no PTY, workspace or browser capability was emulated or promoted merely to remove a limitation.

Proof: focused host-capability set 21/21 PASS; full controlled suite **563/563 PASS**; architecture lint 21 rules / deferred=0; validator PASS; diff check clean; backup count 0.

Exit satisfied: supported-feature and support/release claims match the exact supported-host reality without fake capability promotion.

### P6 — Deterministic closure after product gaps — **CLOSED on exact source HEAD `ebd49d9`**

Deterministic proof from committed canonical sources:

- pre-check tree clean at exact HEAD `ebd49d988caa6f394d11ca295d3681e418d46905`;
- canonical generators rebuilt 32 config options, 7 permission profiles, 8 role contracts, 8 OpenCode agent projections and 27 methodology projections;
- 32 ProjectionReceipts regenerated and matched committed source/output identity;
- architecture lint **21 rules / deferred=0 / linked=8 PASS**;
- full controlled suite **563/563 PASS** under isolated writable HOME/XDG;
- a second full build/generation pass remained byte-idempotent and left the Git tree clean;
- standalone validator PASS, `git diff --check` clean, backup count 0.

Closure is not based on test count alone: P0–P5 owner/consumer/executor gaps are individually recorded above, while P6 proves their committed canonical sources reproduce the generated host/runtime projections without drift.

### P7 — Real-host reacceptance for changed host-bound surfaces

Only where P0–P5 changed OpenCode-bound behavior, run exact-version T3 acceptance against the supported OpenCode host. At minimum revalidate agent/tool/capability/model/session behaviors touched by the changes. Preserve DEGRADED/UNSUPPORTED truth.

### P8 / M13 / Stage 10 — Release readiness and real publication

**NOT REQUESTED.**

Do not execute real push/tag/GitHub release/npm publish/deploy until the user explicitly requests release work. When requested, treat it as a separate authority-bound T4 phase with exact remote/integrity receipts.

---

## 11. Verification protocol for future checkpoints

### Focused verification first

Run the smallest deterministic tests that prove the changed owner/consumer/executor chain. Add tests only after the architecture is understood.

### Controlled full verification when justified

Use a writable isolated environment, e.g.:

```bash
set -e
TMPROOT=$(mktemp -d)
trap 'rm -rf "$TMPROOT"' EXIT
export HOME="$TMPROOT/home"
export XDG_STATE_HOME="$TMPROOT/state"
export XDG_DATA_HOME="$TMPROOT/data"
export XDG_CONFIG_HOME="$TMPROOT/config"
export XDG_CACHE_HOME="$TMPROOT/cache"
mkdir -p "$HOME" "$XDG_STATE_HOME" "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME"
npm run check
git diff --check
printf 'backup_count='
find . \( -name '*.bak' -o -name '*.bak.*' -o -name '*~' \) -print | wc -l
git status --short
```

Do not install missing tools/dependencies merely to make a check green without a real requirement.

### Commit protocol

For each coherent mutation-bearing checkpoint:

```text
source audit
-> smallest coherent implementation
-> focused proof
-> broader proof as justified
-> generated-artifact/hygiene check
-> local commit
-> verify HEAD/status
-> update this MASTER if roadmap/status changed
```

If a tool/safety boundary interrupts after mutation, do not begin another architectural slice. Resume by reconciling and committing/completing that same slice first.

---

### Current-host version policy — **PERMANENT**

OpenCode-Hi does **not** permanently pin host acceptance to 1.18.16 or any other historical host version. Before every host-bound compatibility/T3 checkpoint:

1. resolve `opencode-ai` registry `dist-tags.latest`;
2. update the controlled-host CLI to that version;
3. compile/test the Hi adapter against the matching current plugin/SDK version;
4. bind the new receipt to that exact tested version and Git/source hashes;
5. retain older exact-version receipts only as immutable historical evidence.

At the current P7 checkpoint on 2026-08-14, registry `latest` is **1.18.18**; CLI and development plugin/SDK have been refreshed to **1.18.18**.

## 12. Real-host acceptance truth retained from M12

Canonical receipt:

`data/validation/external-opencode-hi-0.1.0-host-1.18.16-head-753043d.json`

Materially verified on OpenCode 1.18.16 / Linux aarch64:

- local plugin load from exact tested source;
- all 8 canonical Hi agent projections;
- native Hi methodology discovery/load;
- provider/model inventory;
- parent/child sessions and parent relation;
- prompt, abort, status, children, todo, diff, fork, summarize, revert/unrevert;
- child agent/model/variant observation;
- native permission once/reject semantics;
- structured runtime logging;
- native skill load proof.

Truthful limitations:

- process lifecycle: **DEGRADED**;
- workspace isolation binding: **UNSUPPORTED**;
- one independent-review terminal scenario: `HARNESS_MODEL_BEHAVIOR_INCOMPLETE`, not falsely classified as product PASS/FAIL.

A future host/version change invalidates assumptions that depend on that exact host behavior until revalidated.

---

## 13. What is explicitly NOT open anymore

Do not waste future turns reopening these without contradictory repository evidence:

- 27-vs-29 methodology count dispute;
- language-specific user-intent keyword dictionaries;
- separate skill-policy/native-skills duplicate methodology owners;
- selected==loaded methodology conflation;
- general role permission ownership in Markdown;
- decorative runtime config fields removed by the current config contract;
- worker requested/selected/projected/observed model identity gap;
- duplicate Task/Worker/Evidence/Verification schema owners already extracted;
- generic continuation as external authority;
- Team as a second task runtime;
- role-name collision silently binding a foreign canonical agent;
- test-local ephemeral push/tag/publish fixtures being mistaken for real release authority.

---

## 14. Next action

**Start P7 only.**

Re-check real HEAD/status, resolve the current `opencode-ai` registry `latest` version, update the installed CLI and development adapter SDK to that version when needed, then run exact-version T3 reacceptance against that current/latest OpenCode version for host-bound surfaces changed since M12/P0–P5: canonical agent/permission projection (including `scout` removal), primary direct-action authority at `hi_direct_progress`, primary host-selected model non-constraint, browser/visual resource preflight and HostCapability truth, and doctor exposure of process/workspace/browser limitations. Reconfirm native session/child/model/permission behavior needed by those paths and bind the receipt to the exact tested Git HEAD/source hashes.

Do not broaden P7 into release publication or unrelated host feature development. Preserve process `DEGRADED`, workspace `UNSUPPORTED`, and browser `UNSUPPORTED` unless the real host execution evidence itself disproves those statuses. Do not enter real M13/release work without explicit user request.

When P7 is coherently closed, create a local exact-source receipt/proof checkpoint and update this MASTER. P8/M13 remains NOT REQUESTED.
