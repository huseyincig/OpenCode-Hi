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
   +--> Context / ProjectIntelligence      |
   |                                       |
   +--> ChildExecutionCoordinator          |
   |       |                               |
   |       +--> native child session       |
   |       +--> ProcessExecutor            |
   |       +--> WorkspaceRuntime           |
   |       +--> BrowserRuntime             |
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
   |       +--> retry/fallback
   |       +--> stale callback quarantine
   |       +--> restart reconciliation
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
- Context, Project Intelligence and Artifact semantics;
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

Team is a bounded process-ephemeral projection over the same TaskRuntime/Task/Worker semantics. It is not a second orchestration database. Restart preserves durable Task/Worker identity and can reset the Team projection without inventing a new trajectory.

## Role, model and Methodology separation

Role describes semantic responsibility and repository authority. Agent is the host projection/instance. Model is an execution resource. Methodology is reusable HOW. They are deliberately independent axes.

A role cannot smuggle model identity, a Methodology cannot grant Authority, and selected Methodology is not equivalent to loaded OpenCode skill content.

## Context and information plane

The Context Governor classifies provider-bound material as `PROTECTED`, `COMPRESSIBLE`, or `PURGEABLE`. Canonical session/product truth is not destructively rewritten to save tokens; provider projection is bounded separately.

Project Intelligence is repository-scoped reusable context with source provenance/freshness. It never becomes Evidence or Authority. Hybrid retrieval uses lexical, path and source-ref graph signals with deterministic reciprocal-rank fusion.

Semantic Context is behind `SemanticContextAdapter`. The current explicit implementation is TypeScript/TSX only.

Compression artifacts remain Context artifacts with source refs/hashes and freshness. They never become Evidence.

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

`BrowserObservation` is observation provenance, not automatic Evidence. Production browser execution is behind `BrowserExecutor`/`BrowserRuntime` with target confinement, exact Task/Worker/session ownership, bounded observations and Artifact-backed screenshots.

Support is runtime-health-gated. Missing health removes the executable resource and preflight fails closed. A screenshot existing or MCP/tool discovery never creates browser PASS by itself; methodology-specific evidence must still reconcile.

## Human decisions

`HumanDecisionContract` is the durable semantic owner. Transport/UI is separate. The supported chat transport binds responses to exact decision identity; timeout/cancel does not silently resolve the durable decision.

The accepted OpenCode public API does not expose the deterministic question-opening primitive required for a structured host UI transport, so that specific transport remains unsupported instead of being faked through model mediation.

## Persistence and restart

Lifecycle-significant Hi state is persisted as one current-only Mission envelope with strict validation. Unknown/old schema is fail-closed unless a deliberate migration is separately designed. Writes use canonical storage owners and atomicity appropriate to each class.

Restart reconciliation validates external native identities before adoption. Missing or mismatched process/workspace/child ownership is quarantined rather than guessed.

## Generated projections

Generated artifacts are projections, not semantic owners. Current host compatibility and release status are generated from exact receipts/status inputs. Role/permission/methodology host projections are generated from canonical catalogs. Hand editing a generated projection cannot amend the underlying product contract.

## Host portability

Core receives normalized Hi-compatible structures; OpenCode SDK uncertainty stays under `plugin/src/opencode/**` and explicit host ports. A future host adapter should be able to replace the execution substrate without changing Mission/Task/Authority/Evidence semantics.

Portability is an architecture property, not a claim that alternate hosts are currently implemented or certified.
