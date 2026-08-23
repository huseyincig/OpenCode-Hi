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

`MissionStore` is the durable Mission owner. The persisted Mission envelope contains named slices for identity, execution, continuation, context, VCS safety, authority, release and methodology state.

`TaskRuntime` is the canonical Task application facade. Mechanical child execution, result reconciliation and recovery are delegated to bounded collaborators; none owns a second Task store.

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

Model prose, WorkerResult, Project Intelligence, Context summaries and BrowserObservation are not proof by themselves.

Evidence is typed, source/scoped and freshness-aware. `VerificationEnvelope` derives required check state from admissible Evidence. Mutation can invalidate affected proof.

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

Support is runtime-health-gated. In development `0.2.3`, an absent local Chromium executable can trigger one process-local, bounded bootstrap through the exact packaged `playwright-core` CLI into a Hi-owned platform cache. Bootstrap failure is memoized for the unchanged process/resource state and becomes explicit unavailable environment/capability state; it never creates an unbounded verification continuation. Missing health still removes the executable resource and preflight fails closed. A screenshot existing or MCP/tool discovery never creates browser PASS by itself; methodology-specific evidence must still reconcile.

## Human decisions

`HumanDecisionContract` is the durable semantic owner. Transport/UI is separate. The supported chat transport binds responses to exact decision identity; timeout/cancel does not silently resolve the durable decision.

The accepted OpenCode public API does not expose the deterministic question-opening primitive required for a structured host UI transport, so that specific transport remains unsupported instead of being faked through model mediation.

## Persistence and restart

Lifecycle-significant Hi state is persisted as one current-only Mission envelope with strict validation. Unknown/old schema is fail-closed unless a deliberate migration is separately designed. Writes use canonical storage owners and atomicity appropriate to each class.

Restart reconciliation validates external native identities before adoption. Missing or mismatched process/workspace/child ownership is quarantined rather than guessed.

## Generated projections

Generated artifacts are projections, not semantic owners. Current host compatibility and release status are generated from exact receipts/status inputs. Role/permission/methodology host projections are generated from canonical catalogs. Hand editing a generated projection cannot amend the underlying product contract.

## Host portability

Core receives normalized Hi-compatible structures; OpenCode SDK uncertainty stays under `plugin/src/opencode/**` and explicit host adapter boundaries. The canonical semantic seams are `HostPort`, `ChildSessionPort`, `ProcessExecutor`, `WorkspaceExecutor`, and `BrowserExecutor`. Raw OpenCode events are projected to `HostEvent` before they enter the runtime controller, and runtime service assembly receives executors/ports by injection rather than constructing OpenCode adapters itself.

`TaskRuntime`, `ChildExecutionCoordinator`, `RuntimeEventController`, continuation dispatch, process control, and model/provider-policy resolution therefore do not require OpenCode SDK client types or lifecycle shapes. OpenCode remains the only implemented and real-host-certified adapter. A future session-capable host (for example Claude Code) is architecturally feasible by implementing the host ports and host-specific event/config/permission projections; that feasibility does **not** claim that such an adapter currently exists or is supported. Parent continuation dispatch is also host-status-gated: a synthetic continuation is never injected while the authoritative parent session state is `busy` or `retry`; delivery is deferred to the next native parent-idle decision, with generation/action fencing preserved across the status read.

Portability is an architecture property, not a claim that alternate hosts are currently implemented or certified.
## Execution policy

Execution topology and model selection are bounded structured decisions. User follow-up constraints are also represented as revision-bound structured Constraint/Decision atoms in Mission state. Each atom has USER authority, subject/predicate/polarity/scope and explicit supersession lineage. Opposite active atoms do not use keyword or recency heuristics: without an explicit supersedes reference they remain a fail-closed conflict. Mutation-deny path atoms are enforced before write-capable task dispatch and again against reconciled changed-file evidence; the existing same-task constraint rebase remains the lifecycle owner. Legacy prose constraints remain only for compatibility/prompt projection. Small/local work prefers the direct minimum-sufficient path; parallel or specialist execution requires explicit structured benefit/risk/capability signals. Parallel write admission is fail-closed on uncertain mutable ownership: known-disjoint writer scopes may share the primary checkout, overlapping writer scopes serialize, and two writers cannot fan out when either scope is unknown. Read-only workers are exempt from the unknown-write fence. Isolation is therefore selective rather than blanket: a worktree is used only when the Task owns an explicit isolation decision, while ordinary safe disjoint work avoids worktree/merge overhead. OpenCode owns transient provider retry/backoff and live `busy`/`retry` state. Normal provider fallback is host-terminal-only; generic context/tool failure is not sufficient proof for model switching. Behavioral recovery is a separate bounded path: recovery identity hashes semantic-gain state rather than activity-only worker attempt churn, and after two same-session/same-model corrections on the same Task/generation still produce no semantic gain, Hi may open a recovery-only model hazard and start one fresh child using a precomputed capability-ranked candidate. Recovery candidates are constrained by the same live inventory, strict allowlist, role capability policy and `routing.maxFallbacks`; they are not normal fallbacks, routing telemetry, or persisted user preference. Explicit task-model ownership cannot silently escape to an automatic candidate. Any mutating recovery prompt is never speculatively replayed; ambiguous acknowledgement that cannot be proven quiescent keeps the exact child/session/attempt reservation quarantined. Recovery never substitutes for Evidence or Authority. A child response that fails the strict WorkerResult contract is likewise not accepted as proof: host settlement marks the task `FIX_REQUIRED`, preserves the parse failure as an issue, and routes subsequent same-task resumes through the same bounded behavioral-recovery history; observed model identity must still verify before this recovery path is admitted.

## Context and Project Intelligence

The first-class semantic adapter currently supports `typescript` and `typescriptreact` only. JavaScript, LSP-backed and Tree-sitter-backed semantic adapters are not implemented or advertised.

Context is consumer-bound and budgeted. Durable context artifacts and semantic TypeScript context are distinct from Evidence. Project-scoped learning is limited to evidence-bound methodology candidates under canonical storage ownership; it does not provide a general knowledge retrieval layer. Candidate maturity and runtime admission are distinct: repeated independent exact evidence establishes READY maturity, while a deterministic Beta posterior plus frequency-aware freshness decay controls whether that learned HOW is currently admissible. Historical observations are preserved rather than deleted; stale confidence can fall below admission and fresh exact evidence can restore it. Task/model failure is never automatically attributed as harmful methodology evidence without a causally bound receipt. Provider projection/pruning never widens privacy or consumer scope. Economics diagnostics are likewise derived rather than becoming a second runtime owner: exact OpenCode attempt usage is joined to Mission lifecycle ledger events to attribute repeated compute/context volume to corrective retry, behavioral model escalation, provider runtime fallback, write-conflict reconciliation, constraint rebase, semantic follow-up resume, restart reconciliation, or an explicit unattributed bucket. Context volume means observed input/cache-read/cache-write token volume; it is not called provider cache repayment or avoidable cost without per-turn prefix/TTL evidence. Causal economics is diagnostic/eval evidence only and is never normal model-routing authority.

Comparative benchmark uncertainty is advisory-only. Current sample wall-time dispersion is summarized with sample standard deviation and a 95% t-interval. Optional multi-judge agreement is computed only from an explicit fixed-width binary judge matrix using Fleiss kappa, and evidence-family diversity only from explicit family labels. Neither judge agreement nor evidence diversity can override exact receipt validation, deterministic checks, outcome stability, environment identity, or the certification verdict; missing metadata remains `NOT_PROVIDED`/`INSUFFICIENT` rather than inferred from prose or paths.

## Storage and filesystem ownership

OpenCode workspace isolation is bound through the `OpenCodeWorkspaceAdapter`; it verifies exact repository/worktree identity while the generic Workspace runtime owns Hi lease and recovery semantics.

Hi-owned durable project data lives under `.opencode/hi/`. OpenCode-native plugin/skill/config locations remain host-owned. Runtime/transient state uses the runtime-state resolver rather than arbitrary project-root files. Setup, upgrade, rollback, and uninstall mutate only Hi-owned registration/state and preserve unrelated user configuration.

## Privacy

Provider-facing projections are redacted at the privacy boundary. Credentials and secret-bearing execution environment values are not product state. See [Security model](SECURITY-MODEL.md).
