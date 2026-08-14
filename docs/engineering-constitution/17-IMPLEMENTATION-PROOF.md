# 17 — Implementation and Proof Ledger

Status: ACTIVE LEDGER — CONSTITUTION DESIGN DOCUMENTED, METAMODEL IMPLEMENTATION PENDING

## Purpose

Prevent design documentation from being mistaken for runtime implementation. Every migration phase records concrete files, tests, evidence tier and local commit.

## Baseline before constitution program

| Item | Evidence | Tier | Status |
|---|---|---|---|
| Team/Recovery hardening | controlled plugin suite 458/458 | T1/T2 local controlled | PASS |
| Standalone project validator | `python3 scripts/validate.py` | T0/T1 local | PASS |
| backup hygiene | 0 `.bak.*` at baseline closure | T0 | PASS |
| baseline commit | `396e1ba fix: harden team and recovery boundaries` | provenance | COMMITTED |

This proves the starting runtime state only.

## Constitution foundation

| Deliverable | Current proof | Implementation meaning |
|---|---|---|
| Source Study | 22 records; one explicit `agentic` source-version HOLD | architecture grounded; not runtime mutation |
| Runtime Reality Map | production owner/consumer/executor surfaces mapped | preliminary until contract lint is executable |
| Failure Inventory | recurring defects classified | design input |
| Domain Ontology | semantic distinctions documented | contract candidate |
| Component Metamodel | component families/dependency direction documented | design candidate |
| Contract Catalog | C01–C29 candidate contracts | schemas/runtime not yet implemented |
| Template Catalog | T01–T08 authoring shapes | parsers/generators not yet implemented |
| Schema Catalog | S00–S27 target modules/rules | implementation pending |
| Generator Architecture | current generator gap + target G01–G06 | implementation pending |
| Validation Architecture | V1–V10 + HI001–HI020 rules | implementation pending |
| Behavioral Acceptance | BA01–BA12 | executable scenarios pending |
| Host Projection | OpenCode boundary/capability target mapped | contract-backed runtime registry implemented at M7; real-host T3 verification still pending |
| Migration Matrix | M0–M13 ordered plan | migration execution pending |
| Source Semantics | ADOPT/ADAPT/REJECT/HOLD register | architecture decision evidence |
| Engineering Constitution | V1 candidate | migration pending |
| ADRs | ADR-0001..0012 accepted | migration obligations active |

## Migration proof rows

Rows below are intentionally `PENDING` until code exists.

| Phase | Implementation | Required proof | Tier | Commit | Status |
|---|---|---|---|---|---|
| M0 | constitution documentation foundation | constitution lint PASS; validator PASS; diff check clean | T0 | `e03aefd` | PASS |
| M1 | common contract/provenance primitives | focused contract tests 6/6 PASS; controlled full suite 464/464 PASS; validator PASS; diff check clean; build generation idempotent | T0/T1 | `3809cd1` | PASS |
| M2 | RoleContract owner/generator | role identity/mode/description/runtime catalog and methodology permission contribution are canonical-data driven; focused projection suite 24/24 PASS; controlled full suite 467/467 PASS; validator PASS | T1/T2 | `443bfd5` (owner foundation `b06d281`) | PASS — GENERAL PERMISSION RESIDUE CLOSED BY M3 `9801382` |
| M3 | PermissionProfile | canonical 7-profile catalog + RoleContract references; exact 8-agent native permission semantic parity to pre-M3 HEAD; read-only edit-deny/lower-layer-widening/unknown-ref/methodology-owner negatives; focused 10/10 PASS; controlled full suite 543/543 PASS; architecture lint PASS; validator PASS | T1/T2 | `9801382` | PASS — CANONICAL PERMISSION OWNER MIGRATED |
| M4 | MethodologyContract normalization | mechanical SKILL contract sections compiled from canonical JSON; inert duplicated fields removed; focused 37/37 PASS; controlled full suite 469/469 PASS; validator PASS | T1/T2 | `c152f98` | PASS — MECHANICAL OWNER MIGRATED |
| M5 | ConfigOption catalog | 32-option canonical catalog (29 runtime, 2 diagnostic, 1 schema marker); generated default ownership; BA03 executor-effect coverage; HI003 fatal PASS with no deferred config rule; focused config/generator set 22/22 PASS; controlled full suite 548/548 PASS; validator PASS | T1/T2 | `d53fe31` | PASS — EXECUTABLE CONFIG OWNERSHIP CLOSED |
| M6 | Model capability/identity | canonical model capability normalization + production-wired requested/selected/projected/observed/effective execution identity; WorkerState snapshots persist real request/projection producers; projection/model/variant mismatch gates fail closed; focused M6 set 27/27 PASS; controlled full suite 549/549 PASS; validator PASS | T1/T2 | foundation `e7c3c96`; closure `ec2bdd3` | PASS — MODEL EXECUTION IDENTITY CLOSED |
| M7 | Host capability registry | 16 contract-backed OpenCode capabilities; product runtime gates consume worker-runtime/session-revert contracts; doctor reports status/verification/semantic loss; focused 43/43 PASS; controlled full suite 480/480 PASS; validator PASS | T1/T2 local; T3 still pending | `390cc2b` | PASS_LOCAL — REAL-HOST ACCEPTANCE PENDING |
| M8 | Task/Worker/Result/Evidence contracts | WorkerResult, EvidenceItem, ReviewFinding, derived VerificationEnvelope, TaskContract and WorkerContract now have canonical runtime owners; persistence consumes canonical validators; task mission/external-action identity is explicit; worker attempt/recovery/effective-model lifecycle is fail-closed; latest focused Task/Worker set 21/21 PASS and controlled full suite 507/507 PASS; validator PASS | T1/T2 | WorkerResult `4ea320d`; Evidence `3044b94`; ReviewFinding `b120f49`; VerificationEnvelope `a4b1105`; Task/Worker `77f9dc1` | PASS — CONTRACT OWNERSHIP CLOSED |
| M9 | Context/Artifact/PI/Human/Authority/Storage | Artifact + ContextReference + derived SemanticContext + ProjectIntelligence + HumanDecision + Authority + ExternalAction + StorageOwnership operational; machine storage catalog enforces one canonical owner per scope/data class, canonical path providers cover current project/runtime durable classes, OpenCode-native project skills remain outside Hi internal storage, uninstall preserves independently-owned policy/knowledge/skills, and doctor consumes the current runtime-state schema; focused storage/ownership set 66/66 PASS; controlled full suite 538/538 PASS; validator PASS | T1/T2 | Artifact `811ee7f`; ContextReference `3e8ab72`; SemanticContext `b7e51cc`; PI `e2d021b`; HumanDecision `46fc7b7`; Authority/ExternalAction `da67329`; StorageOwnership `ea6c236` | PASS — CONTRACT OWNERSHIP CLOSED |
| M10 | common generator/lint closure | 30 deterministic ProjectionReceipts; BA12 unchanged-input idempotence + declared dependency-scope mutation 2/2 PASS; executable HI001–HI020 architecture lint with migrated-class fatal checks, behavioral proof links and explicit HI003/M5 deferral; controlled full suite 540/540 PASS; validator PASS | T0/T1/T2 | `4602907` | PASS — MIGRATED CLASSES CLOSED; HI003 DEFERRED WITH M5 |
| M11 | deterministic full closure | committed-state integrated check 540/540 PASS; targeted BA12/contract/authority/storage/host-capability negative set 62/62 PASS; architecture lint HI001–HI020 PASS with HI003 explicitly deferred to M5; standalone validator PASS; diff check clean; backup count 0; M11 exposed and fixed one cwd-dependent host-capability acceptance harness defect | T0/T1/T2 | `52c6be4` | PASS — DETERMINISTIC CLOSURE COMPLETE |
| M12 | real-host acceptance | exact-HEAD OpenCode 1.18.16/aarch64 receipt verifies local plugin loader, 8 agent projection, native skill discovery/load, provider inventory, session create/prompt/abort/status/children/todo/diff/fork/summarize/revert/unrevert, worker child agent/model/variant, native permission once/reject and structured logging; process lifecycle remains DEGRADED and workspace-isolation binding remains UNSUPPORTED; one independent-review terminal scenario classified HARNESS_MODEL_BEHAVIOR_INCOMPLETE rather than product FAIL | T3 | `baca9f7` (tested source HEAD `753043d`) | PASS — MATERIAL REAL-HOST PRIMITIVES VERIFIED |
| M13 | release readiness | explicit authority + external receipts | T4 | — | NOT REQUESTED |



### M9 ArtifactContract checkpoint

Implemented:

- added canonical `ArtifactContract` with independent `artifact_id`, explicit `content_ref`, `content_hash`, producer, provenance, retention class, privacy class, consumer refs and freshness;
- durable ContextArtifactStore now persists/loads only the current ArtifactContract shape and verifies content hash on admission;
- artifact identity no longer derives from content hash or source provenance; two artifacts may share identical content hash while retaining distinct identities;
- source-file freshness invalidation remains provenance-bound and does not mutate artifact identity;
- OpenCode context-artifact tool writes redacted artifacts with explicit producer/privacy metadata and mission references use canonical artifact ID/content hash;
- stale legacy artifact storage shape has no silent compatibility owner in current-only runtime;
- ArtifactContract rejects hash drift, malformed provenance and unknown fields.

Evidence: focused artifact/context/core suite 30/30 PASS; controlled isolated-HOME/XDG full suite 510/510 PASS; validator PASS. Artifact checkpoint commit: `811ee7f`. ContextReference/SemanticContext/ProjectIntelligence/HumanDecision/Authority/Storage ownership remain open under M9.


### M9 ContextReferenceContract checkpoint

Implemented and verified:

- added canonical `ContextReferenceContract` separating mission-level context availability from explicit per-Task selection;
- TaskContract now stores consumer-bound ContextReference items rather than raw mission context handles;
- every selected reference binds `consumer_ref` to the exact Task ID;
- unknown requested mission context handles fail closed;
- durable ArtifactContract selection projects live artifact freshness/privacy/content hash into the selected reference and records the Task ID in Artifact `consumer_refs`;
- non-durable context handles use `UNKNOWN` freshness rather than fabricating freshness evidence;
- handoff dereferences durable artifacts through `source_ref`; stale durable content remains excluded by the live Artifact freshness check;
- availability remains distinct from selection: unselected mission handles never enter Task context.

Evidence: focused ContextReference/Artifact/Task/Persistence suite 23/23 PASS; controlled isolated-HOME/XDG full suite 513/513 PASS; validator PASS; diff check clean. SemanticContext/ProjectIntelligence/HumanDecision/Authority/Storage remain open under M9.

### M9 SemanticContextContract checkpoint

Implemented and verified:

- added canonical `SemanticContextContract` with technical source ref, source hash, language adapter, structured symbols, relationships, exact selected ranges, Task consumer, exact character budget, creation timestamp and rendered text;
- corrected the constitution from mandatory `source_artifact_ref` to `source_ref`: live project source files remain live source files and are not wrapped in fake Artifacts;
- SemanticContext is DERIVED and non-persisted; source hash + Task consumer + selected ranges form deterministic semantic-context identity while `created_at` remains observation metadata;
- TypeScript source refs are safe project-relative `file:` refs; traversal/backslash/absolute-path forms fail contract validation;
- exact selected ranges correspond to the actual trimmed source slice used as each declaration signature;
- extraction budget counts rendered separators as well as signatures, so contract `used_chars` equals the exact rendered text length;
- `relationships[]` is legal and empty because the current bounded extractor observes declarations only; no dependency graph is fabricated;
- TaskRuntime consumes SemanticContextContract records, emits bounded `context.semantic-selected` observation metadata and renders only their bounded text into child handoff;
- source mutation changes `source_hash` and derived SemanticContext identity;
- forged IDs, forged ranges, unknown fields, unsafe source refs, unresolved relationship symbols and budget drift fail closed.

Evidence: focused SemanticContext/context/core suite 31/31 PASS; controlled isolated-HOME/XDG full suite 517/517 PASS; validator PASS; diff check clean; backup count 0. ProjectIntelligence/HumanDecision/Authority/Storage remain open under M9.


### M9 ProjectIntelligenceContract checkpoint

Implemented and verified:

- added canonical `ProjectIntelligenceContract` owning project fact/pattern state rather than a generic memory union;
- replaced parallel `sourceFiles[] + sourceHashes{}` truth with bounded `source_refs[]` records containing safe project-relative `file:` refs and exact SHA-256 hashes;
- centralized safe project-file source-ref syntax in the common contract primitive consumed by both SemanticContext and Project Intelligence;
- confidence is bounded to `[0,1]`; freshness, lifecycle, consumer domains and update time are explicit; unknown fields, duplicate refs, unsafe paths and malformed hashes fail closed;
- `ProjectIntelligenceStore` persists/loads only the canonical current contract and rejects invalid upserts instead of silently accepting malformed state;
- TaskRuntime requests PI specifically for the `task-context` consumer domain and emits bounded selection observations; stale, archived, unrelated or consumer-ineligible PI is excluded;
- source-file mutation/hash drift marks PI `POTENTIALLY_STALE` without converting PI into Evidence;
- repeated independent reusable-HOW observations remain owned by the separate `ProjectMethodologyCandidate` lifecycle; `observation_count`, `independence` and generic admission fields were not fabricated on the PI contract because no production fact-observation producer owns them.

Evidence: focused PI/SemanticContext/methodology/context suite 59/59 PASS; controlled isolated-HOME/XDG full suite 521/521 PASS; validator PASS; diff check clean; backup count 0. ProjectIntelligence code checkpoint: `e2d021b`. HumanDecision/Authority/Storage remain open under M9.


### M9 HumanDecisionContract checkpoint

Implemented and verified:

- added canonical strict `HumanDecisionContract` plus one runtime open/resolve owner; all direct `waiting-user + user.action.required` producers now route through that owner rather than writing ad-hoc reason payloads;
- persisted latest HumanDecision state records semantic type, technical reason code, exact Mission/Task/Worker blocking scope, response protocol, lifecycle timestamps and optional authority reference;
- added `operational_action` for provider/permission/runtime-budget/precondition classes so they are not mislabeled as credential or authority decisions;
- shell interactive credential flows, worker user-action gates, permission failures and idle-evaluator user-action decisions now create canonical HumanDecision state;
- exact external-action approval and uncertain-outcome reconciliation create `authority_request` HumanDecision projections but Authority action hash/state remains separately owned by the Authority subsystem;
- generic semantic follow-up may resolve an open non-authority HumanDecision, while authority requests survive generic continuation and close only through the deterministic exact Authority protocol;
- duplicate attempts to open the same decision preserve identity/creation time and do not emit duplicate `user.action.required` ledger interactions;
- HumanDecision survives RuntimePersistence restart validation, participates in progress signature and deterministic completion, and is visible through bounded user status;
- malformed/forged decision IDs, response protocols, lifecycle states and unknown fields fail closed;
- an existing semantic conflation was avoided: temporary rollback remains a `precondition-blocked` operational user action rather than being reclassified as authority simply because completion can also return `USER_ACTION_REQUIRED`.

Evidence: focused HumanDecision/authority/continuation/persistence set 36/36 PASS; controlled isolated-HOME/XDG full suite 528/528 PASS; validator PASS; diff check clean; backup count 0. HumanDecision code checkpoint: `46fc7b7`. AuthorityContract/ExternalAction/Storage remain open under M9.


### M9 AuthorityContract / ExternalActionContract checkpoint

Implemented and verified:

- added canonical `ExternalActionContract` with the closed semantic vocabulary `git-push | release-create | package-publish | deploy`; Task and Mission intent snapshots consume that canonical type instead of duplicating the action union;
- kept executor-specific command kinds (`gh-release-create`, Docker/Kubernetes/Terraform/Vercel/Netlify command classes) as technical classifier facts and mapped each privileged command deterministically into exactly one canonical ExternalAction type;
- added canonical exact `AuthorityContract` construction binding semantic action type + exact command + cwd target into the existing deterministic action hash and auditable authority ID, while preserving the proven one-shot lifecycle and HumanDecision separation;
- added a strict current-only `AuthorityStateContract` for Mission persistence; malformed hashes/action payloads, unknown fields, duplicate completed hashes, and simultaneous `pending`/`approved`/`executing` active slots fail closed during RuntimePersistence load;
- preserved the existing fail-closed uncertain-outcome protocol: unknown host execution ACK remains `executing`, blocks replay through exact-action idempotency, opens an `authority_request` HumanDecision, and requires explicit outcome reconciliation before retry;
- corrected project-persistent OpenCode `always` authority to use the same four semantic action classes rather than widening `git-push` into `release-create`; a persistent push grant no longer authorizes GitHub release creation;
- closed native permission projection gaps for classifier-admitted `yarn npm publish` and `kubectl delete` forms so every current privileged command form receives an explicit ask/allow boundary without falling through a broader shell default;
- preserved explicit user/native deny monotonicity and force-push `ask` behavior; child workers remain unable to execute privileged external effects;
- no real push/tag/release/publish/deploy was performed. Full-suite external-effect coverage used only deterministic test-local bare Git remotes, hosted-release fixtures and local registry fixtures permitted by the continuation protocol.

Evidence: focused Authority/ExternalAction/project-authority/release/HumanDecision/threat set 59/59 PASS; controlled isolated-HOME/XDG full plugin suite 534/534 PASS; standalone validator PASS; `git diff --check` clean; backup count 0. Authority/ExternalAction code checkpoint: `da67329`. StorageOwnershipContract remains open under M9.


### M9 StorageOwnershipContract checkpoint

Implemented and verified:

- added canonical machine-readable `StorageOwnershipContract` + catalog with strict `scope + data_class` uniqueness; overlapping canonical ownership now fails contract validation instead of existing only as a documentation rule;
- mapped current implemented project/runtime durable classes to explicit canonical owner, scope, lifecycle, path provider, schema ref, write owner, readers, retention and privacy semantics;
- centralized project methodology policy/provenance path providers with the existing Hi storage resolver while keeping project-created reusable methodology in OpenCode-native `.opencode/skills/hi-project-*` storage rather than mirroring it under `.opencode/hi`;
- distinguished one logical write owner from multiple authorized executor surfaces: project routing policy may be created/updated through runtime auto-init or explicit project reconfiguration without becoming two semantic owners;
- corrected uninstall ownership: setup uninstall removes plugin registration plus setup-owned `provenance/setup.json`, but preserves independently-owned routing policy, native-always Authority projection, Project Intelligence, methodology state, retained Artifacts and OpenCode-native project skills;
- corrected doctor/runtime schema drift by consuming canonical `RUNTIME_STATE_SCHEMA` instead of a stale hard-coded schema `3`; doctor now describes incompatible runtime state as current-only rather than claiming an obsolete migration-on-load path;
- preserved OS/project boundary: Mission survival remains project-keyed OS state, not `.opencode/hi/runtime`, and host-native project methodologies remain host-native skill capability storage;
- updated storage architecture/ownership/layout docs to match the executable owner graph and cleanup boundary.

Evidence: focused storage/doctor/methodology/authority/routing set 66/66 PASS; controlled isolated-HOME/XDG full plugin suite 538/538 PASS; direct setup install/uninstall ownership scenario PASS because host Python lacks the optional `pytest` module; Python source syntax compile PASS; standalone validator PASS; `git diff --check` clean; backup count 0. StorageOwnership code checkpoint: `ea6c236`. This closes M9 at T1/T2 while preserving BA06/BA10/BA11 behavior in the full regression suite.


### M10 common generator / architecture lint checkpoint

Implemented and verified:

- composed the existing role/agent/methodology generators into one deterministic build/check graph rather than creating a parallel generator framework;
- reused the M1 `ProjectionReceipt` contract and added a deterministic postbuild receipt catalog for 30 material generated outputs (role policy, agent config, methodology policy and 27 native methodology `SKILL.md` projections);
- added `scripts/architecture_lint.mjs` as the executable HI001–HI020 constitutional rule entrypoint; migrated owner/reference/host projection/storage/generated-artifact/role-agent/methodology/current-only/proof-link violations are fatal;
- linked safety/authority/evidence/completion/recovery/context/artifact rules to named controlled behavioral tests instead of pretending these properties are provable by text/AST checks alone; missing proof links are lint failures and the controlled suite executes the linked behavior;
- preserved the earlier M5 blocker honestly: `HI003 CONFIG_EXECUTOR_MISSING` is emitted as `DEFERRED`, not PASS, because ConfigOptionContract has not been migrated under the host policy constraint; M10 only closes fatal lint for migrated classes;
- made generated-artifact drift/hand-edit checks receipt-backed and regeneration-backed without mutating the active working tree during lint;
- added executable BA12 acceptance: identical canonical inputs generate byte-identical projections on repeated runs, while a one-field `coder` RoleContract purpose mutation changes only the declared `role-policy.ts` and `agent-config.ts` dependents in an isolated fixture;
- integrated root/plugin `architecture:lint`, `projections:check`, `behavior:accept`, `contracts:generate` and `check` commands so ordinary deterministic closure is build -> receipts -> architecture lint -> behavioral suite -> standalone validator.

Evidence: BA12 generator acceptance 2/2 PASS; architecture lint reports all 20 rule IDs with 11 migrated-class fatal PASS, 8 behavioral LINKED and 1 explicit HI003/M5 DEFERRED; 30/30 material projection receipts current; controlled isolated-HOME/XDG full plugin suite 540/540 PASS; standalone validator PASS; `git diff --check` clean; backup count 0. M10 code checkpoint: `4602907`.

### M8 Task / Worker contract checkpoint

Implemented:

- added canonical `TaskContract` and `WorkerContract` status/schema owners and removed duplicate task/worker persistence validators;
- Task creation now records explicit `mission_id` and a bounded `external_action_requirements` snapshot; existing runtime fields map directly to the constitution contract rather than creating duplicate alias fields;
- Worker creation now records required `attempt` and `updated_at`; every actual child execution/resume prompt advances `attempt` while preserving semantic Worker/Task identity, including corrective resume, semantic follow-up, constraint rebase, write-conflict reconciliation, stagnation recovery and provider/model fallback;
- WorkerContract validates current lifecycle and evidence-bearing state that persistence previously ignored: session/model/variant fields, native diff snapshots, recovery flags/counters, fallback history, model selection reason and effective-model evidence;
- TaskContract validates mission identity, scope/dependency/obligation/evidence/context snapshots, execution profile, WorkerResult, diff cleanliness and external-action requirements; unknown top-level contract fields fail closed;
- provider fallback fixtures were aligned from stale `skills` terminology to the current `methodologies` execution profile and now prove same-worker attempt 1 -> 2 across fresh fallback sessions;
- RuntimePersistence round-trip accepts current canonical Task/Worker state and rejects a corrupted WorkerContract instead of silently loading it.

Evidence: focused Task/Worker/persistence/provider-recovery/role suite 21/21 PASS; controlled isolated-HOME/XDG full suite 507/507 PASS; validator PASS. This closes M8 Task/Worker/Result/Evidence contract ownership at T1/T2.


### M8 VerificationEnvelope contract checkpoint

Implemented:

- added canonical derived `VerificationEnvelopeContract`; it is computed from canonical Evidence, VerificationPolicy and obligation/review state rather than persisted as a second truth;
- verification checks distinguish `passed`, `failed`, `pending`, `environment-issue` and `not_run`;
- `passed` requires explicit evidence outcome/pass authority plus an evidence reference; outcome-less evidence remains pending and cannot silently satisfy completion;
- missing required checks become `not_run` with explanation; stale executed checks retain their result while envelope freshness independently blocks completion;
- obligation-scoped worker evidence cannot satisfy another verification obligation;
- independent-review completion is represented in the same envelope used by verification completion;
- `verificationSatisfied()` now consumes the derived envelope, and compact ledger reporting projects that same envelope instead of reinterpreting verification state;
- freshness reporting is non-redundant at completion: incomplete checks report their missing kind; `fresh-evidence` is the blocker when all required checks passed but their evidence is stale.

Evidence: focused freshness/envelope/verification/ownership suite 17/17 PASS; controlled isolated-HOME/XDG full suite 502/502 PASS; validator PASS. Task/Worker contract extraction remains.


### M8 ReviewFinding contract checkpoint

Implemented:

- extracted shared evidence-kind/outcome primitives so WorkerResult, mission Evidence and ReviewFinding consume one proof vocabulary without circular ownership;
- added canonical `ReviewFindingContract` with technical finding ID, reviewer role, subject, severity, causality, scope, evidence refs, confidence, disposition and blocking semantics;
- blocking findings require evidence refs, and WorkerResult validation requires every finding evidence ref to resolve to an evidence.kind returned by that same result;
- reviewer handoffs request `findings[]` only for canonical reviewer roles; QA/security/visual reviewer prompt projections now instruct structured findings rather than burying findings in summary/open_issues;
- TaskRuntime requires finding reviewer_role to match the actual canonical reviewer worker; spoofed/mismatched roles become FIX_REQUIRED;
- open introduced/worsened findings force FIX_REQUIRED even when reviewer prose/status claims DONE;
- open pre-existing findings remain recorded in the task result but do not become unrelated mission blockers;
- blocking findings with unknown causality cannot gain blocker authority and instead require explicit causality reconciliation;
- the handoff projection was rewritten from a dense single-line string builder into an equivalent readable structured projection while preserving bounded context/output semantics.

Evidence: focused ReviewFinding/result/evidence/ownership/role suite 45/45 PASS; controlled isolated-HOME/XDG full suite 495/495 PASS; validator PASS; diff check clean. ReviewFinding checkpoint commit: `b120f49`. Task/Worker state extraction remains.


### M8 Evidence contract checkpoint

Implemented:

- added canonical `plugin/src/contracts/evidence.ts` owning the mission EvidenceItem shape and the exact mission evidence-kind catalog;
- mission evidence is explicitly the worker proof catalog plus control-plane/host-only `review-input` and `lsp-diagnostics`; workers cannot self-produce those control-plane evidence classes through WorkerResult;
- `mission/types.ts` re-exports the canonical EvidenceItem instead of defining a second shape;
- runtime persistence now validates mission evidence through `isEvidenceItemContract()` and no longer owns a duplicate evidence-kind/outcome schema;
- evidence runtime narrows verification command classification to the canonical MissionEvidenceKind union;
- strict negative tests reject unknown fields/kinds/outcomes and non-finite freshness timestamps while preserving source/session/state/task/obligation provenance.

Evidence: focused evidence/result/obligation/review suite 32/32 PASS; controlled isolated-HOME/XDG full suite 489/489 PASS; validator PASS; diff check clean. `VerificationEnvelope` and `ReviewFinding` are not claimed implemented: neither is first-class runtime state yet, so the next M8 work must wire a real consumer before adding either contract.


### M8 WorkerResult contract checkpoint

Implemented:

- added canonical `plugin/src/contracts/worker-result.ts` owning WorkerResult status, evidence kinds, evidence/outcome types, methodology observations, scope expansions, bounded normalization and strict validation;
- `mission/types.ts` now re-exports WorkerResult contract types instead of defining a second shape;
- `runtime/task/contracts.ts` retains handoff construction only and re-exports the canonical WorkerResult normalizer;
- persistence now validates persisted task results through `isWorkerResultContract()` instead of maintaining a separate WorkerResult/evidence schema;
- strict negative tests reject unknown result fields, unknown evidence kinds/outcomes and methodology observations that do not cite exact canonical evidence kinds;
- compatibility aliases such as `PASS` and `USER_ACTION_REQUIRED` normalize at the parser boundary but canonical stored status remains `DONE` / `BLOCKED`.

Evidence: focused WorkerResult/persistence/recovery suite 57/57 PASS; controlled isolated-HOME/XDG full suite 485/485 PASS; validator PASS; diff check clean. Remaining M8 work is Evidence/VerificationEnvelope/ReviewFinding ownership, followed by Task/Worker state extraction.


### M7 host capability registry checkpoint

Implemented:

- added `HostCapabilityContract` with separate `status` and `verification_level` so native method observation cannot masquerade as behavioral/real-host verification;
- mapped 16 OpenCode product capabilities with `SUPPORTED | DEGRADED | UNSUPPORTED`, native primitive/adapter, fallback, semantic loss, acceptance reference and forbidden fake behavior;
- kept low-level booleans as compatibility observations while making the registry the product-level decision surface;
- moved Team tool exposure to the `worker-runtime` capability contract and native temporary-mutation revert admission to the `session-revert` contract;
- permanently classifies ordinary shell `process-lifecycle` as `DEGRADED` under the current adapter because PID/job wait/kill/exit ownership is not exposed;
- classifies `workspace-isolation-binding` as `UNSUPPORTED`; creating a git worktree directory is explicitly insufficient unless subsequent child execution is provably bound to it;
- doctor reports registry counts plus process/workspace status, observation verification level and semantic loss;
- every `acceptance_ref` is mechanically checked against a real repository test file.

Evidence: focused host-capability/runtime/doctor suite 43/43 PASS; controlled isolated-HOME/XDG full suite 480/480 PASS; validator PASS; diff check clean. `verification_level=OBSERVED` remains deliberate until M12 real-host acceptance binds an exact OpenCode version.


### M3 PermissionProfile checkpoint

Implemented and verified:

- current environment was re-audited after M12 and the former SentinelX mutation-policy blocker no longer reproduced; the migration proceeded through normal repository writes with no bypass;
- added canonical `data/hi-permission-profiles.json` with seven reusable profiles and strict `PermissionProfileContract` validation;
- `data/hi-roles.json` schema 2 now binds every canonical RoleContract to exactly one `permission_profile_ref`;
- removed general mechanical OpenCode `permission:` ownership from all eight `roles/*.md`; Markdown remains human guidance/host projection input only;
- preserved M4 ownership: methodology `skill` permissions are not legal inside PermissionProfile and continue to derive exclusively from `data/hi-methodologies.json` compatible-role relationships;
- agent generation now resolves Role -> PermissionProfile -> native OpenCode permission and then composes the methodology-owned skill map; unknown profile refs, Markdown permission reintroduction and PermissionProfile skill ownership fail closed;
- read-only roles must resolve to a profile with explicit scalar `edit: deny`; `may_be_widened_by_lower_layer` must remain false; duplicate capability/pattern rules and unknown profile refs fail validation;
- one-time semantic parity against pre-M3 HEAD proved all eight generated agents retain identical `permission`, `prompt`, and other host fields; the migration changes ownership, not runtime agent behavior;
- runtime execution-profile permission snapshots continue to derive from the effective packaged OpenCode agent projection, so the new canonical owner reaches the existing pre-execution consumer path;
- generated PermissionProfile policy entered the projection graph at M3, increasing the material ProjectionReceipt inventory from the historical M10/M11 count of 30 to 31; M5 later adds ConfigOption policy for a current total of 32.

Evidence: focused M3/Role/Methodology/BA12 set 10/10 PASS; controlled isolated-HOME/XDG full plugin suite 543/543 PASS; architecture lint PASS (`rules=20`, `deferred=1`, `linked=8`); standalone validator PASS; `git diff --check` clean; backup count 0. M3 code checkpoint: `9801382`. No real external action was performed.

### M4 methodology projection checkpoint

Implemented:

- removed `escalation_relation` and `verification_relation`, which were identical prose repeated across all 27 methodologies and had zero production consumers;
- added `scripts/generate_methodology_skills.py`, which preserves the human-authored title and `Method` body while compiling frontmatter and mechanical Contract fields from `data/hi-methodologies.json`;
- linked the compiler into methodology policy generation;
- added tests proving SKILL name/purpose/trigger/negative-trigger/exit/role-affinity/context-cost/execution-cost projections exactly mirror canonical methodology data;
- preserved methodology count/names, selected-vs-loaded behavior, project admission/collision/provenance, runtime activation and role-native methodology reachability.

Evidence: focused methodology suite 37/37 PASS; controlled isolated-HOME/XDG full suite 469/469 PASS; validator PASS; diff check clean.

### M2 projection checkpoint

The OpenCode agent projection now derives `description` and `mode` from `data/hi-roles.json`, injects a generated RoleContract purpose/use/do-not-use preamble into the agent prompt, and derives native methodology skill permissions from `data/hi-methodologies.json` compatible-role relationships. `scripts/generate_methodology_policy.py` validates compatible role references against the canonical role catalog rather than treating Markdown skill permissions as an owner.

The former general OpenCode permission frontmatter residue was removed by M3 checkpoint `9801382`. Role Markdown now carries human guidance/host fields only; general native permissions derive from PermissionProfile and methodology skill permissions derive from MethodologyContract.

Evidence: focused role/methodology/agent projection suite 24/24 PASS; controlled full suite 467/467 PASS; validator PASS; diff check clean.

### M1 implementation detail

Current implemented files:

- `plugin/src/contracts/common.ts` — strict common contract primitives, technical canonical IDs, deterministic canonical JSON, SHA-256 content/contract hashes;
- `plugin/src/contracts/provenance.ts` — strict ProvenanceRecord and deterministic ProjectionReceipt validation/generation;
- `plugin/test/contract-primitives.test.mjs` — deterministic ordering/hash and negative boundary tests.

Controlled full-suite environment explicitly uses isolated writable `HOME`, `XDG_STATE_HOME`, `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, and `XDG_CACHE_HOME`. A direct server-default `/root` run produced permission-denied harness failures and is not product evidence. Under the controlled environment the suite is 464/464 PASS.

### M11 deterministic full regression closure

Implemented and verified:

- started from clean committed `6055d39` state and re-ran the M11 closure gates under isolated writable HOME/XDG state;
- integrated `npm run check` passed build, deterministic generation, 30 ProjectionReceipt refresh/parity, architecture lint, the complete controlled plugin suite and standalone validator;
- the complete deterministic plugin suite remained **540/540 PASS**;
- targeted BA12 plus contract/authority/storage/host-capability negative coverage was run independently from repository root; that extra gate exposed one cwd-dependent test harness assumption in `host-capability-contract.test.mjs`;
- corrected the acceptance-source lookup to resolve relative to the test module rather than `process.cwd()`, so the same acceptance contract now works under both plugin-local and repository-root test invocation;
- after the fix, the targeted closure set passed **62/62**, architecture lint passed all 20 rule IDs with HI003 still explicitly DEFERRED to the pre-existing M5 blocker, validator passed, `git diff --check` was clean and backup count was 0;
- no real external push/tag/release/publish/deploy action was performed; release-oriented tests used only deterministic local fixtures.

Evidence: M11 harness-fix checkpoint `52c6be4`; full suite 540/540 PASS; targeted closure 62/62 PASS; architecture lint PASS (`rules=20`, `deferred=1`, `linked=8`); validator PASS; backup count 0. This closes M11 at T0/T1/T2. M12 real-host acceptance remains separate and must produce version/identity-bound host receipts before any T3 claim.

### M12 exact-head real-host acceptance

Implemented and verified against real OpenCode 1.18.16:

- loaded exact committed runtime source from Git HEAD `753043d0f6c9d421e236dff0bf2c9f5ebe1a9c1b` using local `file:///workspace/OpenCode-Hi/plugin/dist/plugin.js`; recorded SHA-256 and Git blob identity for the plugin, HostCapability contract projection and OpenCode capability detector and proved worktree bytes matched HEAD before the receipt mutation;
- real OpenCode config projected all eight canonical Hi agents and native skill discovery exposed `hi-code-review` at the packaged source path;
- real OpenCode server health reported version `1.18.16`; isolated host provider inventory exposed connected `opencode` and seven current models to Hi after chat refresh;
- exercised real session create, prompt, abort, status, children, todo, diff, fork, summarize, revert and unrevert primitives; prompt metadata observed `working-manager` + `opencode/deepseek-v4-flash-free` and the Hi semantic-assessment tool executed in the real message loop;
- exercised real Hi worker delegation: parent control-plane tools `hi_task_start/await/list` reached OpenCode, creating a real `qa-reviewer` child session with observed `opencode/laguna-s-2.1-free`, variant `medium`, parent identity and read-only/control-plane-deny permission projection;
- exercised native permission semantics: `once` remained call-scoped and did not silently persist, while an unnecessary parent polling `sleep 20` request was explicitly rejected; no persistent approval was used;
- separately exercised native methodology load on a real `qa-reviewer` session: OpenCode `skill` loaded exactly `hi-code-review` with state `completed` before terminal `M12_SKILL_OK`;
- real summarize produced a `compaction` agent response using `opencode/deepseek-v4-flash-free`; revert/unrevert state transitions were observed directly through the host API;
- retained truthful negative capability status: ordinary shell `process-lifecycle` remains `DEGRADED` because no Hi-owned PID/job wait/kill identity was observed; `workspace-isolation-binding` remains `UNSUPPORTED` because the real child shared the parent fixture directory and `workspaceID` was absent;
- an independent-review end-to-end scenario did not reach terminal WorkerResult because the selected model repeatedly requested extra bash sanity checks. It is recorded as `HARNESS_MODEL_BEHAVIOR_INCOMPLETE`, not product FAIL; the material worker/session/model/methodology primitives were independently proven by successful bounded scenarios;
- all active fixture sessions were explicitly aborted and the local server/temp project were cleaned. No push/tag/release/publish/deploy or real external project mutation occurred.

Receipt: `data/validation/external-opencode-hi-0.1.0-host-1.18.16-head-753043d.json`, committed as `baca9f7`. This closes M12 for the material HostCapability T3 scope without making an M13 release-readiness or T4 claim.

## Proof record format

Every future completed row records:

```text
phase
contract/ADR IDs
files changed
old owner removed/reclassified
commands/tests
pass/fail count
behavioral scenario IDs
evidence tier
known limitations
commit SHA
external actions performed (normally none)
```

## No-premature-completion rule

A document status such as `V1 TARGET ARCHITECTURE` or ADR `ACCEPTED` is **not** implementation evidence. Only this ledger plus executable tests/receipts may claim a migration phase complete.



### M5 ConfigOptionContract checkpoint

Implemented and verified after release-boundary re-audit:

- the former SentinelX config-catalog mutation blocker no longer reproduced; normal repository mutation succeeded without bypass;
- added canonical `data/hi-config-options.json` with 32 exact current `HiConfig` leaves: 29 executable runtime options, two diagnostic compatibility options, and one current-schema marker;
- runtime entries require explicit source surfaces, precedence, validator, safety semantics, production consumer, executor effect and behavioral acceptance refs; `CONFIG_WITHOUT_EXECUTABLE_EFFECT` is now a fatal contract/lint condition;
- `compatibility.mode` and `compatibility.validatedOpenCodeVersions` are truthfully classified as doctor/diagnostic policy because current production code does not use them to execute mission behavior; they are forbidden from claiming a fake runtime executor;
- `schemaVersion` is explicitly a current-only schema marker: it can report noncanonical supplied input but does not masquerade as a runtime behavior option;
- generated `HI_CONFIG_DEFAULTS` now owns the default value tree, and `plugin/src/config/defaults.ts` consumes that generated projection instead of maintaining a second hand-written default truth;
- representative BA03 effect tests prove config changes alter real executor decisions: topology/max-agent ceilings, scheduler global/provider/model capacity, provider eligibility/model selection, and execution-profile specialist routing;
- existing behavioral refs preserve project-policy precedence/narrowing, Team Mode limits, model/fallback/variant behavior, primary-mode behavior and doctor compatibility diagnostics;
- `HI003 CONFIG_EXECUTOR_MISSING` is now a fatal PASS rule: generated default leaves must exactly equal catalog paths, all runtime options must identify executable effect, non-runtime options cannot claim one, and every behavioral proof ref must resolve;
- ConfigOption policy joins deterministic generation/BA12 scope checks and ProjectionReceipt tracking, increasing the current material receipt count from 31 to 32.

Evidence: focused config/BA03/generator set 22/22 PASS; controlled isolated-HOME/XDG full plugin suite 548/548 PASS; architecture lint PASS (`rules=20`, `deferred=0`, `linked=8`); standalone validator PASS; `git diff --check` clean; backup count 0. M5 code checkpoint: `d53fe31`. No real external action was performed.

### M6 ModelCapabilityProfile / execution-identity closure

Implemented and verified:

- canonical model owner is `plugin/src/contracts/model.ts`; runtime provider inventory is normalized through `ModelCapabilityProfile` before routing and explicit quirk metadata still overrides technical model-ID fallback heuristics;
- the former requested/projected WorkerState deferral was re-audited and normal repository mutation is now available; no host-policy bypass was used;
- WorkerState now persists only model identity phases with real producers: `requested_model[_variant]` from an explicit Task override, current `model[_variant]` as resolver/worker selection, `projected_model[_variant]` immediately before the actual OpenCode child/prompt request, and existing `effective_model*` fields from assistant runtime metadata;
- every material child/prompt execution path records the projection snapshot before native execution: initial dispatch, same-session correction, semantic resume, constraint rebase, serialized write-conflict resume, stagnation recovery and runtime fallback;
- production `TaskRuntime.noteEffectiveModel()` now consumes the canonical `reconcileModelExecutionIdentity()` contract instead of maintaining a parallel interpretation of selected/observed identity;
- projection mismatch is first-class and fail-closed: a selected model that was projected as a different model blocks completion even when assistant metadata later matches the selection;
- model/variant unverified and mismatch behavior remains fail-closed, while host-default remains explicitly unconstrained rather than fabricating a selected model;
- requested/projected snapshots survive RuntimePersistence and malformed snapshot types or a projected variant without a projected model fail WorkerContract validation;
- the existing selected/effective fields remain because they have active runtime/persistence consumers; no producerless alias state was added.

Evidence: focused model/Worker/persistence/fallback set 27/27 PASS under isolated HOME/XDG; controlled isolated-HOME/XDG full plugin suite 549/549 PASS; architecture lint PASS (`rules=20`, `deferred=0`, `linked=8`); standalone validator PASS; `git diff --check` clean; backup count 0. M6 closure checkpoint: `ec2bdd3` (foundation `e7c3c96`). No real external action was performed.
