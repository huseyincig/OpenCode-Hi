# 12 — Host Projection / Capability Architecture

Status: V1 TARGET ARCHITECTURE — OPENCODE REFERENCE HOST MAPPED

## Purpose

Keep Hi Core host-independent while using the richest safe native primitives of each host. OpenCode is the primary/reference host, not the product ontology.

## Boundary rule

```text
Hi decides semantic intent/policy
        ↓
Host adapter translates bounded contract
        ↓
Host executes native primitive
        ↓
Hi observes/reconciles actual result
```

Native-first does not mean native-at-all-costs. A native primitive that violates Hi authority, safety, identity or completion semantics is not automatically selected.

## OpenCode facts currently relied upon

From current runtime/upstream study, the adapter uses or can detect native primitives including:

- session create;
- async/sync prompt;
- abort;
- provider inventory;
- structured log;
- status/children/todo/diff/fork/summarize/revert/unrevert where available;
- native agent config with mode/permission/model/variant/prompt/options/steps;
- native skill/methodology loading/permissions.

`detectOpenCodeCapabilities()` now preserves its boolean observation snapshot for compatibility and also projects the same observations into the canonical `HostCapabilityContract` registry. Product-level capability decisions must use the contract registry where migrated; boolean method-presence fields are observations, not behavioral proof.

## Capability status model

Every material host capability is one of:

### SUPPORTED

A real native primitive is observable and the adapter can reach it with sufficient semantics. Runtime detection records `verification_level=OBSERVED`; controlled or real-host acceptance is tracked separately and must never be inferred from method presence.

### DEGRADED

A real fallback exists but loses semantics. Loss is explicit.

Examples can include lack of PID/process lifecycle visibility for ordinary shell execution or limited host observation metadata.

### UNSUPPORTED

No safe primitive/fallback exists. Hi refuses to fake it.

Current OpenCode-Hi reference-host truth explicitly includes `workspace-isolation-binding=UNSUPPORTED`. Ordinary shell `process-lifecycle` is `DEGRADED`, not supported, because the adapter does not own PID/job wait/kill/exit lifecycle even though shell safety hooks exist.

## Capability contract candidates for OpenCode

```text
opencode.session.create
opencode.session.prompt.async
opencode.session.prompt.sync
opencode.session.abort
opencode.session.status
opencode.session.children
opencode.session.diff
opencode.session.todo
opencode.session.fork
opencode.session.summarize
opencode.session.revert
opencode.session.unrevert
opencode.provider.inventory
opencode.log.structured
opencode.agent.binding
opencode.skill.native-load
opencode.question.structured
opencode.shell.noninteractive
opencode.process.lifecycle
opencode.workspace.isolation-binding
```

Each receives an explicit status during implementation; this document does not declare untested capabilities SUPPORTED merely because the SDK has a method name.

## OpenCode agent projection

Source:

```text
RoleContract
+ PermissionProfile
+ Methodology compatibility
+ selected/default model policy
+ host capability constraints
```

Output contains only OpenCode-valid fields.

Current `bindHiOpenCodeAgents()` policy is retained as a strong fail-closed boundary during migration:

- absent canonical Hi name -> inject packaged projection;
- exact canonical projection -> accept idempotently;
- admitted `hi-project-*` skill permission extension -> tolerate;
- prompt/mode/other permission/foreign skill widening -> collision;
- plugin fails closed on collision.

Target improvement: binding compares against a projection generated from RoleContract rather than one generated from manually authored `roles/*.md` frontmatter.

## Primary agent identity

Actual `chat.message.agent` / host observation is authoritative for current executor identity. Config `primaryMode` selects default policy but cannot fabricate a runtime role different from the observed host agent.

Foreign host primary agents are not silently relabeled as Hi Manager/Working Manager.

## Model projection

Model policy produces requested/selected model + optional variant. Adapter passes this to host invocation. Hi records observed/effective host model metadata separately and detects mismatch.

Role and model remain independent contracts.

## Methodology projection

Methodology contract is host-independent HOW. OpenCode adapter maps an admitted methodology to native skill permission/load surfaces. Host skill names are projections of canonical methodology IDs.

A methodology that requires a missing host capability is ineligible or degraded according to its contract; the prompt must not pretend the primitive exists.

## Permission composition

Target composition order:

```text
constitutional safety constraints
∩ Role PermissionProfile
∩ task/action-specific restrictions
∩ host capability limitations
∩ admitted project extensions
∩ user/host permissions where they do not widen Hi safety
```

This is an intersection/narrowing model for safety. Host/user permission may make execution more restrictive; it cannot make Hi claim authority it does not have.

## Structured human interaction

If the host supports a structured question primitive, HumanDecisionContract may project to it. The adapter returns the structured response to the Human Decision owner. The host UI does not decide whether the response constitutes Authority.

## Shell/process boundary

Ordinary OpenCode bash may be a valid command executor without exposing durable process identity. Therefore:

- shell execution capability can be SUPPORTED;
- OpenCode 1.18.16 exposes a separate PTY lifecycle, but `process.lifecycle` for ordinary model-facing bash remains DEGRADED unless Hi explicitly routes that execution through an owned PTY adapter;
- retries/cleanup cannot claim PID-level guarantees for ordinary bash merely because the host also exposes PTY primitives.

## Workspace isolation boundary

Creating a git worktree is insufficient. OpenCode 1.18.16 also exposes workspace/session `workspaceID` and warp primitives, but `workspace.isolation-binding` becomes SUPPORTED only when Hi owns the selection/provisioning/cleanup path and subsequent child/tool execution is demonstrably bound inside the isolated workspace. The retired `hi-workspace-isolation` methodology is not a substitute for that control-plane capability.

## Team boundary

Team is a Hi projection over canonical TaskRuntime workers. OpenCode child sessions execute team members; there is no separate mailbox/board primitive unless a future host capability and ADR introduce one.

## Host version drift

Host capability/projection acceptance records OpenCode version/build. On version change:

1. structural adapter compilation is insufficient;
2. affected native primitive/projection tests rerun;
3. status may downgrade SUPPORTED -> DEGRADED/UNSUPPORTED;
4. doctor reports unvalidated version/capability state;
5. Hi does not silently preserve stale claims.

## Additional host adapters

A future host adapter must implement the same bounded interfaces:

```text
AgentProjectionAdapter
Session/WorkerAdapter
MethodologyAdapter
ModelObservationAdapter
HumanInteractionAdapter
CapabilityRegistry
Evidence/Artifact bridge where needed
```

It may use different native primitives while preserving Hi contract semantics. Lowest-common-denominator design is not required; capability status handles differences explicitly.

## Acceptance gate

Host projection architecture is complete only when:

- capability registry is contract-backed;
- OpenCode agent projection is generated from RoleContract;
- binding parity remains fail-closed;
- selected vs observed role/model identity is tested;
- methodology native load is tested;
- degraded/unsupported capabilities have negative acceptance tests;
- real-host acceptance exists for material primitives before release claims.

## Implemented registry invariants

The M7 registry currently maps 16 product-level OpenCode capabilities. Each entry carries status, observation verification level, acceptance reference, semantic loss/fallback when degraded, and a forbidden-fake-behavior statement. Unsupported capabilities cannot carry a native primitive or adapter entrypoint.

Two runtime gates already consume the registry directly: Team tool exposure requires `worker-runtime=SUPPORTED`, and native temporary-mutation revert requires `session-revert=SUPPORTED`. Doctor exposes capability counts and the explicit process/workspace limitations. M12 remains responsible for upgrading proof from local controlled evidence to exact-version real-host receipts.
