# OpenCode-Hi — Canonical Continuation, Coverage, and Product-Closure Ledger

Status: **ACTIVE SINGLE CONTINUATION ENTRYPOINT**

> This file is the canonical **work/navigation ledger** for continuing OpenCode-Hi.
> It consolidates the two pre-MASTER working sources, the Engineering Constitution migration program, and the verified live repository state.
> It is not a replacement for component-owned canonical data/contracts. **Live repository state always wins over this ledger when they conflict.**

```yaml
continuation_schema: 3
repository: OpenCode-Hi
repository_root: /workspace/OpenCode-Hi
active_program: Final Product Truth Reconstruction & Documentation Rebuild
active_authority: /workspace/arastirma/OpenCode-Hi_FINAL_RECONSTRUCTION_ZERO_DEFECT_PROMPTS.md
active_phase: PROMPT_A
active_phase_name: Documentation truth reconstruction
phase_status: IN_PROGRESS
working_tree_expectation: clean-at-checkpoint-boundaries
current_source_head_at_program_start: 6c271d281dfd5c2819539e6ca1d3659c5c729a91
current_product_version: 0.1.0
current_release_status_projection: data/validation/release-status-0.1.0.json
current_compatibility_projection: data/validation/compatibility-matrix-0.1.0.json
documentation_ownership_policy: data/documentation-ownership.json
documentation_inventory_receipt: data/validation/documentation-inventory.json
external_release_actions_authorized: false
next_contract_owner: documentation ownership/parity -> current docs rebuild -> Constitution/current-ledger reduction -> PROMPT A certification
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
controlled full suite: 736/736 PASS
architecture lint: PASS rules=22 deferred=0 linked=8
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
| C05 / S05 HostCapability | `contracts/host-capability.ts`, OpenCode detector/doctor | **CLOSED registry / EXACT-BOUND capabilities** | Hi-owned process lifecycle, workspace isolation binding, and browser execution each have exact OpenCode 1.18.18 T3 acceptance. Browser support additionally requires live BrowserRuntime health; unsupported variants remain fail-closed. |
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
| 91–92 | old validation baseline and continuation order | **HISTORICAL**, superseded by the current 564/564 baseline and current roadmap. |
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
| Stage 2 — Role/topology/generated agents/model/host policy | **CLOSED current supported claims** | P0 authority, P1 primary host-selected model truth and P2 methodology/host execution-surface truth are closed; browser execution is now exact-source/host accepted and live-health-gated rather than inferred from host tool inventory. |
| Stage 3 — Context Governor | **CLOSED current scope** | `governContext` is consumed by mission compaction snapshot; TaskRuntime has bounded context/artifact/PI/SemanticContext/native-summary paths. |
| Stage 4 — Project Intelligence / Semantic Context / knowledge lifecycle | **CLOSED current implemented scope** | Durable PI reload/invalidation, SemanticContext contract/consumer, methodology learning/admission separation operational. |
| Stage 5 — Human Decision / process / shell / isolation | **CLOSED current implemented surfaces / H2 HOST-LIMITED** | H1 HumanDecision chat transport and shell policy are operational; Hi-owned process lifecycle and workspace isolation binding have exact OpenCode 1.18.18 T3 support. Structured host question-opening transport (H2) remains unsupported on the public OpenCode 1.18.18 API. |
| Stage 6 — Team / concurrency / crash recovery / fallback | **CLOSED current semantics** | Team is a strict process-ephemeral projection over durable Task/Worker state; restart reconciliation, concurrency, fallback and semantic generation behavior are deterministic. |
| Stage 7 — Storage / setup / docs / packaging / release architecture | **CLOSED local architecture, docs-status residue** | Storage/provenance/release guards operational locally. Historical 06/08 status banners are stale. No real release authority. |
| Stage 8 — independent subsystem/integration tests | **CLOSED current T1/T2 baseline** | 736/736 controlled suite plus architecture lint/validator. Tests remain evidence, not sole product proof. |
| Stage 9 — Linux/OpenCode representative real-host acceptance | **PASS_EXACT_SOURCE_WITH_LIMITATIONS** | OpenCode 1.18.18 exact-source receipts now close Hi-owned process lifecycle, workspace isolation binding, and browser execution on their respective tested runtime commits. H2 structured question opening and npm T4 remain separate limitations. Historical 1.18.16/P7 negative capability observations remain provenance only. |
| Stage 10 — real release/publication acceptance | **NOT REQUESTED** | Requires explicit user authority and T4 receipts. |

---

## 9. Truthful host limitations and non-fake capability policy

These are current product truths, not reasons to manufacture PASS:

### Process lifecycle — SUPPORTED exact owned surface

The historical P5 negative/degraded observation remains provenance for that source state. P3 later added the Hi-owned PTY runtime and exact OpenCode 1.18.18 T3 acceptance. Support applies to the canonical Hi process surface only; arbitrary model-facing/native jobs are not retroactively owned.

### Workspace isolation binding — SUPPORTED exact owned surface

The historical P5 unsupported observation remains provenance. W3 later proved source-bound provisioning, child workspace binding, isolation, cleanup, restart adoption and orphan quarantine on OpenCode 1.18.18. Support applies only to Hi-owned IsolationDecision/WorkspaceLease/WorkspaceRuntime execution.

### Browser / visual — SUPPORTED exact owned + live-health-gated surface

B3 exact-source T3 on `476590e500949ec6c2416c1502beaa9be4217d9f` proves the Hi-owned Playwright BrowserRuntime, exact visual child ownership, navigation/DOM/click/type/screenshot/close, deterministic invalid-target failure, explicit passed browser/visual Evidence, methodology exits and Mission completion. `browser-execution` remains contingent on live runtime health; MCP/tool inventory, prompts, BrowserObservation or screenshot artifacts alone never create support or verification PASS.

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

### P5 — Host-limited capability release/support decision — **HISTORICAL / CLOSED at `e789e92`**

The historical P5 OpenCode 1.18.16 source/type and controlled-host audit established:

- **process lifecycle was `DEGRADED` at this historical P5 source**: OpenCode exposed a separate PTY lifecycle, but ordinary model-facing bash is not routed through an Hi-owned PTY executor, so PID/job wait/kill/exit ownership is not claimed;
- **workspace isolation binding was `UNSUPPORTED` at this historical P5 source**: OpenCode exposed workspace/session `workspaceID`, warp and worktree primitives, but current Hi has no canonical isolation selection/provisioning/cleanup executor and no real-host proof that child/tool execution is bound to an alternate workspace;
- **browser execution was `UNSUPPORTED` at this historical P5 source**: MCP/tool discovery existed, but no deterministic browser executor/evidence adapter binds arbitrary host tools to browser/visual proof semantics;
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

### P7 — Real-host reacceptance for changed host-bound surfaces — **HISTORICAL / CLOSED on exact runtime source `c5d8287`**

Canonical receipt: `data/validation/external-opencode-hi-0.1.0-host-1.18.18-head-c5d8287.json`.

Exact-host T3 reacceptance on OpenCode/plugin/SDK **1.18.18** proved the changed host-bound surfaces without promoting known limitations:

- all 8 canonical Hi agents loaded from `file:///workspace/OpenCode-Hi/plugin/dist/plugin.js`; `scout` is absent, manager is read-only, working-manager/coder remain write-capable, and primary manager/working-manager carry no Hi model/variant constraint;
- four requested OpenCode Go model/role bindings were observed in assistant metadata: working-manager→MiMo V2.5, coder→DeepSeek V4 Flash, architect→DeepSeek V4 Pro, qa-reviewer→MiMo V2.5 Pro;
- working-manager + MiMo V2.5 performed a real file mutation and `hi_direct_progress` returned `RECORDED` with canonical project-relative `p7-direct.txt`; the P7-discovered absolute-vs-relative native path bug was fixed at the host path producer boundary and deterministically closed by 564/564 full-suite proof;
- manager + MiMo V2.5, after a real implementation semantic assessment, was rejected by `hi_direct_progress` with canonical repository-write-authority enforcement;
- Hi `hi_task_start` created a real repository-explorer child with correct parentID, OpenCode 1.18.18 identity, MiMo V2.5 effective model, read-only edit permission, and all Hi control-plane tools denied in the child;
- native permission `once` allowed an asked `pwd` bash call to complete with exit 0; native permission `reject` emitted asked/replied events and the bash tool ended with the host rejection error without retry;
- `hi-visual-qa` real-host task start returned `RESOLVE` before child creation because its canonical `host-capability:browser-execution` resource is unavailable;
- live `hi_doctor` reported process-lifecycle **DEGRADED**, workspace-isolation-binding **UNSUPPORTED**, browser-execution **UNSUPPORTED**, with no stale 1.18.16 runtime wording.

Deterministic source checkpoint before T3: **564/564 PASS**, architecture lint 21/21 with deferred=0, validator PASS, backup count 0.

P7 exit satisfied: changed OpenCode-bound behavior is reaccepted against the current registry-latest host and exact runtime source hashes, while unsupported/degraded features remain truthfully limited.


### W3 — Workspace-isolation real-host promotion — **CLOSED on exact runtime source `92812a1` / browser statement historical**

Canonical receipt: `data/validation/external-opencode-hi-0.1.0-workspace-1.18.18-head-92812a1.json`.

Exact OpenCode/plugin/SDK **1.18.18** T3 acceptance on Linux/aarch64 proves the Hi-owned workspace chain end to end: source-bound builtin-worktree provisioning; exact child `workspaceID + directory`; real `coder` model/tool write confined to the lease; deterministic content + `git diff --check` verification executed from the leased worktree; primary workspace isolation and byte-identical preservation of a pre-existing dirty user file; cleanup removing host record/worktree path; real OpenCode server restart followed by `ADOPTED` reconciliation; external workspace loss followed by `ORPHANED + QUARANTINED`; and no silent recreation. `workspace_isolation=NATIVE` at the reference-host primitive layer and `workspace-isolation-binding=SUPPORTED` at `REAL_HOST_ACCEPTANCE` only for Hi-owned IsolationDecision/WorkspaceLease/WorkspaceRuntime execution. Browser execution remains `UNSUPPORTED`.

Deterministic promoted-source checkpoint: **701/701 PASS**, architecture lint `rules=22 deferred=0 linked=8`, validator PASS (`product=HI docs=26`), naming namespace visibly PASS, generated/idempotency clean, diff-check clean, backup count 0. Host-hardening checkpoint `6ba15d0`; promoted exact runtime source `92812a13b7388387b11096a74a26bdb13fc4dffb`. No push/tag/release/npm publish action is implied by W3.

### B3 — Browser/visual real-host promotion — **CLOSED on exact runtime source `476590e`**

Canonical receipt: `data/validation/external-opencode-hi-0.1.0-browser-1.18.18-head-476590e.json`.

Exact OpenCode/plugin/SDK **1.18.18** T3 acceptance on Linux/aarch64 proves the Hi-owned browser chain end to end: live Playwright/Chromium health; configured local HTTP target confinement; open/inspect/click/type/screenshot/close observations; deterministic invalid observed-target failure; canonical screenshot artifact persistence; default review routing from structured `visual-qa` capability to the `visual-qa` role; READY visual-task preflight; native loading of `hi-browser-testing` and `hi-visual-qa`; exact child session/task/generation browser ownership; terminal raw WorkerResult `DONE`; explicit `browser-evidence` and `visual-evidence` with `outcome=passed`; both methodology exits resolved; review/verification obligations closed; and Mission status `completed`. Child attempts to invoke a Hi control-plane tool were correctly denied by the ownership guard. Static HostCapability support does not manufacture runtime availability: the browser resource is admitted only when live BrowserRuntime health succeeds.

Deterministic exact-source checkpoint: **736/736 PASS**, architecture lint `rules=22 deferred=0 linked=8`, validator PASS (`product=HI docs=26`), generated/idempotency clean, diff-check clean, backup count 0. Ownership/race hardening commit `9306854`; support/health-gating commit `83daf2f`; visual default-routing fix and exact accepted runtime source `476590e500949ec6c2416c1502beaa9be4217d9f`. Direct T3 screenshot SHA-256 `5b09dcef8453330730fdc6a231af3a47381d301fa6912ac46d06317bc6cefacb`; real visual-child screenshot SHA-256 `952980690bb6add6d45577f77e2700e17e98f5e7d0b6c6035d1410aad606a5ef`. Historical negative B3 receipt `707609b...` is retained as provenance for the earlier no-browser-runtime host state and is not rewritten.

### R1 — npm Trusted Publishing/OIDC — **LOCAL CLOSED / EXTERNAL BOOTSTRAP + TRUST BINDING PENDING**

R1 adds `.github/workflows/npm-publish.yml`, `scripts/verify-npm-oidc-release.mjs`, package public-publish metadata, and deterministic workflow contract tests without creating a second release-state owner. The workflow uses GitHub-hosted Ubuntu, job-scoped `id-token: write`, no npm write-token secret, exact non-prerelease release/tag/source/version/repository preflight, fresh pack proof, OIDC `npm publish --access public`, registry version/integrity/shasum equality, and fresh consumer import. Host validation used isolated PyYAML plus `actionlint`; release-focused deterministic tests are green. Canonical release-chain pack/remote verification remains the product owner.

The current external edge cannot be fabricated: `npm whoami` is `ENEEDAUTH` and `opencode-hi@0.1.0` is absent. npm Trusted Publisher configuration requires the package to already exist. Immutable `v0.1.0` points to released source `f1a2c1c...`, which predates the new workflow, so the tag will not be rewritten. Under future explicit npm authentication, bootstrap-publish the exact existing `0.1.0` release artifact, verify registry identity/integrity/fresh install, then configure trusted publisher for GitHub `huseyincig/OpenCode-Hi`, workflow `npm-publish.yml`, allowed action `npm publish`. Future releases can then publish tokenlessly through OIDC. Local readiness metadata: `data/validation/npm-oidc-readiness-0.1.0.json`. This is not T4 evidence.

### R2–R4 + N1 — post-v0.1 engineering program closure — **CLOSED LOCALLY**

R2 closes the setup lifecycle under the existing setup/provenance owner: idempotent install, ownership-safe upgrade, one-step rollback, uninstall rollback, atomic config/state writes, interrupted-operation recovery, drift fail-close, and preservation of unrelated OpenCode/user/project-owned state. Canonical receipt: `data/validation/install-lifecycle-0.1.0.json`; checkpoint `8f9e702d4be27aeb849d8e7d2a6f16ac36f1cd9c`.

R3 generates the compatibility matrix from exact host receipts rather than hand-maintained claims. Current reference-host projection is OpenCode 1.18.18 / Linux / aarch64 with process, workspace-isolation binding, and browser execution each selected from their latest exact capability-specific T3 receipts; historical negative/older receipts remain provenance. Projection: `data/validation/compatibility-matrix-0.1.0.json`; checkpoint `580f1471f0c3c9f431b6d71848f204a6a873d21a`.

R4 generates mutable current release status from hash-bound final acceptance, release gates, publication receipt, compatibility projection, and npm OIDC readiness. `docs/RELEASE.md` contains a generator-owned marker block and deliberately does not persist test counts. Projection: `data/validation/release-status-0.1.0.json`; checkpoint `a50bc7c0efec076e42f1810796dd274469499aad`.

N1 performs final Hi namespace/status normalization after all engineering work packages: the naming guard now covers product/config catalogs plus living architecture-reality/install/release docs; stale pre-P3 process ownership language was removed; all 27 built-in skills remain `hi-*`, tool namespace remains `hi_*`, role/config identifiers contain no foreign canonical branding, and suspicious living namespace paths are absent. Historical provenance, source-study material, immutable receipts, OpenCode-native names, general technical primitives, and explicit negative rejection tests are intentionally preserved. Canonical receipt: `data/validation/namespace-normalization-0.1.0.json`.

The post-v0.1 engineering work-package queue is therefore locally complete. The only remaining external program edge is npm bootstrap publication/trusted-publisher binding/T4 proof; it does not reopen completed engineering packages.

### P8 / M13 / Stage 10 — Release readiness and real publication — **PARTIAL_EXTERNAL: GITHUB RELEASE CLOSED / NPM T4 BLOCKED_AUTH**

The user explicitly authorized the complete release/publication phase. External actions are now permitted only through the canonical release chain and must remain exact-action, exact-ref and receipt-bound. npm publication remains environment-blocked until registry authentication exists; do not fake it.

P8 pre-freeze progress on exact pushed source `9f3a1a9025f73f0da46dcd88da31a6f5ef44c545`:

- GitHub Actions `Release Readiness` run `31813070875` completed **SUCCESS** with both required jobs green: Ubuntu `94808107636` and Windows `94808107727`;
- a fresh remote clone asserted exact HEAD `9f3a1a9`, completed `npm ci`, reported zero audited dependency vulnerabilities, packed `opencode-hi@0.1.0`, installed that package into a fresh consumer, and imported the installed ESM entrypoint successfully;
- the same clean clone was loaded by real OpenCode **1.18.18**; `/global/health`, `/agent`, and `/config` returned HTTP 200, the runtime log recorded `OpenCode-Hi plugin initialized`, the canonical agents/default working-manager/configured skills projection was observable, and the probe process was cleaned afterward;
- canonical receipt: `data/validation/external-clean-consumer-0.1.0-head-9f3a1a9.json`;
- these are **pre-freeze exact-source** proofs only. They do not satisfy the final exact-ref gate after this receipt/documentation checkpoint changes Git identity.

That pre-freeze checkpoint has now advanced to real publication. Final release source `f1a2c1c4358e5a63656da7a585b6b5793d1ed3be` passed GitHub Actions run `31814631919` on both Ubuntu and Windows, fresh-clone clean-consumer/dependency/supply-chain and OpenCode 1.18.18 loader checks, and two byte-identical post-freeze release builds. Annotated tag `v0.1.0` peels remotely to the exact source commit. GitHub Release `v0.1.0` is published with five assets whose GitHub-reported SHA-256 digests match the locally built artifacts. Canonical publication receipt: `data/validation/release-publication-0.1.0.json`.

npm registry publication remains the only open P8/T4 edge: `npm whoami` returned `ENEEDAUTH`; registry lookup did not find `opencode-hi@0.1.0`; no publish was attempted. This does not weaken or retract the verified GitHub release.

---

## 10A. Final reconstruction program — PROMPT A

### A0 — Documentation truth ownership and inventory — **CLOSED at `26dae54`**

Authority: `/workspace/arastirma/OpenCode-Hi_FINAL_RECONSTRUCTION_ZERO_DEFECT_PROMPTS.md`.

The post-v0.1 engineering work-package program is complete through N1, so PROMPT A is now the active repository program. The first reconstruction checkpoint establishes a machine-readable documentation ownership boundary before rewriting current product docs:

- `data/documentation-ownership.json` declares **one meaning -> one canonical documentation owner** for 36 product meanings;
- `scripts/generate-documentation-inventory.py` inventories root docs, product docs, Constitution material, ADRs/source-study material, roles, and all 27 packaged methodology `SKILL.md` files;
- `data/validation/documentation-inventory.json` classifies every inventoried surface as current/derived/reference/historical and rejects unclassified artifacts, duplicate meaning IDs, missing owners, or historical artifacts owning current truth;
- initial inventory: 122 documentation-like artifacts, 68 current/derived, 32 historical, 22 reference, 36 canonical meanings, with zero classification/ownership violations;
- `scripts/validate.py` now consumes `VERSION` as the product-version owner and validates SemVer/parity instead of hard-pinning the application to literal `0.1.0`. No version bump is performed by this checkpoint.

This does **not** certify PROMPT A. Current README/Constitution/architecture/install/release surfaces still require reconstruction and parity review. Historical engineering material remains available but may not own mutable current product truth.


### A1 — Current product entry path and executable documentation parity — **CLOSED at `29f7ce0`**

Rebuilt `README.md`, `README.tr.md`, `docs/ARCHITECTURE.md`, and `docs/INSTALLATION.md` from live contracts/runtime/receipts. Removed stale candidate/no-workspace/old-host language, separated runtime readiness from the externally blocked npm registry distribution edge, documented first-use/source-loading boundaries, and added `scripts/validate-documentation.py` plus generated `data/validation/documentation-parity.json`. `npm run check` now includes `docs:check`, so current docs fail on broken local links, stale capability/candidate language, version/package/product drift, npm availability drift, host capability omission, or semantic-adapter support drift. Checkpoint evidence: Python 70/70, Node 741/741, docs parity PASS/0 violations, validator PASS.

### A2 — Constitution law/history separation — **CLOSED at `945eaea`**

Rebuilt the current Engineering Constitution as durable LAW/WHY/ownership/proof rules and physically moved obsolete program/migration/runtime-snapshot/proof-ledger files under `docs/engineering-constitution/history/`. Constitution README now distinguishes current law, reference catalogs and historical provenance; ADRs no longer instruct engineers to execute the old migration matrix or append to the old implementation-proof ledger. Checkpoint evidence before commit: Python 71/71, Node 741/741, docs parity PASS/0 violations, validator PASS, diff-check clean, backup count 0.


### A3 — Generated config/support documentation projections — **CLOSED at `5ced215`**

Current mutable config and host support facts are no longer maintained as freehand tables. `scripts/generate-documentation-projections.py` derives the complete 32-option configuration reference in `docs/INSTALLATION.md` from `data/hi-config-options.json` and the exact accepted process/workspace/browser matrix in `docs/HOSTS.md` from `data/validation/compatibility-matrix-0.1.0.json`. These projections are regenerated by `npm run docs:check` before parity validation.

### A4 — Product truth trace and current-doc semantic cleanup — **CLOSED at `5ced215`**

`scripts/generate-product-truth-inventory.py` derives `data/validation/product-truth-inventory.json`, tracing 24 major product areas to canonical owner paths, downstream consumer/executor paths, executable proof files and canonical explanatory docs. `docs/ARCHITECTURE-REALITY-MAP.md` projects that trace and records cross-cutting failure/recovery ownership. Current storage/terminology/product-identity/contributor/validation docs were reconciled against live source: Process state is Mission-persisted through `ProcessRuntime`; obsolete memory-only ownership wording was removed; workspace isolation uses the implemented `OpenCodeWorkspaceAdapter`; N1 is completed rather than future work; mutable product version belongs to `VERSION` rather than hard-coded identity prose.

### PROMPT A final exit gate — **COMPLETED**

Certified product-source HEAD `5ced215ed57f28f8d963376ca702efc0dac75503` / tree `b22db990942ad291997a8ad564ac1235283036bb`. `data/validation/documentation-reconstruction.json` is the hash-bound completion receipt. Certification evidence: Python 74/74 PASS; canonical Node 741/741 PASS; architecture lint 22/22 with deferred=0; documentation parity violations=0; product-truth missing paths=0 across 24 areas; 36 canonical documentation meanings with no duplicate owner; validator PASS; generated projections idempotent; broken local links=0; backup files=0.

The completion-record commit may be newer than the certified product-source HEAD because the receipt and this ledger are certification metadata only. npm publication remains externally blocked and is not represented as an available first-use registry install.

### PROMPT B B0 — exact certification baseline — **CLOSED**

Starting clean HEAD `9f0624383db038f55e280ab7834b7dd12bc281ca` / tree `b39dd548b1ceba28ff6fc67575ad9389ccf4f5b2` on `main`. OpenCode installed and npm registry latest both resolve `1.18.18`; platform Linux/aarch64; Node `v24.19.0`, npm `11.17.0`, Python `Python 3.11.2`. Canonical schema baseline: Hi config 2, runtime-state 10, setup ownership 2, setup lifecycle 1, routing 1. `data/validation/zero-defect-baseline.json` binds dependency-lock and generated-artifact hashes. Initial TypeScript import graph scan: 168 source files / 507 relative edges / 0 cycles. This is baseline evidence only, not certification.

### PROMPT B B1 — architecture defect hunt — **CLOSED**

Initial import-graph audit found 168 TypeScript source files / 507 relative import edges / 0 cycles. B1 checkpoint verification: Python 78/78 PASS; canonical Node 734/734 PASS after removal of the obsolete seven-test B2 CLI-only browser suite; architecture lint 22/22 PASS with deferred=0; documentation parity violations=0; zero-consumer internal exports=0; validator PASS; generated docs/product trace PASS; backup files=0. Module-scope mutable-state review found only immutable contract lookup sets/maps plus the intentional OpenCode runtime instance guard. `instance-guard.ts` uses an owner-scoped `WeakMap`, exact project key, duplicate-registration rejection and explicit lease release; controlled tests exercise distinct host instances/reacquire, so it is retained as a justified process-global duplicate-hook guard.

A second architecture/governance defect was confirmed during B1: the initial PROMPT A validator incorrectly compared immutable certification input hashes to mutable current documentation, which would make legitimate future engineering impossible. The guard now validates Prompt A blobs against its exact completion-record commit and only requires the current ledger to retain the historical completed status.

One real dead-abstraction defect was confirmed: `BrowserCliAdapter`/`agent-browser` remained as living source but had no production consumer after B3 moved runtime composition to `PlaywrightBrowserAdapter`; its only consumer was its own obsolete B2 test. The living adapter/test are removed. Historical negative browser receipts remain immutable provenance. Product-truth proof mapping now points only at the current BrowserObservation + Playwright/runtime/methodology evidence chain.

---


### PROMPT B B2 — exact-current OpenCode native re-evaluation — **CLOSED**

Exact OpenCode 1.18.18 source was re-evaluated from Git blobs at upstream commit `e23586af2623f1bc2e8e6965d2d7acf7bd03d5c3`, explicitly ignoring the dirty upstream worktree. `scripts/audit-opencode-native.py` and `data/validation/opencode-native-reevaluation.json` bind 13 upstream source blobs and 12 material host surfaces. Sessions, TaskTool delegation, permission, tool events, PTY, workspace/worktree, provider/model observation, skill loading, lifecycle events and compaction are native substrate; Hi retains only the stronger Mission/Task/Worker, authority, evidence, ownership, recovery and policy semantics. Native `find.symbols`/LSP is real but insufficient by itself for `SemanticContextContract` source-hash/signature/relationship/freshness/budget guarantees, so the local TypeScript semantic adapter remains justified while native discovery is optional. Public plugin SDK does not expose deterministic Question open; v2 exposes question list/reply/reject but no ask/open, so structured `HumanDecision` host UI remains unsupported rather than fabricated.


### PROMPT B B3 — Mission / Task / Worker adversarial verification — **CLOSED**

PROMPT B section 6 was re-audited as a 15-invariant state-machine surface. A real correctness defect was found and fixed: persisted state could contain multiple workers bound to the same native child `session_id`, and callback lookup selected the first registry match; the Mission DAG validator also did not require every worker to be the exact `task.worker_id` owner or bind `parent_session_id` to the Mission session. Current validation now enforces exact bidirectional Task↔Worker ownership, exact Mission parent session/mission identity, and unique native child session ownership. Runtime callback resolution accepts exactly one native session owner and otherwise fails closed. New adversarial injection covers ambiguous duplicate native sessions, superseded-session reordered callbacks, stale generation and restart-pending callbacks. `scripts/audit-mission-task-worker.py` generates `data/validation/prompt-b-mission-task-worker.json`, binding all 15 section-6 invariants to current owner/proof hashes.


### PROMPT B B4 — Role / Model / Methodology adversarial verification — **CLOSED**

PROMPT B section 7 was re-audited as 13 executable invariants enforcing `ROLE != AGENT != MODEL != METHODOLOGY`. The current model chain keeps requested, selected, projected, observed and effective identities distinct; host projection/effective-model contradictions fail closed; unavailable model/native capability resolves before worker execution; runtime fallback revalidates live provider/model policy. Methodology remains a method plane only: available/admitted/selected/loaded are distinct, selected methodology must be natively loaded before DONE, exit conditions require fresh matching Evidence, collision/foreign-provider cases fail closed, methodology runtime has no Authority/Completion owner imports, all 27 packaged skills carry the no-orchestration/no-authority/no-completion boundary, and role Markdown owns no mechanical model/tool/permission state. `scripts/audit-role-model-methodology.py` generates `data/validation/prompt-b-role-model-methodology.json` with current owner/proof hashes and static ownership guards. No new product defect was found in this slice.


### PROMPT B B5 — Authority / Permission / ExternalAction adversarial hardening — **CLOSED**

PROMPT B section 8 was re-audited against 18 fail-close invariants. Natural-language approval/outcome regex ownership was removed: Hi Authority now accepts only an exact structured HumanDecision authority protocol bound to `decision_id` + `authority_ref` + a closed response enum. One-shot requests/approvals are TTL-bound and invalidated across semantic revision, STOP, and runtime restart without erasing unresolved in-flight external effects. Native `always` remains a distinct bounded persistent authority class and explicit host/user deny remains dominant. Credential/OAuth/SSO flows, plaintext secret-sensitive shell commands, catastrophic filesystem mutations, irreversible external deletions/destruction, and supported potentially paid external effects are routed through deterministic user/authority boundaries. Bounded local cleanup is explicitly protected from catastrophic false positives. `scripts/audit-authority-permission-external-action.py` generates `data/validation/prompt-b-authority-permission-external-action.json`; current receipt coverage is 18/18 with zero violations.


### PROMPT B B6 — Evidence / Verification / Completion hostile-claim hardening — **CLOSED**

PROMPT B section 9 was re-audited with model/worker claims treated as untrusted. Two real correctness defects were closed. First, reviewer `DONE`/summary prose no longer synthesizes canonical passed `review-evidence` or closes review/verification obligations; an explicit fresh review proof is required. Second, passed worker-sourced verification/review Evidence is inadmissible without the exact worker session plus a 64-hex source-state identity. Final native session diff now deterministically derives `worker.native_state_hash`, including read-only/no-change review state. Hostile `DONE`, `all tests passed`, `review complete`, and `safe to release` prose cannot replace Evidence. ProjectIntelligence, Context/CompressionArtifact, and WorkerResult remain outside Mission Evidence ownership. `scripts/audit-evidence-verification-completion.py` generates `data/validation/prompt-b-evidence-verification-completion.json`; current receipt coverage is 12/12 with zero violations.


### PROMPT B B7 — Context / ProjectIntelligence / Compression adversarial hardening — **CLOSED**

PROMPT B section 10 was re-audited across explicit context consumer binding, stale/unknown exclusion, ProjectIntelligence retrieval eligibility, compression source/hash/freshness/privacy, context budget survival and Evidence ownership separation. One real isolation defect was closed: `CompressionArtifact` could previously derive a `task:B` compression from source `ContextReference`s bound to `task:A`/another consumer. Compression sources must now already be bound to the exact `consumer_scope`; re-use across consumers requires an explicit canonical `bindContextReference` rebind first. Durable artifact selection still requires Mission handle membership, stale artifact content is not loaded, PI remains consumer-domain/freshness gated, and Context/PI remain outside Evidence ownership. `scripts/audit-context-project-intelligence-compression.py` generates `data/validation/prompt-b-context-project-intelligence-compression.json`; current receipt coverage is 12/12 with zero violations.


### PROMPT B B8 — Process / Workspace / Browser lifecycle adversarial hardening — **CLOSED**

PROMPT B sections 12–14 were re-audited as **61 executable invariants**: Process 23/23, Workspace 24/24, Browser/Visual 14/14, with zero audit violations in `data/validation/prompt-b-process-workspace-browser-lifecycle.json`.

Five material correctness/ownership defects were closed across the lifecycle slice:

- Browser Playwright sessions are now bound to exact `execution_owner_ref`; a new worker/session/generation for the same Task closes/replaces stale browser state, and stale owners cannot read or mutate the replacement session.
- `WorkspaceRuntime.provision()` accepts only the canonical Mission-owned `IsolationDecision` for the exact Task scope/requester; forged/cross-task decisions fail before host provisioning.
- Process kill/timeout semantics no longer mark an operation requested before native signal delivery succeeds; signal failure cannot later misclassify a natural process exit as Hi termination.
- Linux process-group signalling is supported only after independent `/proc` observation proves the exact OpenCode-owned PID is an isolated process-group leader (`pgrp == pid`); process-group identity drift fails closed.
- Different Tasks can no longer own the same active workspace path or host workspace ID. A colliding newly provisioned native lease is cleaned/rejected, and persisted duplicate active workspace identities fail Mission validation.

Additional hostile coverage now includes 1 MiB unread PTY output, concurrent owned PTYs, quick exit, non-zero exit, timeout/group kill, restart adoption/orphan quarantine, staged+unstaged user workspace state, symlink escape, concurrent lease collision, cleanup failure, browser console/network errors, browser timeout/crash, stale elements, auth-state reset, external/credential target rejection and visual-Evidence separation.

Exact-host truth was re-established rather than inherited optimistically. `data/validation/external-opencode-hi-0.1.0-lifecycle-1.18.18-head-2e7813f.json` proves current-equivalent Process and Browser behavior on OpenCode 1.18.18 / Linux aarch64; every capability-relevant Process/Browser owner/executor hash remains byte-identical to current source. Workspace runtime ownership changed later and therefore received fresh exact T3 acceptance at source `47a3502ab7176d9e008ed7b68ad0a3eb93803783` in `data/validation/external-opencode-hi-0.1.0-workspace-1.18.18-head-47a3502.json`. Compatibility projection selects Process=`2e7813f`, Workspace=`47a3502`, Browser=`2e7813f`, and the lifecycle audit independently rejects any selected receipt whose capability-relevant runtime hashes drift from current source.

The source-hardening checkpoint `47a3502ab7176d9e008ed7b68ad0a3eb93803783` / tree `4501bd61c4fd7600568220062b53bb3a92eb493a` passed exact committed-tree gates before T3 promotion: Python 84/84, Node 767/767, architecture lint 22/22 deferred=0, documentation parity violations=0, validator PASS, diff-check clean, backup count 0. Node 24.19.0 may still emit the known libuv `EEXIST` teardown assertion only after complete terminal PASS/result output; such teardown is never accepted without independently persisted terminal evidence and cleanup reconciliation.


### PROMPT B B9 — HumanDecision semantic / transport / Authority separation — **CLOSED**

PROMPT B section 15 is covered by `data/validation/prompt-b-human-decision.json`: **15/15 adversarial invariants PASS, 0 violations**. The audit mechanically binds semantic HumanDecision state, chat transport behavior, persistence/restart behavior, source-resolvable ambiguity handling and the exact Authority boundary.

Three material semantic-state defects were closed:

- Parent idle previously could take an already-open operational HumanDecision, collapse `USER_ACTION_REQUIRED` into the historical `waiting-user-authority` label, and overwrite the canonical decision with a fabricated authority-shaped decision. `RuntimeEventController` now preserves an existing OPEN canonical HumanDecision instead of reclassifying it.
- `HumanDecisionContract` previously allowed `semantic_type=authority_request` without an exact `authority_ref` or authority-protocol response schema, and allowed non-authority decisions to carry authority-shaped fields. Authority requests now require exact `authority_ref + authority-protocol`; non-authority decisions cannot carry either. `openHumanDecision()` validates the constructed contract before mutating Mission state.
- Runtime reason labels can no longer manufacture Authority semantics. `classifyRuntimeHumanDecision()` keeps generic runtime/user-action reasons in the operational semantic plane; exact `authority_request` state is created only by canonical Authority owners that already possess the exact action hash and protocol.

Host/UI separation remains truthful: ChatHumanDecisionTransport is ephemeral and transport-only; timeout/cancel/reply do not resolve semantic state or grant Authority by themselves. Duplicate/conflicting replies are inert after the first accepted response, stale answers cannot resolve replacement decisions, and restart reopens the persisted semantic decision in a fresh transport without replaying stale transport responses. OpenCode 1.18.18 structured host HumanDecision UI remains **UNSUPPORTED** rather than being synthesized through model mediation.

Source-resolvable contract ambiguity remains repo-first: repository exploration is permitted while implementation is blocked, and no HumanDecision is opened merely because repository evidence can still resolve the question.


### PROMPT B B10 — Persistence / restart + concurrency / race adversarial hardening — **CLOSED**

PROMPT B sections 16–17 were re-audited as 31 executable invariants: 19 persistence/restart and 12 concurrency/race invariants. Five real defects were closed. RuntimePersistence now rejects duplicate persisted session/Mission identities on save/load and MissionStore restore rejects duplicate replay defensively; malformed current-schema top-level/runtime metadata is fail-closed; unclean restart reconciliation applies to both active and waiting-user Missions so HumanDecision remains durable while ephemeral permissions/workers and stale Evidence are reconciled; late results cannot resurrect terminal cancelled/completed/failed workers; and permission reply-before-ask reordering cannot recreate a phantom pending permission. Partial/corrupt/old/unknown state, orphan temp writes, atomic primary replacement, process/workspace restart, release/methodology/context/VCS/HumanDecision survival, queue fairness, retry circuit, duplicate delivery, write conflicts and process/workspace races are hash-bound in `data/validation/prompt-b-persistence-concurrency.json`.


### PROMPT B B11 — Git/VCS safety + filesystem/path portability adversarial hardening — **CLOSED**

PROMPT B sections 18–19 are covered by `data/validation/prompt-b-vcs-path-portability.json`: **31/31 invariants PASS, 0 violations** (Git/VCS 13/13; filesystem/path portability 18/18). Three material defects were closed. Repository-file identity is now canonicalized through a bounded relative path contract so absolute POSIX paths, Windows drive paths, UNC paths, traversal, empty segments and NUL-bearing paths cannot enter WorkerResult/native-diff/staging/changed-file ownership. Playwright executable discovery no longer contains `/root/...` or `/home/node/...` host-user literals and instead uses explicit browser configuration plus Playwright/XDG/LOCALAPPDATA/current-user platform cache conventions. Browser snapshots now refresh the actual `page.url()` every observation and re-run local-scope validation, so SPA/client-side route changes are observable and a client-side redirect outside supported local scope fails closed instead of reporting stale URL state.

Exact host evidence was refreshed rather than inherited blindly. Workspace child binding was reaccepted on OpenCode 1.18.18 / Linux aarch64 at source `814acc48675ffa0d84fdb124ca315b403b922ec8` in `data/validation/external-opencode-hi-0.1.0-workspace-1.18.18-head-814acc4.json`; final source remains workspace-hash-equivalent. Browser execution was freshly reaccepted with real Chromium at exact source `59288454a1a03fceba2cd76dbdf59efecb41aa21` in `data/validation/external-opencode-hi-0.1.0-browser-1.18.18-head-5928845.json`, including dynamic `/done` SPA route observation, stale-element rejection, screenshot persistence, execution-owner/auth-state isolation, and external/credential/arbitrary-selector rejection. Process T3 was freshly reaccepted after the security/privacy ProcessRuntime change at `ca6490e...`. Compatibility projection therefore selects Process=`ca6490e`, Workspace=`814acc4`, Browser=`5928845`, and lifecycle audit remains 61/61 with zero source drift. The older `2e7813f...` Process receipt remains immutable historical exact evidence.

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

The current reference-host projection is generated from exact receipts in `data/validation/compatibility-matrix-0.1.0.json`; on the current source it resolves OpenCode **1.18.18** / Linux / aarch64 and selects capability-specific exact T3 proofs for process lifecycle (`ca6490e...`, fresh current-source acceptance), workspace isolation (`814acc4...`, source-equivalent current owner/executor hashes), and browser execution (`5928845...`). Future host-bound checkpoints must resolve registry latest again rather than assuming 1.18.18 remains current.

## 12. Historical real-host acceptance truth retained from M12

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

**PROMPT B — IN PROGRESS. Sections 20–27 are CLOSED. Next: Release engineering (section 28).**



Section 26 Packaging / fresh consumer is closed by `data/validation/prompt-b-packaging-fresh-consumer.json`: **8/8 invariants PASS, 0 violations**, backed by deterministic real-host receipt `data/validation/fresh-consumer-opencode-1.18.18.json`. A fresh tarball was built and installed outside the source tree; the package-provided `opencode-hi-setup` reconfigured the temp project; exact OpenCode **1.18.18** started against a consumer-local `.opencode/plugins/hi-packed.js` wrapper importing the installed package; the package resolved only under `<temp>/consumer/node_modules/opencode-hi/plugin/dist/plugin.js`; the exact host registered **31 Hi tools** including `hi_doctor`, `hi_status`, and `hi_task_start`; `coder` agent/config projection was visible; and provider-independent session creation succeeded. The server log contained no repository source-tree path. Isolated HOME intentionally had no `opencode-go` model inventory, so provider-backed chat/model execution was not claimed and is not required for this package/runtime acceptance boundary.

Section 25 Install/update lifecycle is closed by `data/validation/prompt-b-install-update-lifecycle.json`: **14/14 invariants PASS, 0 violations**. The local lifecycle receipt now covers fresh plan/install, idempotent install, static doctor, reconfigure, owned update, rollback, uninstall, uninstall rollback, final uninstall, reinstall, reinstall doctor, final clean uninstall and interrupted-upgrade recovery while preserving foreign user/OpenCode config. Setup/rollback state remains mode 0600 and stores bounded ownership/hash/index metadata rather than full configuration bodies. Three defects were closed: reinstall/stale-cleanup coverage was missing; the publishable package omitted the operator setup CLI and therefore required a source checkout; and root package metadata omitted direct runtime dependency declarations even though the packed runtime imports OpenCode SDK and optional Playwright. The package now carries executable `opencode-hi-setup`, `VERSION`, explicit `@opencode-ai/sdk` runtime dependency, `@opencode-ai/plugin` host peer and optional `playwright-core`. Local lifecycle proof remains distinct from exact-host runtime T3 and does not claim npm publication.

Section 24 CLI / developer tooling UX is closed by `data/validation/prompt-b-cli-developer-tooling-ux.json`: **11/11 invariants PASS, 0 violations**. Three material operator-safety defects were closed. Malformed existing `opencode.json` input no longer falls through as `{}` and can no longer be silently overwritten by setup; the CLI returns bounded structured `BLOCKED` output with repair guidance and preserves the original bytes. JSONC is truthfully classified as unsupported safe mutation rather than malformed JSON. Reconfigure scalar bounds are rejected at argparse before persistence, keyed provider/model concurrency limits fail closed with exact format/range guidance, and first-run/doctor blocked states now carry actionable next steps. Runtime permission asks remain native/authoritative and unsupported capabilities surface explicit RESOLVE/BLOCKED reasons rather than fabricated support. The UX contract is executable: specific, actionable, truthful, bounded; normal blocked paths do not emit stack dumps.

Section 23 Configuration audit is closed by `data/validation/prompt-b-configuration.json`: **32/32 config leaves PASS, 0 violations** (29 runtime, 2 diagnostic, 1 schema marker). Three material defects were closed. `profile.*` no longer accepts arbitrary runtime keys or invalid threshold strings; only the canonical `specialistThreshold` / `reviewThreshold` leaves with `low|medium|high` values enter `HiConfig`. Nested host/project precedence is now leaf-scoped instead of block-scoped, so a partial project block cannot erase an unrelated valid host constraint/capacity/preference and an invalid higher-precedence leaf falls back to the valid lower layer. Project routing discovery now returns sparse explicit validated overrides instead of manufacturing synthetic defaults such as `cost-quality` or empty sibling maps/lists. Provider allowlists retain narrowing intersection semantics and denied-model constraints retain union semantics. The canonical 32-leaf catalog remains the single semantic/default owner; generated defaults and the generated installation reference are projections. Targeted hostile config coverage reached **21/21 PASS** before full certification.

Section 22 HostPort portability is closed by `data/validation/prompt-b-host-port-portability.json`: **11/11 invariants PASS, 0 violations**. The source checkpoint is `8c3f029bf3503f80bde7e1aaa44efe9530260d50` (tree `fe04f38db425f6c698533e6ab31685ece35c1c32`). The former HostPort exposed raw `OpenCodeClient` / native-adapter shapes and semantic runtime code consumed OpenCode lifecycle details directly. The current architecture instead owns generic `HostPort` and `ChildSessionPort` contracts plus injected `ProcessExecutor`, `WorkspaceExecutor`, and `BrowserExecutor` seams. Raw OpenCode events are normalized at the OpenCode hook boundary; continuation, Task/child execution, process semantics and provider-policy routing no longer require OpenCode SDK types. OpenCode adapter construction is isolated to the plugin composition boundary. Alternate-host feasibility is recorded as `FEASIBLE_BY_PORT_CONTRACT_NOT_IMPLEMENTED`: another session-capable coding host can implement these ports without changing Mission/Task/Authority/Evidence semantics, but no alternate host implementation or support claim is made.

Because §22 changed capability-relevant owner bytes, historical T3 receipts were not inherited. Process, workspace isolation, and browser execution were freshly reaccepted against exact OpenCode **1.18.18** / Linux / aarch64 on source `8c3f029...`. The generated compatibility projection now selects the fresh `head-8c3f029` Process, Workspace, and Browser receipts for all three capabilities at source rank 153; `prompt-b-process-workspace-browser-lifecycle.json` is again **61/61 PASS, 0 violations** with zero runtime hash drift. Process acceptance proved clean Mission-owned exit 0, explicit nonzero 7, bounded 1 MiB output, timeout/process-group behavior, concurrent isolation, restart adoption and host PTY cleanup 0. Workspace acceptance proved exact baseline and `workspaceID + directory` child binding through the generic `ChildSessionPort`, primary/user-dirty preservation, cleanup, restart adoption and orphan quarantine/no recreation. Browser acceptance proved real Chromium health, dynamic DOM state, stale-element rejection, screenshot persistence, local-scope/credential/selector rejection and execution-owner auth-state reset. The known Node 24.19.0 libuv teardown assertion occurred only after terminal acceptance JSON was persisted and is not classified as product failure.

Section 21 Skills / Methodology Security is closed by `data/validation/prompt-b-skills-methodology-security.json`: **13/13 invariants PASS, 0 violations**. Three material defects were closed. Skill discovery now realpath-confines the canonical skill directory and `SKILL.md`, so a project skill-directory or skill-file symlink cannot escape its discovery root; resource indexing/read remains confined and traversal rejects fail closed. Project methodology policy, skill, provenance, and learning-candidate artifacts must resolve to exact project-confined files before admission. Repository-local methodology provenance is integrity/admission metadata only and no longer manufactures execution trust: absent an exact host/user decision, an admitted project methodology receives native `ask`, not `allow`; existing exact `deny` remains authoritative and an explicit exact host/user `allow` may opt in. Foreign project skill IDs cannot shadow a built-in Hi methodology.

The required state separation is executable and guarded: `installed skill != admitted methodology != selected methodology != loaded methodology`. A selected methodology is recorded as loaded only after the exact child/native skill-load observation. Forged `explicit-user-request` or `project-learning` repository metadata therefore cannot silently grant native load trust, Authority, or Completion. Targeted security/methodology suite reached 40/40 PASS; full canonical closure reached Python **90/90**, Node **811/811**, architecture **22/22**, docs parity 0, validator PASS, diff clean, backup artifacts 0. Dependent current-source §7 Role/Model/Methodology and §20 Security/Privacy receipts were regenerated rather than retaining stale owner/proof hashes.

Section 20 closure is source-bound to security/privacy checkpoint `ca6490e13fbee33614c32fab4aa84722fa9f7276` (tree `6b482784e6f27bf773ff8452057d48ba2e3d74c1`) plus the generated current-source receipts that follow it. `data/validation/prompt-b-security-privacy.json` covers **20/20 invariants, 0 violations**. Material defects closed: secret-sensitive ProcessRuntime actions are rejected before Authority mutation; durable Authority action descriptors and ledger payloads redact secrets while exact action identity remains hash-bound; temporary mutation rollback commands fail closed when secret-bearing while durable description/detail is redacted; provider-facing parent/child system projections pass through the privacy boundary; process environment values remain execution-ephemeral and are absent from durable ProcessContract/ledger state.

Because ProcessRuntime changed, the prior Process T3 proof was not inherited. Exact OpenCode **1.18.18** / Linux / aarch64 acceptance was rerun on `ca6490e13fbee33614c32fab4aa84722fa9f7276`; `data/validation/external-opencode-hi-0.1.0-process-1.18.18-head-ca6490e.json` is the current Process lifecycle capability proof. It verifies Mission-owned ProcessRuntime spawn/wait/cleanup plus quick exit, nonzero exit, bounded 1MiB output, timeout/process-group handling, concurrent isolation, restart adoption, group termination and cleanup. The historical `2e7813f...` lifecycle receipt remains immutable history and is no longer selected as current capability proof. Dependent current-source audits regenerate clean: Authority 18/18, lifecycle 61/61, Persistence/Concurrency 31/31, VCS/Path 31/31, Security/Privacy 20/20. Full Node behavior gate reached 803/803 PASS and architecture lint 22/22 before final generated-projection closure.

PROMPT A certified product-source baseline: `5ced215ed57f28f8d963376ca702efc0dac75503` (tree `b22db990942ad291997a8ad564ac1235283036bb`). Canonical reconstruction receipt: `data/validation/documentation-reconstruction.json`.

PROMPT B must distrust previous completion labels, establish a fresh exact baseline on its current clean HEAD, and perform the full-system defect hunt → hardening → certification sequence. The npm `0.1.0` T4 bootstrap remains an external publication blocker and must not be fabricated.

Section 27 Dependency / supply-chain / license is closed by `data/validation/prompt-b-dependency-supply-chain-license.json`: **8/8 invariants PASS, 0 violations**. The publishable distribution graph is exact-pinned and lockfile-v3 bound in root `package-lock.json`, while the plugin build/test graph remains separately bound in `plugin/package-lock.json`. Release SBOM/provenance and release-chain verification deterministically combine both canonical locks. Root and plugin npm audit observed zero vulnerabilities at this checkpoint. The only install-script dependency is optional MIT `msgpackr-extract@3.0.4`, explicitly recorded rather than hidden. `THIRD_PARTY_NOTICES.md` now enumerates direct runtime SDK, host peer, optional Playwright and build TypeScript; restrictive-license and missing-license source reuse remains CLEAN_ROOM/BEHAVIOR_ONLY or IDEA_ONLY as required by `SOURCE-REUSE-MATRIX.md`. OIDC release permissions remain `contents: read` plus job-scoped `id-token: write` with no npm token secret. Release pack proof and publish both use `--ignore-scripts` against the already checked built tree, preventing prepack stdout/artifact drift between proof and publish. No push, tag, GitHub release, npm publication or T4 claim was performed.
