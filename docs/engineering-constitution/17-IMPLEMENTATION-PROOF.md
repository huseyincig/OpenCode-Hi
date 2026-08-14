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
| M2 | RoleContract owner/generator | role identity/mode/description/runtime catalog and methodology permission contribution are canonical-data driven; focused projection suite 24/24 PASS; controlled full suite 467/467 PASS; validator PASS | T1/T2 | `443bfd5` (owner foundation `b06d281`) | PARTIAL_PASS — GENERAL PERMISSION PROFILE REMAINS M3 |
| M3 | PermissionProfile | safety monotonicity negatives + projection parity | T1/T2 | — | BLOCKED — SENTINELX POLICY PREVENTED PERMISSION-CATALOG MUTATION |
| M4 | MethodologyContract normalization | mechanical SKILL contract sections compiled from canonical JSON; inert duplicated fields removed; focused 37/37 PASS; controlled full suite 469/469 PASS; validator PASS | T1/T2 | `c152f98` | PASS — MECHANICAL OWNER MIGRATED |
| M5 | ConfigOption catalog | BA03 + config executor lint | T1/T2 | SentinelX blocks direct config-catalog mutation in this environment | BLOCKED_BY_HOST_POLICY |
| M6 | Model capability/identity | ModelCapabilityProfile host-inventory normalization + identity reconciler + effective-model evidence; focused 17/17 PASS; controlled full suite 475/475 PASS; validator PASS | T1/T2 | `e7c3c96`; requested/projected WorkerState snapshot wiring blocked by SentinelX mutation policy; no unwired state committed | PARTIAL_PASS |
| M7 | Host capability registry | 16 contract-backed OpenCode capabilities; product runtime gates consume worker-runtime/session-revert contracts; doctor reports status/verification/semantic loss; focused 43/43 PASS; controlled full suite 480/480 PASS; validator PASS | T1/T2 local; T3 still pending | `390cc2b` | PASS_LOCAL — REAL-HOST ACCEPTANCE PENDING |
| M8 | Task/Worker/Result/Evidence contracts | WorkerResult, EvidenceItem, ReviewFinding, derived VerificationEnvelope, TaskContract and WorkerContract now have canonical runtime owners; persistence consumes canonical validators; task mission/external-action identity is explicit; worker attempt/recovery/effective-model lifecycle is fail-closed; latest focused Task/Worker set 21/21 PASS and controlled full suite 507/507 PASS; validator PASS | T1/T2 | WorkerResult `4ea320d`; Evidence `3044b94`; ReviewFinding `b120f49`; VerificationEnvelope `a4b1105`; Task/Worker `77f9dc1` | PASS — CONTRACT OWNERSHIP CLOSED |
| M9 | Context/Artifact/PI/Human/Authority/Storage | Artifact + ContextReference + derived SemanticContext + ProjectIntelligence + HumanDecision + Authority + ExternalAction + StorageOwnership operational; machine storage catalog enforces one canonical owner per scope/data class, canonical path providers cover current project/runtime durable classes, OpenCode-native project skills remain outside Hi internal storage, uninstall preserves independently-owned policy/knowledge/skills, and doctor consumes the current runtime-state schema; focused storage/ownership set 66/66 PASS; controlled full suite 538/538 PASS; validator PASS | T1/T2 | Artifact `811ee7f`; ContextReference `3e8ab72`; SemanticContext `b7e51cc`; PI `e2d021b`; HumanDecision `46fc7b7`; Authority/ExternalAction `da67329`; StorageOwnership `ea6c236` | PASS — CONTRACT OWNERSHIP CLOSED |
| M10 | common generator/lint closure | 30 deterministic ProjectionReceipts; BA12 unchanged-input idempotence + declared dependency-scope mutation 2/2 PASS; executable HI001–HI020 architecture lint with migrated-class fatal checks, behavioral proof links and explicit HI003/M5 deferral; controlled full suite 540/540 PASS; validator PASS | T0/T1/T2 | `4602907` | PASS — MIGRATED CLASSES CLOSED; HI003 DEFERRED WITH M5 |
| M11 | deterministic full closure | build + validator + full controlled suite | T0/T1/T2 | — | PENDING |
| M12 | real-host acceptance | OpenCode version-bound native receipts | T3 | — | PENDING |
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


### M3 host-policy blocker

PermissionProfile implementation was attempted only after current role permission maps were inventoried and an exact-preservation profile design was prepared. SentinelX blocked creation/mutation of permission-catalog data and direct removal of existing role permission blocks. No bypass was attempted. M3 remains open; current runtime permission behavior is unchanged.

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

The remaining mechanical role frontmatter surface is the general OpenCode permission/prompt guidance projection that M3 will normalize through PermissionProfile. Existing `permission.skill` text remains physically present in `roles/*.md` because SentinelX blocked direct edits to those blocks; it is not consumed as runtime truth by the generator. This residue must not be mistaken for a second canonical owner.

Evidence: focused role/methodology/agent projection suite 24/24 PASS; controlled full suite 467/467 PASS; validator PASS; diff check clean.

### M1 implementation detail

Current implemented files:

- `plugin/src/contracts/common.ts` — strict common contract primitives, technical canonical IDs, deterministic canonical JSON, SHA-256 content/contract hashes;
- `plugin/src/contracts/provenance.ts` — strict ProvenanceRecord and deterministic ProjectionReceipt validation/generation;
- `plugin/test/contract-primitives.test.mjs` — deterministic ordering/hash and negative boundary tests.

Controlled full-suite environment explicitly uses isolated writable `HOME`, `XDG_STATE_HOME`, `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, and `XDG_CACHE_HOME`. A direct server-default `/root` run produced permission-denied harness failures and is not product evidence. Under the controlled environment the suite is 464/464 PASS.

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


### M6 checkpoint evidence

- Runtime provider inventory is normalized through `ModelCapabilityProfile` before routing.
- Explicit model capability quirk metadata overrides technical model-ID fallback heuristics.
- `ModelExecutionIdentity` distinguishes requested, selected, projected, observed, effective, and verified phases without persisting producerless runtime fields.
- Focused controlled model suite: **17/17 PASS**.
- Controlled full suite: **475/475 PASS**.
- Standalone validator: **PASS**.
- Remaining runtime snapshot wiring is explicitly deferred because the connected host policy rejected that mutation.
