# OpenCode-Hi Architecture

OpenCode-Hi is a host-portable semantic and execution-control plane. It does not replace OpenCode; it decides Hi product semantics and delegates native execution to OpenCode through normalized host boundaries.

## Architectural rule

```text
Hi semantic contract
   -> Hi application/runtime owner
      -> Hi HostPort / executor port
         -> OpenCode adapter
            -> OpenCode native primitive
               -> observed result
                  -> Hi reconciliation / Evidence / completion
```

There is one semantic owner per concept. Generated files, UI projections, host primitives, model prose and historical receipts cannot become alternate owners.

## End-to-end execution

```text
User intent
   |
   v
Semantic Assessment
   |
   v
MissionStore ------------------------------+
   |                                       |
   v                                       |
TaskRuntime                                |
   |                                       |
   +--> TaskContract / Task DAG            |
   +--> RoleContract                       |
   +--> model routing                      |
   +--> Methodology selection/load         |
   +--> Authority / Permission             |
   +--> Context / methodology learning     |
   |                                       |
   +--> ChildExecutionCoordinator          |
   |       |                               |
   |       +--> native child session       |
   |       +--> ProcessExecutor            |
   |       +--> WorkspaceRuntime           |
   |       +--> BrowserExecutor            |
   |               |                       |
   |               v                       |
   |           OpenCodeHostPort            |
   |               |                       |
   |               v                       |
   |          OpenCode primitives          |
   |               |                       |
   +<------ observed result ---------------+
   |
   +--> TaskResultReconciler
   |       +--> WorkerResult validation
   |       +--> changed-file ownership
   |       +--> Evidence
   |       +--> ReviewFinding
   |       +--> VerificationEnvelope
   |
   +--> TaskRecoveryCoordinator
   |       +--> bounded same-session semantic correction
   |       +--> host-terminal explicit provider fallback
   |       +--> semantic-gain-scoped recovery model hazard circuit
   |       +--> stale callback / restart reconciliation
   |
   v
Continuation / WAIT / STOP
   |
   v
Completion adjudication
   |
   v
User-facing result
```

## Canonical ownership

Hi owns:

- Mission identity, obligations and durable execution state;
- Task/Worker identity and lifecycle;
- Role semantics and PermissionProfile projection rules;
- Methodology admission/selection/exit semantics;
- model routing policy for constrained child execution;
- Mission runtime context projection, durable ContextArtifact and project-methodology-learning semantics;
- HumanDecision and exact-action Authority semantics;
- ExternalAction classification and release transaction semantics;
- ProcessContract, IsolationDecision/WorkspaceLease and BrowserObservation contracts;
- Evidence, VerificationEnvelope, recovery, completion and authoritative STOP.

OpenCode owns native host primitives such as sessions, child sessions, provider/model execution, native permissions, tools, PTY, workspaces, events, diffs, LSP and host lifecycle.

**Hi may narrow host authority; it never converts host denial into permission.**

## Mission, Task, Worker and Team

`MissionStore` is the durable Mission owner. The persisted Mission envelope contains named slices for identity, execution, continuation, context, VCS safety, authority, release and methodology state. Host-primary `likely_targets` are proposals until this boundary binds them to an exact user-named technical path, a current project-contained filesystem identity, or an explicit HTTP(S) target; a merely path-shaped nonexistent model label cannot become Task scope authority. When ambiguity remains and no canonical target exists, bounded repository exploration may resolve actual current source scope through the existing source-provenance clearance path.

`TaskRuntime` is the canonical Task application facade. Mechanical child execution, result reconciliation and recovery are delegated to bounded collaborators; none owns a second Task store. A model-facing cancel cannot retire a `FIX_REQUIRED`/`NEEDS_CONTEXT` Task while it still owns an open obligation: that exact Task must be reconciled instead, so cancellation cannot manufacture a fresh identity for an equivalent recovery strategy. Canonical user STOP/runtime-owned cancellation remains a separate lifecycle path.

A Worker is one execution attempt bound to a Task. `WorkerResult` is boundary-untrusted input and does not own completion.

Completed DAG dependencies feed successors through a bounded direct-edge outcome projection at actual dispatch time. Each projected item is fenced to the accepted producer worker attempt/run/generation and result digest, excludes worker evidence claims/findings, and is explicitly non-Evidence. The projection is recomputed after child creation and before the first provider prompt so an await-time generation/result race cannot leak stale predecessor output into a new execution.

Team is a bounded process-ephemeral projection over the same TaskRuntime/Task/Worker semantics. It is not a second orchestration database. Restart preserves durable Task/Worker identity and can reset the Team projection without inventing a new trajectory.

## Role, model and Methodology separation

Role describes semantic responsibility and repository authority. Agent is the host projection/instance. Model is an execution resource. Methodology is reusable HOW. They are deliberately independent axes.

A role cannot smuggle model identity, a Methodology cannot grant Authority, and selected Methodology is not equivalent to loaded OpenCode skill content.

## Context and information plane

Provider-bound context is projected from current Mission state through `MissionRuntimeProjection`, bounded with explicit context budgets and privacy redaction. Duplicate provider tool outputs may be pruned only when their deterministic state/input/output signature proves equivalence; canonical Mission/session truth is not destructively rewritten.

Durable reusable content uses `ContextArtifactStore` with source hashes, freshness and explicit consumer bindings. Project-scoped learning is intentionally narrower: `ProjectMethodologyLearningStore` records evidence-bound reusable HOW candidates and may activate methodology-authoring review only after independent observations; it is not a general repository knowledge/retrieval database and never becomes Evidence or Authority.

Semantic Context is behind `SemanticContextAdapter`. The current explicit implementation is TypeScript/TSX only. Context artifacts and semantic summaries remain non-Evidence until separately admitted by verification policy.

## Authority and Permission

OpenCode Permission answers whether the host can perform a native action. Hi Authority answers whether a sensitive/external action is approved for an exact semantic scope.

```text
user/semantic request
   -> ExternalAction
      -> exact action/target/parameter identity
         -> Authority decision
            -> host Permission projection/request
               -> executor
```

Generic “yes”, continuation, a Methodology, a browser click, or a host permission grant cannot create reusable future Authority.

## Evidence, verification and completion

Model prose, WorkerResult, Project Intelligence, Context summaries and BrowserObservation are not proof by themselves. Diagnosis follows the same rule: parent prose cannot synthesize passed diagnostic evidence. `hi_direct_progress` may close a diagnosis analysis obligation only from a structured falsifiable hypothesis (`hypothesis`, `falsifier`, `SUPPORTED|FALSIFIED|INCONCLUSIVE`) bound to exact current canonical Evidence IDs. `SUPPORTED` requires every referenced observation to be fresh, terminal, and applicable; `FALSIFIED` and `INCONCLUSIVE` remain durable Mission-ledger history while analysis stays open. This is evidence support, not a probabilistic or intervention-causal confirmation, so generic task/model/provider/environment failure never becomes harmful methodology credit.

Evidence is typed, source/scoped and freshness-aware. `VerificationEnvelope` derives required check state from admissible Evidence. Mutation can invalidate affected proof.
The persisted `execution.evidence.fresh` boolean is compatibility/projection cache only: current freshness authority is derived from non-invalidated passed `EvidenceItem` records, Mission validation requires the cache to equal that derivation, and verification/status/runtime projections never allow the cache to substitute for canonical Evidence. `BrowserObservation` remains an ephemeral typed executor result that is bridged into pending Mission Evidence; source-read observations enter the same Evidence owner directly. `VerificationEnvelope`, methodology exits and completion are derived consumers rather than additional evidence stores.

STOP is permitted only after obligations, required evidence, reviews, Methodology exits, Authority state, pending Tasks/Workers/processes/workspaces and user-stop state reconcile deterministically. Idle events and “DONE” text are not completion.

## Process execution

`ProcessContract` is host-independent and binds Mission/Task/Worker ownership, host, command identity, cwd, PID/process-group identity, lifecycle, timestamps, bounded output artifact refs, Authority reference and cleanup state. It **contains no raw stdout/stderr buffer**.

`ProcessRuntime` uses the `ProcessExecutor` port and `OpenCodePtyAdapter`. Output reads are bounded cursor windows. WAIT is event/native-exit driven rather than model polling. Timeout/kill validate the owned PID, and kill is distinct from cleanup. Restart re-adopts only exact PID+cwd+native-command identity; mismatches become quarantined ORPHANED state.

The process capability is supported only on this Hi-owned surface with exact-host T3 evidence. Ordinary native/model-facing bash remains outside that ownership claim.

## Workspace isolation

`IsolationDecision` decides whether a Task requires isolation. `WorkspaceLease` binds the exact repository/source baseline and workspace identity. `WorkspaceRuntime` provisions through `WorkspaceExecutor`; the OpenCode adapter uses the host workspace/worktree primitive.

Required isolation never silently falls back to the primary workspace. Child creation must return the exact lease `workspaceID + directory`. Verification executes in the lease. Cleanup is separate from child abort. Restart adopts an exact existing lease or quarantines it; it does not silently create a replacement.

The supported claim is limited to the Hi-owned isolation chain proven by exact-host T3 receipts. User dirty/staged files in the primary worktree are not claimed as Hi-owned mutation.

## Browser execution

`BrowserObservation` is observation provenance, not automatic Evidence. Production browser execution is behind the `BrowserExecutor` port, task-bound backend policy/ownership checks, and the OpenCode `PlaywrightBrowserAdapter`, with local-origin confinement, exact Task/Worker/session ownership, bounded observations and Artifact-backed screenshots.

Visual verification coverage is also Hi-owned structured state rather than Worker prose. When semantic assessment requires `visual-check`, Hi first derives a bounded, language-agnostic request-unit inventory from the pending user message using structural paragraph/list/clause boundaries. The host-primary remains the sole natural-language meaning owner: each `VerificationCase` carries `source_units` that trace it to those request units, while `nonvisual_request_units` explicitly accounts for the complement. Semantic admission fails closed when a unit is missing, unknown, duplicated across visual/nonvisual ownership, or a visual case has no trace; the rejection includes a bounded exact `ruN:text` challenge so the same revision can be corrected without creating a second semantic model or keyword/scenario parser. At this model-input boundary only, unambiguous mechanical case-ID near-misses (whole-ID kebab or underscore-separated suffix) normalize to the strict `vc_` + kebab-suffix identity; the persisted `VerificationCase` validator remains strict. Only an admitted partition becomes Mission truth.

The admitted bounded `VerificationCase` set carries stable case identity, a short user-visible subject, closed `BrowserObservation` action requirements, and its request-unit trace. The verification obligation owns that set and a `visual-qa` Task automatically snapshots it into its durable Task/ExecutionProfile contract; `hi_task_start` callers cannot silently omit or widen it. The child returns per-case `verification_coverage` claims citing exact current-attempt browser Evidence references. Settlement resolves those references through the canonical `browser.observation-recorded` ledger, checks task/worker/attempt applicability plus every required action, and only then permits browser-derived visual/accessibility evidence to become canonical PASS. Missing, failed, duplicate, unknown, stale or action-incomplete cases keep the Task `FIX_REQUIRED` and the verification obligation open. The runtime does not parse scenario-specific words such as theme, reload, modal, mobile or accessibility at settlement time: natural-language meaning remains at the host-primary semantic boundary, while request-unit accounting, browser execution and observation identity are deterministic Hi/host primitives.

Support is runtime-health-gated. Development `0.2.3` introduced one process-local, bounded Chromium bootstrap through the exact packaged `playwright-core` CLI into a Hi-owned platform cache; immutable published `0.2.4` retains that release behavior. Current `dev` routes the requirement through `OperationalToolProvisioner`: existing implementations are discovered first and managed fallback Chromium defaults under `.opencode/hi/tools/browser-execution/playwright-chromium/<version>`. The resolver records implementation/scope plus smoke verification and does not take over BrowserExecutor, Authority, ProcessRuntime, WorkspaceRuntime, or Evidence ownership. Bootstrap failure remains explicit unavailable environment/capability state and never creates an unbounded verification continuation. Missing health still removes the executable resource and preflight fails closed. A screenshot existing or MCP/tool discovery never creates browser PASS by itself; methodology-specific evidence must still reconcile.

## Human decisions

`HumanDecisionContract` is the durable semantic owner. Transport/UI is separate. The supported chat transport binds responses to exact decision identity; timeout/cancel does not silently resolve the durable decision.

The accepted OpenCode public API does not expose the deterministic question-opening primitive required for a structured host UI transport, so that specific transport remains unsupported instead of being faked through model mediation.

## Persistence and restart

Lifecycle-significant Hi state is persisted as one current-only Mission envelope with strict validation. Unknown/old schema is fail-closed unless a deliberate migration is separately designed. The runtime snapshot keeps `RuntimePersistence` as its single write owner: each replacement uses an exclusive unique sibling temp, file sync before atomic rename, and parent-directory sync where the host filesystem supports it. Production plugin startup also holds one project-scoped runtime writer lease in the external Hi state root, so a second live process cannot concurrently replace the same Mission snapshot; a dead-owner lease is moved through a unique stale quarantine name before recovery. Orphan temp snapshots are never load candidates and cannot override the canonical `runtime-state.json`.

Restart reconciliation validates external native identities before adoption. Missing or mismatched process/workspace/child ownership is quarantined rather than guessed.

## Generated projections

Generated artifacts are projections, not semantic owners. Current host compatibility and release status are generated from exact receipts/status inputs. Role/permission/methodology host projections are generated from canonical catalogs. Hand editing a generated projection cannot amend the underlying product contract.

## Host portability

Core receives normalized Hi-compatible structures; OpenCode SDK uncertainty stays under `plugin/src/opencode/**` and explicit host adapter boundaries. The canonical semantic seams are `HostPort`, `ChildSessionPort`, `ProcessExecutor`, `WorkspaceExecutor`, and `BrowserExecutor`. Raw OpenCode events are projected to `HostEvent` before they enter the runtime controller, and runtime service assembly receives executors/ports by injection rather than constructing OpenCode adapters itself.

`TaskRuntime`, `ChildExecutionCoordinator`, `RuntimeEventController`, continuation dispatch, process control, and model/provider-policy resolution therefore do not require OpenCode SDK client types or lifecycle shapes. OpenCode remains the only implemented and real-host-certified adapter. Model inventory normalization stays inside that adapter boundary: when OpenCode exposes an explicit `connected` provider set, current `dev` first intersects directory `/api/model` rows with that provider membership. Within the remaining connected providers the scoped projection stays authoritative for model membership; a connected provider absent from the projection may be supplemented from OpenCode provider state. This cannot resurrect a model filtered from an already represented connected provider, does not widen when `connected` proof is absent, and failure to read provider state does not discard a valid scoped projection. Hi stores no second provider/model catalog and does not treat App-local model visibility preferences as a host runtime contract. A future session-capable host (for example Claude Code) is architecturally feasible by implementing the host ports and host-specific event/config/permission projections; that feasibility does **not** claim that such an adapter currently exists or is supported. Parent continuation dispatch is also host-status-gated: a synthetic continuation is never injected while the authoritative parent session state is `busy` or `retry`; delivery is deferred to the next native parent-idle decision, with generation/action fencing preserved across the status read. OpenCode `prompt_async` is treated as an immediate host-mutation acceptance boundary, not as provider execution: its acknowledgement is consumer-bounded to 15 seconds, the SDK request is abort-signalled on expiry, resolved SDK error tuples fail closed, and the mutation is never replayed through `prompt` or another model after timeout/rejection. This deadline does not replace or shorten OpenCode-owned provider retry/backoff; any possibly-live exact child/session remains governed by the existing abort/reconciliation/quarantine fence. Same-session attempt settlement is additionally ancestry-bound without a second history/status owner: `beginWorkerAttempt` gives the exact outgoing OpenCode user prompt a durable attempt-scoped `messageID`, and normalized assistant metadata preserves OpenCode `parentID` plus creation time. If a later idle callback exposes an assistant whose parent belongs to an older prompt (or whose creation time predates the current attempt), Hi rejects it before usage, error, effective-model or WorkerResult mutation. Duplicate prior WorkerResults are likewise no-ops before scheduler settlement. OpenCode still owns message storage, ordering and live `busy`/`retry`/`idle` truth; Hi stores only the semantic attempt-to-prompt identity needed to fence its own Task/Worker reservation.

Portability is an architecture property, not a claim that alternate hosts are currently implemented or certified.
## Execution policy

Scheduler capacity has one current-running owner: durable Mission `SchedulerLifecycleState.reservations`. The pure `SchedulingPlanner` and its shared resource-capacity evaluator consume those reservations plus a stateless global/provider/model capacity policy; TaskRuntime, recovery, replay, telemetry, and resource benchmarks do not maintain a second process-local allocation map. Within one Hi project runtime, `projectSchedulingPeerView` reads other Missions' canonical reservations as a side-effect-free projection, so global/provider/model ceilings apply across those Missions while each Mission's topology ceiling remains local. Host child/session execution still belongs to OpenCode; Hi scheduler reservations only fence semantic Task/Worker admission and exact attempts.

Accepted dispatch backpressure follows the same ownership rule. A sessionless `queued` Task/Worker plus its persisted `ExecutionProfile` is the durable dispatch recipe; the in-process FIFO contains only runnable closures/cache. Restart preserves that exact Task/Worker identity, reconciles workspace/process/browser host state first, then deterministically rehydrates the bounded FIFO by Task creation order. A `waiting-user` Mission retains its queued entry without dispatch, and an exact user/authority transition back to `active` wakes the queue. The queue also stops at the semantic gate: a queued worker is paused in place while follow-up meaning is pending, `non-material`/`resume` rebind the same worker to the new Mission generation, material verification/amendment invalidates the stale queued recipe, and a constraint follow-up updates the not-yet-started Task lazily before dispatch. Persisted `bounded-playwright` work rechecks the live browser resource before creating a child and remains queued with explicit capability/environment state when the resource is unavailable. No queue database, polling loop, replacement Task, or second scheduler owner is introduced.

Execution topology and model selection are bounded structured decisions. Semantic execution decisions also expose advisory counterfactual stability: a bounded deterministic sensitivity analysis over valid one-step structured intent neighbors records which execution-path/topology/team/model-class axes would change. It is explicitly not a probability or confidence score and cannot alter routing, authority, verification, completion, or user constraints; external-action authority invariants are held fixed while perturbations are generated. User follow-up constraints are also represented as revision-bound structured Constraint/Decision atoms in Mission state. Each atom has USER authority, subject/predicate/polarity/scope and explicit supersession lineage. Opposite active atoms do not use keyword or recency heuristics: without an explicit supersedes reference they remain a fail-closed conflict. Mutation-deny path atoms are enforced before write-capable task dispatch and again against reconciled changed-file evidence; the existing same-task constraint rebase remains the lifecycle owner. Legacy prose constraints remain only for compatibility/prompt projection. Small/local work prefers the direct minimum-sufficient path; parallel or specialist execution requires explicit structured benefit/risk/capability signals. Parallel write admission is fail-closed on uncertain mutable ownership: known-disjoint writer scopes may share the primary checkout, overlapping writer scopes serialize, and two writers cannot fan out when either scope is unknown. The same pure mutable-surface policy also covers project-runtime peers and direct `working-manager` implementation: an active DIRECT/EVIDENCE parent is projected from canonical Mission intent/current changed-file state as a virtual write claim, so a foreign child cannot bypass it and a parent mutation cannot bypass an earlier/active peer. Exact parent tool paths narrow the claim when available; otherwise the semantic likely-target scope is used, and unknown mutable scope fails closed. Delegated child ownership remains Task/Worker-owned; after terminal delegation, any parent re-claim is ordered from the existing terminal lifecycle timestamp instead of jumping ahead of queued foreign work. This projection creates no lock, lease, queue, or second scheduler state. Read-only workers are exempt from the unknown-write fence. Isolation is therefore selective rather than blanket: a worktree is used only when the Task owns an explicit isolation decision, while ordinary safe disjoint work avoids worktree/merge overhead. OpenCode owns transient provider retry/backoff and live `busy`/`retry` state. Normal provider fallback is host-terminal-only; generic context/tool failure is not sufficient proof for model switching. Behavioral recovery is a separate bounded path: recovery identity hashes semantic-gain state rather than activity-only worker attempt churn, and after two same-session/same-model corrections on the same Task/generation still produce no semantic gain, Hi may open a recovery-only model hazard and start one fresh child using a precomputed capability-ranked candidate. Recovery candidates are constrained by the same live inventory, strict allowlist, role capability policy and `routing.maxFallbacks`; they are not normal fallbacks, routing telemetry, or persisted user preference. Explicit task-model ownership cannot silently escape to an automatic candidate. Any mutating recovery prompt is never speculatively replayed; ambiguous acknowledgement that cannot be proven quiescent keeps the exact child/session/attempt reservation quarantined. Recovery never substitutes for Evidence or Authority. A child response that fails the strict WorkerResult contract is likewise not accepted as proof: host settlement marks the task `FIX_REQUIRED`, preserves the parse failure as an issue, and routes subsequent same-task resumes through the same bounded behavioral-recovery history; observed model identity must still verify before this recovery path is admitted.

## Context and Project Intelligence

Repository exploration has an explicit evidence-bound clearance fence. A `repository-explorer` WorkerResult cannot clear `resolvable` or `contract-critical` Mission ambiguity merely by returning `DONE`. During the exact child task/attempt, successful OpenCode `read` tool observations are recorded as pending `source-read-observation` receipts bound to task, session, attempt, file scope and current file SHA-256. Explorer `source-provenance-evidence` claims must cite those receipts and return `context_gap: none` with no unresolved context/issues. `contract-critical` clearance additionally requires a `decision-evidence` claim on the same source scope citing the same read receipts. Hi independently re-hashes the bounded source at settlement and records one runtime-owned source-provenance freshness receipt. The read receipt proves observation and the freshness receipt proves current source identity; neither the worker decision claim nor these observations are canonical verification, user Authority, or routing authority. Later source-byte drift makes the clearance stale and implementation preflight returns `RESOLVE` until a fresh bounded explorer clearance is admitted. This reuses Mission Evidence freshness rather than adding another planner, memory database, or stochastic exploration policy.

The first-class semantic adapter currently supports `typescript` and `typescriptreact` only. JavaScript, LSP-backed and Tree-sitter-backed semantic adapters are not implemented or advertised.

Context is consumer-bound and budgeted. Durable context artifacts and semantic TypeScript context are distinct from Evidence. Project-scoped learning is limited to evidence-bound methodology candidates under canonical storage ownership; it does not provide a general knowledge retrieval layer. A separate narrow `ProjectTaskOutcomeMemoryStore` keeps at most 128 derived accepted Task outcome receipts, not arbitrary project knowledge: identity is the structured task/dependency shape plus exact current bounded source bytes, physical append order is authoritative, a later matching `DONE` supersedes older failure hints, and only Hi-runtime-receipted failure classes (plus bounded structured failure finding) may be recalled. Recall is computed again at actual dispatch, enters the existing atomic handoff budget as optional advisory/non-Evidence context, and cannot block, reroute, assign model reputation/blame, authorize, verify, or complete work. Provider/permission/capability availability failures are intentionally not retained as cross-session project failure memory, and bookkeeping failure is fail-open for Task settlement. Candidate maturity and runtime admission are distinct: repeated independent exact evidence establishes READY maturity, while a deterministic Beta posterior plus frequency-aware freshness decay controls whether that learned HOW is currently admissible. Historical observations are preserved rather than deleted; stale confidence can fall below admission and fresh exact evidence can restore it. Task/model failure is never automatically attributed as harmful methodology evidence without a causally bound receipt. Provider projection/pruning never widens privacy or consumer scope. Economics diagnostics are likewise derived rather than becoming a second runtime owner: exact OpenCode attempt usage is joined to Mission lifecycle ledger events to attribute repeated compute/context volume to corrective retry, behavioral model escalation, provider runtime fallback, write-conflict reconciliation, constraint rebase, semantic follow-up resume, restart reconciliation, or an explicit unattributed bucket. Context volume means observed input/cache-read/cache-write token volume; it is not called provider cache repayment or avoidable cost without per-turn prefix/TTL evidence. Causal economics is diagnostic/eval evidence only and is never normal model-routing authority. Hi-owned child handoff context is projected separately from OpenCode canonical session history. Runtime/explicit/semantic/artifact/dependency context is represented as atomic groups and selected against the actual Worker relevant-context consumer budget using only explicit metadata (priority, freshness, protection and bounded cost). Protected/required groups are whole-or-fail-closed, optional byte-identical groups may be deduplicated, and equal-utility explicit groups preserve caller order. No group is partially clipped by this projection and no LLM-generated hidden relevance score controls selection. An ablation against the former order-plus-clip behavior is required to preserve required coverage while reducing context cost or partial projection before this policy is admitted.

Comparative benchmark uncertainty is advisory-only. Current sample wall-time dispersion is summarized with sample standard deviation and a 95% t-interval. Optional multi-judge agreement is computed only from an explicit fixed-width binary judge matrix using Fleiss kappa, and evidence-family diversity only from explicit family labels. Neither judge agreement nor evidence diversity can override exact receipt validation, deterministic checks, outcome stability, environment identity, or the certification verdict; missing metadata remains `NOT_PROVIDED`/`INSUFFICIENT` rather than inferred from prose or paths.

## Storage and filesystem ownership

OpenCode workspace isolation is bound through the `OpenCodeWorkspaceAdapter`; it verifies exact repository/worktree identity while the generic Workspace runtime owns Hi lease and recovery semantics.

Hi-owned durable project data lives under `.opencode/hi/`. OpenCode-native plugin/skill/config locations remain host-owned. Runtime/transient state uses the runtime-state resolver rather than arbitrary project-root files. Setup, upgrade, rollback, and uninstall mutate only Hi-owned registration/state and preserve unrelated user configuration.

## Privacy

Provider-facing projections are redacted at the privacy boundary. Credentials and secret-bearing execution environment values are not product state. See [Security model](SECURITY-MODEL.md).
